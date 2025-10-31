import { getUserProfile } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { ReportsTable } from "./reports-table"
import { redirect } from "next/navigation"

export default async function MyReportsPage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'tutor') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Get tutor's reports with entries for editing drafts
  const { data: reports } = await supabase
    .from('monthly_reports')
    .select(`
      id,
      month,
      year,
      status,
      total_hours,
      total_amount,
      submitted_at,
      created_at,
      monthly_report_entries (
        id,
        student_id,
        hours
      )
    `)
    .eq('tutor_id', profile.id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  // Get tutor's students
  // First get student IDs from assignments
  const { data: assignments } = await supabase
    .from('student_assignments')
    .select('student_id')
    .eq('tutor_id', profile.id)
    .eq('status', 'active')

  const studentIds = assignments?.map(a => a.student_id) || []

  // Then get student details
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
      <ReportsTable
        reports={reports || []}
        tutorId={profile.id}
        students={students || []}
      />
    </div>
  )
}

