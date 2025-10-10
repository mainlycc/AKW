import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { HistoryView } from "./history-view"

export default async function HistoryPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile || profile.role !== 'tutor') {
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Brak dostępu. Ta strona jest dostępna tylko dla tutorów.
        </p>
      </div>
    )
  }

  // Pobierz wszystkie sesje tutora
  const { data: rawSessions } = await supabase
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

  // Przekształć dane do oczekiwanego formatu
  const sessions = rawSessions?.map((session: {
    id: string;
    session_date: string;
    duration_minutes: number;
    notes: string | null;
    students: { id: string; first_name: string; last_name: string }[] | null;
    student_assignments: {
      subjects: { id: string; name: string }[] | null;
      subject_levels: { level_name: string; price_per_hour: number }[] | null;
    }[] | null;
  }) => ({
    id: session.id,
    session_date: session.session_date,
    duration_minutes: session.duration_minutes,
    notes: session.notes,
    students: session.students?.[0] || { id: '', first_name: '', last_name: '' },
    student_assignments: {
      subjects: session.student_assignments?.[0]?.subjects?.[0] || { id: '', name: '' },
      subject_levels: session.student_assignments?.[0]?.subject_levels?.[0] || { level_name: '', price_per_hour: 0 },
    },
  })) || []

  return (
    <div className="space-y-4">
      <HistoryView sessions={sessions} />
    </div>
  )
}

