import { getUserProfile } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { ReportsManagement } from "./reports-management"

interface MonthlyReport {
  id: string
  month: number
  year: number
  status: string
  total_hours: number
  total_amount: number | null
  submitted_at: string | null
  profiles: {
    id: string
    full_name: string
    hourly_rate: number | null
  }
  monthly_report_entries: {
    id: string
    hours: number
    students: {
      first_name: string
      last_name: string
    }
  }[]
}

export default async function TutorReportsPage() {
  console.log('[TutorReportsPage] Starting page render')
  
  let profile
  try {
    console.log('[TutorReportsPage] Fetching user profile...')
    profile = await getUserProfile()
    console.log('[TutorReportsPage] User profile fetched:', { id: profile?.id, role: profile?.role })
  } catch (error) {
    console.error('[TutorReportsPage] Error fetching user profile:', error)
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Błąd podczas pobierania profilu użytkownika: {error instanceof Error ? error.message : 'Nieznany błąd'}
        </p>
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Brak dostępu. Ta strona jest dostępna tylko dla administratorów.
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  console.log('[TutorReportsPage] Supabase client created')

  // Get all reports with details
  console.log('[TutorReportsPage] Fetching reports...')
  const { data: reports, error: reportsError } = await supabase
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

  if (reportsError) {
    console.error('[TutorReportsPage] Error fetching reports:', reportsError)
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Błąd podczas pobierania raportów: {reportsError.message}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Szczegóły: {JSON.stringify(reportsError, null, 2)}
        </p>
      </div>
    )
  }

  console.log('[TutorReportsPage] Reports fetched:', {
    count: reports?.length || 0,
    sample: reports?.[0] ? {
      id: reports[0].id,
      hasProfile: !!reports[0].profiles,
      hasEntries: !!reports[0].monthly_report_entries
    } : null
  })

  // Get all tutors for filter
  console.log('[TutorReportsPage] Fetching tutors...')
  const { data: tutors, error: tutorsError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'tutor')
    .order('full_name')

  if (tutorsError) {
    console.error('Error fetching tutors:', tutorsError)
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Błąd podczas pobierania tutorów: {tutorsError.message}
        </p>
      </div>
    )
  }

  console.log('[TutorReportsPage] Rendering ReportsManagement with', {
    reportsCount: reports?.length || 0,
    tutorsCount: tutors?.length || 0,
    adminId: profile.id
  })

  // Transform reports: Supabase returns profiles as array, but we need single object
  const validReports: MonthlyReport[] = (reports || [])
    .filter((report: any) => {
      // Check if profiles exists and is not null/empty
      const profileData = Array.isArray(report.profiles) 
        ? report.profiles[0] 
        : report.profiles
      return profileData !== null && profileData !== undefined
    })
    .map((report: any) => {
      // Extract single profile from array (should be only one due to foreign key)
      const profileData = Array.isArray(report.profiles) 
        ? report.profiles[0] 
        : report.profiles
      
      return {
        id: report.id,
        month: report.month,
        year: report.year,
        status: report.status,
        total_hours: Number(report.total_hours),
        total_amount: report.total_amount ? Number(report.total_amount) : null,
        submitted_at: report.submitted_at,
        profiles: {
          id: profileData.id,
          full_name: profileData.full_name,
          hourly_rate: profileData.hourly_rate ? Number(profileData.hourly_rate) : null,
        },
        monthly_report_entries: (report.monthly_report_entries || []).map((entry: any) => ({
          id: entry.id,
          hours: Number(entry.hours),
          students: entry.students || { first_name: '', last_name: '' },
        })),
      } as MonthlyReport
    })

  return (
    <div className="space-y-4">
      <ReportsManagement
        reports={validReports}
        tutors={tutors || []}
        adminId={profile.id}
      />
    </div>
  )
}

