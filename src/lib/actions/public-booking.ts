'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CalendarSlot, DayOfWeek } from '@/lib/types/availability.types'
import { SLOT_DURATION_MINUTES } from '@/lib/types/availability.types'
import { generateCalendarSlots } from '@/lib/utils/availability-helpers'
import { addDays, format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { createNotification } from '@/lib/actions/notifications'
import { getDefaultStudentRate } from '@/app/(dashboard)/dashboard/stawki/actions'
import { sendBookingConfirmationEmail, sendTutorBookingNotificationEmail } from '@/lib/email/send'

interface TutorProfile {
  id: string
  full_name: string
  subjects?: { id: string; name: string } | null
}

export async function listPublicTutors(): Promise<TutorProfile[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, tutor_availability_templates(id)')
    .eq('role', 'tutor')
    .eq('public_booking_enabled', true)
    .order('full_name', { ascending: true })

  if (error) {
    throw error
  }

  const tutors = (data || []) as (TutorProfile & { tutor_availability_templates: { id: string }[] })[]

  return tutors
    .filter((tutor) => tutor.tutor_availability_templates?.length > 0)
    .map(({ tutor_availability_templates: _templates, ...rest }) => rest)
}

export interface PublicSubjectLevel {
  id: string
  name: string
  levels: { id: string; name: string }[]
}

export async function listPublicSubjects(): Promise<PublicSubjectLevel[]> {
  const supabase = await createClient()

  console.log('[listPublicSubjects] Starting to fetch subjects...')

  const { data: tutorLevels, error } = await supabase
    .from('tutor_subject_levels')
    .select(`
      tutor_id,
      subject_id,
      subject_level_id,
      subjects ( id, name, color ),
      subject_levels ( id, level_name )
    `)

  if (error) {
    console.error('[listPublicSubjects] Error fetching tutor_subject_levels:', error)
    throw error
  }

  console.log('[listPublicSubjects] Found tutor_subject_levels:', tutorLevels?.length || 0, tutorLevels)

  const tutorIds = Array.from(
    new Set((tutorLevels || []).map((row) => row.tutor_id).filter((id): id is string => !!id))
  )

  console.log('[listPublicSubjects] Unique tutor IDs:', tutorIds.length, tutorIds)

  if (tutorIds.length === 0) {
    console.log('[listPublicSubjects] No tutors found - returning empty array')
    return []
  }

  const { data: activeTemplates, error: templatesError } = await supabase
    .from('tutor_availability_templates')
    .select('tutor_id')
    .eq('is_active', true)
    .in('tutor_id', tutorIds)

  if (templatesError) {
    console.error('[listPublicSubjects] Error fetching tutor_availability_templates:', templatesError)
    throw templatesError
  }

  console.log('[listPublicSubjects] Found active templates:', activeTemplates?.length || 0, activeTemplates)

  const activeTutorIds = new Set(
    (activeTemplates || []).map((template) => template.tutor_id).filter((id): id is string => !!id)
  )

  // Per-tutor toggle: only include tutors enabled for public bookings
  const { data: enabledTutorRows, error: enabledTutorsError } = await supabase
    .from('profiles')
    .select('id')
    .in('id', Array.from(activeTutorIds))
    .eq('public_booking_enabled', true)

  if (enabledTutorsError) {
    console.error('[listPublicSubjects] Error fetching enabled tutors:', enabledTutorsError)
    throw enabledTutorsError
  }

  const enabledTutorIdSet = new Set(
    (enabledTutorRows || []).map((row) => row.id).filter((id): id is string => !!id)
  )

  console.log('[listPublicSubjects] Active tutor IDs:', activeTutorIds.size, Array.from(activeTutorIds))

  if (activeTutorIds.size === 0 || enabledTutorIdSet.size === 0) {
    console.log('[listPublicSubjects] No active templates found - returning empty array')
    return []
  }

  const subjectsMap = new Map<string, PublicSubjectLevel>()

  for (const row of tutorLevels || []) {
    if (!row.tutor_id || !activeTutorIds.has(row.tutor_id) || !enabledTutorIdSet.has(row.tutor_id)) {
      continue
    }

    // Supabase zwraca relacje jako tablice, więc wyciągamy pierwszy element
    const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects
    const level = Array.isArray(row.subject_levels) ? row.subject_levels[0] : row.subject_levels
    if (!subject || !level) {
      console.warn('[listPublicSubjects] Missing subject or level in row:', row)
      continue
    }

    if (!subjectsMap.has(subject.id)) {
      subjectsMap.set(subject.id, {
        id: subject.id,
        name: subject.name,
        levels: [],
      })
    }

    const subjectEntry = subjectsMap.get(subject.id)!
    if (!subjectEntry.levels.some((lvl) => lvl.id === level.id)) {
      subjectEntry.levels.push({
        id: level.id,
        name: level.level_name,
      })
    }
  }

  const subjects = Array.from(subjectsMap.values())
    .map((subject) => ({
      ...subject,
      levels: subject.levels.sort((a, b) => a.name.localeCompare(b.name, 'pl')),
    }))
    .filter((subject) => subject.levels.length > 0)

  console.log('[listPublicSubjects] Returning subjects:', subjects.length, subjects)

  return subjects.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
}

export interface GetTutorOpenSlotsParams {
  tutorId: string
  startDate: string // yyyy-mm-dd inclusive
  endDate: string // yyyy-mm-dd inclusive
}

export async function getTutorOpenSlots({
  tutorId,
  startDate,
  endDate,
}: GetTutorOpenSlotsParams): Promise<CalendarSlot[]> {
  const supabase = await createClient()

  // Per-tutor toggle: block public slot generation when disabled
  const { data: tutorFlag, error: tutorFlagError } = await supabase
    .from('profiles')
    .select('public_booking_enabled')
    .eq('id', tutorId)
    .maybeSingle()

  if (tutorFlagError) {
    console.error(`[getTutorOpenSlots] Error fetching tutor flag for tutor ${tutorId}:`, tutorFlagError)
    throw tutorFlagError
  }

  if (tutorFlag?.public_booking_enabled === false) {
    return []
  }

  const { data: template, error: templateError } = await supabase
    .from('tutor_availability_templates')
    .select('id')
    .eq('tutor_id', tutorId)
    .eq('is_active', true)
    .single()

  if (templateError || !template) {
    return []
  }

  const { data: tutorProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', tutorId)
    .single()

  const { data: templateSlots, error: slotsError } = await supabase
    .from('tutor_availability_slots')
    .select('day_of_week, start_time, end_time, is_available')
    .eq('template_id', template.id)
    .order('day_of_week')
    .order('start_time')

  if (slotsError) {
    console.error(`[getTutorOpenSlots] Error fetching template slots for tutor ${tutorId}:`, slotsError)
    throw slotsError
  }

  console.log(`[getTutorOpenSlots] Tutor ${tutorId}: Found ${templateSlots?.length || 0} template slots`)

  const blockedWeekdaySet = new Set<string>()
  const blockedDateSet = new Set<string>()

  const { data: bookedSlots, error: bookedError } = await supabase
    .from('booked_slots')
    .select('weekday, start_time, end_time')
    .eq('tutor_id', tutorId)
    .eq('status', 'booked')

  if (bookedError) {
    console.error(`[getTutorOpenSlots] Error fetching booked slots for tutor ${tutorId}:`, bookedError)
    throw bookedError
  }

  console.log(`[getTutorOpenSlots] Tutor ${tutorId}: Found ${bookedSlots?.length || 0} booked slots`)

  for (const slot of bookedSlots || []) {
    const key = `${slot.weekday}-${slot.start_time.slice(0, 5)}`
    blockedWeekdaySet.add(key)
  }

  // Block pending and confirmed one-time requests by specific date
  const { data: dateBlockedRequests, error: requestsError } = await supabase
    .from('public_booking_requests')
    .select('request_date, start_time, status, is_recurring')
    .eq('tutor_id', tutorId)
    .in('status', ['pending', 'confirmed'])

  if (requestsError) {
    console.error(`[getTutorOpenSlots] Error fetching booking requests for tutor ${tutorId}:`, requestsError)
    throw requestsError
  }

  console.log(`[getTutorOpenSlots] Tutor ${tutorId}: Found ${dateBlockedRequests?.length || 0} active booking requests`)

  for (const request of dateBlockedRequests || []) {
    if (request.status === 'pending' || request.is_recurring === false) {
      const key = `${request.request_date}-${request.start_time.slice(0, 5)}`
      blockedDateSet.add(key)
    }
  }

  const baseSlots = generateCalendarSlots({
    startDate,
    endDate,
    templateSlots:
      templateSlots?.map((slot) => ({
        day: slot.day_of_week as DayOfWeek,
        startTime: slot.start_time,
        endTime: slot.end_time,
        isAvailable: slot.is_available,
      })) || [],
    blockedWeekdayKeys: blockedWeekdaySet,
    blockedDateKeys: blockedDateSet,
  })

  const availableCount = baseSlots.filter((slot) => slot.isAvailable).length
  console.log(`[getTutorOpenSlots] Tutor ${tutorId}: Generated ${baseSlots.length} slots, ${availableCount} available (${blockedWeekdaySet.size} blocked by weekday, ${blockedDateSet.size} blocked by date)`)

  return baseSlots.map((slot) => ({
    ...slot,
    tutorId,
    tutorName: tutorProfile?.full_name,
  }))
}

export interface GetSubjectLevelSlotsParams {
  subjectLevelId: string
  startDate: string
  endDate: string
}

export interface SubjectLevelSlot extends CalendarSlot {
  tutorId: string
  tutorName?: string
}

export async function getSubjectLevelOpenSlots({
  subjectLevelId,
  startDate,
  endDate,
}: GetSubjectLevelSlotsParams): Promise<SubjectLevelSlot[]> {
  const supabase = await createClient()

  const { data: tutorRows, error } = await supabase
    .from('tutor_subject_levels')
    .select('tutor_id')
    .eq('subject_level_id', subjectLevelId)

  if (error) {
    console.error('Error fetching tutor_subject_levels:', error)
    throw error
  }

  const tutorIds = Array.from(
    new Set((tutorRows || []).map((row) => row.tutor_id).filter((id): id is string => !!id))
  )

  console.log('[getSubjectLevelOpenSlots] Found tutors for subject level:', tutorIds.length, tutorIds)

  if (tutorIds.length === 0) {
    console.log('[getSubjectLevelOpenSlots] No tutors found for subject level')
    return []
  }

  // Per-tutor toggle: only include tutors enabled for public bookings
  const { data: enabledTutors, error: enabledTutorsError } = await supabase
    .from('profiles')
    .select('id')
    .in('id', tutorIds)
    .eq('public_booking_enabled', true)

  if (enabledTutorsError) {
    console.error('[getSubjectLevelOpenSlots] Error fetching enabled tutors:', enabledTutorsError)
    throw enabledTutorsError
  }

  const enabledTutorIds = new Set(
    (enabledTutors || []).map((row) => row.id).filter((id): id is string => !!id)
  )

  const { data: activeTemplates, error: templatesError } = await supabase
    .from('tutor_availability_templates')
    .select('tutor_id')
    .eq('is_active', true)
    .in('tutor_id', tutorIds)

  if (templatesError) {
    console.error('Error fetching tutor_availability_templates:', templatesError)
    throw templatesError
  }

  const activeTutorIds = Array.from(
    new Set(
      (activeTemplates || []).map((template) => template.tutor_id).filter((id): id is string => !!id)
    )
  )

  const activeAndEnabledTutorIds = activeTutorIds.filter((id) => enabledTutorIds.has(id))

  console.log('[getSubjectLevelOpenSlots] Found active templates for tutors:', activeTutorIds.length, activeTutorIds)
  console.log('[getSubjectLevelOpenSlots] Enabled tutors for public booking:', activeAndEnabledTutorIds.length, activeAndEnabledTutorIds)

  if (activeAndEnabledTutorIds.length === 0) {
    console.log('[getSubjectLevelOpenSlots] No active templates found')
    return []
  }

  const slots: SubjectLevelSlot[] = []

  // Podwójne sprawdzenie - upewniamy się, że każdy tutor faktycznie prowadzi dany poziom
  const verifiedTutorIds = new Set(activeAndEnabledTutorIds.filter((tutorId) => 
    tutorIds.includes(tutorId)
  ))

  if (verifiedTutorIds.size !== activeTutorIds.length) {
    console.warn('[getSubjectLevelOpenSlots] Some tutors were filtered out:', {
      activeTutorIds: activeTutorIds.length,
      verifiedTutorIds: verifiedTutorIds.size,
    })
  }

  const slotGroups = await Promise.all(
    Array.from(verifiedTutorIds).map(async (tutorId) => {
      const tutorSlots = await getTutorOpenSlots({ tutorId, startDate, endDate })
      const availableSlots = tutorSlots.filter((slot) => slot.isAvailable)
      console.log(`[getSubjectLevelOpenSlots] Tutor ${tutorId}: ${availableSlots.length} available slots out of ${tutorSlots.length} total`)
      return availableSlots
    })
  )

  for (const group of slotGroups) {
    for (const slot of group) {
      // Dodatkowe sprawdzenie - upewniamy się, że tutorId jest w zweryfikowanej liście
      if (slot.tutorId && verifiedTutorIds.has(slot.tutorId)) {
        slots.push({
          ...slot,
          tutorId: slot.tutorId,
          tutorName: slot.tutorName,
        })
      } else {
        console.warn('[getSubjectLevelOpenSlots] Skipping slot with invalid tutorId:', slot.tutorId)
      }
    }
  }

  const minBookingDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const bookableSlots = slots.filter((slot) => slot.date >= minBookingDate)

  console.log(`[getSubjectLevelOpenSlots] Returning ${bookableSlots.length} total available slots`)

  return bookableSlots.sort((a, b) => {
    if (a.date === b.date) {
      return a.startTime.localeCompare(b.startTime)
    }
    return a.date.localeCompare(b.date)
  })
}

export interface PublicBookingPayload {
  tutorId: string
  date: string // yyyy-mm-dd
  startTime: string // HH:MM
  subjectId: string
  subjectLevelId: string
  studentFirstName: string
  studentLastName: string
  contactEmail: string
  contactPhone?: string
  notes?: string
  isRecurring: boolean
}

export interface PublicBookingResource {
  id: string
  assignment_id: string | null
  booked_slot_id: string | null
  session_id: string | null
  tutor_id: string
  student_id: string | null
  request_date: string
  weekday: number
  start_time: string
  end_time: string
  is_recurring: boolean
}

function combineBookingDateAndStartTime(requestDate: string, startTime: string): string {
  const time = startTime?.substring(0, 5) || '00:00'
  return `${requestDate}T${time}:00`
}

/**
 * Create tutoring_sessions / booked_slots for confirmed public bookings that are missing them.
 */
export async function syncMissingSessionsForConfirmedPublicBookings(
  admin: ReturnType<typeof createAdminClient>
): Promise<number> {
  const { data: bookings, error } = await admin
    .from('public_booking_requests')
    .select(
      'id, assignment_id, booked_slot_id, session_id, tutor_id, student_id, request_date, weekday, start_time, end_time, is_recurring'
    )
    .eq('status', 'confirmed')
    .or('session_id.is.null,booked_slot_id.is.null')

  if (error || !bookings) {
    console.error('[syncMissingSessionsForConfirmedPublicBookings] Query failed:', error)
    return 0
  }

  let synced = 0

  for (const booking of bookings) {
    const needsOneTimeSession =
      !booking.is_recurring && !booking.session_id && booking.assignment_id && booking.student_id
    const needsRecurringSlot =
      booking.is_recurring && !booking.booked_slot_id && booking.assignment_id

    if (!needsOneTimeSession && !needsRecurringSlot) {
      continue
    }

    try {
      await createConfirmedBookingResources(admin, {
        id: booking.id,
        assignment_id: booking.assignment_id,
        booked_slot_id: booking.booked_slot_id,
        session_id: booking.session_id,
        tutor_id: booking.tutor_id,
        student_id: booking.student_id,
        request_date: booking.request_date,
        weekday: booking.weekday,
        start_time: booking.start_time,
        end_time: booking.end_time,
        is_recurring: booking.is_recurring ?? false,
      })
      synced++
    } catch (syncError) {
      console.error(
        '[syncMissingSessionsForConfirmedPublicBookings] Failed for booking:',
        booking.id,
        syncError
      )
    }
  }

  return synced
}

export async function createConfirmedBookingResources(
  admin: ReturnType<typeof createAdminClient>,
  booking: PublicBookingResource
): Promise<void> {
  if (booking.is_recurring) {
    if (booking.booked_slot_id || !booking.assignment_id) {
      return
    }

    const { data: existingSlot } = await admin
      .from('booked_slots')
      .select('id, status')
      .eq('tutor_id', booking.tutor_id)
      .eq('student_assignment_id', booking.assignment_id)
      .eq('weekday', booking.weekday)
      .eq('start_time', booking.start_time)
      .eq('end_time', booking.end_time)
      .maybeSingle()

    if (existingSlot) {
      if (existingSlot.status !== 'booked') {
        const { error: slotUpdateError } = await admin
          .from('booked_slots')
          .update({ status: 'booked' })
          .eq('id', existingSlot.id)

        if (slotUpdateError) {
          throw slotUpdateError
        }
      }

      await admin
        .from('public_booking_requests')
        .update({ booked_slot_id: existingSlot.id })
        .eq('id', booking.id)
      return
    }

    const { data: occupiedByOther } = await admin
      .from('booked_slots')
      .select('id')
      .eq('tutor_id', booking.tutor_id)
      .eq('weekday', booking.weekday)
      .eq('start_time', booking.start_time)
      .eq('status', 'booked')
      .maybeSingle()

    if (occupiedByOther) {
      throw new Error('Ten termin jest już zajęty przez innego ucznia.')
    }

    const { data: newSlot, error: slotInsertError } = await admin
      .from('booked_slots')
      .insert({
        tutor_id: booking.tutor_id,
        student_assignment_id: booking.assignment_id,
        weekday: booking.weekday,
        start_time: booking.start_time,
        end_time: booking.end_time,
        status: 'booked',
        created_by: booking.tutor_id,
      })
      .select('id')
      .single()

    if (slotInsertError || !newSlot) {
      throw slotInsertError ?? new Error('Nie udało się utworzyć cyklicznej rezerwacji slotu.')
    }

    await admin
      .from('public_booking_requests')
      .update({ booked_slot_id: newSlot.id })
      .eq('id', booking.id)
    return
  }

  if (booking.session_id || !booking.assignment_id || !booking.student_id) {
    return
  }

  const { data: newSession, error: sessionInsertError } = await admin
    .from('tutoring_sessions')
    .insert({
      assignment_id: booking.assignment_id,
      tutor_id: booking.tutor_id,
      student_id: booking.student_id,
      session_date: combineBookingDateAndStartTime(booking.request_date, booking.start_time),
      duration_minutes: SLOT_DURATION_MINUTES,
      status: 'scheduled',
      notes: 'Rezerwacja publiczna',
      created_by: booking.tutor_id,
    })
    .select('id')
    .single()

  if (sessionInsertError || !newSession) {
    throw sessionInsertError ?? new Error('Nie udało się utworzyć jednorazowej lekcji.')
  }

  await admin
    .from('public_booking_requests')
    .update({ session_id: newSession.id })
    .eq('id', booking.id)
}

export async function cancelConfirmedBookingResources(
  admin: ReturnType<typeof createAdminClient>,
  booking: Pick<PublicBookingResource, 'booked_slot_id' | 'session_id'>
): Promise<void> {
  if (booking.booked_slot_id) {
    const { error: slotCancelError } = await admin
      .from('booked_slots')
      .update({ status: 'cancelled' })
      .eq('id', booking.booked_slot_id)

    if (slotCancelError) {
      throw slotCancelError
    }
  }

  if (booking.session_id) {
    const { error: sessionCancelError } = await admin
      .from('tutoring_sessions')
      .update({ status: 'cancelled' })
      .eq('id', booking.session_id)

    if (sessionCancelError) {
      throw sessionCancelError
    }
  }
}

const normalizeTime = (time: string) => {
  const [h = '00', m = '00'] = time.split(':')
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

const capitalizeWord = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

const deriveParentNameFromContact = (contactEmail: string, studentLastName: string) => {
  const localPart = contactEmail.split('@')[0] || 'rodzic'
  const parts = localPart.replace(/[._+-]/g, ' ').split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return {
      first_name: capitalizeWord(parts[0]),
      last_name: parts.slice(1).map(capitalizeWord).join(' '),
    }
  }

  return {
    first_name: parts[0] ? capitalizeWord(parts[0]) : 'Rodzic',
    last_name: studentLastName.trim(),
  }
}

async function syncStudentContactFromBooking(
  admin: ReturnType<typeof createAdminClient>,
  studentId: string,
  studentLastName: string,
  contactEmail: string,
  contactPhone: string | null
) {
  const email = contactEmail.trim().toLowerCase()
  const phone = contactPhone?.trim() || null

  const { error: studentUpdateError } = await admin
    .from('students')
    .update({
      parent_email: email,
      parent_phone: phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', studentId)

  if (studentUpdateError) {
    throw studentUpdateError
  }

  const { data: existingParent, error: fetchParentError } = await admin
    .from('parents')
    .select('id, phone')
    .eq('email', email)
    .maybeSingle()

  if (fetchParentError) {
    throw fetchParentError
  }

  let parentId: string

  if (existingParent) {
    parentId = existingParent.id

    if (phone && phone !== existingParent.phone) {
      const { error: parentUpdateError } = await admin
        .from('parents')
        .update({
          phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parentId)

      if (parentUpdateError) {
        throw parentUpdateError
      }
    }
  } else {
    const { first_name, last_name } = deriveParentNameFromContact(email, studentLastName)

    const { data: newParent, error: parentInsertError } = await admin
      .from('parents')
      .insert({
        first_name,
        last_name,
        email,
        phone,
        parent_type: 'other',
      })
      .select('id')
      .single()

    if (parentInsertError || !newParent) {
      throw parentInsertError ?? new Error('Nie udało się utworzyć rekordu rodzica.')
    }

    parentId = newParent.id
  }

  const { data: existingLink, error: fetchLinkError } = await admin
    .from('student_parents')
    .select('id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (fetchLinkError) {
    throw fetchLinkError
  }

  if (!existingLink) {
    const { count, error: countError } = await admin
      .from('student_parents')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)

    if (countError) {
      throw countError
    }

    const { error: linkError } = await admin.from('student_parents').insert({
      parent_id: parentId,
      student_id: studentId,
      is_primary: (count || 0) === 0,
    })

    if (linkError) {
      throw linkError
    }
  }
}

/**
 * Calculate lesson price based on student's hourly rate or default rate
 * Price = hourly_rate * (SLOT_DURATION_MINUTES / 60)
 */
export async function calculateLessonPrice(studentId: string): Promise<number> {
  const admin = createAdminClient()

  // Get student's hourly rate
  const { data: student, error: studentError } = await admin
    .from('students')
    .select('hourly_rate')
    .eq('id', studentId)
    .single()

  if (studentError) {
    throw studentError
  }

  // Use student's hourly_rate or get default rate from system_settings
  let hourlyRate: number
  if (student?.hourly_rate) {
    hourlyRate = parseFloat(student.hourly_rate.toString())
  } else {
    hourlyRate = await getDefaultStudentRate()
  }

  // Calculate price: hourly_rate * (duration in hours)
  const durationInHours = SLOT_DURATION_MINUTES / 60
  const price = hourlyRate * durationInHours

  return price
}

export async function bookPublicSlot(payload: PublicBookingPayload) {
  const admin = createAdminClient()

  const today = format(new Date(), 'yyyy-MM-dd')
  if (payload.date <= today) {
    throw new Error('Na dzisiaj nie możesz rezerwować już lekcji. Wybierz termin od jutra.')
  }

  const firstName = payload.studentFirstName.trim()
  const lastName = payload.studentLastName.trim()
  const email = payload.contactEmail.trim().toLowerCase()
  const phone = payload.contactPhone?.trim() || null
  const notes = payload.notes?.trim() || null

  const startTime = normalizeTime(payload.startTime)
  const appointmentStart = new Date(`${payload.date}T${startTime}:00`)
  const appointmentEnd = new Date(appointmentStart)
  appointmentEnd.setMinutes(appointmentEnd.getMinutes() + SLOT_DURATION_MINUTES)
  const endTime = `${String(appointmentEnd.getHours()).padStart(2, '0')}:${String(appointmentEnd.getMinutes()).padStart(2, '0')}`
  const weekday = (((appointmentStart.getUTCDay() + 6) % 7) + 1) as DayOfWeek

  const { data: availabilityCheck, error: checkError } = await admin.rpc('is_tutor_slot_available', {
    p_tutor_id: payload.tutorId,
    p_date: payload.date,
    p_start: startTime,
    p_end: endTime,
  })

  if (checkError) {
    throw checkError
  }

  if (!availabilityCheck) {
    throw new Error('Wybrany termin jest już zajęty. Odśwież kalendarz i wybierz inny slot.')
  }

  // Per-tutor toggle: block booking when tutor is disabled for public bookings
  const { data: tutorFlag, error: tutorFlagError } = await admin
    .from('profiles')
    .select('public_booking_enabled')
    .eq('id', payload.tutorId)
    .maybeSingle()

  if (tutorFlagError) {
    throw tutorFlagError
  }

  if (tutorFlag?.public_booking_enabled === false) {
    throw new Error('Wybrany tutor nie jest dostępny w publicznych rezerwacjach. Wybierz inny termin.')
  }

  // Sprawdzenie czy tutor prowadzi dany poziom (zabezpieczenie - powinno być już przefiltrowane w getSubjectLevelOpenSlots)
  const { data: tutorSubjectLevel, error: tutorSubjectError } = await admin
    .from('tutor_subject_levels')
    .select('id')
    .eq('tutor_id', payload.tutorId)
    .eq('subject_level_id', payload.subjectLevelId)
    .maybeSingle()

  if (tutorSubjectError || !tutorSubjectLevel) {
    console.error('[bookPublicSlot] Tutor does not teach this level:', {
      tutorId: payload.tutorId,
      subjectLevelId: payload.subjectLevelId,
      error: tutorSubjectError,
    })
    throw tutorSubjectError ?? new Error('Wybrany tutor nie prowadzi tego poziomu. Odśwież stronę i wybierz inny termin.')
  }

  // Find or create student - używamy tej samej logiki co w innych miejscach (sprawdzanie po imieniu i nazwisku)
  // To zapobiega duplikatom uczniów
  const { data: existingStudent, error: fetchStudentError } = await admin
    .from('students')
    .select('id')
    .eq('first_name', firstName.trim())
    .eq('last_name', lastName.trim())
    .maybeSingle()

  if (fetchStudentError) {
    throw fetchStudentError
  }

  let studentId: string

  if (existingStudent) {
    studentId = existingStudent.id
  } else {
    // Get default rate from system_settings
    const defaultRate = await getDefaultStudentRate()
    
    const { data: newStudent, error: studentInsertError } = await admin
      .from('students')
      .insert({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        parent_email: email,
        parent_phone: phone,
        notes,
        rate_level: 1,
        hourly_rate_is_overridden: false,
        hourly_rate: defaultRate,
      })
      .select('id')
      .single()

    if (studentInsertError) {
      throw studentInsertError
    }
    studentId = newStudent.id
  }

  try {
    await syncStudentContactFromBooking(admin, studentId, lastName, email, phone)
  } catch (contactSyncError) {
    console.error('[bookPublicSlot] Failed to sync parent contact data:', contactSyncError)
    throw contactSyncError instanceof Error
      ? contactSyncError
      : new Error('Nie udało się zapisać danych kontaktowych rodzica.')
  }

  // Determine tutor subject/level to link assignment
  // Find or create assignment
  const { data: existingAssignment, error: fetchAssignmentError } = await admin
    .from('student_assignments')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('tutor_id', payload.tutorId)
    .eq('subject_level_id', payload.subjectLevelId)
    .maybeSingle()

  if (fetchAssignmentError) {
    throw fetchAssignmentError
  }

  let assignmentId: string
  let createdAssignment = false

  if (existingAssignment) {
    assignmentId = existingAssignment.id
    if (existingAssignment.status !== 'pending') {
      const { error: updateAssignmentStatusError } = await admin
        .from('student_assignments')
        .update({ status: 'pending' })
        .eq('id', assignmentId)

      if (updateAssignmentStatusError) {
        throw updateAssignmentStatusError
      }
    }
  } else {
    const { data: newAssignment, error: assignmentInsertError } = await admin
      .from('student_assignments')
      .insert({
        student_id: studentId,
        tutor_id: payload.tutorId,
        subject_id: payload.subjectId,
        subject_level_id: payload.subjectLevelId,
        assigned_by: payload.tutorId,
        status: 'pending',
      })
      .select('id')
      .single()

    if (assignmentInsertError) {
      throw assignmentInsertError
    }
    assignmentId = newAssignment.id
    createdAssignment = true
  }

  // Create booking request (without booked_slot - it will be created when confirmed)
  // We don't create booked_slot here because it would block the entire weekday
  // Instead, we use public_booking_requests to block specific dates
  const { data: bookingRequest, error: insertError } = await admin
    .from('public_booking_requests')
    .insert({
      tutor_id: payload.tutorId,
      student_id: studentId,
      assignment_id: assignmentId,
      booked_slot_id: null, // Will be set when confirmed
      subject_id: payload.subjectId,
      subject_level_id: payload.subjectLevelId,
      request_date: payload.date,
      weekday,
      start_time: startTime,
      end_time: endTime,
      student_first_name: firstName,
      student_last_name: lastName,
      contact_email: email,
      contact_phone: phone,
      notes,
      status: 'pending',
      is_recurring: payload.isRecurring,
    })
    .select()
    .single()

  if (insertError) {
    if (createdAssignment) {
      await admin.from('student_assignments').delete().eq('id', assignmentId)
    }
    throw insertError
  }

  if (!bookingRequest) {
    throw new Error('Nie udało się utworzyć rezerwacji.')
  }

  // Pobierz dane do powiadomienia (tutor, przedmiot, poziom)
  const [tutorData, subjectData, levelData] = await Promise.all([
    admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', payload.tutorId)
      .single(),
    admin
      .from('subjects')
      .select('name')
      .eq('id', payload.subjectId)
      .single(),
    admin
      .from('subject_levels')
      .select('level_name')
      .eq('id', payload.subjectLevelId)
      .single(),
  ])

  // Powiadomienie dla adminów o nowej rezerwacji (oczekującej na płatność)
  try {
    // Pobierz wszystkich adminów
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    if (admins && admins.length > 0 && tutorData.data && subjectData.data && levelData.data) {
      const formattedDate = format(parseISO(payload.date), 'd MMMM yyyy', { locale: pl })
      const timeRange = `${startTime.substring(0, 5)}-${endTime.substring(0, 5)}`
      const studentFullName = `${firstName} ${lastName}`

      // Utwórz powiadomienia dla wszystkich adminów
      await Promise.all(
        admins.map((adminProfile) =>
          createNotification({
            userId: adminProfile.id,
            type: 'public_booking_created',
            title: 'Nowa rezerwacja publiczna (oczekuje na płatność)',
            message: `${studentFullName} zarezerwował(a) termin ${formattedDate} ${timeRange} u tutora ${tutorData.data.full_name} (${subjectData.data.name} - ${levelData.data.level_name}) - oczekuje na płatność`,
            metadata: {
              booking_id: bookingRequest.id,
              tutor_id: payload.tutorId,
              student_name: studentFullName,
              date: payload.date,
              time: timeRange,
            },
          })
        )
      )
    }
  } catch (notificationError) {
    // Logujemy błąd, ale nie przerywamy procesu rezerwacji
    console.error('Failed to create notification:', notificationError)
  }

  // Wyślij email z potwierdzeniem rezerwacji (oczekującej na płatność)
  if (
    email &&
    tutorData.data &&
    subjectData.data &&
    levelData.data
  ) {
    try {
      const formattedDate = format(parseISO(payload.date), 'd MMMM yyyy', { locale: pl })
      const timeRange = `${startTime.substring(0, 5)}-${endTime.substring(0, 5)}`
      const studentFullName = `${firstName} ${lastName}`

      const emailResult = await sendBookingConfirmationEmail({
        to: email,
        studentName: studentFullName,
        tutorName: tutorData.data.full_name,
        subject: subjectData.data.name,
        level: levelData.data.level_name,
        date: formattedDate,
        time: timeRange,
        duration: SLOT_DURATION_MINUTES,
      })

      if (!emailResult.success) {
        console.error('Booking confirmation email failed:', {
          error: emailResult.error,
          email: email,
          bookingId: bookingRequest.id,
        })
      } else {
        console.log('Booking confirmation email sent successfully:', {
          messageId: emailResult.messageId,
          email: email,
          bookingId: bookingRequest.id,
        })
      }
    } catch (emailError) {
      // Logujemy błąd, ale nie przerywamy procesu rezerwacji
      console.error('Failed to send booking confirmation email:', {
        error: emailError instanceof Error ? emailError.message : String(emailError),
        email: email,
        bookingId: bookingRequest.id,
      })
    }
  }

  // Wyślij email z powiadomieniem do tutora o nowej rezerwacji
  if (
    tutorData.data?.email &&
    tutorData.data &&
    subjectData.data &&
    levelData.data
  ) {
    try {
      const formattedDate = format(parseISO(payload.date), 'd MMMM yyyy', { locale: pl })
      const timeRange = `${startTime.substring(0, 5)}-${endTime.substring(0, 5)}`
      const studentFullName = `${firstName} ${lastName}`

      const tutorEmailResult = await sendTutorBookingNotificationEmail({
        to: tutorData.data.email,
        tutorName: tutorData.data.full_name,
        studentName: studentFullName,
        subject: subjectData.data.name,
        level: levelData.data.level_name,
        date: formattedDate,
        time: timeRange,
        duration: SLOT_DURATION_MINUTES,
        contactEmail: email,
        contactPhone: phone,
        notes,
      })

      if (!tutorEmailResult.success) {
        console.error('Tutor booking notification email failed:', {
          error: tutorEmailResult.error,
          tutorEmail: tutorData.data.email,
          bookingId: bookingRequest.id,
        })
      } else {
        console.log('Tutor booking notification email sent successfully:', {
          messageId: tutorEmailResult.messageId,
          tutorEmail: tutorData.data.email,
          bookingId: bookingRequest.id,
        })
      }
    } catch (tutorEmailError) {
      // Logujemy błąd, ale nie przerywamy procesu rezerwacji
      console.error('Failed to send tutor booking notification email:', {
        error: tutorEmailError instanceof Error ? tutorEmailError.message : String(tutorEmailError),
        tutorEmail: tutorData.data.email,
        bookingId: bookingRequest.id,
      })
    }
  }

  revalidatePath('/public/rezerwacje')
  revalidatePath('/dashboard/rezerwacje-publiczne')
  revalidatePath('/dashboard/uczniowie')

  return bookingRequest
}


