export type UserRole = 'admin' | 'tutor'

export type AssignmentStatus = 'active' | 'completed' | 'cancelled'

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
  created_at: string
  updated_at: string
}

export interface SubjectLevel {
  id: string
  subject_id: string
  level_name: string
  level_order: number
  price_per_hour: number
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
  created_by: string
  created_at: string
  updated_at: string
}

