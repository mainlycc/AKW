'use client'

import { useState, useMemo } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay } from "date-fns"
import { pl } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconX } from "@tabler/icons-react"
import { cn, formatHours } from "@/lib/utils"
import type { DeclarationEntry } from "./actions"

interface DeclarationCalendarProps {
  month: number
  year: number
  entries: DeclarationEntry[]
  students: { id: string; first_name: string; last_name: string }[]
  onRemoveEntry: (index: number) => void
}

export function DeclarationCalendar({
  month,
  year,
  entries,
  students,
  onRemoveEntry,
}: DeclarationCalendarProps) {
  const monthStart = startOfMonth(new Date(year, month - 1, 1))
  const monthEnd = endOfMonth(new Date(year, month - 1, 1))
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const grouped: Record<string, (DeclarationEntry & { index: number })[]> = {}
    entries.forEach((entry, index) => {
      if (!grouped[entry.session_date]) {
        grouped[entry.session_date] = []
      }
      grouped[entry.session_date].push({ ...entry, index })
    })
    // Sort entries by time within each day
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })
    return grouped
  }, [entries])

  // Get student name
  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.id === studentId)
    return student ? `${student.first_name} ${student.last_name}` : 'Nieznany'
  }

  // Calculate total hours per student
  const studentHours = useMemo(() => {
    const hours: Record<string, number> = {}
    entries.forEach(entry => {
      if (!hours[entry.student_id]) {
        hours[entry.student_id] = 0
      }
      hours[entry.student_id] += entry.duration_minutes / 60
    })
    return hours
  }, [entries])

  const firstDayOfWeek = (getDay(monthStart) + 6) % 7
  const weekDays = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie']

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground p-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days of month */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}

              {/* Days */}
              {daysInMonth.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const dayEntries = entriesByDate[dateKey] || []
                const isToday = isSameDay(day, new Date())

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "aspect-square p-1 rounded-md border transition-colors",
                      "flex flex-col items-start gap-0.5 overflow-hidden",
                      isToday && "ring-2 ring-primary",
                      dayEntries.length > 0 && "bg-muted"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium flex-shrink-0",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayEntries.length > 0 && (
                      <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                        {dayEntries.map((entry) => {
                          const studentName = getStudentName(entry.student_id)
                          const time = entry.start_time.slice(0, 5)
                          const entryIndex = entry.index
                          
                          return (
                            <div
                              key={entryIndex}
                              className={cn(
                                "text-xs px-1.5 py-1 rounded leading-tight truncate",
                                "flex items-center gap-1 w-full group",
                                "bg-blue-500/20 text-blue-700 border border-blue-500"
                              )}
                              title={`${time} - ${studentName}`}
                            >
                              <span className="font-medium">{time}</span>
                              <span className="truncate flex-1">{studentName}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onRemoveEntry(entryIndex)
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Usuń lekcję"
                              >
                                <IconX className="h-3 w-3" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student summary */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Podsumowanie godzin dla uczniów</h3>
          <div className="space-y-2">
            {Object.entries(studentHours).length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak zaplanowanych lekcji</p>
            ) : (
              Object.entries(studentHours).map(([studentId, hours]) => {
                const student = students.find(s => s.id === studentId)
                const studentName = student 
                  ? `${student.first_name} ${student.last_name}`
                  : 'Nieznany'
                const lessonCount = entries.filter(e => e.student_id === studentId).length
                
                return (
                  <div key={studentId} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{studentName}</p>
                      <p className="text-sm text-muted-foreground">
                        {lessonCount} {lessonCount === 1 ? 'lekcja' : lessonCount < 5 ? 'lekcje' : 'lekcji'}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-lg">
                      {formatHours(hours)} h
                    </Badge>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

