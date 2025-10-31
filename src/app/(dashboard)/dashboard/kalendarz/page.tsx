import { getUserProfile } from "@/lib/actions/auth"
import { getTutorAvailability } from "@/lib/actions/availability"
import { listTutorBookedSlots, getTutorActiveAssignments } from './actions'
import { AvailabilityCalendar } from "./availability-calendar"
import { redirect } from "next/navigation"

export default async function CalendarPage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'tutor') {
    redirect('/dashboard')
  }

  const [availability, bookedSlots, assignments] = await Promise.all([
    getTutorAvailability(profile.id),
    listTutorBookedSlots(profile.id),
    getTutorActiveAssignments(profile.id),
  ])

  return (
    <div className="space-y-4">
      <AvailabilityCalendar
        tutorId={profile.id}
        initialAvailability={availability}
        initialBookedSlots={bookedSlots}
        initialAssignments={assignments}
        currentUserId={profile.id}
      />
    </div>
  )
}

