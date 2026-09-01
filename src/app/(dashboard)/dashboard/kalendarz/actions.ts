'use server'

import { updateAvailabilityTemplate } from '@/lib/actions/availability'
import { createBookedSlot as createBookedSlotLib, listBookedSlots as listBookedSlotsLib, cancelBookedSlot as cancelBookedSlotLib, syncBookedSlotsFromScheduledSessions } from '@/lib/actions/booked-slots'
import { createClient } from '@/lib/supabase/server'
import type { TimeSlot, TutorAvailabilityData } from '@/lib/types/availability.types'
import type { BookedSlot } from '@/lib/types/booked-slots.types'
import type { MonitoringMeta } from '@/lib/monitoring/correlation'

export async function saveAvailability(
  tutorId: string,
  slots: TimeSlot[],
  meta?: MonitoringMeta
): Promise<TutorAvailabilityData> {
  return updateAvailabilityTemplate(tutorId, slots, meta)
}

export async function listTutorBookedSlots(tutorId: string): Promise<BookedSlot[]> {
  await syncBookedSlotsFromScheduledSessions(tutorId)
  return listBookedSlotsLib({ scope: 'tutor', tutorId })
}

export async function createBookedSlotAction(
  createdBy: string,
  input: { student_assignment_id: string; weekday: 1|2|3|4|5|6|7; start_time: string; end_time: string },
  meta?: MonitoringMeta
) {
  await createBookedSlotLib(createdBy, input, meta)
}

export async function cancelBookedSlotAction(slotId: string, meta?: MonitoringMeta) {
  await cancelBookedSlotLib(slotId, meta)
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

