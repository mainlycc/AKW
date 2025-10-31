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

  type TutorAssignmentRow = {
    id: string
    status: string
    students: { id: string; first_name: string; last_name: string } | null
    subjects: { id: string; name: string } | null
    subject_levels: { id: string; level_name: string } | null
  }

  const assignments: AssignmentOption[] = (assignmentsRaw as TutorAssignmentRow[]).map((a: TutorAssignmentRow) => ({
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

