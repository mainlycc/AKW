import { getUserProfile } from "@/lib/actions/auth"
import { getTutorAvailability } from "@/lib/actions/availability"
import { AvailabilityCalendar } from "./availability-calendar"
import { redirect } from "next/navigation"

export default async function CalendarPage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'tutor') {
    redirect('/dashboard')
  }

  const availability = await getTutorAvailability(profile.id)

  return (
    <div className="space-y-4">
      <AvailabilityCalendar
        tutorId={profile.id}
        initialAvailability={availability}
      />
    </div>
  )
}

