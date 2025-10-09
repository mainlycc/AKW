import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { AssignmentsManagement } from "./assignments-management"

export default async function AssignmentsPage() {
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

  // Pobierz wszystkie przypisania z pełnymi danymi
  const { data: assignments } = await supabase
    .from('student_assignments')
    .select(`
      *,
      students (
        id,
        first_name,
        last_name
      ),
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
        level_name,
        price_per_hour
      )
    `)
    .order('created_at', { ascending: false })

  // Pobierz listę uczniów, tutorów, przedmiotów i poziomów dla formularzy
  const [students, tutors, subjects] = await Promise.all([
    supabase.from('students').select('id, first_name, last_name').order('last_name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'tutor').order('full_name'),
    supabase
      .from('subjects')
      .select(`
        id,
        name,
        subject_levels (
          id,
          level_name,
          level_order,
          price_per_hour
        )
      `)
      .order('name'),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Przypisania</h1>
        <p className="text-muted-foreground">
          Przypisuj uczniów do tutorów
        </p>
      </div>

      <AssignmentsManagement
        assignments={assignments || []}
        students={students.data || []}
        tutors={tutors.data || []}
        subjects={subjects.data || []}
        adminId={profile.id}
      />
    </div>
  )
}

