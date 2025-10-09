import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { ReportsView } from "./reports-view"

export default async function ReportsPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Brak dostępu</h1>
        <p className="text-muted-foreground">
          Ta strona jest dostępna tylko dla administratorów.
        </p>
      </div>
    )
  }

  // Pobierz wszystkie sesje z pełnymi danymi
  const { data: sessions } = await supabase
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
        full_name
      ),
      student_assignments (
        subjects (
          id,
          name
        ),
        subject_levels (
          price_per_hour
        )
      )
    `)
    .order('session_date', { ascending: false })

  // Pobierz listę wszystkich tutorów i uczniów dla filtrów
  const [tutors, students, subjects] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'tutor').order('full_name'),
    supabase.from('students').select('id, first_name, last_name').order('last_name'),
    supabase.from('subjects').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Raporty godzin</h1>
        <p className="text-muted-foreground">
          Analizuj czas pracy tutorów i sesje uczniów
        </p>
      </div>

      <ReportsView
        sessions={sessions || []}
        tutors={tutors.data || []}
        students={students.data || []}
        subjects={subjects.data || []}
      />
    </div>
  )
}

