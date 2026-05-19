'use client'

import { useEffect, useMemo, useState } from 'react'
import { Student } from '@/lib/types/database.types'
import { StudentDialog } from '@/app/(dashboard)/dashboard/uczniowie/student-dialog'
import { getStudentWithRelations, getAllParentsForSelectAction, getAllSubjectsWithLevelsAction } from '@/app/(dashboard)/dashboard/uczniowie/actions'

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
  isAdmin?: boolean
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
  isAdmin = false,
  tutorId,
  tutorSubjectLevels = [],
  currentUserId,
  className = '',
}: StudentNameLinkProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loadingRelations, setLoadingRelations] = useState(false)

  type ParentsArr = NonNullable<StudentNameLinkProps['studentParents']>
  type NotesArr = NonNullable<StudentNameLinkProps['studentNotes']>
  type SubjectsArr = NonNullable<StudentNameLinkProps['studentSubjects']>
  type AllParentsArr = NonNullable<StudentNameLinkProps['allParents']>
  type AllSubjectsArr = NonNullable<StudentNameLinkProps['allSubjects']>

  const [loadedParents, setLoadedParents] = useState<ParentsArr>(studentParents)
  const [loadedNotes, setLoadedNotes] = useState<NotesArr>(studentNotes)
  const [loadedSubjects, setLoadedSubjects] = useState<SubjectsArr>(studentSubjects)
  const [loadedAllParents, setLoadedAllParents] = useState<AllParentsArr>(allParents)
  const [loadedAllSubjects, setLoadedAllSubjects] = useState<AllSubjectsArr>(allSubjects)

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

  const studentId = fullStudent.id

  const needsLazyLoad = useMemo(() => {
    // In a few places (np. rozliczenia deklaracji) otwieramy dialog bez relacji i bez list.
    // Wtedy dociągamy wszystko „na żądanie” przy otwarciu.
    const missingRelations = loadedParents.length === 0 && loadedNotes.length === 0 && loadedSubjects.length === 0
    const missingLists = loadedAllParents.length === 0 || loadedAllSubjects.length === 0
    return missingRelations || missingLists
  }, [loadedParents.length, loadedNotes.length, loadedSubjects.length, loadedAllParents.length, loadedAllSubjects.length])

  useEffect(() => {
    if (!dialogOpen) return
    if (!studentId) return
    if (!needsLazyLoad) return

    let alive = true
    const run = async () => {
      try {
        setLoadingRelations(true)

        const [relations, parentsList, subjectsList] = await Promise.all([
          getStudentWithRelations(studentId),
          // listy potrzebne do „Dodaj rodzica” i „Przedmioty”
          getAllParentsForSelectAction(),
          getAllSubjectsWithLevelsAction(),
        ])

        if (!alive) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r: any = relations
        setLoadedParents((r?.student_parents || []) as ParentsArr)
        setLoadedNotes((r?.student_notes || []) as NotesArr)
        // student-dialog używa listy subject_level_id oraz (opcjonalnie) szczegółów
        const subjectRows = (r?.student_subjects || []) as Array<{ subject_level_id: string }>
        setLoadedSubjects(subjectRows.map(s => s.subject_level_id))

        setLoadedAllParents(parentsList as AllParentsArr)
        setLoadedAllSubjects(subjectsList as AllSubjectsArr)
      } catch (err) {
        console.error('[StudentNameLink] lazy load error:', err)
      } finally {
        if (alive) setLoadingRelations(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [dialogOpen, studentId, needsLazyLoad])

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
        studentParents={loadedParents}
        studentNotes={loadedNotes}
        studentSubjects={loadedSubjects}
        allParents={loadedAllParents}
        allSubjects={loadedAllSubjects}
        isTutor={isTutor}
        isAdmin={isAdmin}
        tutorId={tutorId}
        tutorSubjectLevels={tutorSubjectLevels}
        currentUserId={currentUserId}
      />
      {loadingRelations ? null : null}
    </>
  )
}
