import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { SessionsManagement } from "./sessions-management"

export default async function SessionsPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile) {
    return null
  }

  const isAdmin = profile.role === 'admin'
  const isTutor = profile.role === 'tutor'

  // Pobierz sesje
  let sessionsQuery = supabase
    .from('tutoring_sessions')
    .select(`
      *,
      students (
        id,
        first_name,
        last_name
      ),
      profiles!tutoring_sessions_tutor_id_fkey (
        id,
        full_name
      ),
      student_assignments (
        id,
        subjects (
          id,
          name
        ),
        subject_levels (
          id,
          level_name
        )
      )
    `)
    .order('session_date', { ascending: false })

  if (isTutor) {
    sessionsQuery = sessionsQuery.eq('tutor_id', profile.id)
  }

  const { data: rawSessions } = await sessionsQuery

  // Przekształć sesje do oczekiwanego formatu
  const sessions = rawSessions?.map((session: {
    id: string;
    session_date: string;
    duration_minutes: number;
    notes: string | null;
    students: { id: string; first_name: string; last_name: string }[] | null;
    profiles: { id: string; full_name: string }[] | null;
    student_assignments: {
      id: string;
      subjects: { id: string; name: string }[] | null;
      subject_levels: { id: string; level_name: string }[] | null;
    }[] | null;
  }) => ({
    id: session.id,
    session_date: session.session_date,
    duration_minutes: session.duration_minutes,
    notes: session.notes,
    students: session.students?.[0] || { id: '', first_name: '', last_name: '' },
    profiles: session.profiles?.[0] || { id: '', full_name: '' },
    student_assignments: {
      id: session.student_assignments?.[0]?.id || '',
      subjects: session.student_assignments?.[0]?.subjects?.[0] || { id: '', name: '' },
      subject_levels: session.student_assignments?.[0]?.subject_levels?.[0] || { id: '', level_name: '' },
    },
  })) || []

  // Pobierz aktywne przypisania dla formularza
  let assignmentsQuery = supabase
    .from('student_assignments')
    .select(`
      id,
      students (
        id,
        first_name,
        last_name
      ),
      profiles!student_assignments_tutor_id_fkey (
        id,
        full_name
      ),
      subjects (
        id,
        name
      ),
      subject_levels (
        id,
        level_name
      )
    `)
    .eq('status', 'active')

  if (isTutor) {
    assignmentsQuery = assignmentsQuery.eq('tutor_id', profile.id)
  }

  const { data: rawAssignments } = await assignmentsQuery

  // Przekształć przypisania do oczekiwanego formatu
  const assignments = rawAssignments?.map((assignment: {
    id: string;
    students: { id: string; first_name: string; last_name: string }[] | null;
    profiles: { id: string; full_name: string }[] | null;
    subjects: { id: string; name: string }[] | null;
    subject_levels: { id: string; level_name: string }[] | null;
  }) => ({
    id: assignment.id,
    students: assignment.students?.[0] || { id: '', first_name: '', last_name: '' },
    profiles: assignment.profiles?.[0] || { id: '', full_name: '' },
    subjects: assignment.subjects?.[0] || { id: '', name: '' },
    subject_levels: assignment.subject_levels?.[0] || { id: '', level_name: '' },
  })) || []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sesje korepetycji</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Zarządzaj sesjami korepetycji' : 'Dodawaj i przeglądaj swoje sesje'}
        </p>
      </div>

      <SessionsManagement
        sessions={sessions}
        assignments={assignments}
        userId={profile.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}

