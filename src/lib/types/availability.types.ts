// Types for tutor availability calendar system

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7 // 1=Monday, 7=Sunday

export interface TimeSlot {
  day: DayOfWeek
  startTime: string // "14:00"
  endTime: string // "14:30"
  isAvailable: boolean
}

export interface AvailabilityTemplate {
  id: string
  tutor_id: string
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AvailabilitySlot {
  id: string
  template_id: string
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  is_available: boolean
  created_at: string
}

export interface TutorAvailabilityData {
  template: AvailabilityTemplate
  slots: AvailabilitySlot[]
}

export interface TutorAvailabilitySummary {
  tutor_id: string
  tutor_name: string
  has_availability: boolean
  version: number | null
  last_updated: string | null
}

// Helper types for UI
export interface DaySchedule {
  day: DayOfWeek
  dayName: string
  slots: {
    startTime: string
    endTime: string
    isAvailable: boolean
    isWithinWorkingHours: boolean
  }[]
}

export interface WorkingHours {
  weekday: { start: string; end: string } // "08:00" - "21:00"
  weekend: { start: string; end: string } // "09:00" - "14:00"
}

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  weekday: { start: '08:00', end: '21:00' },
  weekend: { start: '09:00', end: '14:00' },
}

export const DAY_NAMES: Record<DayOfWeek, string> = {
  1: 'Poniedziałek',
  2: 'Wtorek',
  3: 'Środa',
  4: 'Czwartek',
  5: 'Piątek',
  6: 'Sobota',
  7: 'Niedziela',
}

export const DAY_NAMES_SHORT: Record<DayOfWeek, string> = {
  1: 'Pn',
  2: 'Wt',
  3: 'Śr',
  4: 'Cz',
  5: 'Pt',
  6: 'Sb',
  7: 'Nd',
}

