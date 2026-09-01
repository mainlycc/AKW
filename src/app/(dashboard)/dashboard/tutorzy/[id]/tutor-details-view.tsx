'use client'

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TimeSlotGrid } from "../../kalendarz/time-slot-grid"
import type { TutorAvailabilityData, DayOfWeek } from "@/lib/types/availability.types"
import type { BookedSlot } from "@/lib/types/booked-slots.types"
import { SLOT_DURATION_MINUTES, DAY_NAMES } from "@/lib/types/availability.types"
import { slotMatchesWeekdayTime } from "@/lib/utils/availability-helpers"
import { LABELS } from "@/lib/labels/reports-declarations"
import { Button } from "@/components/ui/button"
import {
  IconArrowLeft,
  IconDotsVertical,
  IconMail,
  IconPencil,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TutorDetailDialog } from "../tutor-detail-dialog"
import { StudentNameLink } from "@/components/student-name-link"
import { SubjectBadge } from "@/components/subject-badge"
import { SlotReservationDialog } from "./slot-reservation-dialog"
import { ReservationNotificationsDialog } from "./reservation-notifications-dialog"
import type { ReservationNotificationContext } from "./notification-actions"
import { cancelTutorBookedSlot } from "./actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ComposeSendDialog } from "@/components/messaging/compose-send-dialog"
import { AVAILABILITY_LABELS, availabilityReminderMessage } from "@/lib/labels/availability"
import { sendAvailabilityReminderToTutor } from "./availability-reminder-actions"
import { toast } from "sonner"

interface Tutor {
  id: string
  full_name: string
  email: string
  phone: string | null
  bio: string | null
  hourly_rate: number | null
  public_booking_enabled?: boolean | null
  activeAssignments?: number
  totalHours?: number
  totalSessions?: number
}

interface StudentWithRelations {
  id: string
  first_name: string
  last_name: string
  parent_email: string
  parent_phone: string | null
  hourly_rate?: number | null
  student_parents?: Array<{
    id: string
    is_primary: boolean
    parents: {
      id: string
      first_name: string
      last_name: string
      email: string
      phone: string | null
    } | null
  }>
  student_assignments?: Array<{
    id: string
    status: string
    subjects: {
      id: string
      name: string
      color?: string | null
    } | null
    subject_levels: {
      id: string
      level_name: string
    } | null
  }>
}

interface TutorSubjectLevel {
  id: string
  subject_id: string
  subject_level_id: string
  subjects: { id: string; name: string; color?: string | null } | null
  subject_levels: { id: string; level_name: string; price_per_hour: number } | null
}

interface TutorDetailsViewProps {
  tutor: Tutor
  defaultTutorRate: number | null
  availability: TutorAvailabilityData | null
  bookedSlots: BookedSlot[]
  students: StudentWithRelations[]
  tutorSubjects: TutorSubjectLevel[]
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function TutorDetailsView({
  tutor,
  defaultTutorRate,
  availability,
  bookedSlots: initialBookedSlots,
  students,
  tutorSubjects,
}: TutorDetailsViewProps) {
  const router = useRouter()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>(initialBookedSlots)
  const [reservationOpen, setReservationOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{
    day: DayOfWeek
    start: string
    end: string
  } | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [slotToCancel, setSlotToCancel] = useState<BookedSlot | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [notificationContext, setNotificationContext] = useState<ReservationNotificationContext | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [availabilityReminderOpen, setAvailabilityReminderOpen] = useState(false)

  useEffect(() => {
    setBookedSlots((prev) => {
      const serverIds = new Set(initialBookedSlots.map((s) => s.id))
      const pendingLocal = prev.filter((s) => !serverIds.has(s.id))
      return [...initialBookedSlots, ...pendingLocal]
    })
  }, [initialBookedSlots])

  // Pobierz podstawowe informacje o rodzicach (pierwszy główny rodzic)
  const getPrimaryParentInfo = (student: StudentWithRelations) => {
    const parents = student.student_parents || []
    const primaryParent = parents.find(p => p.is_primary) || parents[0]
    if (primaryParent?.parents) {
      return {
        email: primaryParent.parents.email,
        phone: primaryParent.parents.phone,
      }
    }
    return {
      email: student.parent_email,
      phone: student.parent_phone,
    }
  }

  // Pobierz przedmioty ucznia
  const renderStudentSubjects = (student: StudentWithRelations) => {
    const assignments = (student.student_assignments || []).filter(
      (a) => a.subjects && a.subject_levels
    )

    if (assignments.length === 0) {
      return <span className="text-muted-foreground">-</span>
    }

    const map = new Map<
      string,
      {
        subject: { id: string; name: string; color?: string | null }
        levels: string[]
      }
    >()

    for (const a of assignments) {
      const subject = a.subjects
      const level = a.subject_levels
      if (!subject || !level) continue

      const existing = map.get(subject.id)
      if (!existing) {
        map.set(subject.id, {
          subject,
          levels: [level.level_name],
        })
      } else if (!existing.levels.includes(level.level_name)) {
        existing.levels.push(level.level_name)
      }
    }

    const grouped = Array.from(map.values())
    if (grouped.length === 0) {
      return <span className="text-muted-foreground">-</span>
    }

    return (
      <div className="flex flex-wrap gap-2">
        {grouped.map(({ subject, levels }) => (
          <div key={subject.id} className="flex flex-wrap items-center gap-2">
            <SubjectBadge subject={subject} className="text-sm px-2 py-0.5" />
            {levels
              .sort((a, b) => a.localeCompare(b, 'pl'))
              .map((lvl) => (
                <Badge key={`${subject.id}-${lvl}`} variant="outline" className="text-sm px-2 py-0.5">
                  {lvl}
                </Badge>
              ))}
          </div>
        ))}
      </div>
    )
  }

  // Formatuj przedmioty tutora do wyświetlenia
  const tutorSubjectsGrouped = useMemo(() => {
    const map = new Map<
      string,
      { subject: { id?: string; name: string; color?: string | null }; levels: string[] }
    >()

    for (const ts of tutorSubjects || []) {
      const subject = Array.isArray(ts.subjects) ? ts.subjects[0] : ts.subjects
      const level = Array.isArray(ts.subject_levels) ? ts.subject_levels[0] : ts.subject_levels
      if (!subject || !level) continue

      const existing = map.get(subject.id)
      if (!existing) {
        map.set(subject.id, {
          subject,
          levels: [level.level_name],
        })
      } else if (!existing.levels.includes(level.level_name)) {
        existing.levels.push(level.level_name)
      }
    }

    return Array.from(map.values()).map((entry) => ({
      subject: entry.subject,
      levels: entry.levels.sort((a, b) => a.localeCompare(b, 'pl')),
    }))
  }, [tutorSubjects])

  const buildSubjectGroupsFromAssignments = (
    assignments: StudentWithRelations['student_assignments']
  ): { subject: { id: string; name: string }; levels: { id: string; level_name: string }[] }[] => {
    const map = new Map<
      string,
      { subject: { id: string; name: string }; levels: { id: string; level_name: string }[] }
    >()

    for (const a of assignments ?? []) {
      if (a.status !== 'active') continue
      const subject = a.subjects
      const level = a.subject_levels
      if (!subject?.id || !level?.id) continue

      const existing = map.get(subject.id)
      if (!existing) {
        map.set(subject.id, {
          subject: { id: subject.id, name: subject.name },
          levels: [{ id: level.id, level_name: level.level_name }],
        })
      } else if (!existing.levels.some((l) => l.id === level.id)) {
        existing.levels.push({ id: level.id, level_name: level.level_name })
      }
    }

    return Array.from(map.values()).map((entry) => ({
      ...entry,
      levels: entry.levels.sort((a, b) => a.level_name.localeCompare(b.level_name, 'pl')),
    }))
  }

  const assignedStudents = useMemo(
    () =>
      students.map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        hourly_rate:
          s.hourly_rate != null && !Number.isNaN(Number(s.hourly_rate))
            ? Number(s.hourly_rate)
            : null,
        subjects: buildSubjectGroupsFromAssignments(s.student_assignments),
      })),
    [students]
  )

  const tutorSubjectsForDialog = useMemo(() => {
    const map = new Map<
      string,
      { subject: { id: string; name: string }; levels: { id: string; level_name: string }[] }
    >()

    for (const ts of tutorSubjects) {
      const subject = Array.isArray(ts.subjects) ? ts.subjects[0] : ts.subjects
      const level = Array.isArray(ts.subject_levels) ? ts.subject_levels[0] : ts.subject_levels
      if (!subject?.id || !level?.id) continue

      const existing = map.get(subject.id)
      if (!existing) {
        map.set(subject.id, {
          subject: { id: subject.id, name: subject.name },
          levels: [{ id: level.id, level_name: level.level_name }],
        })
      } else if (!existing.levels.some((l) => l.id === level.id)) {
        existing.levels.push({ id: level.id, level_name: level.level_name })
      }
    }

    return Array.from(map.values()).map((entry) => ({
      ...entry,
      levels: entry.levels.sort((a, b) => a.level_name.localeCompare(b.level_name, 'pl')),
    }))
  }, [tutorSubjects])

  const getBookedSlotStudentName = (slot: BookedSlot): string => {
    type BookedSlotWithAssignment = BookedSlot & {
      student_assignments?: {
        students?: { first_name: string; last_name: string } | null
      } | null
    }
    const stud = (slot as BookedSlotWithAssignment).student_assignments?.students
    if (stud?.first_name || stud?.last_name) {
      return `${stud.first_name ?? ''} ${stud.last_name ?? ''}`.trim()
    }
    return 'uczeń'
  }

  const handleConfirmCancel = async () => {
    if (!slotToCancel || isCancelling) return

    const cancelled = slotToCancel
    setCancelDialogOpen(false)
    setSlotToCancel(null)
    setBookedSlots((prev) => prev.filter((s) => s.id !== cancelled.id))

    setIsCancelling(true)
    try {
      await cancelTutorBookedSlot(cancelled.id, tutor.id)
      toast.success('Rezerwacja anulowana')
    } catch {
      setBookedSlots((prev) => [...prev, cancelled])
      toast.error('Nie udało się anulować rezerwacji')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleSlotClick = (day: DayOfWeek, startTime: string, endTime: string) => {
    const normalizeTime = (t: string) => t.substring(0, 5)
    const isBooked = bookedSlots.some((b) => slotMatchesWeekdayTime(b, day, startTime))

    if (isBooked) {
      const slot = bookedSlots.find((b) => slotMatchesWeekdayTime(b, day, startTime))
      if (slot) {
        setSlotToCancel(slot)
        setCancelDialogOpen(true)
      }
      return
    }

    const isAvailable = availability?.slots.some(
      (s) =>
        s.day_of_week === day &&
        normalizeTime(s.start_time) === startTime &&
        normalizeTime(s.end_time) === endTime &&
        s.is_available
    )

    if (!isAvailable) return

    if (tutorSubjectsForDialog.length === 0) {
      toast.error('Tutor nie ma przypisanych przedmiotów — dodaj je w edycji profilu tutora.')
      return
    }

    setSelectedSlot({ day, start: startTime, end: endTime })
    setReservationOpen(true)
  }

  const handleReserved = (bookedSlot: BookedSlot) => {
    setBookedSlots((prev) => {
      if (prev.some((s) => s.id === bookedSlot.id)) return prev
      return [...prev, bookedSlot]
    })
    router.refresh()
  }

  const availableSlotsCount = availability?.slots.filter(s => s.is_available).length || 0
  const weeklyHours = (availableSlotsCount * SLOT_DURATION_MINUTES) / 60

  const bookedHours = useMemo(() => {
    const toMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number)
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
      return hours * 60 + minutes
    }

    const totalMinutes = bookedSlots.reduce((acc, slot) => {
      const start = toMinutes(slot.start_time)
      const end = toMinutes(slot.end_time)
      if (end <= start) return acc
      return acc + (end - start)
    }, 0)

    return totalMinutes / 60
  }, [bookedSlots])

  const activeAssignments = useMemo(
    () =>
      students.reduce(
        (acc, student) => acc + (student.student_assignments?.length || 0),
        0
      ),
    [students]
  )

  const tutorWithStats = useMemo(
    () => ({
      ...tutor,
      activeAssignments,
      totalSessions: bookedSlots.length,
      totalHours: bookedHours,
    }),
    [activeAssignments, bookedHours, bookedSlots, tutor]
  )

  const effectiveHourlyRate = tutor.hourly_rate ?? defaultTutorRate
  const hourlyRateText =
    effectiveHourlyRate === null || effectiveHourlyRate === undefined
      ? '-'
      : `${effectiveHourlyRate.toFixed(0)} zł/h`

  return (
    <div className="space-y-6">
      {/* Przycisk powrotu */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/tutorzy')}
          className="mb-4"
        >
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Powrót do listy tutorów
        </Button>
      </div>

      {/* Informacje o tutorze */}
      <Card data-tour="tutor-detail-header">
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle>Informacje o tutorze</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Opcje tutora"
              >
                <IconDotsVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                <IconPencil className="mr-2 h-4 w-4" />
                Edytuj
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Imię i nazwisko</p>
              <p className="text-lg font-semibold">{tutor.full_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{LABELS.clientSubmissions}</p>
              <div className="mt-1 inline-flex items-center gap-2">
                {tutor.public_booking_enabled === false ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden="true" />
                    <span className="text-lg font-semibold">Niedostępny</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
                    <span className="text-lg font-semibold">Dostępny</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-lg">{tutor.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Telefon</p>
              <p className="text-lg">{tutor.phone || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Stawka godzinowa</p>
              <p className="text-lg">{hourlyRateText}</p>
            </div>
            {tutor.bio && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Bio</p>
                <p className="text-lg">{tutor.bio}</p>
              </div>
            )}
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Przedmioty</p>
              {tutorSubjectsGrouped.length === 0 ? (
                <p className="text-lg text-muted-foreground">Brak przypisanych przedmiotów</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {tutorSubjectsGrouped.map(({ subject, levels }) => (
                    <div key={subject.id ?? subject.name} className="flex flex-wrap items-center gap-2">
                      <SubjectBadge subject={subject} className="text-sm px-2 py-0.5" />
                      {levels.map((level) => (
                        <Badge key={level} variant="outline" className="text-sm px-2 py-0.5">
                          {level}
                        </Badge>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dostępność w tygodniu */}
      <Card data-tour="tutor-availability">
        <CardHeader>
          <CardTitle>Dostępność w tygodniu</CardTitle>
          <p className="text-sm text-muted-foreground">
            Kliknij zielony slot, aby zarezerwować lekcję. Kliknij fioletowy, aby anulować rezerwację.
          </p>
        </CardHeader>
        <CardContent>
          {availability ? (
            <div className="space-y-4">
              {/* Info i statystyki */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      Wersja {availability.template.version}
                    </Badge>
                    <Badge variant="outline">
                      Aktywna
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ostatnia aktualizacja: {formatDate(availability.template.updated_at)}
                  </p>
                </div>

                {/* Statystyki */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    Dostępne sloty:{' '}
                    <strong className="text-foreground">
                      {availableSlotsCount}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Godziny tygodniowo:{' '}
                    <strong className="text-foreground">
                      {weeklyHours.toFixed(0)}h
                    </strong>
                  </span>
                </div>
              </div>

              <div className="w-full overflow-x-auto pb-1">
                <TimeSlotGrid
                  slots={availability.slots.map((slot) => ({
                    day: slot.day_of_week,
                    startTime: slot.start_time,
                    endTime: slot.end_time,
                    isAvailable: slot.is_available,
                  }))}
                  onSlotToggle={handleSlotClick}
                  isEditing={false}
                  bookedSlots={bookedSlots}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8 text-center text-muted-foreground">
              <p>Brak danych o dostępności dla tego tutora</p>
              <Button
                variant="outline"
                onClick={() => setAvailabilityReminderOpen(true)}
              >
                <IconMail className="mr-2 h-4 w-4" />
                {AVAILABILITY_LABELS.sendAvailabilityReminderButton}
              </Button>
            </div>
          )}

          <div
            data-tour="tutor-reservation-guide"
            className="mt-4 rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground space-y-1"
          >
            <p className="font-medium text-foreground">Jak zapisać ucznia na zajęcia</p>
            <p>1. Kliknij <strong className="text-foreground">zielony slot</strong> w grafiku powyżej.</p>
            <p>2. Wybierz ucznia (istniejący lub nowy) oraz przedmiot i poziom.</p>
            <p>3. Ustaw rezerwację cykliczną lub jednorazową i kliknij <strong className="text-foreground">Zarezerwuj</strong>.</p>
            <p>4. Wyślij rodzicowi link PayU — po opłaceniu wpłata pojawi się w <strong className="text-foreground">historii płatności</strong>.</p>
          </div>
        </CardContent>
      </Card>

      {/* Lista uczniów */}
      <Card>
        <CardHeader>
          <CardTitle>
            Uczniowie ({students.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Brak przypisanych uczniów
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imię i nazwisko</TableHead>
                    <TableHead>Email rodzica</TableHead>
                    <TableHead>Telefon rodzica</TableHead>
                    <TableHead>Przedmioty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => {
                    const parentInfo = getPrimaryParentInfo(student)

                    // Dane dla dialogu ucznia – rodzice
                    const dialogStudentParents =
                      (student.student_parents || [])
                        .filter((sp) => !!sp.parents)
                        .map((sp) => ({
                          id: sp.id,
                          is_primary: sp.is_primary,
                          parents: {
                            id: sp.parents!.id,
                            first_name: sp.parents!.first_name,
                            last_name: sp.parents!.last_name,
                            email: sp.parents!.email,
                            phone: sp.parents!.phone,
                            // StudentDialog oczekuje pola parent_type, ale w tym widoku
                            // nie korzystamy z niego – ustawiamy neutralną wartość
                            parent_type: "parent",
                          },
                        }))

                    // Dane dla dialogu ucznia – przedmioty
                    const assignmentLevels =
                      (student.student_assignments || []).filter(
                        (a) => a.subjects && a.subject_levels
                      )

                    const dialogStudentSubjects = Array.from(
                      new Set(
                        assignmentLevels
                          .map((a) => a.subject_levels!.id)
                          .filter((id): id is string => !!id)
                      )
                    )

                    const subjectsMap = new Map<
                      string,
                      {
                        id: string
                        name: string
                        color?: string | null
                        subject_levels: {
                          id: string
                          level_name: string
                          level_order: number
                          price_per_hour: number
                        }[]
                      }
                    >()

                    assignmentLevels.forEach((a) => {
                      const subject = a.subjects
                      const level = a.subject_levels
                      if (!subject || !level) return

                      const existing = subjectsMap.get(subject.id)
                      if (!existing) {
                        subjectsMap.set(subject.id, {
                          id: subject.id,
                          name: subject.name,
                          // Kolor może nie być dostępny, ale SubjectBadge sobie poradzi bez niego
                          color: (subject as any).color ?? null,
                          subject_levels: [
                            {
                              id: level.id,
                              level_name: level.level_name,
                              // W tym widoku nie korzystamy z kolejności ani stawki,
                              // ale typ w StudentDialog ich wymaga
                              level_order: 0,
                              price_per_hour: 0,
                            },
                          ],
                        })
                      } else if (
                        !existing.subject_levels.some(
                          (l) => l.id === level.id
                        )
                      ) {
                        existing.subject_levels.push({
                          id: level.id,
                          level_name: level.level_name,
                          level_order: 0,
                          price_per_hour: 0,
                        })
                      }
                    })

                    const dialogAllSubjects = Array.from(subjectsMap.values())

                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          <StudentNameLink
                            student={student}
                            studentParents={dialogStudentParents}
                            studentSubjects={dialogStudentSubjects}
                            allSubjects={dialogAllSubjects}
                          />
                        </TableCell>
                        <TableCell>{parentInfo.email}</TableCell>
                        <TableCell>{parentInfo.phone || '-'}</TableCell>
                        <TableCell>{renderStudentSubjects(student)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <TutorDetailDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        tutor={tutorWithStats}
        tutorSubjects={tutorSubjects}
      />
      {selectedSlot && (
        <SlotReservationDialog
          open={reservationOpen}
          onClose={() => setReservationOpen(false)}
          tutorId={tutor.id}
          weekday={selectedSlot.day}
          startTime={selectedSlot.start}
          endTime={selectedSlot.end}
          assignedStudents={assignedStudents}
          tutorSubjects={tutorSubjectsForDialog}
          onReserved={handleReserved}
          onReservationCreated={({ notificationContext: ctx }) => {
            setNotificationContext(ctx)
            setNotificationsOpen(true)
          }}
        />
      )}
      <ReservationNotificationsDialog
        open={notificationsOpen}
        onClose={() => {
          setNotificationsOpen(false)
          setNotificationContext(null)
        }}
        context={notificationContext}
      />
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          setCancelDialogOpen(open)
          if (!open) setSlotToCancel(null)
        }}
        title="Anulować rezerwację?"
        description={
          slotToCancel
            ? `Slot ${DAY_NAMES[slotToCancel.weekday as DayOfWeek]}, ${slotToCancel.start_time.substring(0, 5)}–${slotToCancel.end_time.substring(0, 5)} jest zarezerwowany dla ${getBookedSlotStudentName(slotToCancel)}. Czy na pewno chcesz anulować tę rezerwację?`
            : 'Czy na pewno chcesz anulować tę rezerwację?'
        }
        confirmText="Anuluj rezerwację"
        cancelText="Zostaw"
        onConfirm={handleConfirmCancel}
      />
      <ComposeSendDialog
        open={availabilityReminderOpen}
        onOpenChange={setAvailabilityReminderOpen}
        title={AVAILABILITY_LABELS.reminderAvailabilityDialog}
        description={`Tutor: ${tutor.full_name}`}
        defaultMessage={availabilityReminderMessage()}
        messagePlaceholder="Wpisz treść przypomnienia..."
        confirmLabel="Wyślij przypomnienie"
        stats={{
          totalRecipients: 1,
          emailAvailable: tutor.email?.trim() ? 1 : 0,
          smsAvailable: tutor.phone?.trim() ? 1 : 0,
          emailUnavailable: tutor.email?.trim() ? 0 : 1,
          smsUnavailable: tutor.phone?.trim() ? 0 : 1,
        }}
        onSend={async ({ message, channel }) => {
          try {
            const result = await sendAvailabilityReminderToTutor(tutor.id, channel, message)
            if (result.success) {
              toast.success('Wysłano przypomnienie o wypełnieniu grafiku')
              setAvailabilityReminderOpen(false)
            } else {
              toast.error(result.error || 'Nie udało się wysłać przypomnienia')
            }
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : 'Nie udało się wysłać przypomnienia'
            )
          }
        }}
      />
    </div>
  )
}

