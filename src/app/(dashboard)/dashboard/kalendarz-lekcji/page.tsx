import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserProfile } from "@/lib/actions/auth"
import { syncMissingSessionsForConfirmedPublicBookings } from "@/lib/actions/public-booking"
import { redirect } from "next/navigation"
import { LessonsCalendar } from "./lessons-calendar"
import type { SessionStatus } from "@/lib/types/database.types"

const SELECT_QUERY = `
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
`

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

  // Uzupełnij brakujące lekcje z potwierdzonych rezerwacji publicznych
  try {
    const admin = createAdminClient()
    await syncMissingSessionsForConfirmedPublicBookings(admin)
  } catch (syncError) {
    console.error('[kalendarz-lekcji] Sync public booking sessions failed:', syncError)
  }

  // Automatycznie dogeneruj sesje na przyszłe miesiące z booked_slots
  // (trigger generuje sesje tylko na 3 miesiące od daty utworzenia slotu)
  const today = new Date()
  const startDate = today.toISOString().split('T')[0]
  const futureDate = new Date(today)
  futureDate.setMonth(futureDate.getMonth() + 3)
  const endDate = futureDate.toISOString().split('T')[0]

  await supabase.rpc('generate_sessions_for_all_booked_slots', {
    p_start_date: startDate,
    p_end_date: endDate,
  })

  // Zakres dat: 12 miesięcy wstecz + 6 miesięcy wprzód
  const now = new Date()
  const rangeStart = new Date(now)
  rangeStart.setMonth(rangeStart.getMonth() - 12)
  const rangeEnd = new Date(now)
  rangeEnd.setMonth(rangeEnd.getMonth() + 6)

  const rangeStartISO = rangeStart.toISOString()
  const rangeEndISO = rangeEnd.toISOString()

  // Pobierz WSZYSTKIE sesje z paginacją (Supabase ma twardy limit 1000 wierszy)
  const PAGE_SIZE = 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRawSessions: any[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('tutoring_sessions')
      .select(SELECT_QUERY)
      .gte('session_date', rangeStartISO)
      .lte('session_date', rangeEndISO)
      .order('session_date', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (isTutor) {
      query = query.eq('tutor_id', profile.id)
    }

    const { data, error } = await query

    if (error) {
      console.error('[kalendarz-lekcji] Błąd pobierania sesji (strona od', from, '):', error.message)
      break
    }

    if (data && data.length > 0) {
      allRawSessions.push(...data)
      from += PAGE_SIZE
      // Jeśli dostaliśmy mniej niż PAGE_SIZE, to koniec
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
  }

  // Przekształć sesje do oczekiwanego formatu
  const sessions = allRawSessions.map((session: {
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
  })

  return (
    <div className="space-y-4">
      <LessonsCalendar sessions={sessions} isAdmin={isAdmin} />
    </div>
  )
}
