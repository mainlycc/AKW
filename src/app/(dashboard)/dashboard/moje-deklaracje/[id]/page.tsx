import { getUserProfile } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DeclarationForm } from "../nowa/declaration-form"
import type { DeclarationEntry } from "../actions"

export default async function EditDeclarationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'tutor') {
    redirect('/dashboard')
  }

  const { id } = await params
  const supabase = await createClient()

  // Get declaration
  const { data: declaration } = await supabase
    .from('monthly_declarations')
    .select(`
      id,
      month,
      year,
      status,
      tutor_id,
      monthly_declaration_entries (
        id,
        student_id,
        session_date,
        start_time,
        duration_minutes,
        assignment_id
      )
    `)
    .eq('id', id)
    .eq('tutor_id', profile.id)
    .single()

  if (!declaration || declaration.status !== 'draft') {
    redirect('/dashboard/moje-deklaracje')
  }

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

  const entries: DeclarationEntry[] = (declaration.monthly_declaration_entries || []).map(e => ({
    student_id: e.student_id,
    session_date: e.session_date,
    start_time: e.start_time,
    duration_minutes: e.duration_minutes,
    assignment_id: e.assignment_id,
  }))

  return (
    <div className="space-y-4">
      <DeclarationForm
        tutorId={profile.id}
        students={students || []}
        assignments={assignmentsWithStudents}
        initialDeclaration={{
          month: declaration.month,
          year: declaration.year,
          entries,
        }}
      />
    </div>
  )
}

