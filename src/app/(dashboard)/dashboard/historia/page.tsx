import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { HistoryView } from "./history-view"

export default async function HistoryPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile || profile.role !== 'tutor') {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Brak dostępu</h1>
        <p className="text-muted-foreground">
          Ta strona jest dostępna tylko dla tutorów.
        </p>
      </div>
    )
  }

  // Pobierz wszystkie sesje tutora
  const { data: sessions } = await supabase
    .from('tutoring_sessions')
    .select(`
      id,
      session_date,
      duration_minutes,
      notes,
      students (
        id,
        first_name,
        last_name
      ),
      student_assignments (
        subjects (
          id,
          name
        ),
        subject_levels (
          level_name,
          price_per_hour
        )
      )
    `)
    .eq('tutor_id', profile.id)
    .order('session_date', { ascending: false })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Historia sesji</h1>
        <p className="text-muted-foreground">
          Twoja historia przeprowadzonych korepetycji
        </p>
      </div>

      <HistoryView sessions={sessions || []} />
    </div>
  )
}

