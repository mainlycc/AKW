'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface CreateBookedSlotInput {
  student_assignment_id: string
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  start_time: string // HH:MM
  end_time: string   // HH:MM
}

export type BookedSlotStatus = 'booked' | 'cancelled'

export interface BookedSlot {
  id: string
  tutor_id: string
  student_assignment_id: string
  weekday: number
  start_time: string
  end_time: string
  status: BookedSlotStatus
  created_by: string
  created_at: string
  updated_at: string
  // enriched
  students?: { id: string; first_name: string; last_name: string } | null
  profiles?: { id: string; full_name: string } | null
  subjects?: { id: string; name: string } | null
  subject_levels?: { id: string; level_name: string } | null
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
    .order('weekday')
    .order('start_time')

  if (params.scope === 'tutor' && params.tutorId) {
    query = query.eq('tutor_id', params.tutorId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as unknown as BookedSlot[]
}

export async function createBookedSlot(
  createdBy: string,
  input: CreateBookedSlotInput
) {
  const supabase = await createClient()

  // pobierz przypisanie, aby wyciągnąć tutora i zweryfikować spójność
  const { data: assignment, error: assErr } = await supabase
    .from('student_assignments')
    .select('id, tutor_id, status')
    .eq('id', input.student_assignment_id)
    .single()

  if (assErr || !assignment) {
    throw new Error('Nie znaleziono przypisania')
  }
  if (assignment.status !== 'active') {
    throw new Error('Przypisanie nie jest aktywne')
  }

  const { error } = await supabase.from('booked_slots').insert({
    tutor_id: assignment.tutor_id,
    student_assignment_id: input.student_assignment_id,
    weekday: input.weekday,
    start_time: input.start_time,
    end_time: input.end_time,
    status: 'booked',
    created_by: createdBy,
  })
  if (error) throw error

  revalidatePath('/dashboard/kalendarz')
}

export async function cancelBookedSlot(slotId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('booked_slots')
    .update({ status: 'cancelled' })
    .eq('id', slotId)
  if (error) throw error
  revalidatePath('/dashboard/kalendarz')
}


