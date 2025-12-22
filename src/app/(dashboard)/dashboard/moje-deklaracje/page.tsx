import { getUserProfile } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { DeclarationsTable } from "./declarations-table"
import { redirect } from "next/navigation"

export default async function MyDeclarationsPage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'tutor') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Get tutor's declarations with entries
  const { data: declarations } = await supabase
    .from('monthly_declarations')
    .select(`
      id,
      month,
      year,
      status,
      submitted_at,
      approved_at,
      created_at,
      monthly_declaration_entries (
        id,
        student_id,
        session_date,
        start_time,
        duration_minutes,
        assignment_id
      )
    `)
    .eq('tutor_id', profile.id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  // Get tutor's students
  const { data: assignments } = await supabase
    .from('student_assignments')
    .select('student_id')
    .eq('tutor_id', profile.id)
    .eq('status', 'active')

  const studentIds = assignments?.map(a => a.student_id) || []

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
      <DeclarationsTable
        declarations={declarations || []}
        tutorId={profile.id}
        students={students || []}
      />
    </div>
  )
}

