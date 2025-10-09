import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { SubjectsManagement } from "./subjects-management"

export default async function SubjectsPage() {
  const profile = await getUserProfile()
  const supabase = await createClient()

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Brak dostępu</h1>
        <p className="text-muted-foreground">
          Ta strona jest dostępna tylko dla administratorów.
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Przedmioty</h1>
        <p className="text-muted-foreground">
          Zarządzaj przedmiotami i poziomami trudności
        </p>
      </div>

      <SubjectsManagement subjects={subjects || []} />
    </div>
  )
}

