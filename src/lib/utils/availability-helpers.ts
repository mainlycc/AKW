// Helper functions for availability calendar
// These are not server actions, just utility functions

import type { TimeSlot, DayOfWeek } from '@/lib/types/availability.types'

// Generuj domyślny szablon dostępności
export function getDefaultAvailabilitySlots(): TimeSlot[] {
  const slots: TimeSlot[] = []
  
  // Dni tygodnia (Pn-Pt): 14:00-21:00 dostępne
  for (let day = 1; day <= 5; day++) {
    // 8:00-14:00 niedostępne
    for (let hour = 8; hour < 14; hour++) {
      slots.push({
        day: day as DayOfWeek,
        startTime: `${hour.toString().padStart(2, '0')}:00`,
        endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
        isAvailable: false,
      })
    }
    
    // 14:00-21:00 dostępne
    for (let hour = 14; hour < 21; hour++) {
      slots.push({
        day: day as DayOfWeek,
        startTime: `${hour.toString().padStart(2, '0')}:00`,
        endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
        isAvailable: true,
      })
    }
  }
  
  // Weekend (Sb-Nd): 8:00-14:00 dostępne
  for (let day = 6; day <= 7; day++) {
    for (let hour = 8; hour < 14; hour++) {
      slots.push({
        day: day as DayOfWeek,
        startTime: `${hour.toString().padStart(2, '0')}:00`,
        endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
        isAvailable: true,
      })
    }

    // Weekend rozszerzony: 14:00-21:00 dostępne
    for (let hour = 14; hour < 21; hour++) {
      slots.push({
        day: day as DayOfWeek,
        startTime: `${hour.toString().padStart(2, '0')}:00`,
        endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
        isAvailable: true,
      })
    }
  }
  
  return slots
}

// Sprawdź czy slot jest w dozwolonych godzinach pracy
export function isWithinWorkingHours(day: DayOfWeek, time: string): boolean {
  const hour = parseInt(time.split(':')[0])
  
  if (day >= 1 && day <= 5) {
    // Dni tygodnia: 8:00-21:00
    return hour >= 8 && hour < 21
  } else {
    // Weekend: 8:00-21:00
    return hour >= 8 && hour < 21
  }
}

