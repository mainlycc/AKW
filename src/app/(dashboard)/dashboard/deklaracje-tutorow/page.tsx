import { getUserProfile } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { DeclarationsManagement } from "./declarations-management"
import { LABELS } from "@/lib/labels/reports-declarations"

interface MonthlyDeclaration {
  id: string
  month: number
  year: number
  status: string
  submitted_at: string | null
  approved_at: string | null
  created_at: string
  profiles: {
    id: string
    full_name: string
  }
  monthly_declaration_entries: {
    id: string
    session_date: string
    start_time: string
    duration_minutes: number
    students: {
      first_name: string
      last_name: string
    }
  }[]
}

export default async function TutorDeclarationsPage() {
  const profile = await getUserProfile()

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

  // Get all declarations with details
  const { data: declarations, error: declarationsError } = await supabase
    .from('monthly_declarations')
    .select(`
      id,
      month,
      year,
      status,
      submitted_at,
      approved_at,
      created_at,
      profiles!monthly_declarations_tutor_id_fkey (
        id,
        full_name
      ),
      monthly_declaration_entries (
        id,
        session_date,
        start_time,
        duration_minutes,
        students (
          first_name,
          last_name
        )
      )
    `)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (declarationsError) {
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          {LABELS.fetchNextMonthPlansError}: {declarationsError.message}
        </p>
      </div>
    )
  }

  // Get all tutors for filter
  const { data: tutors, error: tutorsError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'tutor')
    .order('full_name')

  if (tutorsError) {
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Błąd podczas pobierania tutorów: {tutorsError.message}
        </p>
      </div>
    )
  }

  // Transform declarations: Supabase returns profiles as array, but we need single object
  const validDeclarations: MonthlyDeclaration[] = (declarations || [])
    .filter((declaration: any) => {
      const profileData = Array.isArray(declaration.profiles) 
        ? declaration.profiles[0] 
        : declaration.profiles
      return profileData !== null && profileData !== undefined
    })
    .map((declaration: any) => {
      const profileData = Array.isArray(declaration.profiles) 
        ? declaration.profiles[0] 
        : declaration.profiles
      
      return {
        id: declaration.id,
        month: declaration.month,
        year: declaration.year,
        status: declaration.status,
        submitted_at: declaration.submitted_at,
        approved_at: declaration.approved_at,
        created_at: declaration.created_at,
        profiles: {
          id: profileData.id,
          full_name: profileData.full_name,
        },
        monthly_declaration_entries: (declaration.monthly_declaration_entries || []).map((entry: any) => ({
          id: entry.id,
          session_date: entry.session_date,
          start_time: entry.start_time,
          duration_minutes: entry.duration_minutes,
          students: entry.students || { first_name: '', last_name: '' },
        })),
      } as MonthlyDeclaration
    })

  return (
    <div className="space-y-4">
      <DeclarationsManagement
        declarations={validDeclarations}
        tutors={tutors || []}
        adminId={profile.id}
      />
    </div>
  )
}

