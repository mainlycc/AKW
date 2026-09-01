'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { calculateAdminReservationAmount } from '@/lib/utils/admin-reservation-pricing'
import { getNextOccurrenceForWeekday } from '@/lib/utils/availability-helpers'
import { DAY_NAMES, SLOT_DURATION_MINUTES, type DayOfWeek } from '@/lib/types/availability.types'
import type { BookedSlot } from '@/lib/types/booked-slots.types'
import type { ReservationNotificationContext } from './notification-actions'
import { reserveTutorSlot } from './actions'
import { toast } from 'sonner'
import { IconCalendar, IconRepeat } from '@tabler/icons-react'

interface StudentOption {
  id: string
  first_name: string
  last_name: string
  hourly_rate: number | null
  subjects: TutorSubjectGroup[]
}

interface TutorSubjectGroup {
  subject: { id: string; name: string }
  levels: { id: string; level_name: string }[]
}

interface SlotReservationDialogProps {
  open: boolean
  onClose: () => void
  tutorId: string
  weekday: DayOfWeek
  startTime: string
  endTime: string
  assignedStudents: StudentOption[]
  tutorSubjects: TutorSubjectGroup[]
  onReserved: (bookedSlot: BookedSlot) => void
  onReservationCreated?: (payload: {
    bookedSlot: BookedSlot
    notificationContext: ReservationNotificationContext
  }) => void
}

export function SlotReservationDialog({
  open,
  onClose,
  tutorId,
  weekday,
  startTime,
  endTime,
  assignedStudents,
  tutorSubjects,
  onReserved,
  onReservationCreated,
}: SlotReservationDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [studentMode, setStudentMode] = useState<'existing' | 'new'>('existing')
  const [studentId, setStudentId] = useState('')
  const [newStudent, setNewStudent] = useState({
    first_name: '',
    last_name: '',
    parent_email: '',
  })
  const [subjectId, setSubjectId] = useState('')
  const [subjectLevelId, setSubjectLevelId] = useState('')
  const [isRecurring, setIsRecurring] = useState(true)
  const [hourlyRateInput, setHourlyRateInput] = useState('')

  const selectedStudent = assignedStudents.find((s) => s.id === studentId)
  const hoursPerLesson = SLOT_DURATION_MINUTES / 60
  const parsedHourlyRate = useMemo(() => {
    const trimmed = hourlyRateInput.trim()
    if (!trimmed) return null
    const value = parseFloat(trimmed.replace(',', '.'))
    return Number.isNaN(value) || value <= 0 ? null : value
  }, [hourlyRateInput])

  const singleLessonPricePreview = useMemo(() => {
    if (parsedHourlyRate === null) return null
    return calculateAdminReservationAmount(parsedHourlyRate, 1, false)
  }, [parsedHourlyRate])

  const subjectOptions = useMemo(() => {
    if (studentMode === 'existing') {
      return selectedStudent?.subjects ?? []
    }
    return tutorSubjects
  }, [studentMode, selectedStudent, tutorSubjects])

  const selectedSubject = subjectOptions.find((s) => s.subject.id === subjectId)
  const availableLevels = selectedSubject?.levels ?? []

  const nextOccurrence = useMemo(
    () => getNextOccurrenceForWeekday(weekday, startTime),
    [weekday, startTime]
  )

  useEffect(() => {
    if (!open) return
    setStudentMode('existing')
    setNewStudent({ first_name: '', last_name: '', parent_email: '' })
    setIsRecurring(true)
    setStudentId(assignedStudents.length === 1 ? assignedStudents[0].id : '')
    setSubjectId('')
    setSubjectLevelId('')
    setHourlyRateInput('')
  }, [open, weekday, startTime, assignedStudents])

  useEffect(() => {
    if (!open) return
    if (studentMode === 'new') {
      setHourlyRateInput('')
      return
    }
    if (!studentId) {
      setHourlyRateInput('')
      return
    }
    const student = assignedStudents.find((s) => s.id === studentId)
    setHourlyRateInput(
      student?.hourly_rate != null && !Number.isNaN(student.hourly_rate)
        ? String(student.hourly_rate)
        : ''
    )
  }, [open, studentMode, studentId, assignedStudents])

  // Auto-uzupełnij przedmiot i poziom, gdy nie ma wyboru
  useEffect(() => {
    if (!open) return
    if (studentMode === 'existing' && !studentId) {
      setSubjectId('')
      setSubjectLevelId('')
      return
    }

    if (subjectOptions.length === 1) {
      const { subject, levels } = subjectOptions[0]
      setSubjectId(subject.id)
      setSubjectLevelId(levels.length === 1 ? levels[0].id : '')
      return
    }

    setSubjectId('')
    setSubjectLevelId('')
  }, [open, studentMode, studentId, subjectOptions])

  // Auto-uzupełnij poziom, gdy wybrany przedmiot ma tylko jeden poziom
  useEffect(() => {
    if (!subjectId) return
    const levels = subjectOptions.find((o) => o.subject.id === subjectId)?.levels ?? []
    if (levels.length === 1) {
      setSubjectLevelId(levels[0].id)
    }
  }, [subjectId, subjectOptions])

  const singleStudent = assignedStudents.length === 1
  const singleSubject = subjectOptions.length === 1
  const singleLevel = availableLevels.length === 1

  const handleSubmit = () => {
    if (!subjectId || !subjectLevelId) {
      toast.error('Wybierz przedmiot i poziom')
      return
    }
    if (studentMode === 'existing' && subjectOptions.length === 0) {
      toast.error('Ten uczeń nie ma aktywnych przypisań przedmiotów u tego tutora')
      return
    }
    if (studentMode === 'existing' && !studentId) {
      toast.error('Wybierz ucznia')
      return
    }
    if (studentMode === 'new') {
      if (!newStudent.first_name.trim() || !newStudent.last_name.trim()) {
        toast.error('Podaj imię i nazwisko ucznia')
        return
      }
      if (!newStudent.parent_email.trim()) {
        toast.error('Podaj email rodzica')
        return
      }
    }

    startTransition(async () => {
      try {
        const result = await reserveTutorSlot({
          tutorId,
          weekday,
          startTime,
          endTime,
          isRecurring,
          studentMode,
          studentId: studentMode === 'existing' ? studentId : undefined,
          newStudent: studentMode === 'new' ? newStudent : undefined,
          subject_id: subjectId,
          subject_level_id: subjectLevelId,
          hourlyRate: parsedHourlyRate,
        })
        toast.success(isRecurring ? 'Cykliczna rezerwacja utworzona' : 'Jednorazowa lekcja zaplanowana')
        onReserved(result.bookedSlot)
        onClose()
        onReservationCreated?.({
          bookedSlot: result.bookedSlot,
          notificationContext: result.notificationContext,
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Nie udało się zarezerwować slotu')
      }
    })
  }

  const slotLabel = `${DAY_NAMES[weekday]}, ${startTime}–${endTime}`

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="w-[95vw] sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zarezerwuj lekcję</DialogTitle>
          <DialogDescription>
            Slot: <strong>{slotLabel}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Uczeń */}
          <div className="space-y-3">
            <Label>Uczeń</Label>
            <Tabs
              value={studentMode}
              onValueChange={(v) => setStudentMode(v as 'existing' | 'new')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Istniejący</TabsTrigger>
                <TabsTrigger value="new">Nowy uczeń</TabsTrigger>
              </TabsList>
            </Tabs>

            {studentMode === 'existing' ? (
              <Select value={studentId} onValueChange={setStudentId} disabled={singleStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz ucznia przypisanego do tutora" />
                </SelectTrigger>
                <SelectContent>
                  {assignedStudents.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      Brak uczniów przypisanych do tego tutora
                    </SelectItem>
                  ) : (
                    assignedStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.first_name} {s.last_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-first-name">Imię</Label>
                    <Input
                      id="new-first-name"
                      value={newStudent.first_name}
                      onChange={(e) =>
                        setNewStudent((p) => ({ ...p, first_name: e.target.value }))
                      }
                      placeholder="Imię ucznia"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-last-name">Nazwisko</Label>
                    <Input
                      id="new-last-name"
                      value={newStudent.last_name}
                      onChange={(e) =>
                        setNewStudent((p) => ({ ...p, last_name: e.target.value }))
                      }
                      placeholder="Nazwisko ucznia"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-parent-email">Email rodzica</Label>
                  <Input
                    id="new-parent-email"
                    type="email"
                    value={newStudent.parent_email}
                    onChange={(e) =>
                      setNewStudent((p) => ({ ...p, parent_email: e.target.value }))
                    }
                    placeholder="rodzic@example.com"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Przedmiot i poziom */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Przedmiot</Label>
              <Select
                value={subjectId}
                onValueChange={(v) => {
                  setSubjectId(v)
                  setSubjectLevelId('')
                }}
                disabled={(studentMode === 'existing' && !studentId) || singleSubject}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      studentMode === 'existing' && !studentId
                        ? 'Najpierw wybierz ucznia'
                        : 'Wybierz przedmiot'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      {studentMode === 'existing'
                        ? 'Brak przypisań przedmiotów dla tego ucznia'
                        : 'Brak przedmiotów tutora'}
                    </SelectItem>
                  ) : (
                    subjectOptions.map(({ subject }) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Poziom</Label>
              <Select
                value={subjectLevelId}
                onValueChange={setSubjectLevelId}
                disabled={!subjectId || singleLevel}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz poziom" />
                </SelectTrigger>
                <SelectContent>
                  {availableLevels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.level_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stawka */}
          <div className="space-y-1.5">
            <Label htmlFor="reservation-hourly-rate">Stawka godzinowa (zł/h)</Label>
            <Input
              id="reservation-hourly-rate"
              type="number"
              min={0}
              step={1}
              placeholder="np. 80"
              value={hourlyRateInput}
              onChange={(e) => setHourlyRateInput(e.target.value)}
            />
            {singleLessonPricePreview !== null && !isRecurring && (
              <p className="text-xs text-muted-foreground">
                Koszt jednorazowej lekcji:{' '}
                <strong>{singleLessonPricePreview.toFixed(2).replace('.', ',')} zł</strong>
                {' '}({hoursPerLesson} h × {parsedHourlyRate?.toFixed(0)} zł/h)
              </p>
            )}
            {parsedHourlyRate !== null && isRecurring && (
              <p className="text-xs text-muted-foreground">
                Stawka za 1 lekcję ({hoursPerLesson} h):{' '}
                <strong>{singleLessonPricePreview?.toFixed(2).replace('.', ',')} zł</strong>
                {' '}— pełna kwota zostanie wyliczona przy wysyłce powiadomień.
              </p>
            )}
          </div>

          {/* Typ lekcji */}
          <div className="space-y-2">
            <Label>Typ lekcji</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-lg border-2 p-3 transition-colors',
                  !isRecurring
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="lessonType"
                    checked={!isRecurring}
                    onChange={() => setIsRecurring(false)}
                    className="h-4 w-4"
                  />
                  <IconCalendar className="h-4 w-4" />
                  Jednorazowa
                </span>
                <span className="text-xs text-muted-foreground pl-6">
                  Tylko najbliższy termin — bez powtarzania.
                </span>
              </label>
              <label
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-lg border-2 p-3 transition-colors',
                  isRecurring
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="lessonType"
                    checked={isRecurring}
                    onChange={() => setIsRecurring(true)}
                    className="h-4 w-4"
                  />
                  <IconRepeat className="h-4 w-4" />
                  Cykliczna
                </span>
                <span className="text-xs text-muted-foreground pl-6">
                  Co tydzień w tym samym dniu i godzinie.
                </span>
              </label>
            </div>
          </div>

          {/* Podgląd daty */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            {isRecurring ? (
              <p>
                Lekcja będzie powtarzana co tydzień:{' '}
                <strong>{DAY_NAMES[weekday]}</strong>, godz.{' '}
                <strong>{startTime}</strong>
              </p>
            ) : (
              <p>
                Najbliższy termin:{' '}
                <strong>{nextOccurrence.dateLabel}</strong>, godz.{' '}
                <strong>{startTime}</strong>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || subjectOptions.length === 0}
          >
            {isPending ? 'Zapisywanie...' : 'Zarezerwuj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
