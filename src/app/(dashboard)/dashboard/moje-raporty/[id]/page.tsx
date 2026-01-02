import { getUserProfile } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ReportForm } from "../report-form"

export default async function EditReportPage({
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

  // Get report
  const { data: report } = await supabase
    .from('monthly_reports')
    .select(`
      id,
      month,
      year,
      status,
      tutor_id,
      monthly_report_entries (
        id,
        student_id,
        hours
      )
    `)
    .eq('id', id)
    .eq('tutor_id', profile.id)
    .single()

  if (!report || report.status !== 'draft') {
    redirect('/dashboard/moje-raporty')
  }

  // Get tutor's students
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

  const entries = (report.monthly_report_entries || []).map(e => ({
    student_id: e.student_id,
    hours: e.hours,
  }))

  return (
    <div className="space-y-4">
      <ReportForm
        tutorId={profile.id}
        students={students || []}
        initialReport={{
          month: report.month,
          year: report.year,
          entries,
        }}
      />
    </div>
  )
}

