'use client'

import { useState } from 'react'
import { Student } from '@/lib/types/database.types'
import { StudentDialog } from '@/app/(dashboard)/dashboard/uczniowie/student-dialog'

interface StudentNameLinkProps {
  student: Student | { id: string; first_name: string; last_name: string }
  studentParents?: Array<{
    id: string
    is_primary: boolean
    parents: {
      id: string
      first_name: string
      last_name: string
      email: string
      phone: string | null
      parent_type: string
    }
  }>
  studentNotes?: Array<{
    id: string
    content: string
    created_at: string
    profiles: {
      id: string
      full_name: string
    }
  }>
  studentSubjects?: string[]
  allParents?: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
    parent_type: string
  }>
  allSubjects?: Array<{
    id: string
    name: string
    subject_levels: Array<{
      id: string
      level_name: string
      level_order: number
      price_per_hour: number
    }>
  }>
  isTutor?: boolean
  tutorId?: string
  tutorSubjectLevels?: Array<{
    subject_level_id: string
    subjects: { id: string; name: string } | null
    subject_levels: { id: string; level_name: string } | null
  }>
  currentUserId?: string
  className?: string
}

export function StudentNameLink({
  student,
  studentParents = [],
  studentNotes = [],
  studentSubjects = [],
  allParents = [],
  allSubjects = [],
  isTutor = false,
  tutorId,
  tutorSubjectLevels = [],
  currentUserId,
  className = '',
}: StudentNameLinkProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDialogOpen(true)
  }

  // Konwertuj student na pełny obiekt Student, jeśli to możliwe
  const fullStudent: Student | null = student && 'id' in student && 'first_name' in student && 'last_name' in student
    ? (student as Student)
    : null

  if (!fullStudent) {
    // Fallback - wyświetl tylko tekst, jeśli nie mamy pełnego obiektu Student
    return (
      <span className={className}>
        {student.first_name} {student.last_name}
      </span>
    )
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`text-left hover:underline cursor-pointer ${className}`}
      >
        {student.first_name} {student.last_name}
      </button>
      <StudentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        student={fullStudent}
        studentParents={studentParents}
        studentNotes={studentNotes}
        studentSubjects={studentSubjects}
        allParents={allParents}
        allSubjects={allSubjects}
        isTutor={isTutor}
        tutorId={tutorId}
        tutorSubjectLevels={tutorSubjectLevels}
        currentUserId={currentUserId}
      />
    </>
  )
}
