import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { ReportsView } from "./reports-view"

export default async function ReportsPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Brak dostępu. Ta strona jest dostępna tylko dla administratorów.
        </p>
      </div>
    )
  }

  // Pobierz wszystkie sesje z pełnymi danymi
  const { data: rawSessions } = await supabase
    .from('tutoring_sessions')
    .select(`
      id,
      session_date,
      duration_minutes,
      students (
        id,
        first_name,
        last_name
      ),
      profiles!tutoring_sessions_tutor_id_fkey (
        id,
        full_name,
        hourly_rate
      ),
      student_assignments (
        subjects (
          id,
          name
        )
      )
    `)
    .order('session_date', { ascending: false })

  // Przekształć dane do oczekiwanego formatu
  const sessions = rawSessions?.map((session: {
    id: string;
    session_date: string;
    duration_minutes: number;
    students: { id: string; first_name: string; last_name: string }[] | null;
    profiles: { id: string; full_name: string; hourly_rate: number | null }[] | null;
    student_assignments: {
      subjects: { id: string; name: string }[] | null;
    }[] | null;
  }) => ({
    id: session.id,
    session_date: session.session_date,
    duration_minutes: session.duration_minutes,
    students: session.students?.[0] || { id: '', first_name: '', last_name: '' },
    profiles: session.profiles?.[0] || { id: '', full_name: '', hourly_rate: null },
    student_assignments: {
      subjects: session.student_assignments?.[0]?.subjects?.[0] || { id: '', name: '' },
    },
  })) || []

  // Pobierz listę wszystkich tutorów i uczniów dla filtrów
  const [tutors, students, subjects] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'tutor').order('full_name'),
    supabase.from('students').select('id, first_name, last_name').order('last_name'),
    supabase.from('subjects').select('id, name, color').order('name'),
  ])

  return (
    <div className="space-y-4">
      <ReportsView
        sessions={sessions}
        tutors={tutors.data || []}
        students={students.data || []}
        subjects={subjects.data || []}
      />
    </div>
  )
}

