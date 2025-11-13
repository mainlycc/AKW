// Helper functions for availability calendar
// These are not server actions, just utility functions

import type { TimeSlot, DayOfWeek, CalendarSlot } from '@/lib/types/availability.types'
import { DEFAULT_WORKING_HOURS, SLOT_DURATION_MINUTES } from '@/lib/types/availability.types'

// Generuj domyślny szablon dostępności
export function getDefaultAvailabilitySlots(): TimeSlot[] {
  const slots: TimeSlot[] = []

  const pad = (value: number) => value.toString().padStart(2, '0')

  const createSlots = (day: DayOfWeek, startHour: number, endHour: number, isAvailable: boolean) => {
    for (let hour = startHour; hour < endHour; hour++) {
      const start = `${pad(hour)}:00`
      const end = `${pad(hour + SLOT_DURATION_MINUTES / 60)}:00`
      slots.push({
        day,
        startTime: start,
        endTime: end,
        isAvailable,
      })
    }
  }

  for (let day = 1; day <= 5; day++) {
    createSlots(day as DayOfWeek, 8, 14, false)
    createSlots(day as DayOfWeek, 14, 21, true)
  }

  for (let day = 6; day <= 7; day++) {
    createSlots(day as DayOfWeek, 8, 9, false)
    createSlots(day as DayOfWeek, 9, 14, true)
    createSlots(day as DayOfWeek, 14, 21, false)
  }

  return slots
}

// Sprawdź czy slot jest w dozwolonych godzinach pracy
export function isWithinWorkingHours(day: DayOfWeek, time: string): boolean {
  const hour = parseInt(time.split(':')[0])

  const hours = day >= 1 && day <= 5 ? DEFAULT_WORKING_HOURS.weekday : DEFAULT_WORKING_HOURS.weekend
  const startHour = parseInt(hours.start.split(':')[0])
  const endHour = parseInt(hours.end.split(':')[0])

  return hour >= startHour && hour < endHour
}

const normalizeTime = (time: string) => time.slice(0, 5)

export interface GenerateCalendarSlotsParams {
  startDate: string // inclusive yyyy-mm-dd
  endDate: string // inclusive yyyy-mm-dd
  templateSlots: TimeSlot[]
  blockedWeekdayKeys?: Set<string> // `${weekday}-${HH:MM}`
  blockedDateKeys?: Set<string> // `${yyyy-mm-dd}-${HH:MM}`
}

export function generateCalendarSlots({
  startDate,
  endDate,
  templateSlots,
  blockedWeekdayKeys,
  blockedDateKeys,
}: GenerateCalendarSlotsParams): CalendarSlot[] {
  const result: CalendarSlot[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return result
  }

  const slotsByDay = templateSlots
    .filter((slot) => slot.isAvailable)
    .reduce<Record<DayOfWeek, { start: string; end: string }[]>>((acc, slot) => {
      const normalizedStart = normalizeTime(slot.startTime)
      const normalizedEnd = normalizeTime(slot.endTime)
      const day = slot.day
      if (!acc[day]) {
        acc[day] = []
      }
      acc[day].push({ start: normalizedStart, end: normalizedEnd })
      return acc
    }, {} as Record<DayOfWeek, { start: string; end: string }[]>)

  const current = new Date(start)
  while (current <= end) {
    // Use local date to avoid timezone issues
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, '0')
    const day = String(current.getDate()).padStart(2, '0')
    const isoDate = `${year}-${month}-${day}`
    
    // getDay() returns 0 (Sunday) to 6 (Saturday), we need 1 (Monday) to 7 (Sunday)
    const weekday = (((current.getDay() + 6) % 7) + 1) as DayOfWeek
    const daySlots = slotsByDay[weekday]

    if (daySlots?.length) {
      for (const slot of daySlots) {
        const weekdayKey = `${weekday}-${slot.start}`
        const dateKey = `${isoDate}-${slot.start}`

        const conflictBooked = blockedWeekdayKeys?.has(weekdayKey) ?? false
        const conflictRequested = blockedDateKeys?.has(dateKey) ?? false
        const isAvailable = !conflictBooked && !conflictRequested

        result.push({
          weekday,
          date: isoDate,
          startTime: slot.start,
          endTime: slot.end,
          isAvailable,
          conflicts: (conflictBooked || conflictRequested)
            ? {
                booked: conflictBooked || undefined,
                requested: conflictRequested || undefined,
              }
            : undefined,
        })
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return result
}


