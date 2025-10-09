import { getUserProfile } from "@/lib/actions/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile) {
    return null
  }

  const isAdmin = profile.role === 'admin'
  const isTutor = profile.role === 'tutor'

  // Pobierz statystyki
  let stats = {
    studentsCount: 0,
    tutorsCount: 0,
    sessionsThisMonth: 0,
    totalHoursThisMonth: 0,
    activeAssignments: 0,
  }

  if (isAdmin) {
    const [students, tutors, assignments] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'tutor'),
      supabase.from('student_assignments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ])

    stats.studentsCount = students.count || 0
    stats.tutorsCount = tutors.count || 0
    stats.activeAssignments = assignments.count || 0
  }

  if (isTutor) {
    const assignments = await supabase
      .from('student_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('tutor_id', profile.id)
      .eq('status', 'active')

    stats.activeAssignments = assignments.count || 0
  }

  // Pobierz sesje z tego miesiąca
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const sessionsQuery = supabase
    .from('tutoring_sessions')
    .select('duration_minutes')
    .gte('session_date', startOfMonth.toISOString())

  if (isTutor) {
    sessionsQuery.eq('tutor_id', profile.id)
  }

  const { data: sessions } = await sessionsQuery

  if (sessions) {
    stats.sessionsThisMonth = sessions.length
    stats.totalHoursThisMonth = sessions.reduce((acc, s) => acc + s.duration_minutes, 0) / 60
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Witaj z powrotem, {profile.full_name}!
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isAdmin && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Uczniowie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.studentsCount}</div>
                <p className="text-xs text-muted-foreground">
                  Wszyscy uczniowie w systemie
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tutorzy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.tutorsCount}</div>
                <p className="text-xs text-muted-foreground">
                  Aktywni tutorzy
                </p>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Aktywne przypisania
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeAssignments}</div>
            <p className="text-xs text-muted-foreground">
              {isTutor ? 'Twoi uczniowie' : 'W całym systemie'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Sesje w tym miesiącu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sessionsThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalHoursThisMonth.toFixed(1)} godzin
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Witamy w systemie Akademia Wiedzy</CardTitle>
          <CardDescription>
            System zarządzania e-korepetycjami
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {isAdmin && "Jako administrator masz pełny dostęp do zarządzania uczniami, tutorami, przedmiotami oraz raportami."}
            {isTutor && "Jako tutor możesz zarządzać swoimi uczniami i dodawać sesje korepetycji."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

