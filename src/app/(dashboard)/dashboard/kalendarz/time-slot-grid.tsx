'use client'

import { DayColumn } from './day-column'
import type { TimeSlot, DayOfWeek } from '@/lib/types/availability.types'
import type { BookedSlot } from '@/lib/actions/booked-slots'
import { DAY_NAMES_SHORT } from '@/lib/types/availability.types'

interface TimeSlotGridProps {
  slots: TimeSlot[]
  isEditing?: boolean
  onSlotToggle: (day: DayOfWeek, startTime: string, endTime: string) => void
  bookedSlots?: BookedSlot[]
}

export function TimeSlotGrid({ slots, isEditing = true, onSlotToggle, bookedSlots = [] }: TimeSlotGridProps) {
  const days: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7]

  // Generuj wszystkie możliwe sloty czasowe
  const generateTimeSlots = (day: DayOfWeek) => {
    const isWeekend = day === 6 || day === 7
    const startHour = isWeekend ? 8 : 13
    const endHour = isWeekend ? 21 : 21

    const timeSlots: { start: string; end: string }[] = []
    
    for (let hour = startHour; hour < endHour; hour++) {
      timeSlots.push({
        start: `${hour.toString().padStart(2, '0')}:00`,
        end: `${(hour + 1).toString().padStart(2, '0')}:00`,
      })
    }

    return timeSlots
  }

  return (
    <div className="w-full">
      <div className="w-full">
        {/* Nagłówki dni */}
        <div className="grid grid-cols-8 gap-0.5 mb-2 w-full">
          <div className="text-xs font-medium text-muted-foreground p-1.5 text-right">
            Czas
          </div>
          {days.map((day) => (
            <div key={day} className="text-center p-1.5">
              <div className="text-xs font-medium">{DAY_NAMES_SHORT[day]}</div>
              <div className="text-[10px] text-muted-foreground">
                {day <= 5 ? '13-21' : '8-21'}
              </div>
            </div>
          ))}
        </div>

        {/* Siatka slotów */}
        <div className="space-y-px w-full">
          {/* godziny 8:00–21:00 jako wiersze siatki */}
          {Array.from({ length: 13 }, (_, idx) => 8 + idx).map((hour) => {
            const rowStart = `${hour.toString().padStart(2, '0')}:00`
            const rowEnd = `${(hour + 1).toString().padStart(2, '0')}:00`

            return (
              <div key={rowStart} className="grid grid-cols-8 gap-0.5 w-full">
                {/* Kolumna z czasem */}
                <div className="flex items-center justify-end pr-1.5 text-xs text-muted-foreground">
                  {rowStart}
                </div>
                
                {/* Kolumny dla każdego dnia */}
                {days.map((day) => {
                  const dayTimeSlots = generateTimeSlots(day)
                  const currentSlot = dayTimeSlots.find((s) => s.start === rowStart)
                  
                  if (!currentSlot) {
                    // Poza godzinami pracy dla tego dnia
                    return (
                      <div 
                        key={`${day}-${rowStart}`} 
                        className="h-6 bg-muted/30 rounded cursor-not-allowed"
                        title="Poza godzinami pracy"
                      />
                    )
                  }

                  // Normalizuj czas do formatu HH:MM (usuń sekundy jeśli są)
                  const normalizeTime = (time: string) => time.substring(0, 5)
                  
                  const existingSlot = slots.find(
                    (s) =>
                      s.day === day &&
                      normalizeTime(s.startTime) === currentSlot.start &&
                      normalizeTime(s.endTime) === currentSlot.end
                  )

                  const isAvailable = existingSlot?.isAvailable ?? false

                  const matched = bookedSlots.find(
                    (b) => b.weekday === day && b.start_time.substring(0,5) === currentSlot.start && b.end_time.substring(0,5) === currentSlot.end && b.status === 'booked'
                  )
                  const isBooked = !!matched
                  type BookedSlotWithAssignment = BookedSlot & {
                    student_assignments?: {
                      students?: { id: string; first_name: string; last_name: string } | null
                      subjects?: { id: string; name: string } | null
                      subject_levels?: { id: string; level_name: string } | null
                    } | null
                  }

                  const bookedLabel = isBooked
                    ? (() => {
                        const slotWith: BookedSlotWithAssignment = matched as BookedSlotWithAssignment
                        const stud = slotWith?.student_assignments?.students
                        if (stud?.first_name || stud?.last_name) {
                          const first = stud?.first_name ?? ''
                          const last = stud?.last_name ?? ''
                          return `${first} ${last}`.trim()
                        }
                        return ''
                      })()
                    : undefined

                  return (
                    <DayColumn
                      key={`${day}-${currentSlot.start}`}
                      day={day}
                      startTime={currentSlot.start}
                      endTime={currentSlot.end}
                      isAvailable={isAvailable}
                      isBooked={isBooked}
                      bookedLabel={bookedLabel}
                      isEditing={isEditing}
                      onToggle={onSlotToggle}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500/20 border-2 border-green-500 rounded" />
            <span>Dostępny</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-muted border-2 border-border rounded" />
            <span>Niedostępny</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-500/20 border-2 border-purple-500 rounded" />
            <span>Zarezerwowany (uczeń)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-muted/30 rounded" />
            <span>Poza godzinami</span>
          </div>
        </div>
      </div>
    </div>
  )
}

