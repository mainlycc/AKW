import { SLOT_DURATION_MINUTES } from '@/lib/types/availability.types'

export function calculateAdminReservationAmount(
  hourlyRate: number,
  lessonCount: number,
  isRecurring: boolean
): number {
  const hoursPerLesson = SLOT_DURATION_MINUTES / 60
  const effectiveLessonCount = isRecurring ? lessonCount : 1
  return Math.round(hourlyRate * hoursPerLesson * effectiveLessonCount * 100) / 100
}
