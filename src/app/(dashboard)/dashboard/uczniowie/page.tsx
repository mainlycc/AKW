import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { StudentsTable } from "./students-table"

export default async function StudentsPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile) {
    return null
  }

  const isAdmin = profile.role === 'admin'
  const isTutor = profile.role === 'tutor'

  let students = []

  if (isAdmin) {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })

    students = data || []
  } else if (isTutor) {
    // Tutorzy widzą tylko swoich uczniów
    const { data } = await supabase
      .from('students')
      .select(`
        *,
        student_assignments!inner(
          tutor_id,
          status
        )
      `)
      .eq('student_assignments.tutor_id', profile.id)
      .eq('student_assignments.status', 'active')
      .order('created_at', { ascending: false })

    students = data || []
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isAdmin ? 'Uczniowie' : 'Moi Uczniowie'}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Zarządzaj uczniami w systemie' : 'Lista Twoich uczniów'}
          </p>
        </div>
      </div>

      <StudentsTable students={students} isAdmin={isAdmin} />
    </div>
  )
}

