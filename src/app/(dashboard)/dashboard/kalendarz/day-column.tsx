'use client'

import { cn } from '@/lib/utils'
import type { DayOfWeek } from '@/lib/types/availability.types'

interface DayColumnProps {
  day: DayOfWeek
  startTime: string
  endTime: string
  isAvailable: boolean
  isEditing?: boolean
  onToggle: (day: DayOfWeek, startTime: string, endTime: string) => void
}

export function DayColumn({
  day,
  startTime,
  endTime,
  isAvailable,
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
        !isEditing && 'cursor-default',
        isAvailable
          ? 'bg-green-500/20 border-2 border-green-500' + (isEditing ? ' hover:bg-green-500/30' : '')
          : 'bg-muted border-2 border-border' + (isEditing ? ' hover:bg-muted/80' : '')
      )}
      title={`${startTime} - ${endTime}: ${isAvailable ? 'Dostępny' : 'Niedostępny'}`}
      disabled={!isEditing}
    />
  )
}

