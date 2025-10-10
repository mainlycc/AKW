import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { SubjectsManagement } from "./subjects-management"

export default async function SubjectsPage() {
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

  const { data: subjects } = await supabase
    .from('subjects')
    .select(`
      *,
      subject_levels (
        id,
        level_name,
        level_order,
        price_per_hour
      )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <SubjectsManagement subjects={subjects || []} />
    </div>
  )
}

