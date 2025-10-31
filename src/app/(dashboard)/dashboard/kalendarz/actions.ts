'use server'

import { updateAvailabilityTemplate } from '@/lib/actions/availability'
import { createBookedSlot as createBookedSlotLib, listBookedSlots as listBookedSlotsLib, cancelBookedSlot as cancelBookedSlotLib } from '@/lib/actions/booked-slots'
import { createClient } from '@/lib/supabase/server'
import type { TimeSlot, TutorAvailabilityData } from '@/lib/types/availability.types'
import type { BookedSlot } from '@/lib/actions/booked-slots'

export async function saveAvailability(tutorId: string, slots: TimeSlot[]): Promise<TutorAvailabilityData> {
  return updateAvailabilityTemplate(tutorId, slots)
}

export async function listTutorBookedSlots(tutorId: string): Promise<BookedSlot[]> {
  return listBookedSlotsLib({ scope: 'tutor', tutorId })
}

export async function createBookedSlotAction(
  createdBy: string,
  input: { student_assignment_id: string; weekday: 1|2|3|4|5|6|7; start_time: string; end_time: string }
) {
  await createBookedSlotLib(createdBy, input)
}

export async function cancelBookedSlotAction(slotId: string) {
  await cancelBookedSlotLib(slotId)
}

export async function getTutorActiveAssignments(tutorId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('student_assignments')
    .select(`
      id,
      status,
      students (id, first_name, last_name),
      subjects (id, name),
      subject_levels (id, level_name)
    `)
    .eq('tutor_id', tutorId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

