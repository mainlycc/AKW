import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { getTutorSubjectLevels } from "@/lib/actions/tutor"
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
      .select(`
        *,
        student_parents (
          id,
          is_primary,
          parents (
            id,
            first_name,
            last_name,
            email,
            phone,
            parent_type
          )
        ),
        student_notes (
          id,
          content,
          created_at,
          profiles (
            id,
            full_name
          )
        ),
        student_subjects (
          subject_level_id,
          subjects (
            name
          ),
          subject_levels (
            level_name
          )
        )
      `)
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
        ),
        student_parents (
          id,
          is_primary,
          parents (
            id,
            first_name,
            last_name,
            email,
            phone,
            parent_type
          )
        ),
        student_notes (
          id,
          content,
          created_at,
          profiles (
            id,
            full_name
          )
        ),
        student_subjects (
          subject_level_id,
          subjects (
            name
          ),
          subject_levels (
            level_name
          )
        )
      `)
      .eq('student_assignments.tutor_id', profile.id)
      .eq('student_assignments.status', 'active')
      .order('created_at', { ascending: false })

    students = data || []
  }

  // Get all parents and subjects for dialog
  let allParents = []
  let allSubjects = []
  let tutorSubjectLevels = []

  if (isAdmin) {
    const [parentsData, subjectsData] = await Promise.all([
      supabase.from('parents').select('*').order('last_name'),
      supabase.from('subjects').select(`
        id,
        name,
        subject_levels (
          id,
          level_name,
          level_order,
          price_per_hour
        )
      `).order('name'),
    ])

    allParents = parentsData.data || []
    allSubjects = subjectsData.data || []
  } else if (isTutor) {
    tutorSubjectLevels = await getTutorSubjectLevels(profile.id)
  }

  return (
    <div className="space-y-4">
      <StudentsTable
        students={students}
        isAdmin={isAdmin}
        isTutor={isTutor}
        allParents={allParents}
        allSubjects={allSubjects}
        tutorId={profile.id}
        tutorSubjectLevels={tutorSubjectLevels}
        currentUserId={profile.id}
      />
    </div>
  )
}

