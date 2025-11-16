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
      students!tutoring_sessions_student_id_fkey (
        id,
        first_name,
        last_name
      ),
      profiles!tutoring_sessions_tutor_id_fkey (
        id,
        full_name
      ),
      student_assignments!tutoring_sessions_assignment_id_fkey (
        id,
        subjects!student_assignments_subject_id_fkey (
          id,
          name
        ),
        subject_levels!student_assignments_subject_level_id_fkey (
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
    duration_minutes: number | null;
    notes: string | null;
    students: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null;
    profiles: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
    student_assignments: {
      id: string;
      subjects: { id: string; name: string } | { id: string; name: string }[] | null;
      subject_levels: { id: string; level_name: string } | { id: string; level_name: string }[] | null;
    } | {
      id: string;
      subjects: { id: string; name: string } | { id: string; name: string }[] | null;
      subject_levels: { id: string; level_name: string } | { id: string; level_name: string }[] | null;
    }[] | null;
  }) => {
    // Supabase może zwracać relacje jako obiekty lub tablice
    const student = Array.isArray(session.students) 
      ? session.students[0] 
      : session.students;
    const tutor = Array.isArray(session.profiles) 
      ? session.profiles[0] 
      : session.profiles;
    const assignment = Array.isArray(session.student_assignments) 
      ? session.student_assignments[0] 
      : session.student_assignments;
    
    const subject = assignment && (Array.isArray(assignment.subjects) 
      ? assignment.subjects[0] 
      : assignment.subjects);
    const subjectLevel = assignment && (Array.isArray(assignment.subject_levels) 
      ? assignment.subject_levels[0] 
      : assignment.subject_levels);

    return {
      id: session.id,
      session_date: session.session_date,
      duration_minutes: session.duration_minutes ?? 0,
      notes: session.notes,
      students: student || { id: '', first_name: '', last_name: '' },
      profiles: tutor || { id: '', full_name: '' },
      student_assignments: {
        id: assignment?.id || '',
        subjects: subject || { id: '', name: '' },
        subject_levels: subjectLevel || { id: '', level_name: '' },
      },
    };
  }) || []

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
      <SessionsManagement
        sessions={sessions}
        assignments={assignments}
        userId={profile.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}

