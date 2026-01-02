import { getUserProfile } from "@/lib/actions/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

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
              Jako tutor możesz zarządzać swoimi uczniami i dodawać sesje korepetycji.
            </p>
          </CardContent>
        </Card>

        {/* 2. Najbliższa lekcja */}
        {nextSession ? (
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

        {/* 3. Aktywne przypisania */}
        <Card>
          <CardHeader>
            <CardTitle>Aktywne przypisania</CardTitle>
            <CardDescription>
              Twoi uczniowie i przypisane przedmioty
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tutorAssignments.length > 0 ? (
              <div className="space-y-3">
                {tutorAssignments.map((assignment) => {
                  const student = Array.isArray(assignment.students) 
                    ? assignment.students[0] 
                    : assignment.students;
                  const subject = Array.isArray(assignment.subjects) 
                    ? assignment.subjects[0] 
                    : assignment.subjects;
                  const subjectLevel = Array.isArray(assignment.subject_levels) 
                    ? assignment.subject_levels[0] 
                    : assignment.subject_levels;

                  return (
                    <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          {student ? `${student.first_name} ${student.last_name}` : 'Nieznany uczeń'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {subject?.name || 'Nieznany przedmiot'} • {subjectLevel?.level_name || 'Nieznany poziom'}
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

  // Renderowanie dla admina - oryginalna kolejność
  return (
    <div className="space-y-4">
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

      <Card>
        <CardHeader>
          <CardTitle>Witamy w systemie Akademia Wiedzy</CardTitle>
          <CardDescription>
            System zarządzania e-korepetycjami
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Jako administrator masz pełny dostęp do zarządzania uczniami, tutorami, przedmiotami oraz raportami.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

