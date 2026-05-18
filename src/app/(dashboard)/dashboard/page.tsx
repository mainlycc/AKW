import { getUserProfile } from "@/lib/actions/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import Link from "next/link"

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

  if (isStudent && studentId) {
    const assignments = await supabase
      .from('student_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
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

  if (isStudent && studentId) {
    sessionsQuery.eq('student_id', studentId)
  }

  const { data: sessions } = await sessionsQuery

  if (sessions) {
    stats.sessionsThisMonth = sessions.length
    stats.totalHoursThisMonth = sessions.reduce((acc, s) => acc + s.duration_minutes, 0) / 60
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
        {/* 1. Witamy w systemie Akademia Wiedzy */}
        <Card className="relative overflow-hidden border bg-card/80 py-0 shadow-sm">
          <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
            <div className="px-5 py-6 sm:px-8 sm:py-8">
              <div className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Witamy w systemie Akademia Wiedzy
              </div>
              <div className="mt-2 text-sm text-muted-foreground sm:text-[15px]">
                System zarządzania e-korepetycjami
              </div>
              <div className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Jako tutor możesz zarządzać swoimi uczniami i dodawać sesje korepetycji.
              </div>
            </div>

            {/* Dekoracyjny panel po prawej — tylko wizualnie */}
            <div className="relative hidden md:block">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200" />
              <div className="absolute inset-0 opacity-[0.35]">
                <svg
                  className="h-full w-full"
                  viewBox="0 0 800 420"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="awFade" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                      <stop offset="1" stopColor="#0f172a" stopOpacity="0.08" />
                    </linearGradient>
                    <pattern id="awGrid" width="44" height="44" patternUnits="userSpaceOnUse">
                      <path
                        d="M0 44V0H44"
                        fill="none"
                        stroke="#94a3b8"
                        strokeOpacity="0.35"
                        strokeWidth="1"
                      />
                      <circle cx="22" cy="22" r="2.2" fill="#64748b" fillOpacity="0.35" />
                    </pattern>
                    <filter id="awSoft" x="-10%" y="-10%" width="120%" height="120%">
                      <feGaussianBlur stdDeviation="10" />
                    </filter>
                  </defs>

                  <rect width="800" height="420" fill="url(#awGrid)" />
                  <path
                    d="M520 60c120 12 178 88 214 158 38 74 12 140-62 174-90 42-190 30-276-22-92-56-116-158-74-234 40-72 112-88 198-76z"
                    fill="#60a5fa"
                    fillOpacity="0.22"
                    filter="url(#awSoft)"
                  />
                  <path
                    d="M610 250c88-20 142 4 170 44 30 44 18 90-36 116-62 30-142 22-204-10-66-34-90-90-62-132 26-38 78-48 132-18z"
                    fill="#22c55e"
                    fillOpacity="0.14"
                    filter="url(#awSoft)"
                  />
                  <rect width="800" height="420" fill="url(#awFade)" />
                </svg>
              </div>
              <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-transparent via-card/60 to-card" />
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* 2. Najbliższa lekcja */}
          <section className="lg:col-span-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Najbliższa lekcja</div>
              <Button asChild variant="link" className="h-auto p-0 text-xs font-semibold">
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
            <div className="mb-2 flex items-center justify-between">
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
      <Card className="relative overflow-hidden border bg-card/80 py-0 shadow-sm">
        <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Witamy w systemie Akademia Wiedzy
            </div>
            <div className="mt-2 text-sm text-muted-foreground sm:text-[15px]">
              System zarządzania e-korepetycjami
            </div>
            <div className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Jako administrator masz pełny dostęp do zarządzania uczniami, tutorami, przedmiotami oraz zrealizowanymi lekcjami.
            </div>
          </div>

          {/* Prawa kolumna — analogicznie, ale bez gradientu */}
          <div className="relative hidden md:block">
            <div className="absolute inset-0 bg-muted/40" />
            <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-transparent via-card/60 to-card" />
          </div>
        </div>
      </Card>

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
    </div>
  )
}

