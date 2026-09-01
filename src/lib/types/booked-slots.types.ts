export type BookedSlotStatus = 'booked' | 'cancelled'

export interface CreateBookedSlotInput {
  student_assignment_id: string
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  start_time: string // HH:MM
  end_time: string // HH:MM
}

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
  student_assignments?: {
    students?: { id: string; first_name: string; last_name: string } | null
    subjects?: { id: string; name: string } | null
    subject_levels?: { id: string; level_name: string } | null
  } | null
}
