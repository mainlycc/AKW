import { getUserProfile } from "@/lib/actions/auth"
import { getInvitations } from "@/lib/actions/invitations"
import { InvitationsManagement } from "./invitations-management"

export default async function InvitationsPage() {
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

  const invitations = await getInvitations()

  return (
    <div className="space-y-4">
      <InvitationsManagement invitations={invitations} />
    </div>
  )
}

