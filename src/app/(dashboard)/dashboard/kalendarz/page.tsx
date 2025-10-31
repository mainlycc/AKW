import { getUserProfile } from "@/lib/actions/auth"
import { getTutorAvailability } from "@/lib/actions/availability"
import { listTutorBookedSlots, getTutorActiveAssignments } from './actions'
import { AvailabilityCalendar } from "./availability-calendar"
import type { AssignmentOption } from './assign-dialog'
import { redirect } from "next/navigation"

export default async function CalendarPage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'tutor') {
    redirect('/dashboard')
  }

  const [availability, bookedSlots, assignmentsRaw] = await Promise.all([
    getTutorAvailability(profile.id),
    listTutorBookedSlots(profile.id),
    getTutorActiveAssignments(profile.id),
  ])

  const assignments: AssignmentOption[] = (assignmentsRaw as any[]).map((a) => ({
    id: String(a.id),
    students: {
      id: String(a.students?.id ?? ''),
      first_name: String(a.students?.first_name ?? ''),
      last_name: String(a.students?.last_name ?? ''),
    },
    subjects: {
      id: String(a.subjects?.id ?? ''),
      name: String(a.subjects?.name ?? ''),
    },
    subject_levels: {
      id: String(a.subject_levels?.id ?? ''),
      level_name: String(a.subject_levels?.level_name ?? ''),
    },
  }))

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

