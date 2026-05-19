'use client'

import { useMemo, useState } from "react"
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
import type { TutorAvailabilityData } from "@/lib/types/availability.types"
import type { BookedSlot } from "@/lib/actions/booked-slots"
import { SLOT_DURATION_MINUTES } from "@/lib/types/availability.types"
import { LABELS } from "@/lib/labels/reports-declarations"
import { Button } from "@/components/ui/button"
import {
  IconArrowLeft,
  IconDotsVertical,
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
  bookedSlots,
  students,
  tutorSubjects,
}: TutorDetailsViewProps) {
  const router = useRouter()
  const [editDialogOpen, setEditDialogOpen] = useState(false)

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
      <Card>
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
      <Card>
        <CardHeader>
          <CardTitle>Dostępność w tygodniu</CardTitle>
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

              {/* Kalendarz (read-only) */}
              <div className="w-full overflow-x-auto">
                <TimeSlotGrid
                  slots={availability.slots.map((slot) => ({
                    day: slot.day_of_week,
                    startTime: slot.start_time,
                    endTime: slot.end_time,
                    isAvailable: slot.is_available,
                  }))}
                  onSlotToggle={() => {}} // Read-only
                  isEditing={false}
                  bookedSlots={bookedSlots}
                />
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Brak danych o dostępności dla tego tutora
            </div>
          )}
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
    </div>
  )
}

