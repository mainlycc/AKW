export type UserRole = 'admin' | 'tutor'

export type AssignmentStatus = 'active' | 'completed' | 'cancelled'

export type InvitationStatus = 'pending' | 'accepted' | 'expired'

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  email: string
  created_at: string
  updated_at: string
}

export interface Subject {
  id: string
  name: string
  description: string | null
  color: string | null
  created_at: string
  updated_at: string
}

export interface SubjectLevel {
  id: string
  subject_id: string
  level_name: string
  level_order: number
  price_per_hour: number  // DEPRECATED: Use profiles.hourly_rate instead
  created_at?: string
  updated_at?: string
}

export interface Student {
  id: string
  first_name: string
  last_name: string
  parent_email: string
  parent_phone: string | null
  notes: string | null
  hourly_rate: number | null
  rate_level: number
  hourly_rate_is_overridden: boolean
  created_at: string
  updated_at: string
}

export interface StudentAssignment {
  id: string
  student_id: string
  tutor_id: string
  subject_id: string
  subject_level_id: string
  assigned_by: string
  status: AssignmentStatus
  created_at: string
  updated_at: string
}

export interface TutoringSession {
  id: string
  assignment_id: string
  tutor_id: string
  student_id: string
  session_date: string
  duration_minutes: number
  notes: string | null
  status: SessionStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface TutorInvitation {
  id: string
  email: string
  token: string
  status: InvitationStatus
  created_by: string
  expires_at: string
  created_at: string
  updated_at: string
}

