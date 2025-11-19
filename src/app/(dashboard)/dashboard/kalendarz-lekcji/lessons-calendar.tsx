'use client'

import { useState, useMemo } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from "date-fns"
import { pl } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { SessionStatus } from "@/lib/types/database.types"

interface Session {
  id: string
  session_date: string
  duration_minutes: number
  notes: string | null
  status: SessionStatus
  students: { id: string; first_name: string; last_name: string }
  profiles: { id: string; full_name: string }
  student_assignments: {
    id: string
    subjects: { id: string; name: string }
    subject_levels: { id: string; level_name: string }
  }
}

interface LessonsCalendarProps {
  sessions: Session[]
  isAdmin?: boolean
}

export function LessonsCalendar({ sessions, isAdmin = false }: LessonsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSessions, setSelectedSessions] = useState<Session[]>([])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Oblicz statystyki dla aktualnego miesiąca
  const monthStats = useMemo(() => {
    const monthSessions = sessions.filter(session => {
      const sessionDate = new Date(session.session_date)
      return isSameMonth(sessionDate, currentMonth)
    })

    const totalSessions = monthSessions.length
    const completedSessions = monthSessions.filter(s => s.status === 'completed').length
    const scheduledSessions = monthSessions.filter(s => s.status === 'scheduled').length
    const cancelledSessions = monthSessions.filter(s => s.status === 'cancelled').length

    return {
      total: totalSessions,
      completed: completedSessions,
      scheduled: scheduledSessions,
      cancelled: cancelledSessions,
    }
  }, [sessions, currentMonth])

  // Oblicz statystyki ogólne (wszystkie sesje)
  const overallStats = useMemo(() => {
    const totalSessions = sessions.length
    const completedSessions = sessions.filter(s => s.status === 'completed').length
    const scheduledSessions = sessions.filter(s => s.status === 'scheduled').length
    const cancelledSessions = sessions.filter(s => s.status === 'cancelled').length
    const totalHours = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) / 60

    return {
      total: totalSessions,
      completed: completedSessions,
      scheduled: scheduledSessions,
      cancelled: cancelledSessions,
      totalHours: totalHours.toFixed(1),
    }
  }, [sessions])

  // Grupuj sesje według daty
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, Session[]> = {}
    sessions.forEach(session => {
      const dateKey = format(new Date(session.session_date), 'yyyy-MM-dd')
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(session)
    })
    return grouped
  }, [sessions])

  const handleDateClick = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const daySessions = sessionsByDate[dateKey] || []
    setSelectedSessions(daySessions)
    setSelectedDate(date)
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleToday = () => {
    setCurrentMonth(new Date())
  }

  // Uzyskaj pierwszy dzień miesiąca i jego dzień tygodnia (0 = niedziela, 6 = sobota)
  // W Polsce tydzień zaczyna się od poniedziałku (1), więc przesuwamy
  const firstDayOfWeek = (getDay(monthStart) + 6) % 7 // Konwersja: niedziela (0) → 6, poniedziałek (1) → 0
  const weekDays = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie']

  const getStatusColor = (status: SessionStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-700 border-green-500'
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-700 border-blue-500'
      case 'cancelled':
        return 'bg-red-500/20 text-red-700 border-red-500'
      default:
        return 'bg-gray-500/20 text-gray-700 border-gray-500'
    }
  }

  const getStatusLabel = (status: SessionStatus) => {
    switch (status) {
      case 'completed':
        return 'Odbyta'
      case 'scheduled':
        return 'Zaplanowana'
      case 'cancelled':
        return 'Anulowana'
      default:
        return status
    }
  }

  return (
    <div className="space-y-4">
      {/* Kalendarz */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {format(currentMonth, 'MMMM yyyy', { locale: pl })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousMonth}
              >
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
              >
                Dzisiaj
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
              >
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Nagłówki dni tygodnia */}
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

            {/* Dni miesiąca */}
            <div className="grid grid-cols-7 gap-1">
              {/* Puste komórki przed pierwszym dniem miesiąca */}
              {Array.from({ length: firstDayOfWeek }).map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}

              {/* Dni miesiąca */}
              {daysInMonth.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const daySessions = sessionsByDate[dateKey] || []
                const isToday = isSameDay(day, new Date())
                const isCurrentMonth = isSameMonth(day, currentMonth)
                
                // Sortuj sesje według godziny
                const sortedSessions = [...daySessions].sort((a, b) => {
                  const timeA = new Date(a.session_date).getTime()
                  const timeB = new Date(b.session_date).getTime()
                  return timeA - timeB
                })

                return (
                  <button
                    key={dateKey}
                    onClick={() => handleDateClick(day)}
                    className={cn(
                      "aspect-square p-1 rounded-md border transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "flex flex-col items-start gap-0.5 overflow-hidden",
                      !isCurrentMonth && "opacity-50",
                      isToday && "ring-2 ring-primary",
                      daySessions.length > 0 && "bg-muted"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium flex-shrink-0",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {sortedSessions.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 w-full">
                        {sortedSessions.map((session) => (
                          <Badge
                            key={session.id}
                            variant="outline"
                            className={cn(
                              "text-[9px] px-0.5 py-0 h-3.5 leading-tight",
                              "flex items-center justify-center",
                              getStatusColor(session.status)
                            )}
                          >
                            {format(new Date(session.session_date), 'HH:mm')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getStatusColor('completed')}>
                Odbyta
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getStatusColor('scheduled')}>
                Zaplanowana
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getStatusColor('cancelled')}>
                Anulowana
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Baner ze statystykami ogólnymi */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground font-medium">Wszystkie lekcje</div>
              <div className="text-3xl font-bold text-foreground">{overallStats.total}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground font-medium">Odbyte</div>
              <div className="text-3xl font-bold text-green-600">{overallStats.completed}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground font-medium">Zaplanowane</div>
              <div className="text-3xl font-bold text-blue-600">{overallStats.scheduled}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground font-medium">Anulowane</div>
              <div className="text-3xl font-bold text-red-600">{overallStats.cancelled}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground font-medium">Łączne godziny</div>
              <div className="text-3xl font-bold text-purple-600">{overallStats.totalHours}h</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog ze szczegółami sesji dla wybranego dnia */}
      <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Sesje z dnia {selectedDate && format(selectedDate, 'd MMMM yyyy', { locale: pl })}
            </DialogTitle>
            <DialogDescription>
              {selectedSessions.length === 0
                ? 'Brak sesji w tym dniu'
                : `${selectedSessions.length} ${selectedSessions.length === 1 ? 'sesja' : 'sesji'}`
              }
            </DialogDescription>
          </DialogHeader>
          {selectedSessions.length > 0 && (
            <div className="space-y-2">
              {selectedSessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={getStatusColor(session.status)}
                          >
                            {getStatusLabel(session.status)}
                          </Badge>
                          <span className="font-medium">
                            {format(new Date(session.session_date), 'HH:mm', { locale: pl })}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {session.duration_minutes} min
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="font-medium">Uczeń: </span>
                          {session.students.first_name} {session.students.last_name}
                        </div>
                        {isAdmin && (
                          <div>
                            <span className="font-medium">Tutor: </span>
                            {session.profiles.full_name}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Przedmiot: </span>
                          {session.student_assignments.subjects.name} - {session.student_assignments.subject_levels.level_name}
                        </div>
                        {session.notes && (
                          <div>
                            <span className="font-medium">Notatki: </span>
                            <span className="text-muted-foreground">{session.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

