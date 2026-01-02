import { getUserProfile } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ReportForm } from "../report-form"

export default async function NewReportPage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'tutor') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

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

  return (
    <div className="space-y-4">
      <ReportForm
        tutorId={profile.id}
        students={students || []}
      />
    </div>
  )
}

