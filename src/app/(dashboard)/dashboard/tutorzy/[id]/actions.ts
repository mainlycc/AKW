'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/actions/auth'
import {
  createBookedSlot,
  cancelBookedSlot,
  assertTutorWeeklySlotAvailable,
} from '@/lib/actions/booked-slots'
import {
  isSessionDisplaySlot,
  toSessionDisplaySlotId,
  SESSION_SLOT_ID_PREFIX,
} from '@/lib/utils/booked-slot-helpers'
import type { BookedSlot } from '@/lib/types/booked-slots.types'
import { createAssignment } from '../../przypisania/actions'
import { createStudent } from '../../uczniowie/actions'
import { getNextOccurrenceForWeekday } from '@/lib/utils/availability-helpers'
import { SLOT_DURATION_MINUTES } from '@/lib/types/availability.types'
import type { DayOfWeek } from '@/lib/types/availability.types'
import type { MonitoringMeta } from '@/lib/monitoring/correlation'
import {
  fetchParentInfoForStudent,
  type ReservationNotificationContext,
} from './notification-actions'

export type ReserveTutorSlotInput = {
  tutorId: string
  weekday: DayOfWeek
  startTime: string
  endTime: string
  isRecurring: boolean
  studentMode: 'existing' | 'new'
  studentId?: string
  newStudent?: {
    first_name: string
    last_name: string
    parent_email: string
  }
  subject_id: string
  subject_level_id: string
  hourlyRate?: number | null
}

export type { ReservationNotificationContext }

async function buildNotificationContext(params: {
  bookedSlotId: string
  studentId: string
  tutorId: string
  isRecurring: boolean
  weekday: DayOfWeek
  startTime: string
  endTime: string
  subject_id: string
  subject_level_id: string
  nextOccurrenceDate?: string
  hourlyRate?: number | null
}): Promise<ReservationNotificationContext> {
  const supabase = await createClient()

  const [studentResult, tutorResult, subjectResult, levelResult, parentInfo] = await Promise.all([
    supabase
      .from('students')
      .select('first_name, last_name')
      .eq('id', params.studentId)
      .single(),
    supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', params.tutorId)
      .single(),
    supabase.from('subjects').select('name').eq('id', params.subject_id).single(),
    supabase.from('subject_levels').select('level_name').eq('id', params.subject_level_id).single(),
    fetchParentInfoForStudent(params.studentId),
  ])

  const student = studentResult.data
  const tutor = tutorResult.data

  return {
    bookedSlotId: params.bookedSlotId,
    studentId: params.studentId,
    tutorId: params.tutorId,
    isRecurring: params.isRecurring,
    weekday: params.weekday,
    startTime: params.startTime,
    endTime: params.endTime,
    studentName: `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim(),
    subjectName: subjectResult.data?.name ?? 'Przedmiot',
    levelName: levelResult.data?.level_name ?? 'Poziom',
    parentEmail: parentInfo.parentEmail,
    parentPhone: parentInfo.parentPhone,
    parentName: parentInfo.parentName,
    tutorName: tutor?.full_name ?? 'Tutor',
    tutorEmail: tutor?.email ?? '',
    tutorPhone: tutor?.phone ?? null,
    nextOccurrenceDate: params.nextOccurrenceDate,
    hourlyRate: params.hourlyRate ?? null,
  }
}

async function assertAdmin() {
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'admin') {
    throw new Error('Brak uprawnień administratora')
  }
  return profile
}

async function resolveAssignmentId(params: {
  studentId: string
  tutorId: string
  subject_id: string
  subject_level_id: string
  assignedBy: string
}): Promise<string> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('student_assignments')
    .select('id')
    .eq('student_id', params.studentId)
    .eq('tutor_id', params.tutorId)
    .eq('subject_id', params.subject_id)
    .eq('subject_level_id', params.subject_level_id)
    .eq('status', 'active')
    .maybeSingle()

  if (existing?.id) {
    return existing.id
  }

  await createAssignment({
    student_id: params.studentId,
    tutor_id: params.tutorId,
    subject_id: params.subject_id,
    subject_level_id: params.subject_level_id,
    assigned_by: params.assignedBy,
  })

  const { data: created, error } = await supabase
    .from('student_assignments')
    .select('id')
    .eq('student_id', params.studentId)
    .eq('tutor_id', params.tutorId)
    .eq('subject_id', params.subject_id)
    .eq('subject_level_id', params.subject_level_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !created) {
    throw new Error('Nie udało się utworzyć przypisania')
  }

  return created.id
}

export async function reserveTutorSlot(input: ReserveTutorSlotInput) {
  const admin = await assertAdmin()

  let studentId = input.studentId

  if (input.studentMode === 'new') {
    if (!input.newStudent?.first_name?.trim() || !input.newStudent?.last_name?.trim()) {
      throw new Error('Imię i nazwisko ucznia są wymagane')
    }
    if (!input.newStudent.parent_email?.trim()) {
      throw new Error('Email rodzica jest wymagany')
    }

    const student = await createStudent(
      {
        first_name: input.newStudent.first_name.trim(),
        last_name: input.newStudent.last_name.trim(),
      },
      {
        first_name: 'Rodzic',
        last_name: input.newStudent.last_name.trim(),
        email: input.newStudent.parent_email.trim(),
        phone: '',
      }
    )
    studentId = student.id
  }

  if (!studentId) {
    throw new Error('Wybierz ucznia')
  }

  let assignmentId: string

  if (input.studentMode === 'existing') {
    const supabase = await createClient()
    const { data: existing, error } = await supabase
      .from('student_assignments')
      .select('id')
      .eq('student_id', studentId)
      .eq('tutor_id', input.tutorId)
      .eq('subject_id', input.subject_id)
      .eq('subject_level_id', input.subject_level_id)
      .eq('status', 'active')
      .maybeSingle()

    if (error) throw error
    if (!existing) {
      throw new Error(
        'Wybrany przedmiot i poziom nie są przypisane do tego ucznia u tego tutora.'
      )
    }
    assignmentId = existing.id
  } else {
    assignmentId = await resolveAssignmentId({
      studentId,
      tutorId: input.tutorId,
      subject_id: input.subject_id,
      subject_level_id: input.subject_level_id,
      assignedBy: admin.id,
    })
  }

  const meta: MonitoringMeta = {
    route: `/dashboard/tutorzy/${input.tutorId}`,
  }

  if (input.isRecurring) {
    const bookedSlot = await createBookedSlot(
      admin.id,
      {
        student_assignment_id: assignmentId,
        weekday: input.weekday,
        start_time: input.startTime,
        end_time: input.endTime,
      },
      meta
    )

    revalidatePath(`/dashboard/tutorzy/${input.tutorId}`)
    revalidatePath('/dashboard/kalendarz-lekcji')
    revalidatePath('/dashboard/dostepnosc-tutorow')

    const notificationContext = await buildNotificationContext({
      bookedSlotId: bookedSlot.id,
      studentId,
      tutorId: input.tutorId,
      isRecurring: true,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      subject_id: input.subject_id,
      subject_level_id: input.subject_level_id,
      hourlyRate: input.hourlyRate,
    })

    return { success: true as const, bookedSlot, notificationContext }
  }

  await assertTutorWeeklySlotAvailable(input.tutorId, input.weekday, input.startTime)

  const supabase = await createClient()
  const { sessionDateIso } = getNextOccurrenceForWeekday(input.weekday, input.startTime)

  const { data: session, error } = await supabase
    .from('tutoring_sessions')
    .insert({
      assignment_id: assignmentId,
      tutor_id: input.tutorId,
      student_id: studentId,
      session_date: sessionDateIso,
      duration_minutes: SLOT_DURATION_MINUTES,
      status: 'scheduled',
      notes: 'Rezerwacja admina (jednorazowa)',
      created_by: admin.id,
    })
    .select(`
      id,
      assignment_id,
      student_assignments (*,
        students (id, first_name, last_name),
        subjects (id, name),
        subject_levels (id, level_name)
      )
    `)
    .single()

  if (error || !session) {
    throw error ?? new Error('Nie udało się utworzyć sesji')
  }

  const bookedSlot: BookedSlot = {
    id: toSessionDisplaySlotId(session.id),
    tutor_id: input.tutorId,
    student_assignment_id: session.assignment_id,
    weekday: input.weekday,
    start_time: input.startTime.substring(0, 5),
    end_time: input.endTime.substring(0, 5),
    status: 'booked',
    created_by: admin.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    student_assignments: session.student_assignments,
  } as unknown as BookedSlot

  revalidatePath(`/dashboard/tutorzy/${input.tutorId}`)
  revalidatePath('/dashboard/kalendarz-lekcji')
  revalidatePath('/dashboard/dostepnosc-tutorow')

  const notificationContext = await buildNotificationContext({
    bookedSlotId: bookedSlot.id,
    studentId,
    tutorId: input.tutorId,
    isRecurring: false,
    weekday: input.weekday,
    startTime: input.startTime,
    endTime: input.endTime,
    subject_id: input.subject_id,
    subject_level_id: input.subject_level_id,
    nextOccurrenceDate: sessionDateIso,
    hourlyRate: input.hourlyRate,
  })

  return { success: true as const, bookedSlot, notificationContext }
}

export async function cancelTutorBookedSlot(slotId: string, tutorId: string) {
  await assertAdmin()

  if (isSessionDisplaySlot(slotId)) {
    const sessionId = slotId.slice(SESSION_SLOT_ID_PREFIX.length)
    const supabase = await createClient()
    const { error } = await supabase
      .from('tutoring_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId)
    if (error) throw error
  } else {
    await cancelBookedSlot(slotId, { route: `/dashboard/tutorzy/${tutorId}` })
  }

  revalidatePath(`/dashboard/tutorzy/${tutorId}`)
  revalidatePath('/dashboard/kalendarz-lekcji')
  return { success: true as const }
}
