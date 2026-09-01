'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { listBookedSlots, syncBookedSlotsFromScheduledSessions } from '@/lib/actions/booked-slots'
import type { BookedSlot } from '@/lib/types/booked-slots.types'

export async function clearTutorsAvailability(tutorIds: string[]) {
  if (!tutorIds.length) return

  const supabase = await createClient()

  const { error } = await supabase
    .from('tutor_availability_templates')
    .update({ is_active: false })
    .in('tutor_id', tutorIds)
    .eq('is_active', true)

  if (error) {
    throw error
  }

  revalidatePath('/dashboard/dostepnosc-tutorow')
  revalidatePath('/dashboard/kalendarz')
}

export async function getTutorBookedSlotsSynced(tutorId: string): Promise<BookedSlot[]> {
  await syncBookedSlotsFromScheduledSessions(tutorId)
  return listBookedSlots({ scope: 'admin', tutorId })
}


