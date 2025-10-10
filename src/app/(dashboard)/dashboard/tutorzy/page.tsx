import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { TutorsTable } from "./tutors-table"

export default async function TutorsPage() {
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

  // Pobierz przedmioty wszystkich tutorów
  const { data: allTutorSubjects } = await supabase
    .from('tutor_subject_levels')
    .select(`
      id,
      tutor_id,
      subject_id,
      subject_level_id,
      subjects (
        id,
        name
      ),
      subject_levels (
        id,
        level_name,
        price_per_hour
      )
    `)

  // Group by tutor_id
  const tutorSubjects: Record<string, typeof allTutorSubjects> = {}
  allTutorSubjects?.forEach((ts) => {
    if (!tutorSubjects[ts.tutor_id]) {
      tutorSubjects[ts.tutor_id] = []
    }
    tutorSubjects[ts.tutor_id].push(ts)
  })

  return (
    <div className="space-y-4">
      <TutorsTable tutors={tutorsWithStats} tutorSubjects={tutorSubjects} />
    </div>
  )
}

