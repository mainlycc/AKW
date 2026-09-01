import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { getTutorAvailability } from "@/lib/actions/availability"
import { listTutorCalendarOccupancy } from "@/lib/actions/booked-slots"
import { getTutorSubjectLevels } from "@/lib/actions/tutor"
import { getDefaultTutorRate } from "../../stawki/actions"
import { redirect } from "next/navigation"
import { TutorDetailsView } from "./tutor-details-view"

interface PageProps {
  params: Promise<{ id: string }>
}

interface StudentWithRelations {
  id: string
  first_name: string
  last_name: string
  parent_email: string
  parent_phone: string | null
  hourly_rate?: number | null
  student_parents?: Array<{
    id: string
    is_primary: boolean
    parents: {
      id: string
      first_name: string
      last_name: string
      email: string
      phone: string | null
    } | null
  }>
  student_assignments?: Array<{
    id: string
    status: string
    subjects: {
      id: string
      name: string
    } | null
    subject_levels: {
      id: string
      level_name: string
    } | null
  }>
}

export default async function TutorDetailsPage({ params }: PageProps) {
  const profile = await getUserProfile()
  const supabase = await createClient()
  const { id } = await params

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard/tutorzy')
  }

  const defaultTutorRate = await getDefaultTutorRate()

  // Pobierz dane tutora
  const { data: tutor, error: tutorError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('role', 'tutor')
    .single()

  if (tutorError || !tutor) {
    redirect('/dashboard/tutorzy')
  }

  // Pobierz dostępność tutora
  const availability = await getTutorAvailability(id)

  const bookedSlots = await listTutorCalendarOccupancy(id)

  // Pobierz przedmioty tutora i zmapuj dane
  const tutorSubjectsData = await getTutorSubjectLevels(id)
  const tutorSubjects = tutorSubjectsData.map((item: any) => ({
    id: item.id,
    subject_id: item.subject_id,
    subject_level_id: item.subject_level_id,
    subjects: Array.isArray(item.subjects) ? item.subjects[0] : item.subjects,
    subject_levels: Array.isArray(item.subject_levels) ? item.subject_levels[0] : item.subject_levels,
  }))

  // Pobierz uczniów z aktywnych przypisań do tego tutora
  // Najpierw pobierz aktywne przypisania dla tego tutora
  const { data: assignmentsData } = await supabase
    .from('student_assignments')
    .select(`
      student_id,
      id,
      status,
      subjects (
        id,
        name,
        color
      ),
      subject_levels (
        id,
        level_name
      )
    `)
    .eq('tutor_id', id)
    .eq('status', 'active')

  // Zbierz unikalne ID uczniów
  const studentIds = assignmentsData 
    ? Array.from(new Set(assignmentsData.map(a => a.student_id)))
    : []

  let students: StudentWithRelations[] = []

  if (studentIds.length > 0) {
    // Pobierz uczniów na podstawie ID z przypisań
    const { data: studentsData } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        parent_email,
        parent_phone,
        hourly_rate,
        student_parents (
          id,
          is_primary,
          parents (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        )
      `)
      .in('id', studentIds)
      .order('first_name')
      .order('last_name')

    // Połącz uczniów z ich przypisaniami
    if (studentsData) {
      students = studentsData.map((student) => {
        const studentAssignments = (assignmentsData || [])
          .filter(a => a.student_id === student.id)
          .map(a => ({
            id: a.id,
            status: a.status,
            subjects: Array.isArray(a.subjects) ? a.subjects[0] : a.subjects,
            subject_levels: Array.isArray(a.subject_levels) ? a.subject_levels[0] : a.subject_levels,
          }))

        // Mapuj student_parents - parents może być tablicą lub pojedynczym obiektem
        const studentParents = student.student_parents?.map(sp => ({
          id: sp.id,
          is_primary: sp.is_primary,
          parents: Array.isArray(sp.parents) ? sp.parents[0] : sp.parents,
        }))

        return {
          ...student,
          student_parents: studentParents,
          student_assignments: studentAssignments,
        }
      }) as StudentWithRelations[]
    }
  }

  return (
    <TutorDetailsView
      tutor={tutor}
      defaultTutorRate={defaultTutorRate}
      availability={availability}
      bookedSlots={bookedSlots}
      students={students}
      tutorSubjects={tutorSubjects}
    />
  )
}

