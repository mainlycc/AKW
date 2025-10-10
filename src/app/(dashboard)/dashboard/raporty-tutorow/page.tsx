import { getUserProfile } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { ReportsManagement } from "./reports-management"

export default async function TutorReportsPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Brak dostępu. Ta strona jest dostępna tylko dla administratorów.
        </p>
      </div>
    )
  }

  // Get all reports with details
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
      approved_at,
      created_at,
      profiles!monthly_reports_tutor_id_fkey (
        id,
        full_name,
        hourly_rate
      ),
      monthly_report_entries (
        id,
        hours,
        students (
          first_name,
          last_name
        )
      )
    `)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  // Get all tutors for filter
  const { data: tutors } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'tutor')
    .order('full_name')

  return (
    <div className="space-y-4">
      <ReportsManagement
        reports={reports || []}
        tutors={tutors || []}
        adminId={profile.id}
      />
    </div>
  )
}

