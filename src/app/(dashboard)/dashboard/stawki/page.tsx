import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/actions/auth"
import { RatesManagement } from "./rates-management"

export default async function RatesPage() {
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Zarządzanie stawkami</h1>
        <p className="text-sm text-muted-foreground">
          Ustaw domyślne stawki godzinowe dla studentów i tutorów
        </p>
      </div>
      <RatesManagement />
    </div>
  )
}
