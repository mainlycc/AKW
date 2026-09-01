'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractWeeklySlotFromSession, normalizeSlotTime } from '@/lib/utils/availability-helpers'
import { toSessionDisplaySlotId } from '@/lib/utils/booked-slot-helpers'
import type { BookedSlot, CreateBookedSlotInput } from '@/lib/types/booked-slots.types'
import { resolveCorrelationId, resolveRoute, type MonitoringMeta } from '@/lib/monitoring/correlation'
import { logSupabaseFailure } from '@/lib/monitoring/support-events'

type BookedSlotConflict = {
  taken: boolean
  studentName?: string
}

/** Sprawdza czy tutor ma już ucznia w danym cotygodniowym slocie (booked_slot lub scheduled session). */
export async function getTutorWeeklySlotConflict(
  tutorId: string,
  weekday: number,
  startTime: string
): Promise<BookedSlotConflict> {
  const admin = createAdminClient()
  const start = normalizeSlotTime(startTime)

  const { data: bookedSlots } = await admin
    .from('booked_slots')
    .select(`
      id,
      start_time,
      student_assignments (
        students (first_name, last_name)
      )
    `)
    .eq('tutor_id', tutorId)
    .eq('weekday', weekday)
    .eq('status', 'booked')

  for (const slot of bookedSlots ?? []) {
    if (normalizeSlotTime(slot.start_time) !== start) continue
    const stud = slot.student_assignments as unknown as
      | { students: { first_name: string; last_name: string } | null }
      | { students: { first_name: string; last_name: string } | null }[]
      | null
    const student = Array.isArray(stud) ? stud[0]?.students : stud?.students
    const name = student
      ? `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim()
      : undefined
    return { taken: true, studentName: name || undefined }
  }

  const { data: sessions } = await admin
    .from('tutoring_sessions')
    .select(`
      id,
      session_date,
      duration_minutes,
      students (first_name, last_name)
    `)
    .eq('tutor_id', tutorId)
    .eq('status', 'scheduled')

  for (const session of sessions ?? []) {
    const extracted = extractWeeklySlotFromSession(
      session.session_date,
      session.duration_minutes ?? 60
    )
    if (extracted.weekday !== weekday || extracted.start_time !== start) continue
    const student = session.students as
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null
    const s = Array.isArray(student) ? student[0] : student
    const name = s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() : undefined
    return { taken: true, studentName: name || undefined }
  }

  return { taken: false }
}

export async function assertTutorWeeklySlotAvailable(
  tutorId: string,
  weekday: number,
  startTime: string
): Promise<void> {
  const conflict = await getTutorWeeklySlotConflict(tutorId, weekday, startTime)
  if (conflict.taken) {
    throw new Error(
      conflict.studentName
        ? `Ten termin jest już zajęty przez ${conflict.studentName}. Wybierz inną godzinę.`
        : 'Ten termin jest już zajęty przez innego ucznia. Wybierz inną godzinę.'
    )
  }
}

export async function listBookedSlots(params: {
  scope: 'admin' | 'tutor'
  tutorId?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from('booked_slots')
    .select(`
      *,
      student_assignments (*,
        students (id, first_name, last_name),
        subjects (id, name),
        subject_levels (id, level_name)
      ),
      profiles!booked_slots_tutor_id_fkey (id, full_name)
    `)
    .eq('status', 'booked')
    .order('weekday')
    .order('start_time')

  // Filtruj po tutorId jeśli jest podane (dla obu scope: 'tutor' i 'admin')
  if (params.tutorId) {
    query = query.eq('tutor_id', params.tutorId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as unknown as BookedSlot[]
}

/** Booked slots + jednorazowe sesje bez booked_slot (do siatki tygodniowej). */
export async function listTutorCalendarOccupancy(tutorId: string) {
  const booked = await listBookedSlots({ scope: 'admin', tutorId })
  const occupiedKeys = new Set(
    booked.map((b) => `${Number(b.weekday)}-${normalizeSlotTime(b.start_time)}`)
  )
  const bookedAssignmentTimeKeys = new Set(
    booked.map(
      (b) => `${b.student_assignment_id}-${normalizeSlotTime(b.start_time)}`
    )
  )

  const supabase = await createClient()
  const { data: sessions, error } = await supabase
    .from('tutoring_sessions')
    .select(`
      id,
      session_date,
      duration_minutes,
      assignment_id,
      student_assignments (*,
        students (id, first_name, last_name),
        subjects (id, name),
        subject_levels (id, level_name)
      )
    `)
    .eq('tutor_id', tutorId)
    .eq('status', 'scheduled')

  if (error) throw error

  const fromSessions: BookedSlot[] = []
  for (const session of sessions ?? []) {
    const extracted = extractWeeklySlotFromSession(
      session.session_date,
      session.duration_minutes ?? 60
    )
    const assignmentTimeKey = `${session.assignment_id}-${extracted.start_time}`
    if (bookedAssignmentTimeKeys.has(assignmentTimeKey)) continue

    const key = `${extracted.weekday}-${extracted.start_time}`
    if (occupiedKeys.has(key)) continue

    fromSessions.push({
      id: toSessionDisplaySlotId(session.id),
      tutor_id: tutorId,
      student_assignment_id: session.assignment_id,
      weekday: extracted.weekday,
      start_time: extracted.start_time,
      end_time: extracted.end_time,
      status: 'booked',
      created_by: '',
      created_at: '',
      updated_at: '',
      student_assignments: session.student_assignments,
    } as unknown as BookedSlot)
  }

  return [...booked, ...fromSessions]
}

export async function createBookedSlot(
  createdBy: string,
  input: CreateBookedSlotInput,
  meta?: MonitoringMeta
) {
  const supabase = await createClient()
  const correlationId = resolveCorrelationId(meta)
  const route = resolveRoute(meta)

  // pobierz przypisanie, aby wyciągnąć tutora i zweryfikować spójność
  const { data: assignment, error: assErr } = await supabase
    .from('student_assignments')
    .select('id, tutor_id, status')
    .eq('id', input.student_assignment_id)
    .single()

  if (assErr || !assignment) {
    if (assErr) {
      await logSupabaseFailure({
        action: 'booked_slots.assignment.fetch',
        correlationId,
        route,
        request: { student_assignment_id: input.student_assignment_id },
        supabaseError: assErr,
      })
    }
    throw new Error('Nie znaleziono przypisania')
  }
  if (assignment.status !== 'active') {
    throw new Error('Przypisanie nie jest aktywne')
  }

  const startTime = normalizeSlotTime(input.start_time)
  const endTime = normalizeSlotTime(input.end_time)

  await assertTutorWeeklySlotAvailable(assignment.tutor_id, input.weekday, startTime)

  const { data, error } = await supabase
    .from('booked_slots')
    .insert({
      tutor_id: assignment.tutor_id,
      student_assignment_id: input.student_assignment_id,
      weekday: input.weekday,
      start_time: startTime,
      end_time: endTime,
      status: 'booked',
      created_by: createdBy,
    })
    .select(`
      *,
      student_assignments (*,
        students (id, first_name, last_name),
        subjects (id, name),
        subject_levels (id, level_name)
      ),
      profiles!booked_slots_tutor_id_fkey (id, full_name)
    `)
    .single()

  if (error) {
    await logSupabaseFailure({
      action: 'booked_slots.insert',
      correlationId,
      route,
      request: { ...input, tutor_id: assignment.tutor_id, created_by: createdBy },
      supabaseError: error,
    })
    if (error.code === '23505') {
      throw new Error('Ten termin jest już zajęty przez innego ucznia. Wybierz inną godzinę.')
    }
    throw error
  }

  // Revaliduj kalendarz dostępności i kalendarz lekcji
  revalidatePath('/dashboard/kalendarz')
  revalidatePath('/dashboard/kalendarz-lekcji')
  if (route?.startsWith('/dashboard/tutorzy/')) {
    revalidatePath(route)
  }

  return data as unknown as BookedSlot
}

export async function cancelBookedSlot(slotId: string, meta?: MonitoringMeta) {
  const admin = createAdminClient()
  const correlationId = resolveCorrelationId(meta)
  const route = resolveRoute(meta)

  const { data: slot, error: fetchError } = await admin
    .from('booked_slots')
    .select('id, tutor_id, student_assignment_id, weekday, start_time, end_time, status')
    .eq('id', slotId)
    .maybeSingle()

  if (fetchError) {
    await logSupabaseFailure({
      action: 'booked_slots.cancel.fetch',
      correlationId,
      route,
      request: { slotId },
      supabaseError: fetchError,
    })
    throw fetchError
  }

  if (!slot || slot.status !== 'booked') {
    return
  }

  const { error } = await admin
    .from('booked_slots')
    .update({ status: 'cancelled' })
    .eq('id', slotId)

  if (error) {
    await logSupabaseFailure({
      action: 'booked_slots.cancel',
      correlationId,
      route,
      request: { slotId },
      supabaseError: error,
    })
    throw error
  }

  // Anuluj powiązane zaplanowane sesje (backup obok triggera DB)
  const slotStart = normalizeSlotTime(slot.start_time)

  try {
    await admin.rpc('cancel_future_sessions_for_booked_slot', {
      p_booked_slot_id: slotId,
    })
  } catch (rpcError) {
    console.warn('[cancelBookedSlot] RPC cancel_future_sessions_for_booked_slot failed:', rpcError)
  }

  const { data: sessions } = await admin
    .from('tutoring_sessions')
    .select('id, session_date, duration_minutes')
    .eq('tutor_id', slot.tutor_id)
    .eq('status', 'scheduled')

  for (const session of sessions ?? []) {
    const extracted = extractWeeklySlotFromSession(
      session.session_date,
      session.duration_minutes ?? 60
    )
    if (
      extracted.weekday === slot.weekday &&
      normalizeSlotTime(extracted.start_time) === slotStart
    ) {
      await admin
        .from('tutoring_sessions')
        .update({ status: 'cancelled' })
        .eq('id', session.id)
    }
  }

  revalidatePath('/dashboard/kalendarz')
  revalidatePath('/dashboard/kalendarz-lekcji')
  revalidatePath('/dashboard/tutorzy')
}

/**
 * Tworzy brakujące booked_slots na podstawie zaplanowanych sesji (tutoring_sessions).
 * Dzięki temu lekcje z kalendarza pojawiają się na wykresie dostępności tutora.
 */
export async function syncBookedSlotsFromScheduledSessions(tutorId?: string): Promise<number> {
  const admin = createAdminClient()

  let query = admin
    .from('tutoring_sessions')
    .select('id, tutor_id, assignment_id, session_date, duration_minutes, created_by')
    .eq('status', 'scheduled')

  if (tutorId) {
    query = query.eq('tutor_id', tutorId)
  }

  const { data: sessions, error } = await query
  if (error || !sessions?.length) {
    if (error) {
      console.error('[syncBookedSlotsFromScheduledSessions] Query failed:', error)
    }
    return 0
  }

  type SlotCandidate = {
    tutor_id: string
    assignment_id: string
    weekday: number
    start_time: string
    end_time: string
    created_by: string
    count: number
  }

  const slotMap = new Map<string, SlotCandidate>()

  for (const session of sessions) {
    const { weekday, start_time, end_time } = extractWeeklySlotFromSession(
      session.session_date,
      session.duration_minutes ?? 60
    )
    const key = `${session.tutor_id}-${weekday}-${start_time}-${end_time}`
    const existing = slotMap.get(key)

    if (existing) {
      existing.count++
      if (existing.assignment_id !== session.assignment_id) {
        // Preferuj przypisanie z większą liczbą sesji w tym slocie
        existing.assignment_id = session.assignment_id
      }
    } else {
      slotMap.set(key, {
        tutor_id: session.tutor_id,
        assignment_id: session.assignment_id,
        weekday,
        start_time,
        end_time,
        created_by: session.created_by,
        count: 1,
      })
    }
  }

  let synced = 0

  for (const slot of slotMap.values()) {
    const { data: existingSlots, error: lookupError } = await admin
      .from('booked_slots')
      .select('id, status, student_assignment_id, start_time, end_time')
      .eq('tutor_id', slot.tutor_id)
      .eq('weekday', slot.weekday)
      .eq('status', 'booked')

    if (lookupError) {
      console.error('[syncBookedSlotsFromScheduledSessions] Lookup failed:', lookupError)
      continue
    }

    const normalizeTime = (t: string) => t.substring(0, 5)
    const matchedActive = (existingSlots ?? []).find(
      (s) => normalizeTime(s.start_time) === slot.start_time
    )

    if (matchedActive) {
      continue
    }

    const { data: cancelledSlots, error: cancelledLookupError } = await admin
      .from('booked_slots')
      .select('id, start_time, end_time')
      .eq('tutor_id', slot.tutor_id)
      .eq('weekday', slot.weekday)
      .eq('status', 'cancelled')

    if (cancelledLookupError) {
      console.error('[syncBookedSlotsFromScheduledSessions] Cancelled lookup failed:', cancelledLookupError)
      continue
    }

    const cancelledSlot = (cancelledSlots ?? []).find(
      (s) => normalizeTime(s.start_time) === slot.start_time
    )

    if (cancelledSlot) {
      // Nie reaktywuj slotów celowo anulowanych przez użytkownika
      continue
    }

    const { data: assignment } = await admin
      .from('student_assignments')
      .select('id, status')
      .eq('id', slot.assignment_id)
      .single()

    if (!assignment || assignment.status !== 'active') {
      continue
    }

    const conflict = await getTutorWeeklySlotConflict(
      slot.tutor_id,
      slot.weekday,
      slot.start_time
    )
    if (conflict.taken) {
      continue
    }

    const { error: insertError } = await admin.from('booked_slots').insert({
      tutor_id: slot.tutor_id,
      student_assignment_id: slot.assignment_id,
      weekday: slot.weekday,
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: 'booked',
      created_by: slot.created_by,
    })

    if (insertError) {
      // Unikalność aktywnego slotu — inny uczeń w tym samym czasie
      if (insertError.code !== '23505') {
        console.error('[syncBookedSlotsFromScheduledSessions] Insert failed:', insertError)
      }
      continue
    }

    synced++
  }

  return synced
}

// Funkcja pomocnicza: generuje sesje dla wszystkich aktywnych booked_slots
// Przydatne gdy migracja została zastosowana po utworzeniu booked_slots
export async function generateSessionsForAllBookedSlots(
  startDate?: string,
  endDate?: string
): Promise<number> {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('generate_sessions_for_all_booked_slots', {
    p_start_date: startDate || new Date().toISOString().split('T')[0],
    p_end_date: endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  })
  
  if (error) throw error
  
  // Revaliduj kalendarz lekcji
  revalidatePath('/dashboard/kalendarz-lekcji')
  
  return data || 0
}


