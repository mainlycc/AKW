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

  type TutorAssignmentRawRow = {
    id: unknown
    status: unknown
    students: (
      { id: unknown; first_name: unknown; last_name: unknown } |
      { id: unknown; first_name: unknown; last_name: unknown }[]
    ) | null
    subjects: (
      { id: unknown; name: unknown } |
      { id: unknown; name: unknown }[]
    ) | null
    subject_levels: (
      { id: unknown; level_name: unknown } |
      { id: unknown; level_name: unknown }[]
    ) | null
  }

  const toSingle = <T,>(val: T | T[] | null | undefined): T | null => {
    if (Array.isArray(val)) return val[0] ?? null
    return val ?? null
  }

  const rawRows = assignmentsRaw as TutorAssignmentRawRow[]
  const assignments: AssignmentOption[] = rawRows.map((a) => {
    const stud = toSingle(a.students)
    const subj = toSingle(a.subjects)
    const level = toSingle(a.subject_levels)
    return {
      id: String(a.id ?? ''),
      students: {
        id: String(stud?.id ?? ''),
        first_name: String(stud?.first_name ?? ''),
        last_name: String(stud?.last_name ?? ''),
      },
      subjects: {
        id: String(subj?.id ?? ''),
        name: String(subj?.name ?? ''),
      },
      subject_levels: {
        id: String(level?.id ?? ''),
        level_name: String(level?.level_name ?? ''),
      },
    }
  })

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

