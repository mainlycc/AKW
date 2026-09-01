'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TimeSlotGrid } from './time-slot-grid'
import { AssignDialog, type AssignmentOption } from './assign-dialog'
import { saveAvailability, cancelBookedSlotAction, listTutorBookedSlots } from './actions'
import type { BookedSlot } from '@/lib/types/booked-slots.types'
import { getDefaultAvailabilitySlots, isWithinWorkingHours } from '@/lib/utils/availability-helpers'
import type { TutorAvailabilityData, TimeSlot, DayOfWeek } from '@/lib/types/availability.types'
import { SLOT_DURATION_MINUTES } from '@/lib/types/availability.types'
import { IconDeviceFloppy, IconRefresh, IconInfoCircle, IconEdit } from '@tabler/icons-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { createCorrelationId } from '@/lib/monitoring/correlation'

interface AvailabilityCalendarProps {
  tutorId: string
  initialAvailability: TutorAvailabilityData | null
  initialBookedSlots: BookedSlot[]
  initialAssignments: AssignmentOption[]
  currentUserId: string
}

export function AvailabilityCalendar({ tutorId, initialAvailability, initialBookedSlots, initialAssignments, currentUserId }: AvailabilityCalendarProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [savedAvailability, setSavedAvailability] = useState<TutorAvailabilityData | null>(initialAvailability)
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>(initialBookedSlots)
  const [assignments] = useState<AssignmentOption[]>(initialAssignments)
  const [loading, setLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isEditing, setIsEditing] = useState(!initialAvailability) // Tryb edycji jeśli nie ma zapisanego grafiku
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ day: DayOfWeek; start: string; end: string } | null>(null)

  // Inicjalizuj sloty TYLKO RAZ z initialAvailability
  useEffect(() => {
    if (initialAvailability) {
      // Konwertuj sloty z bazy do formatu TimeSlot
      const convertedSlots: TimeSlot[] = initialAvailability.slots.map((slot) => ({
        day: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        isAvailable: slot.is_available,
      }))
      setSlots(convertedSlots)
      setSavedAvailability(initialAvailability)
      setHasChanges(false)
      setIsEditing(false) // Tryb widoku
    } else {
      // Użyj domyślnego szablonu
      setSlots(getDefaultAvailabilitySlots())
      setIsEditing(true) // Tryb edycji dla nowego grafiku
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Uruchom TYLKO raz przy montowaniu

  // Realtime: automatyczne odświeżanie listy rezerwacji
  useEffect(() => {
    const supabase = createClient()

    type RealtimeBooked = {
      id: string
      tutor_id: string
      student_assignment_id: string
      weekday: number
      start_time: string
      end_time: string
      status: BookedSlot['status']
      created_by: string
      created_at: string
      updated_at: string
    }

    const channel = supabase
      .channel(`booked-slots-${tutorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booked_slots',
          filter: `tutor_id=eq.${tutorId}`,
        },
        (payload) => {
          // Obsłuż DELETE - usuń z listy (payload.old istnieje, payload.new nie)
          if (payload.old && !payload.new) {
            const deletedId = (payload.old as RealtimeBooked).id
            setBookedSlots((prev) => prev.filter((s) => s.id !== deletedId))
            return
          }

          // Obsłuż INSERT i UPDATE - użyj payload.new
          const row = payload.new as RealtimeBooked | null
          if (!row) return

          setBookedSlots((prev) => {
            const existingIndex = prev.findIndex((s) => s.id === row.id)
            if (existingIndex >= 0) {
              const updated = [...prev]
              updated[existingIndex] = {
                ...updated[existingIndex],
                status: row.status,
                start_time: row.start_time,
                end_time: row.end_time,
                weekday: row.weekday,
                updated_at: row.updated_at,
              }
              return updated
            }
            return [
              ...prev,
              {
                id: row.id,
                tutor_id: row.tutor_id,
                student_assignment_id: row.student_assignment_id,
                weekday: row.weekday,
                start_time: row.start_time,
                end_time: row.end_time,
                status: row.status,
                created_by: row.created_by,
                created_at: row.created_at,
                updated_at: row.updated_at,
              } as BookedSlot,
            ]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tutorId])

  const handleSlotToggle = (day: DayOfWeek, startTime: string, endTime: string) => {
    // Ignoruj kliknięcia jeśli nie jesteśmy w trybie edycji
    if (!isEditing) {
      // w trybie podglądu – jeśli zajęty: zaproponuj anulowanie; jeśli dostępny: przypisz
      const normalizeTime = (t: string) => t.substring(0,5)
      const isBooked = bookedSlots.some(b => b.weekday === day && b.start_time.substring(0,5) === startTime && b.status === 'booked')
      if (isBooked) {
        const slot = bookedSlots.find(b => b.weekday === day && b.start_time.substring(0,5) === startTime && b.status === 'booked')
        if (slot && window.confirm('Ten slot jest zarezerwowany. Czy chcesz anulować rezerwację?')) {
          cancelBookedSlotAction(slot.id, {
            correlationId: createCorrelationId(),
            route: '/dashboard/kalendarz',
          }).then(() => {
            setBookedSlots(prev => prev.map(s => s.id === slot.id ? { ...s, status: 'cancelled' } as BookedSlot : s))
            toast.success('Rezerwacja anulowana')
          }).catch(() => toast.error('Nie udało się anulować rezerwacji'))
        }
      } else {
        const isAvailable = slots.some(s => s.day === day && normalizeTime(s.startTime) === startTime && normalizeTime(s.endTime) === endTime && s.isAvailable)
        if (!isAvailable) return
        setSelectedSlot({ day, start: startTime, end: endTime })
        setAssignOpen(true)
      }
      return
    }

    // Sprawdź czy slot jest w dozwolonych godzinach
    if (!isWithinWorkingHours(day, startTime)) {
      toast.error('Ten slot jest poza godzinami pracy')
      return
    }

    setSlots((prevSlots) => {
      // Normalizuj czas do formatu HH:MM dla porównania
      const normalizeTime = (time: string) => time.substring(0, 5)
      
      const existingSlotIndex = prevSlots.findIndex(
        (s) => 
          s.day === day && 
          normalizeTime(s.startTime) === startTime && 
          normalizeTime(s.endTime) === endTime
      )

      if (existingSlotIndex >= 0) {
        // Przełącz istniejący slot
        const newSlots = [...prevSlots]
        newSlots[existingSlotIndex] = {
          ...newSlots[existingSlotIndex],
          isAvailable: !newSlots[existingSlotIndex].isAvailable,
        }
        setHasChanges(true)
        return newSlots
      } else {
        // Dodaj nowy slot jako dostępny
        setHasChanges(true)
        return [
          ...prevSlots,
          {
            day,
            startTime,
            endTime,
            isAvailable: true,
          },
        ]
      }
    })
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const result = await saveAvailability(tutorId, slots, {
        correlationId: createCorrelationId(),
        route: '/dashboard/kalendarz',
      })
      // Zaktualizuj zapisany stan
      setSavedAvailability(result)
      setHasChanges(false)
      setIsEditing(false) // Wyjdź z trybu edycji
      toast.success('Szablon dostępności został zapisany')
    } catch (error) {
      console.error('Error saving availability:', error)
      toast.error('Błąd podczas zapisywania szablonu')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (savedAvailability) {
      // Przywróć zapisany stan
      const convertedSlots: TimeSlot[] = savedAvailability.slots.map((slot) => ({
        day: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        isAvailable: slot.is_available,
      }))
      setSlots(convertedSlots)
      setHasChanges(false)
      setIsEditing(false)
    }
  }

  const handleReset = () => {
    setSlots(getDefaultAvailabilitySlots())
    setHasChanges(true)
    toast.info('Przywrócono domyślny szablon')
  }

  const availableCount = slots.filter((s) => s.isAvailable).length

  return (
    <div className="space-y-4">
      {/* Info box */}
      {isEditing && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
          <IconInfoCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
            <p>
              <strong>Jak to działa:</strong> Kliknij na sloty czasowe aby zaznaczyć swoje dostępności. 
              Zielone sloty = dostępny, szare = niedostępny.
            </p>
            <p>
              <strong>Godziny pracy:</strong> Pn-Pt: 13:00-21:00, Sb-Nd: 8:00-21:00.
              Domyślnie graf zawiera dostępności Pn-Pt: 14:00-21:00, Sb-Nd: 9:00-14:00.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Kalendarz dostępności</CardTitle>
              <CardDescription>
                {isEditing
                  ? 'Kliknij na sloty aby zaznaczyć swoją dostępność'
                  : 'Twój aktualny grafik dostępności'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {savedAvailability && (
                <Badge variant="secondary">
                  Wersja {savedAvailability.template.version}
                </Badge>
              )}
              {isEditing && hasChanges && (
                <Badge variant="outline" className="text-orange-600">
                  Niezapisane zmiany
                </Badge>
              )}
              {!isEditing && savedAvailability && (
                <Badge variant="outline" className="text-green-600">
                  Zapisany
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Statystyki */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Dostępne sloty: <strong className="text-foreground">{availableCount}</strong>
            </span>
            <span>•</span>
            <span>
              Godziny tygodniowo:{' '}
              <strong className="text-foreground">
                {((availableCount * SLOT_DURATION_MINUTES) / 60).toFixed(0)}h
              </strong>
            </span>
          </div>

          {/* Siatka czasowa */}
          <TimeSlotGrid slots={slots} isEditing={isEditing} onSlotToggle={handleSlotToggle} bookedSlots={bookedSlots} />

          {/* Akcje */}
          <div className="flex items-center justify-between pt-4 border-t">
            {isEditing ? (
              <>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={loading}
                  >
                    <IconRefresh className="mr-2 h-4 w-4" />
                    Przywróć domyślny
                  </Button>
                  {savedAvailability && (
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={loading}
                    >
                      Anuluj
                    </Button>
                  )}
                </div>
                <Button
                  onClick={handleSave}
                  disabled={loading || !hasChanges}
                >
                  <IconDeviceFloppy className="mr-2 h-4 w-4" />
                  {loading ? 'Zapisywanie...' : 'Zapisz szablon'}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleEdit}
                className="ml-auto"
              >
                <IconEdit className="mr-2 h-4 w-4" />
                Edytuj grafik
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog przypisania */}
      {selectedSlot && (
        <AssignDialog
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          tutorId={tutorId}
          createdBy={currentUserId}
          weekday={selectedSlot.day}
          startTime={selectedSlot.start}
          endTime={selectedSlot.end}
          assignments={assignments}
          onAssigned={async () => {
            const updated = await listTutorBookedSlots(tutorId)
            setBookedSlots(updated)
          }}
        />
      )}
    </div>
  )
}

