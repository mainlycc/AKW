import { getUserProfile } from '@/lib/actions/auth'
import { TutorSettlementsTable } from './tutor-settlements-table'

export default async function TutorSettlementsPage() {
  let profile
  try {
    profile = await getUserProfile()
  } catch (error) {
    console.error('[TutorSettlementsPage] Error fetching user profile:', error)
    return (
      <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <p className="text-sm text-destructive font-medium">
          Błąd podczas pobierania profilu użytkownika:{' '}
          {error instanceof Error ? error.message : 'Nieznany błąd'}
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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground">
          Rozliczenia tutorów na podstawie zatwierdzonych raportów miesięcznych.
        </p>
      </div>
      <TutorSettlementsTable />
    </div>
  )
}

