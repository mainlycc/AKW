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

  const { data: sessions } = await sessionsQuery

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

  const { data: assignments } = await assignmentsQuery

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sesje korepetycji</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Zarządzaj sesjami korepetycji' : 'Dodawaj i przeglądaj swoje sesje'}
        </p>
      </div>

      <SessionsManagement
        sessions={sessions || []}
        assignments={assignments || []}
        userId={profile.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}

