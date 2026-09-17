'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { addDays, format, getISODay, parseISO, subDays } from 'date-fns'
import { pl } from 'date-fns/locale'
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
  return `${labelDate} · ${slot.startTime}-${slot.endTime}`
}

const getTodayDate = () => format(new Date(), 'yyyy-MM-dd')

const getMinBookingDate = () => format(addDays(new Date(), 1), 'yyyy-MM-dd')

const isSlotBookable = (date: string) => date > getTodayDate()

const TODAY_BOOKING_BLOCKED_MESSAGE =
  'Na dzisiaj nie możesz rezerwować już lekcji. Dostępne są wyłącznie terminy od jutra.'

export function PublicBookingPage({ subjects }: PublicBookingPageProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? '')
  const [selectedLevelId, setSelectedLevelId] = useState<string>(
    subjects[0]?.levels?.[0]?.id ?? ''
  )
  const [rangeStart, setRangeStart] = useState(() => getMinBookingDate())
  const [slots, setSlots] = useState<SubjectLevelSlot[]>([])
  const [loadingSlots, startSlotsTransition] = useTransition()
  const [booking, setBooking] = useState<PendingBooking | null>(null)
  const [isBooking, startBookingTransition] = useTransition()

  const [formData, setFormData] = useState({
    studentFirstName: '',
    studentLastName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
  })

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
      isRecurring: false,
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
    <div className="space-y-6 pb-8 sm:space-y-8">
      {/* Informacja o automatycznym przypisywaniu korepetytora */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 sm:p-4 dark:border-blue-800 dark:bg-blue-950/40">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          System automatycznie przypisuje właściwego korepetytora do wybranego przedmiotu i poziomu.
          Wystarczy, że wybierzesz interesujący Cię przedmiot oraz poziom, a my dopasujemy najlepszego dostępnego korepetytora.
        </p>
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_400px]">
        {/* Lewy panel - Kroki rezerwacji */}
        <div className="min-w-0 space-y-6">
          {/* Krok 1: Preferencje */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="px-4 sm:px-6">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  1
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">Krok 1: Preferencje</CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base">
                    Wybierz przedmiot i poziom, a my znajdziemy najbliższy wolny termin u dostępnego tutora.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-semibold uppercase tracking-wide">Przedmiot</Label>
                  <Select 
                    value={selectedSubjectId || undefined} 
                    onValueChange={handleSubjectChange}
                    disabled={subjects.length === 0}
                  >
                    <SelectTrigger className="h-11 w-full">
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
                    <SelectTrigger className="h-11 w-full">
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
                  <div className="flex min-w-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      aria-label="Poprzedni tydzień"
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
                      className="h-11 min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      aria-label="Następny tydzień"
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
              <div className="flex sm:justify-end">
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
                  className="h-11 w-full gap-2 sm:w-auto"
                >
                  <Search className="h-4 w-4" />
                  {loadingSlots ? 'Ładowanie...' : 'Pokaż terminy'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Krok 2: Wybierz slot */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="px-4 sm:px-6">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  2
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">Krok 2: Wybierz slot</CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base">
                    Wybierz dostępny termin, aby kontynuować
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 overflow-hidden px-4 sm:px-6">
              {loadingSlots && (
                <p className="text-sm text-muted-foreground sm:text-base">Ładuję terminy...</p>
              )}
              {!loadingSlots && !initialised && (
                <p className="text-sm text-muted-foreground sm:text-base">
                  Wybierz przedmiot i poziom, aby zobaczyć dostępne sloty.
                </p>
              )}
              {!loadingSlots && initialised && slots.length === 0 && (
                <p className="text-sm text-muted-foreground sm:text-base">
                  Brak wolnych terminów w wybranym zakresie. Spróbuj zmienić daty lub poziom.
                </p>
              )}
              <PublicSlotGrid
                rangeStart={rangeStart}
                slotMap={slotMap}
                onSelect={(slot) => {
                  openBooking(slot)
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

      <Dialog open={!!booking} onOpenChange={(open) => {
        if (!open) {
          setBooking(null)
        }
      }}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 text-left sm:px-6">
            <DialogTitle className="pr-6 text-lg">Potwierdź rezerwację</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Podaj dane kontaktowe, abyśmy mogli potwierdzić rezerwację jednorazowej lekcji.
            </DialogDescription>
          </DialogHeader>

          {booking && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              <p className="rounded-md bg-muted px-3 py-2 text-sm sm:text-base">
                Wybrany termin: <strong>{formatLabel(booking.slot)}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Przedmiot: <strong>{selectedSubject?.name ?? '—'}</strong>{' '}
                {selectedLevelName && <>· Poziom: <strong>{selectedLevelName}</strong></>}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="studentFirstName">Imię ucznia</Label>
                  <Input
                    id="studentFirstName"
                    className="h-11"
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
                    className="h-11"
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
                    className="h-11"
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
                    type="tel"
                    inputMode="tel"
                    className="h-11"
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

          <DialogFooter className="relative z-10 shrink-0 gap-2 border-t bg-background px-4 py-4 sm:justify-end sm:px-6">
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={() => setBooking(null)}
              disabled={isBooking}
            >
              Anuluj
            </Button>
            <Button className="h-11 w-full sm:w-auto" onClick={handleBookingSubmit} disabled={isBooking}>
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
}

const HOURS_START = 8
const HOURS_END = 21

function isWithinPublicBookingHours(weekday: DayOfWeek, start: string) {
  // Pn–Pt: 13:00–21:00, Sb–Nd: 08:00–21:00
  const hour = parseInt(start.slice(0, 2), 10)
  const isWeekend = weekday === 6 || weekday === 7
  const startHour = isWeekend ? 8 : 13
  const endHour = 21
  return hour >= startHour && hour < endHour
}

function PublicSlotGrid({ rangeStart, slotMap, onSelect }: PublicSlotGridProps) {
  const startDate = parseISO(rangeStart)
  const daysToDisplay = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(startDate, index)
      const isoDate = format(date, 'yyyy-MM-dd')
      const weekday = getISODay(date) as DayOfWeek
      return { isoDate, weekday, label: DAY_NAMES_SHORT[weekday] }
    })
  }, [startDate])

  const [selectedMobileDay, setSelectedMobileDay] = useState(daysToDisplay[0]?.isoDate ?? '')

  const allTimeSlots = useMemo(() => {
    const slots: { start: string; end: string }[] = []
    for (let hour = HOURS_START; hour < HOURS_END; hour++) {
      slots.push({
        start: `${hour.toString().padStart(2, '0')}:00`,
        end: `${(hour + 1).toString().padStart(2, '0')}:00`,
      })
    }
    return slots
  }, [])

  const dayAvailabilityCounts = useMemo(() => {
    const today = getTodayDate()
    return Object.fromEntries(
      daysToDisplay.map((day) => {
        if (day.isoDate <= today) return [day.isoDate, 0]
        const count = allTimeSlots.reduce((acc, timeSlot) => {
          if (!isWithinPublicBookingHours(day.weekday, timeSlot.start)) return acc
          const key = `${day.isoDate}-${timeSlot.start}`
          return acc + ((slotMap.get(key)?.length ?? 0) > 0 ? 1 : 0)
        }, 0)
        return [day.isoDate, count]
      })
    ) as Record<string, number>
  }, [allTimeSlots, daysToDisplay, slotMap])

  useEffect(() => {
    if (!daysToDisplay.some((day) => day.isoDate === selectedMobileDay)) {
      const firstWithSlots = daysToDisplay.find((day) => (dayAvailabilityCounts[day.isoDate] ?? 0) > 0)
      setSelectedMobileDay(firstWithSlots?.isoDate ?? daysToDisplay[0]?.isoDate ?? '')
      return
    }

    const currentCount = dayAvailabilityCounts[selectedMobileDay] ?? 0
    if (currentCount === 0) {
      const firstWithSlots = daysToDisplay.find((day) => (dayAvailabilityCounts[day.isoDate] ?? 0) > 0)
      if (firstWithSlots) {
        setSelectedMobileDay(firstWithSlots.isoDate)
      }
    }
  }, [daysToDisplay, selectedMobileDay, dayAvailabilityCounts])

  const handleSlotActivate = (availableSlots: SubjectLevelSlot[]) => {
    if (availableSlots.length === 0) return
    onSelect(availableSlots[0])
  }

  const mobileDay = daysToDisplay.find((day) => day.isoDate === selectedMobileDay) ?? daysToDisplay[0]
  const mobileAvailableSlots = useMemo(() => {
    if (!mobileDay) return []
    const today = getTodayDate()
    if (mobileDay.isoDate <= today) return []

    return allTimeSlots
      .filter((timeSlot) => isWithinPublicBookingHours(mobileDay.weekday, timeSlot.start))
      .map((timeSlot) => {
        const key = `${mobileDay.isoDate}-${timeSlot.start}`
        const availableSlots = slotMap.get(key) || []
        return { timeSlot, availableSlots }
      })
      .filter((entry) => entry.availableSlots.length > 0)
  }, [allTimeSlots, mobileDay, slotMap])

  return (
    <div className="w-full min-w-0 max-w-full">
      {/* Mobile: wybór dnia + lista godzin */}
      <div className="w-full min-w-0 max-w-full space-y-4 md:hidden">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <div className="flex w-max gap-2 pb-1">
          {daysToDisplay.map((day) => {
            const today = getTodayDate()
            const isPastOrToday = day.isoDate <= today
            const isSelected = day.isoDate === selectedMobileDay
            const count = dayAvailabilityCounts[day.isoDate] ?? 0

            return (
              <button
                key={day.isoDate}
                type="button"
                disabled={isPastOrToday}
                onClick={() => setSelectedMobileDay(day.isoDate)}
                className={cn(
                  'flex min-w-[4.75rem] shrink-0 flex-col items-center rounded-xl border-2 px-3 py-2.5 transition-colors',
                  isPastOrToday && 'cursor-not-allowed opacity-40',
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background hover:border-primary/50'
                )}
              >
                <span className="text-sm font-semibold">{day.label}</span>
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(day.isoDate), 'dd.MM')}
                </span>
                {!isPastOrToday && (
                  <span
                    className={cn(
                      'mt-1 text-[10px] font-medium',
                      count > 0 ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'
                    )}
                  >
                    {count > 0 ? `${count} wolne` : 'brak'}
                  </span>
                )}
              </button>
            )
          })}
          </div>
        </div>

        {mobileDay && mobileDay.isoDate <= getTodayDate() ? (
          <p className="text-sm text-muted-foreground">
            Na dzisiaj nie możesz rezerwować lekcji. Wybierz inny dzień.
          </p>
        ) : mobileAvailableSlots.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Brak wolnych godzin w tym dniu. Wybierz inny dzień lub zmień poziom.
          </p>
        ) : (
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 [grid-template-columns:repeat(2,minmax(0,1fr))]">
            {mobileAvailableSlots.map(({ timeSlot, availableSlots }) => (
              <button
                key={`${mobileDay?.isoDate}-${timeSlot.start}`}
                type="button"
                onClick={() => handleSlotActivate(availableSlots)}
                className={cn(
                  'flex min-h-12 w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 px-2 py-3 text-center transition-colors',
                  'border-green-400 bg-green-100 hover:bg-green-200 dark:border-green-600 dark:bg-green-900/30 dark:hover:bg-green-900/50'
                )}
              >
                <span className="text-sm font-semibold tabular-nums sm:text-base">
                  {timeSlot.start}–{timeSlot.end}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded border-2 border-green-400 bg-green-100 dark:border-green-600 dark:bg-green-900/30" />
            <span>Dostępny slot</span>
          </div>
        </div>
      </div>

      {/* Desktop: siatka tygodniowa */}
      <div className="hidden md:block">
        <div className="mb-2 grid grid-cols-8 gap-1">
          <div className="p-2 text-right text-sm font-medium text-muted-foreground">
            Czas
          </div>
          {daysToDisplay.map((day) => (
            <div key={day.isoDate} className="p-2 text-center">
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
                      className="h-8 cursor-not-allowed rounded border-2 border-border bg-muted"
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
                      className="h-8 cursor-not-allowed rounded border-2 border-border bg-muted"
                      title="Slot niedostępny"
                    />
                  )
                }

                const primarySlot = availableSlots[0]

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSlotActivate(availableSlots)}
                    className={cn(
                      'h-8 cursor-pointer rounded border-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                      'border-green-400 bg-green-100 hover:bg-green-200 dark:border-green-600 dark:bg-green-900/30 dark:hover:bg-green-900/50'
                    )}
                    title={formatLabel(primarySlot)}
                  />
                )
              })}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded border-2 border-green-400 bg-green-100 dark:border-green-600 dark:bg-green-900/30" />
            <span>Dostępny slot</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded border-2 border-border bg-muted" />
            <span>Niedostępny</span>
          </div>
        </div>
      </div>
    </div>
  )
}


