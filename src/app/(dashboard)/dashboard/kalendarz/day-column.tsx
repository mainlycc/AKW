'use client'

import { cn } from '@/lib/utils'
import type { DayOfWeek } from '@/lib/types/availability.types'

interface DayColumnProps {
  day: DayOfWeek
  startTime: string
  endTime: string
  isAvailable: boolean
  isBooked?: boolean
  bookedLabel?: string
  isEditing?: boolean
  onToggle: (day: DayOfWeek, startTime: string, endTime: string) => void
}

export function DayColumn({
  day,
  startTime,
  endTime,
  isAvailable,
  isBooked = false,
  bookedLabel,
  isEditing = true,
  onToggle,
}: DayColumnProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(day, startTime, endTime)}
      className={cn(
        'h-6 rounded transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        isEditing && 'hover:scale-105 cursor-pointer',
        !isEditing && 'cursor-pointer',
        isBooked
          ? 'bg-purple-500/20 border-2 border-purple-500'
          : isAvailable
            ? 'bg-green-500/20 border-2 border-green-500' + (isEditing ? ' hover:bg-green-500/30' : '')
            : 'bg-muted border-2 border-border' + (isEditing ? ' hover:bg-muted/80' : '')
      )}
      title={`${startTime} - ${endTime}: ${isBooked ? `Zarezerwowany${bookedLabel ? ' · ' + bookedLabel : ''}` : (isAvailable ? 'Dostępny' : 'Niedostępny')}`}
    >
      {isBooked && (
        <span className="block w-full px-1 text-[10px] leading-4 text-foreground/90 truncate text-center">
          {bookedLabel}
        </span>
      )}
    </button>
  )
}

