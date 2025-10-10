import { getUserProfile } from "@/lib/actions/auth"
import { getAllTutorsAvailability } from "@/lib/actions/availability"
import { TutorAvailabilityList } from "./tutor-availability-list"

export default async function TutorAvailabilityPage() {
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

  const tutors = await getAllTutorsAvailability()

  return (
    <div className="space-y-4">
      <TutorAvailabilityList tutors={tutors} />
    </div>
  )
}

