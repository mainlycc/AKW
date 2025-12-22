import { getUserProfile } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DeclarationForm } from "./declaration-form"

export default async function NewDeclarationPage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'tutor') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Get tutor's assignments with student data
  const { data: assignments } = await supabase
    .from('student_assignments')
    .select(`
      id,
      student_id,
      students (
        id,
        first_name,
        last_name
      )
    `)
    .eq('tutor_id', profile.id)
    .eq('status', 'active')

  // Transform assignments to match the expected format
  const assignmentsWithStudents = (assignments || []).map(a => ({
    id: a.id,
    student_id: a.student_id,
    student: Array.isArray(a.students) ? a.students[0] : a.students,
  }))

  // Also get students list for backward compatibility
  const studentIds = assignmentsWithStudents.map(a => a.student_id)
  const { data: students } = studentIds.length > 0 
    ? await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name
        `)
        .in('id', studentIds)
    : { data: [] }

  return (
    <div className="space-y-4">
      <DeclarationForm
        tutorId={profile.id}
        students={students || []}
        assignments={assignmentsWithStudents}
      />
    </div>
  )
}

