'use client'

import { DayColumn } from './day-column'
import type { TimeSlot, DayOfWeek } from '@/lib/types/availability.types'
import { DAY_NAMES_SHORT } from '@/lib/types/availability.types'

interface TimeSlotGridProps {
  slots: TimeSlot[]
  isEditing?: boolean
  onSlotToggle: (day: DayOfWeek, startTime: string, endTime: string) => void
}

export function TimeSlotGrid({ slots, isEditing = true, onSlotToggle }: TimeSlotGridProps) {
  const days: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7]

  // Generuj wszystkie możliwe sloty czasowe
  const generateTimeSlots = (day: DayOfWeek) => {
    const isWeekend = day === 6 || day === 7
    const startHour = isWeekend ? 8 : 8
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
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* Nagłówki dni */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="text-xs font-medium text-muted-foreground p-2">
            Czas
          </div>
          {days.map((day) => (
            <div key={day} className="text-center p-2">
              <div className="text-xs font-medium">{DAY_NAMES_SHORT[day]}</div>
              <div className="text-[10px] text-muted-foreground">
                {day <= 5 ? '8-21' : '8-21'}
              </div>
            </div>
          ))}
        </div>

        {/* Siatka slotów */}
        <div className="space-y-px">
          {generateTimeSlots(1).map((timeSlot, index) => (
            <div key={timeSlot.start} className="grid grid-cols-8 gap-1">
              {/* Kolumna z czasem */}
              <div className="flex items-center justify-end pr-2 text-xs text-muted-foreground">
                {timeSlot.start}
              </div>
              
              {/* Kolumny dla każdego dnia */}
              {days.map((day) => {
                const dayTimeSlots = generateTimeSlots(day)
                const currentSlot = dayTimeSlots.find((s) => s.start === timeSlot.start)
                
                if (!currentSlot) {
                  // Poza godzinami pracy dla tego dnia
                  return (
                    <div 
                      key={`${day}-${timeSlot.start}`} 
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

                return (
                  <DayColumn
                    key={`${day}-${currentSlot.start}`}
                    day={day}
                    startTime={currentSlot.start}
                    endTime={currentSlot.end}
                    isAvailable={isAvailable}
                    isEditing={isEditing}
                    onToggle={onSlotToggle}
                  />
                )
              })}
            </div>
          ))}
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
            <div className="w-6 h-6 bg-muted/30 rounded" />
            <span>Poza godzinami</span>
          </div>
        </div>
      </div>
    </div>
  )
}

