'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { addDays, format, getISODay, parseISO, subDays } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import type { DayOfWeek } from '@/lib/types/availability.types'
import { DAY_NAMES_SHORT } from '@/lib/types/availability.types'
import type {
  PublicBookingPayload,
  PublicSubjectLevel,
  SubjectLevelSlot,
} from '@/lib/actions/public-booking'
import { getSubjectLevelOpenSlots, bookPublicSlot } from '@/lib/actions/public-booking'
import { createPayUOrderForBooking } from '@/lib/actions/payu'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Search, CalendarX } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PublicBookingPageProps {
  subjects: PublicSubjectLevel[]
}

interface PendingBooking {
  tutorId: string
  slot: SubjectLevelSlot
}

const formatLabel = (slot: SubjectLevelSlot) => {
  const date = parseISO(slot.date)
  const labelDate = format(date, 'EEEE, d MMMM', { locale: pl })
  const tutorLabel = slot.tutorName ?? 'Tutor'
  return `${labelDate} · ${slot.startTime}-${slot.endTime} · ${tutorLabel}`
}

const getTodayDate = () => format(new Date(), 'yyyy-MM-dd')

const getMinBookingDate = () => format(addDays(new Date(), 1), 'yyyy-MM-dd')

const isSlotBookable = (date: string) => date > getTodayDate()

const TODAY_BOOKING_BLOCKED_MESSAGE =
  'Na dzisiaj nie możesz rezerwować już lekcji. Dostępne są wyłącznie terminy od jutra.'

export function PublicBookingPage({ subjects }: PublicBookingPageProps) {
  const router = useRouter()
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? '')
  const [selectedLevelId, setSelectedLevelId] = useState<string>(
    subjects[0]?.levels?.[0]?.id ?? ''
  )
  const [rangeStart, setRangeStart] = useState(() => getMinBookingDate())
  const [slots, setSlots] = useState<SubjectLevelSlot[]>([])
  const [loadingSlots, startSlotsTransition] = useTransition()
  const [booking, setBooking] = useState<PendingBooking | null>(null)
  const [isBooking, startBookingTransition] = useTransition()
  const [tutorSelection, setTutorSelection] = useState<{
    slots: SubjectLevelSlot[]
    onSelect: (slot: SubjectLevelSlot) => void
  } | null>(null)

  const [formData, setFormData] = useState({
    studentFirstName: '',
    studentLastName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
  })
  const [isRecurring, setIsRecurring] = useState(false)

  const rangeEnd = useMemo(() => {
    const start = parseISO(rangeStart)
    const end = new Date(start)
    end.setDate(end.getDate() + 13)
    return format(end, 'yyyy-MM-dd')
  }, [rangeStart])

  const availableLevels = useMemo(() => {
    return subjects.find((subject) => subject.id === selectedSubjectId)?.levels ?? []
  }, [subjects, selectedSubjectId])

  useEffect(() => {
    if (availableLevels.length > 0 && !availableLevels.some((level) => level.id === selectedLevelId)) {
      setSelectedLevelId(availableLevels[0]?.id ?? '')
    }
  }, [availableLevels, selectedLevelId])

  const fetchSlots = (subjectLevelId: string, startDate: string) => {
    if (!subjectLevelId) {
      setSlots([])
      return
    }
    startSlotsTransition(async () => {
      try {
        console.log('[PublicBookingPage] Fetching slots for:', { subjectLevelId, startDate, endDate: rangeEnd })
        const data = await getSubjectLevelOpenSlots({ subjectLevelId, startDate, endDate: rangeEnd })
        console.log('[PublicBookingPage] Received slots:', data.length, data)
        setSlots(data)
        if (data.length === 0) {
          console.warn('[PublicBookingPage] No slots returned - check console for details')
        }
      } catch (error) {
        console.error('[PublicBookingPage] Error fetching slots:', error)
        toast.error('Nie udało się pobrać dostępnych terminów.')
      }
    })
  }

  const handleSubjectChange = (subjectId: string) => {
    console.log('[PublicBookingPage] Subject changed to:', subjectId)
    setSelectedSubjectId(subjectId)
    const firstLevel = subjects.find((subject) => subject.id === subjectId)?.levels?.[0]?.id ?? ''
    setSelectedLevelId(firstLevel)
    if (firstLevel) {
      fetchSlots(firstLevel, rangeStart)
    } else {
      setSlots([])
    }
  }

  const handleLevelChange = (levelId: string) => {
    setSelectedLevelId(levelId)
    if (levelId) {
      fetchSlots(levelId, rangeStart)
    } else {
      setSlots([])
    }
  }

  const handleRangeChange = (date: string) => {
    const minDate = getMinBookingDate()
    if (date < minDate) {
      toast.error(TODAY_BOOKING_BLOCKED_MESSAGE)
      return
    }
    setRangeStart(date)
    if (selectedLevelId) {
      fetchSlots(selectedLevelId, date)
    }
  }

  const openBooking = (slot: SubjectLevelSlot) => {
    if (!selectedSubjectId || !selectedLevelId) {
      toast.error('Wybierz najpierw przedmiot i poziom.')
      return
    }
    if (!isSlotBookable(slot.date)) {
      toast.error(TODAY_BOOKING_BLOCKED_MESSAGE)
      return
    }
    if (!slot.isAvailable) {
      toast.error('Ten termin jest już zajęty.')
      return
    }
    if (!slot.tutorId) {
      toast.error('Brak przypisanego tutora dla tego terminu.')
      return
    }
    setBooking({ tutorId: slot.tutorId, slot })
  }

  const handleBookingSubmit = () => {
    if (!booking) return
    if (!selectedSubjectId || !selectedLevelId) {
      toast.error('Wybierz przedmiot i poziom.')
      return
    }
    if (!isSlotBookable(booking.slot.date)) {
      toast.error(TODAY_BOOKING_BLOCKED_MESSAGE)
      return
    }
    const payload: PublicBookingPayload = {
      tutorId: booking.tutorId,
      subjectId: selectedSubjectId,
      subjectLevelId: selectedLevelId,
      date: booking.slot.date,
      startTime: booking.slot.startTime,
      studentFirstName: formData.studentFirstName.trim(),
      studentLastName: formData.studentLastName.trim(),
      contactEmail: formData.contactEmail.trim(),
      contactPhone: formData.contactPhone.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      isRecurring,
    }

    startBookingTransition(async () => {
      try {
        // Create booking request
        const bookingRequest = await bookPublicSlot(payload)
        
        if (!bookingRequest || !bookingRequest.id) {
          throw new Error('Nie udało się utworzyć rezerwacji.')
        }

        // Create PayU order for booking
        const paymentResult = await createPayUOrderForBooking(bookingRequest.id)
        
        if (!paymentResult.success || !paymentResult.redirectUrl) {
          throw new Error(paymentResult.error || 'Nie udało się utworzyć płatności.')
        }

        // Redirect to PayU payment page
        window.location.href = paymentResult.redirectUrl
      } catch (error) {
        console.error(error)
        toast.error(error instanceof Error ? error.message : 'Nie udało się zarezerwować slotu.')
      }
    })
  }

  useEffect(() => {
    if (selectedLevelId) {
      fetchSlots(selectedLevelId, rangeStart)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initialised = slots.length > 0 || loadingSlots
  const slotMap = useMemo(() => {
    const map = new Map<string, SubjectLevelSlot[]>()
    for (const slot of slots) {
      if (!slot.isAvailable || !isSlotBookable(slot.date)) continue
      const key = `${slot.date}-${slot.startTime.substring(0, 5)}`
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(slot)
    }
    return map
  }, [slots])

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  )

  const selectedLevelName = useMemo(
    () => selectedSubject?.levels.find((level) => level.id === selectedLevelId)?.name ?? '',
    [selectedSubject, selectedLevelId]
  )

  useEffect(() => {
    console.log('[PublicBookingPage] Subjects received:', subjects.length, subjects)
    console.log('[PublicBookingPage] Current selectedSubjectId:', selectedSubjectId)
    // Upewnij się, że selectedSubjectId jest poprawnie ustawione
    if (subjects.length > 0 && (!selectedSubjectId || !subjects.some(s => s.id === selectedSubjectId))) {
      console.log('[PublicBookingPage] Resetting selectedSubjectId to first subject')
      setSelectedSubjectId(subjects[0].id)
      const firstLevel = subjects[0]?.levels?.[0]?.id ?? ''
      setSelectedLevelId(firstLevel)
    }
  }, [subjects, selectedSubjectId])

  if (subjects.length === 0) {
    return (
      <div
        data-testid="public-booking-empty"
        className="mx-auto flex max-w-md flex-col items-center py-16 text-center"
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <CalendarX className="h-8 w-8 text-muted-foreground" aria-hidden />
        </div>
        <h2 className="text-xl font-semibold">Rezerwacja tymczasowo niedostępna</h2>
        <p className="mt-3 text-muted-foreground">
          Obecnie nie ma korepetytorów z włączoną rezerwacją online. Spróbuj ponownie później lub skontaktuj się z
          nami, jeśli chcesz umówić zajęcia.
        </p>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/">Wróć na stronę główną</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Informacja o automatycznym przypisywaniu korepetytora */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          System automatycznie przypisuje właściwego korepetytora do wybranego przedmiotu i poziomu.
          Wystarczy, że wybierzesz interesujący Cię przedmiot oraz poziom, a my dopasujemy najlepszego dostępnego korepetytora.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Lewy panel - Kroki rezerwacji */}
        <div className="space-y-6">
          {/* Krok 1: Preferencje */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  1
                </div>
                <div>
                  <CardTitle className="text-lg">Krok 1: Preferencje</CardTitle>
                  <CardDescription className="mt-1 text-base">
                    Wybierz przedmiot i poziom, a my znajdziemy najbliższy wolny termin u dostępnego tutora.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-semibold uppercase tracking-wide">Przedmiot</Label>
                  <Select 
                    value={selectedSubjectId || undefined} 
                    onValueChange={handleSubjectChange}
                    disabled={subjects.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Wybierz przedmiot" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-semibold uppercase tracking-wide">Poziom</Label>
                  <Select
                    value={selectedLevelId}
                    onValueChange={handleLevelChange}
                    disabled={availableLevels.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={availableLevels.length ? 'Wybierz poziom' : 'Brak poziomów'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLevels.map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {level.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-semibold uppercase tracking-wide">Od daty</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => {
                        const prev = subDays(parseISO(rangeStart), 7)
                        const minDate = getMinBookingDate()
                        const value = format(prev, 'yyyy-MM-dd')
                        if (value < minDate) {
                          toast.error(TODAY_BOOKING_BLOCKED_MESSAGE)
                          return
                        }
                        setRangeStart(value)
                        if (selectedLevelId) {
                          fetchSlots(selectedLevelId, value)
                        }
                      }}
                    >
                      ‹
                    </Button>
                    <Input
                      type="date"
                      value={rangeStart}
                      onChange={(event) => handleRangeChange(event.target.value)}
                      min={getMinBookingDate()}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => {
                        const next = addDays(parseISO(rangeStart), 7)
                        const value = format(next, 'yyyy-MM-dd')
                        setRangeStart(value)
                        if (selectedLevelId) {
                          fetchSlots(selectedLevelId, value)
                        }
                      }}
                    >
                      ›
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    if (selectedLevelId) {
                      fetchSlots(selectedLevelId, rangeStart)
                    } else {
                      toast.error('Najpierw wybierz przedmiot i poziom.')
                    }
                  }}
                  disabled={!selectedLevelId || loadingSlots}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  {loadingSlots ? 'Ładowanie...' : 'Pokaż terminy'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Krok 2: Wybierz slot */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  2
                </div>
                <div>
                  <CardTitle className="text-lg">Krok 2: Wybierz slot</CardTitle>
                  <CardDescription className="mt-1 text-base">
                    Kliknij w dostępny termin, aby kontynuować
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingSlots && (
                <p className="text-base text-muted-foreground">Ładuję terminy...</p>
              )}
              {!loadingSlots && !initialised && (
                <p className="text-base text-muted-foreground">
                  Wybierz przedmiot i poziom, aby zobaczyć dostępne sloty.
                </p>
              )}
              {!loadingSlots && initialised && slots.length === 0 && (
                <p className="text-base text-muted-foreground">
                  Brak wolnych terminów w wybranym zakresie. Spróbuj zmienić daty lub poziom.
                </p>
              )}
              <PublicSlotGrid
                rangeStart={rangeStart}
                slotMap={slotMap}
                onSelect={(slot) => {
                  openBooking(slot)
                }}
                onMultipleSlots={(slots) => {
                  setTutorSelection({ slots, onSelect: openBooking })
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Prawy panel - Jak to działa */}
        <Card className="lg:sticky lg:top-4 lg:h-fit">
          <CardHeader>
            <CardTitle className="text-xl">Jak to działa?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Krok 1 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  1
                </div>
                <h4 className="text-base font-semibold">Wypełnienie formularza</h4>
              </div>
              <div className="ml-9 space-y-1">
                <p className="text-sm text-muted-foreground">
                  Wybierz przedmiot, poziom oraz zakres dat, a następnie kliknij &quot;Pokaż terminy&quot;.
                </p>
                <p className="text-sm text-muted-foreground">
                  Z kalendarza wybierz dogodny termin (zielony slot) i wypełnij formularz z danymi ucznia oraz kontaktowymi.
                </p>
              </div>
            </div>

            <Separator />

            {/* Krok 2 - Płatność */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  2
                </div>
                <h4 className="text-base font-semibold">Płatność przez PayU</h4>
              </div>
              <div className="ml-9 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Po wysłaniu formularza zostaniesz przekierowany do systemu płatności PayU.
                </p>
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Status: OCZEKUJE NA PŁATNOŚĆ</p>
                      <p className="text-sm text-muted-foreground">
                        Rezerwacja wstępna wygasa po 30 minutach.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Krok 3 - Potwierdzenie */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  3
                </div>
                <h4 className="text-base font-semibold">Automatyczne potwierdzenie</h4>
              </div>
              <div className="ml-9 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Po zakończeniu płatności rezerwacja jest automatycznie potwierdzana i slot zostaje zablokowany.
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Email potwierdzający</p>
                  <p className="text-sm text-muted-foreground">
                    Otrzymasz wiadomość ze wszystkimi szczegółami rezerwacji, danymi tutora oraz linkiem do spotkania.
                  </p>
                  <div className="p-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm font-semibold text-green-900 dark:text-green-100">Status: POTWIERDZONA</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog wyboru tutora gdy jest więcej niż jeden slot */}
      <Dialog open={!!tutorSelection} onOpenChange={(open) => !open && setTutorSelection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">Wybierz tutora</DialogTitle>
            <DialogDescription className="text-base">
              Dla wybranego terminu dostępni są następujący tutorzy. Wybierz jednego z nich.
            </DialogDescription>
          </DialogHeader>
          {tutorSelection && (
            <div className="space-y-2">
              {tutorSelection.slots.map((slot) => (
                <button
                  key={slot.tutorId}
                  type="button"
                  onClick={() => {
                    tutorSelection.onSelect(slot)
                    setTutorSelection(null)
                  }}
                  className="w-full text-left p-3 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-colors"
                >
                  <div className="font-semibold">{slot.tutorName || 'Tutor'}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatLabel(slot)}
                  </div>
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTutorSelection(null)}>
              Anuluj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!booking} onOpenChange={(open) => {
        if (!open) {
          setBooking(null)
          setIsRecurring(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">Potwierdź rezerwację</DialogTitle>
            <DialogDescription className="text-base">
              Podaj dane kontaktowe, abyśmy mogli potwierdzić rezerwację.
            </DialogDescription>
          </DialogHeader>

          {booking && (
            <div className="space-y-3">
              <p className="rounded-md bg-muted px-3 py-2 text-base">
                Wybrany termin: <strong>{formatLabel(booking.slot)}</strong>
              </p>
              <p className="text-sm text-muted-foreground px-3">
                Przedmiot: <strong>{selectedSubject?.name ?? '—'}</strong>{' '}
                {selectedLevelName && <>· Poziom: <strong>{selectedLevelName}</strong></>}
              </p>
              <div className="space-y-2 px-1">
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
                      Jednorazowa
                    </span>
                    <span className="text-xs text-muted-foreground pl-6">
                      Tylko wybrany termin — bez powtarzania w kolejnych tygodniach.
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
                      Cykliczna
                    </span>
                    <span className="text-xs text-muted-foreground pl-6">
                      Lekcja co tydzień o tej samej porze — termin zostaje zarezerwowany na stałe.
                    </span>
                  </label>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="studentFirstName">Imię ucznia</Label>
                  <Input
                    id="studentFirstName"
                    value={formData.studentFirstName}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, studentFirstName: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="studentLastName">Nazwisko ucznia</Label>
                  <Input
                    id="studentLastName"
                    value={formData.studentLastName}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, studentLastName: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contactEmail">Email kontaktowy</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, contactEmail: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactPhone">Telefon (opcjonalnie)</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, contactPhone: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Dodatkowe informacje</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  placeholder="Napisz, czego dotyczy korepetycja lub preferencje."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setBooking(null)} disabled={isBooking}>
              Anuluj
            </Button>
            <Button onClick={handleBookingSubmit} disabled={isBooking}>
              {isBooking ? 'Zapisywanie...' : 'Zarezerwuj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface PublicSlotGridProps {
  rangeStart: string
  slotMap: Map<string, SubjectLevelSlot[]>
  onSelect: (slot: SubjectLevelSlot) => void
  onMultipleSlots: (slots: SubjectLevelSlot[]) => void
}

const HOURS_START = 8
const HOURS_END = 21

function PublicSlotGrid({ rangeStart, slotMap, onSelect, onMultipleSlots }: PublicSlotGridProps) {
  const startDate = parseISO(rangeStart)
  const daysToDisplay = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(startDate, index)
      const isoDate = format(date, 'yyyy-MM-dd')
      const weekday = getISODay(date) as DayOfWeek
      return { isoDate, weekday, label: DAY_NAMES_SHORT[weekday] }
    })
  }, [startDate])

  const generateTimeSlots = () => {
    const slots: { start: string; end: string }[] = []
    for (let hour = HOURS_START; hour < HOURS_END; hour++) {
      slots.push({
        start: `${hour.toString().padStart(2, '0')}:00`,
        end: `${(hour + 1).toString().padStart(2, '0')}:00`,
      })
    }
    return slots
  }

  const allTimeSlots = useMemo(() => generateTimeSlots(), [])

  const isWithinPublicBookingHours = (weekday: DayOfWeek, start: string) => {
    // Pn–Pt: 13:00–21:00, Sb–Nd: 08:00–21:00
    const hour = parseInt(start.slice(0, 2), 10)
    const isWeekend = weekday === 6 || weekday === 7
    const startHour = isWeekend ? 8 : 13
    const endHour = 21
    return hour >= startHour && hour < endHour
  }

  return (
    <div>
      <div>
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="text-sm font-medium text-muted-foreground p-2 text-right">
            Czas
          </div>
          {daysToDisplay.map((day) => (
            <div key={day.isoDate} className="text-center p-2">
              <div className="text-sm font-medium">{day.label}</div>
              <div className="text-xs text-muted-foreground">
                {format(parseISO(day.isoDate), 'dd.MM')}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-px">
          {allTimeSlots.map((timeSlot) => (
            <div key={timeSlot.start} className="grid grid-cols-8 gap-1">
              <div className="flex items-center justify-end pr-2 text-sm text-muted-foreground">
                {timeSlot.start}
              </div>

              {daysToDisplay.map((day) => {
                const today = getTodayDate()
                const isPastOrToday = day.isoDate <= today

                // Ukryj interakcję poza dozwolonymi godzinami dla danego dnia
                const withinHours = isWithinPublicBookingHours(day.weekday, timeSlot.start)
                if (!withinHours || isPastOrToday) {
                  const title = isPastOrToday
                    ? day.isoDate === today
                      ? 'Na dzisiaj nie możesz rezerwować już lekcji'
                      : 'Termin w przeszłości'
                    : 'Poza godzinami pracy'
                  return (
                    <div
                      key={`${day.isoDate}-${timeSlot.start}`}
                      className="h-6 rounded border-2 border-border bg-muted cursor-not-allowed"
                      title={title}
                    />
                  )
                }

                const key = `${day.isoDate}-${timeSlot.start}`
                const availableSlots = slotMap.get(key) || []
                const isAvailable = availableSlots.length > 0

                if (!isAvailable) {
                  return (
                    <div
                      key={key}
                      className="h-6 rounded border-2 border-border bg-muted cursor-not-allowed"
                      title="Slot niedostępny"
                    />
                  )
                }

                // Jeśli jest tylko jeden slot, kliknij bezpośrednio
                // Jeśli jest więcej, pokaż pierwszy (użytkownik może wybrać inny w dialogu)
                const primarySlot = availableSlots[0]
                const slotCount = availableSlots.length
                const titleText = slotCount === 1 
                  ? formatLabel(primarySlot)
                  : `${slotCount} dostępnych tutorów: ${availableSlots.map(s => s.tutorName || 'Tutor').join(', ')}`

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (slotCount === 1) {
                        onSelect(primarySlot)
                      } else {
                        // Jeśli jest więcej slotów, pokaż dialog wyboru tutora
                        onMultipleSlots(availableSlots)
                      }
                    }}
                    className={cn(
                      'h-6 rounded border-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 cursor-pointer',
                      'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50',
                      slotCount > 1 && 'relative'
                    )}
                    title={titleText}
                  >
                    {slotCount > 1 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {slotCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-600 rounded" />
            <span>Dostępny slot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-muted border-2 border-border rounded" />
            <span>Niedostępny</span>
          </div>
        </div>
      </div>
    </div>
  )
}


