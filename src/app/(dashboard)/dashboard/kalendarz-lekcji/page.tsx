import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { redirect } from "next/navigation"
import { LessonsCalendar } from "./lessons-calendar"
import type { SessionStatus } from "@/lib/types/database.types"

export default async function LessonsCalendarPage() {
  const profile = await getUserProfile()

  if (!profile) {
    redirect("/login")
  }

  // Admin i tutorzy mają dostęp
  const isAdmin = profile.role === 'admin'
  const isTutor = profile.role === 'tutor'
  
  if (!isAdmin && !isTutor) {
    redirect("/dashboard")
  }

  const supabase = await createClient()

  // Pobierz sesje z pełnymi danymi
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
    .order('session_date', { ascending: true })

  // Filtruj sesje tylko dla tutora (jeśli jest tutorem)
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
    status: string;
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
      status: (session.status || 'scheduled') as SessionStatus,
      students: student || { id: '', first_name: '', last_name: '' },
      profiles: tutor || { id: '', full_name: '' },
      student_assignments: {
        id: assignment?.id || '',
        subjects: subject || { id: '', name: '' },
        subject_levels: subjectLevel || { id: '', level_name: '' },
      },
    };
  }) || []

  return (
    <div className="space-y-4">
      <LessonsCalendar sessions={sessions} isAdmin={isAdmin} />
    </div>
  )
}

