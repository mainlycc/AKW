import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { TutorsTable } from "./tutors-table"

export default async function TutorsPage() {
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

  const { data: tutors } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'tutor')
    .order('created_at', { ascending: false })

  // Pobierz statystyki dla każdego tutora
  const tutorsWithStats = await Promise.all(
    (tutors || []).map(async (tutor) => {
      const [assignments, sessions] = await Promise.all([
        supabase
          .from('student_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('tutor_id', tutor.id)
          .eq('status', 'active'),
        supabase
          .from('tutoring_sessions')
          .select('duration_minutes')
          .eq('tutor_id', tutor.id),
      ])

      const totalHours = (sessions.data || []).reduce((acc, s) => acc + s.duration_minutes, 0) / 60

      return {
        ...tutor,
        activeAssignments: assignments.count || 0,
        totalHours: totalHours,
        totalSessions: sessions.data?.length || 0,
      }
    })
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tutorzy</h1>
        <p className="text-muted-foreground">
          Przeglądaj tutorów i ich statystyki
        </p>
      </div>

      <TutorsTable tutors={tutorsWithStats} />
    </div>
  )
}

