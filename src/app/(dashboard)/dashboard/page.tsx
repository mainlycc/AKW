import { getUserProfile } from "@/lib/actions/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import Link from "next/link"
import { DashboardWelcomeCard } from "./dashboard-welcome-card"
import type { SupabaseClient } from "@supabase/supabase-js"

async function getScheduledHoursThisMonth(
  supabase: SupabaseClient,
  filters?: { tutorId?: string; studentId?: string }
) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const startOfNextMonth = new Date(startOfMonth)
  startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1)

  const PAGE_SIZE = 1000
  let from = 0
  let totalMinutes = 0
  let sessionCount = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('tutoring_sessions')
      .select('duration_minutes')
      .eq('status', 'scheduled')
      .gte('session_date', startOfMonth.toISOString())
      .lt('session_date', startOfNextMonth.toISOString())
      .range(from, from + PAGE_SIZE - 1)

    if (filters?.tutorId) {
      query = query.eq('tutor_id', filters.tutorId)
    }

    if (filters?.studentId) {
      query = query.eq('student_id', filters.studentId)
    }

    const { data, error } = await query

    if (error || !data?.length) {
      break
    }

    for (const session of data) {
      totalMinutes += session.duration_minutes
      sessionCount++
    }

    hasMore = data.length === PAGE_SIZE
    from += PAGE_SIZE
  }

  return {
    hours: totalMinutes / 60,
    sessionCount,
  }
}

export default async function DashboardPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile) {
    return null
  }

  const isAdmin = profile.role === 'admin'
  const isTutor = profile.role === 'tutor'

  // Sprawdź czy użytkownik jest uczniem (przez parent_email lub przez parents)
  let studentId: string | null = null
  
  // Najpierw sprawdź przez parent_email w students
  const { data: studentDataByEmail } = await supabase
    .from('students')
    .select('id')
    .eq('parent_email', profile.email)
    .limit(1)
    .maybeSingle()

  if (studentDataByEmail) {
    studentId = studentDataByEmail.id
  } else {
    // Jeśli nie znaleziono przez parent_email, sprawdź przez tabelę parents
    const { data: parentData } = await supabase
      .from('parents')
      .select('id')
      .eq('email', profile.email)
      .limit(1)
      .maybeSingle()

    if (parentData) {
      const { data: studentParentData } = await supabase
        .from('student_parents')
        .select('student_id')
        .eq('parent_id', parentData.id)
        .limit(1)
        .maybeSingle()

      if (studentParentData) {
        studentId = studentParentData.student_id
      }
    }
  }

  const isStudent = studentId !== null

  // Pobierz statystyki
  const stats = {
    studentsCount: 0,
    tutorsCount: 0,
    plannedHoursThisMonth: 0,
    plannedSessionsThisMonth: 0,
    activeAssignments: 0,
  }

  if (isAdmin) {
    const [students, tutors, assignments, planned] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'tutor'),
      supabase.from('student_assignments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      getScheduledHoursThisMonth(supabase),
    ])

    stats.studentsCount = students.count || 0
    stats.tutorsCount = tutors.count || 0
    stats.activeAssignments = assignments.count || 0
    stats.plannedHoursThisMonth = planned.hours
    stats.plannedSessionsThisMonth = planned.sessionCount
  }

  if (isTutor) {
    const assignments = await supabase
      .from('student_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('tutor_id', profile.id)
      .eq('status', 'active')

    stats.activeAssignments = assignments.count || 0
  }

  if (isStudent && studentId) {
    const assignments = await supabase
      .from('student_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'active')

    stats.activeAssignments = assignments.count || 0
  }

  // Pobierz najbliższą lekcję dla tutora lub ucznia
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
        tutor_name: null,
      }
    }
  }

  if (isStudent && studentId) {
    const now = new Date().toISOString()
    const { data: nextSessionDataArray } = await supabase
      .from('tutoring_sessions')
      .select(`
        id,
        session_date,
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
      `)
      .eq('student_id', studentId)
      .gte('session_date', now)
      .order('session_date', { ascending: true })
      .limit(1)

    const nextSessionData = nextSessionDataArray && nextSessionDataArray.length > 0 
      ? nextSessionDataArray[0] 
      : null

    if (nextSessionData) {
      const tutor = Array.isArray(nextSessionData.profiles) 
        ? nextSessionData.profiles[0] 
        : nextSessionData.profiles;
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
        student_name: null,
        subject_name: subject?.name || 'Nieznany przedmiot',
        level_name: subjectLevel?.level_name || 'Nieznany poziom',
        tutor_name: tutor?.full_name || 'Nieznany tutor',
      }
    }
  }

  // Pobierz aktywne przypisania dla ucznia
  let studentAssignments: any[] = []
  if (isStudent && studentId) {
    const { data: assignmentsData } = await supabase
      .from('student_assignments')
      .select(`
        id,
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
      .eq('student_id', studentId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    studentAssignments = assignmentsData || []
  }

  // Pobierz aktywne przypisania dla tutora
  let tutorAssignments: any[] = []
  if (isTutor) {
    const { data: assignmentsData } = await supabase
      .from('student_assignments')
      .select(`
        id,
        students (
          id,
          first_name,
          last_name
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
      .eq('tutor_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    tutorAssignments = assignmentsData || []
  }

  // Renderowanie dla ucznia - inna kolejność
  if (isStudent) {
    return (
      <div className="space-y-4">
        {/* 1. Witamy w systemie Akademia Wiedzy */}
        <Card>
          <CardHeader>
            <CardTitle>Witamy w systemie Akademia Wiedzy</CardTitle>
            <CardDescription>
              System zarządzania e-korepetycjami
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Jako uczeń możesz przeglądać swoje lekcje i aktywne przypisania.
            </p>
          </CardContent>
        </Card>

        {/* 2. Najbliższa lekcja */}
        <div className="max-w-md mx-auto">
          {nextSession ? (
            <Card>
              <CardHeader>
                <CardTitle>Najbliższa lekcja</CardTitle>
                <CardDescription>
                  Informacje o Twojej najbliższej zaplanowanej lekcji
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Data:</span>
                  <span className="text-sm font-semibold">
                    {format(new Date(nextSession.session_date), 'EEEE, dd.MM.yyyy HH:mm', { locale: pl })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Tutor:</span>
                  <span className="text-sm font-semibold">{nextSession.tutor_name}</span>
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
          ) : (
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
        </div>

        {/* 3. Aktywne przypisania */}
        <Card>
          <CardHeader>
            <CardTitle>Aktywne przypisania</CardTitle>
            <CardDescription>
              Twoje aktywne przypisania do tutorów
            </CardDescription>
          </CardHeader>
          <CardContent>
            {studentAssignments.length > 0 ? (
              <div className="space-y-3">
                {studentAssignments.map((assignment) => {
                  const tutor = Array.isArray(assignment.profiles) 
                    ? assignment.profiles[0] 
                    : assignment.profiles;
                  const subject = Array.isArray(assignment.subjects) 
                    ? assignment.subjects[0] 
                    : assignment.subjects;
                  const subjectLevel = Array.isArray(assignment.subject_levels) 
                    ? assignment.subject_levels[0] 
                    : assignment.subject_levels;

                  return (
                    <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{subject?.name || 'Nieznany przedmiot'}</p>
                        <p className="text-xs text-muted-foreground">
                          {subjectLevel?.level_name || 'Nieznany poziom'} • {tutor?.full_name || 'Nieznany tutor'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nie masz żadnych aktywnych przypisań.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Renderowanie dla tutora - zmieniona kolejność
  if (isTutor) {
    return (
      <div className="space-y-6">
        <DashboardWelcomeCard description="Jako tutor możesz zarządzać swoimi uczniami i dodawać sesje korepetycji." />

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* 2. Najbliższa lekcja */}
          <section className="lg:col-span-5">
            <div className="mb-2 flex min-h-8 items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Najbliższa lekcja</div>
              <Button asChild variant="link" className="h-8 p-0 text-xs font-semibold">
                <Link href="/dashboard/kalendarz-lekcji">Zobacz kalendarz</Link>
              </Button>
            </div>

            {nextSession ? (
              <Card className="py-5">
                <CardContent className="space-y-3">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                    DATA I GODZINA
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    {format(new Date(nextSession.session_date), "dd.MM.yyyy, HH:mm", { locale: pl })}
                  </div>

                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">UCZEŃ</div>
                      <div className="text-sm font-semibold">{nextSession.student_name}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">PRZEDMIOT</div>
                      <div className="text-sm font-semibold">{nextSession.subject_name}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-[11px] font-semibold text-muted-foreground">POZIOM</div>
                      <div className="text-sm font-semibold">{nextSession.level_name}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="py-5">
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Nie masz zaplanowanych żadnych lekcji w przyszłości.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* 3. Aktywne przypisania */}
          <section className="lg:col-span-7">
            <div className="mb-2 flex min-h-8 items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Aktywne przypisania</div>
              <Button size="sm" variant="outline" className="h-8">
                + Nowe przypisanie
              </Button>
            </div>

            <Card className="py-5">
              <CardContent>
                {tutorAssignments.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border">
                    <div className="grid grid-cols-[1.4fr_1fr_0.9fr] gap-3 bg-muted/40 px-4 py-3 text-[11px] font-semibold text-muted-foreground">
                      <div>STUDENT</div>
                      <div>PRZEDMIOT</div>
                      <div className="text-right">STATUS</div>
                    </div>
                    <div className="divide-y">
                      {tutorAssignments.map((assignment) => {
                        const student = Array.isArray(assignment.students)
                          ? assignment.students[0]
                          : assignment.students
                        const subject = Array.isArray(assignment.subjects)
                          ? assignment.subjects[0]
                          : assignment.subjects
                        const subjectLevel = Array.isArray(assignment.subject_levels)
                          ? assignment.subject_levels[0]
                          : assignment.subject_levels

                        return (
                          <div
                            key={assignment.id}
                            className="grid grid-cols-[1.4fr_1fr_0.9fr] items-center gap-3 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">
                                {student ? `${student.first_name} ${student.last_name}` : "Nieznany uczeń"}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {subjectLevel?.level_name || "Nieznany poziom"}
                              </div>
                            </div>
                            <div className="truncate text-sm font-semibold">
                              {subject?.name || "Nieznany przedmiot"}
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
                                AKTYWNE
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nie masz żadnych aktywnych przypisań.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    )
  }

  // Renderowanie dla admina - oryginalna kolejność
  return (
    <div className="space-y-6">
      <DashboardWelcomeCard description="Jako administrator masz pełny dostęp do zarządzania uczniami, tutorami, przedmiotami oraz zrealizowanymi lekcjami." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Aktywne przypisania
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeAssignments}</div>
            <p className="text-xs text-muted-foreground">
              W całym systemie
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Zaplanowane godziny
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.plannedHoursThisMonth.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.plannedSessionsThisMonth} lekcji w tym miesiącu
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

