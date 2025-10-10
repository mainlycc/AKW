import { getUserProfile } from "@/lib/actions/auth"
import { getParents } from "@/lib/actions/parents"
import { ParentsTable } from "./parents-table"

export default async function ParentsPage() {
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

  const parents = await getParents()

  return (
    <div className="space-y-4">
      <ParentsTable parents={parents} />
    </div>
  )
}

