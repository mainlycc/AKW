'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/actions/auth'
import { getSuggestedTimeSlots } from '@/lib/actions/availability'
import type { SuggestedTimeSlot } from '@/lib/types/availability.types'

export async function createSession(data: {
  assignment_id: string
  session_date: string
  duration_minutes: number
  notes: string
  created_by: string
}) {
  const supabase = await createClient()

  // Pobierz dane przypisania
  const { data: assignment } = await supabase
    .from('student_assignments')
    .select('student_id, tutor_id')
    .eq('id', data.assignment_id)
    .single()

  if (!assignment) {
    throw new Error('Assignment not found')
  }

  const { error } = await supabase.from('tutoring_sessions').insert({
    assignment_id: data.assignment_id,
    tutor_id: assignment.tutor_id,
    student_id: assignment.student_id,
    session_date: data.session_date,
    duration_minutes: data.duration_minutes,
    notes: data.notes || null,
    status: 'scheduled',
    created_by: data.created_by,
  })

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/sesje')
}

export async function deleteSession(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('tutoring_sessions').delete().eq('id', id)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/sesje')
}

export async function getSuggestedSessionTimes(params: {
  tutorId: string
  studentId: string
  durationMinutes?: number
}): Promise<SuggestedTimeSlot[]> {
  const { tutorId, studentId, durationMinutes = 60 } = params
  return getSuggestedTimeSlots(tutorId, studentId, durationMinutes)
}

export async function confirmSession(sessionId: string) {
  const supabase = await createClient()
  const profile = await getUserProfile()

  if (!profile) {
    throw new Error('Unauthorized')
  }

  // Sprawdź czy sesja należy do tutora
  const { data: session, error: fetchError } = await supabase
    .from('tutoring_sessions')
    .select('tutor_id, status')
    .eq('id', sessionId)
    .single()

  if (fetchError || !session) {
    throw new Error('Session not found')
  }

  // Tylko tutor może potwierdzić swoją sesję
  if (session.tutor_id !== profile.id) {
    throw new Error('Unauthorized - you can only confirm your own sessions')
  }

  // Tylko sesje ze statusem 'scheduled' można potwierdzić
  if (session.status !== 'scheduled') {
    throw new Error('Only scheduled sessions can be confirmed')
  }

  // Zaktualizuj status na 'completed'
  const { error } = await supabase
    .from('tutoring_sessions')
    .update({ status: 'completed' })
    .eq('id', sessionId)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/sesje')
}

