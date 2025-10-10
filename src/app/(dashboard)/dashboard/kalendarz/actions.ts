'use server'

import { updateAvailabilityTemplate } from '@/lib/actions/availability'
import type { TimeSlot, TutorAvailabilityData } from '@/lib/types/availability.types'

export async function saveAvailability(tutorId: string, slots: TimeSlot[]): Promise<TutorAvailabilityData> {
  return updateAvailabilityTemplate(tutorId, slots)
}

