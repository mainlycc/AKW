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
  const stats = {
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

  // Pobierz najbliższą lekcję dla tutora
  let nextSession = null
  if (isTutor) {
    const now = new Date().toISOString()
    const { data: nextSessionDataArray } = await supabase
      .from('tutoring_sessions')
      .select(`
        id,
        session_date,
        students!tutoring_sessions_student_id_fkey (
          id,
          first_name,
          last_name
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
      .eq('tutor_id', profile.id)
      .gte('session_date', now)
      .order('session_date', { ascending: true })
      .limit(1)

    const nextSessionData = nextSessionDataArray && nextSessionDataArray.length > 0 
      ? nextSessionDataArray[0] 
      : null

    if (nextSessionData) {
      const student = Array.isArray(nextSessionData.students) 
        ? nextSessionData.students[0] 
        : nextSessionData.students;
      const assignment = Array.isArray(nextSessionData.student_assignments) 
        ? nextSessionData.student_assignments[0] 
        : nextSessionData.student_assignments;
      
      const subject = assignment && (Array.isArray(assignment.subjects) 
        ? assignment.subjects[0] 
        : assignment.subjects);
      const subjectLevel = assignment && (Array.isArray(assignment.subject_levels) 
        ? assignment.subject_levels[0] 
        : assignment.subject_levels);

      nextSession = {
        session_date: nextSessionData.session_date,
        student_name: student ? `${student.first_name} ${student.last_name}` : 'Nieznany uczeń',
        subject_name: subject?.name || 'Nieznany przedmiot',
        level_name: subjectLevel?.level_name || 'Nieznany poziom',
      }
    }
  }

  return (
    <div className="space-y-4">
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

      {isTutor && nextSession && (
        <Card>
          <CardHeader>
            <CardTitle>Najbliższa lekcja</CardTitle>
            <CardDescription>
              Informacje o Twojej najbliższej zaplanowanej lekcji
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Data:</span>
              <span className="text-sm font-semibold">
                {new Date(nextSession.session_date).toLocaleString('pl-PL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Uczeń:</span>
              <span className="text-sm font-semibold">{nextSession.student_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Przedmiot:</span>
              <span className="text-sm font-semibold">{nextSession.subject_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Poziom:</span>
              <span className="text-sm font-semibold">{nextSession.level_name}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isTutor && !nextSession && (
        <Card>
          <CardHeader>
            <CardTitle>Najbliższa lekcja</CardTitle>
            <CardDescription>
              Informacje o Twojej najbliższej zaplanowanej lekcji
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nie masz zaplanowanych żadnych lekcji w przyszłości.
            </p>
          </CardContent>
        </Card>
      )}

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

