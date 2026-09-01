'use client'

import { useState, useMemo, useEffect, useTransition } from "react"
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
import { updateSessionStatus } from "./actions"
import { useRouter } from "next/navigation"
import { StudentNameLink } from "@/components/student-name-link"

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

type StatusFilter = SessionStatus | 'all'

const STATUS_FILTERS: { value: StatusFilter; label: string; status?: SessionStatus }[] = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'scheduled', label: 'Zaplanowane', status: 'scheduled' },
  { value: 'completed', label: 'Odbyte', status: 'completed' },
  { value: 'cancelled', label: 'Anulowane', status: 'cancelled' },
]

export function LessonsCalendar({ sessions, isAdmin = false }: LessonsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSessions, setSelectedSessions] = useState<Session[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isPending, startTransition] = useTransition()
  const [updatingSessions, setUpdatingSessions] = useState<Set<string>>(new Set())
  const router = useRouter()
  
  // Tylko dla tutora (nie admina)
  const isTutor = !isAdmin

  const filteredSessions = useMemo(() => {
    if (statusFilter === 'all') return sessions
    return sessions.filter((session) => session.status === statusFilter)
  }, [sessions, statusFilter])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Oblicz statystyki dla aktualnego miesiąca
  const monthStats = useMemo(() => {
    const monthSessions = filteredSessions.filter(session => {
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
  }, [filteredSessions, currentMonth])

  // Oblicz statystyki ogólne (filtrowane sesje)
  const overallStats = useMemo(() => {
    const totalSessions = filteredSessions.length
    const completedSessions = filteredSessions.filter(s => s.status === 'completed').length
    const scheduledSessions = filteredSessions.filter(s => s.status === 'scheduled').length
    const cancelledSessions = filteredSessions.filter(s => s.status === 'cancelled').length
    const totalHours = filteredSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) / 60

    return {
      total: totalSessions,
      completed: completedSessions,
      scheduled: scheduledSessions,
      cancelled: cancelledSessions,
      totalHours: totalHours.toFixed(1),
    }
  }, [filteredSessions])

  // Grupuj sesje według daty
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, Session[]> = {}
    filteredSessions.forEach(session => {
      const dateKey = format(new Date(session.session_date), 'yyyy-MM-dd')
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(session)
    })
    return grouped
  }, [filteredSessions])

  // Zamknij podgląd dnia, jeśli po filtrze brak sesji w wybranym dniu
  useEffect(() => {
    if (!selectedDate) return
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    const daySessions = sessionsByDate[dateKey] || []
    setSelectedSessions(daySessions)
    if (daySessions.length === 0) {
      setSelectedDate(null)
    }
  }, [sessionsByDate, selectedDate])

  // Filtruj przeszłe lekcje ze statusem 'scheduled' (tylko dla tutora)
  const pastScheduledSessions = useMemo(() => {
    if (!isTutor) return []
    
    const now = new Date()
    return sessions.filter(session => {
      const sessionDate = new Date(session.session_date)
      return session.status === 'scheduled' && sessionDate < now && !updatingSessions.has(session.id)
    }).sort((a, b) => {
      const dateA = new Date(a.session_date).getTime()
      const dateB = new Date(b.session_date).getTime()
      return dateB - dateA // Najnowsze na górze
    })
  }, [sessions, isTutor, updatingSessions])

  // Obsługa aktualizacji statusu sesji
  const handleStatusUpdate = async (sessionId: string, status: 'completed' | 'cancelled') => {
    setUpdatingSessions(prev => new Set(prev).add(sessionId))
    
    startTransition(async () => {
      try {
        await updateSessionStatus(sessionId, status)
        router.refresh()
      } catch (error) {
        console.error('Error updating session status:', error)
        setUpdatingSessions(prev => {
          const newSet = new Set(prev)
          newSet.delete(sessionId)
          return newSet
        })
      }
    })
  }

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

  // Obsługa nawigacji klawiaturą
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + strzałki do nawigacji po miesiącach
      if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowLeft') {
        event.preventDefault()
        setCurrentMonth(prev => subMonths(prev, 1))
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowRight') {
        event.preventDefault()
        setCurrentMonth(prev => addMonths(prev, 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
      {/* Sekcja potwierdzania przeszłych lekcji (tylko dla tutora) */}
      {isTutor && pastScheduledSessions.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-amber-900 dark:text-amber-100">
              Potwierdź status lekcji
            </CardTitle>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              Poniżej znajdują się lekcje, których termin już minął. Proszę potwierdzić czy się odbyły.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastScheduledSessions.map((session) => {
                const studentName = `${session.students.first_name} ${session.students.last_name}`
                const sessionDate = new Date(session.session_date)
                const isUpdating = updatingSessions.has(session.id)
                
                return (
                  <Card key={session.id} className="bg-background">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <p className="font-medium text-base">
                              Czy lekcja z <span className="font-semibold text-primary">{studentName}</span> odbyła się?
                            </p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>
                                <span className="font-medium">Data i godzina: </span>
                                {format(sessionDate, 'd MMMM yyyy, HH:mm', { locale: pl })}
                              </div>
                              <div>
                                <span className="font-medium">Przedmiot: </span>
                                {session.student_assignments.subjects.name} - {session.student_assignments.subject_levels.level_name}
                              </div>
                              <div>
                                <span className="font-medium">Czas trwania: </span>
                                {session.duration_minutes} minut
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => handleStatusUpdate(session.id, 'completed')}
                            disabled={isUpdating || isPending}
                            className="flex-1 bg-green-500/20 text-green-700 border-green-500 hover:bg-green-500/30 dark:text-green-400 dark:border-green-500"
                            variant="outline"
                          >
                            {isUpdating ? 'Aktualizowanie...' : 'Odbyta'}
                          </Button>
                          <Button
                            onClick={() => handleStatusUpdate(session.id, 'cancelled')}
                            disabled={isUpdating || isPending}
                            className="flex-1 bg-red-500/20 text-red-700 border-red-500 hover:bg-red-500/30 dark:text-red-400 dark:border-red-500"
                            variant="outline"
                          >
                            {isUpdating ? 'Aktualizowanie...' : 'Odwołana'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kalendarz */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">
              {format(currentMonth, 'MMMM yyyy', { locale: pl })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="default"
                onClick={handlePreviousMonth}
                className="min-w-[100px]"
                title="Poprzedni miesiąc (Ctrl + ←)"
              >
                <IconChevronLeft className="h-4 w-4 mr-1" />
                Poprzedni
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={handleToday}
                className="min-w-[80px]"
              >
                Dzisiaj
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={handleNextMonth}
                className="min-w-[100px]"
                title="Następny miesiąc (Ctrl + →)"
              >
                Następny
                <IconChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtr statusów */}
          <div className="mb-4 pb-4 border-b flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground font-medium">Filtruj po:</span>
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.value
              const badgeClass =
                filter.status
                  ? getStatusColor(filter.status)
                  : 'bg-muted text-muted-foreground border-border'

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    'rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isActive && 'ring-2 ring-primary ring-offset-2'
                  )}
                  aria-pressed={isActive}
                >
                  <Badge variant="outline" className={cn(badgeClass, 'cursor-pointer px-3 py-1')}>
                    {filter.label}
                  </Badge>
                </button>
              )
            })}
          </div>

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
                      <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                        {sortedSessions.map((session) => {
                          const studentName = `${session.students.first_name} ${session.students.last_name}`
                          const time = format(new Date(session.session_date), 'HH:mm')
                          return (
                            <div
                              key={session.id}
                              className={cn(
                                "text-xs px-1.5 py-1 rounded leading-tight truncate",
                                "flex items-center gap-1 w-full",
                                getStatusColor(session.status)
                              )}
                              title={`${time} - ${studentName}`}
                            >
                              <span className="font-medium">{time}</span>
                              <span className="truncate">{studentName}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Baner ze statystykami (wg aktywnego filtra) */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          {statusFilter !== 'all' && (
            <p className="text-xs text-muted-foreground mb-3">
              Statystyki dla filtra:{' '}
              {STATUS_FILTERS.find((o) => o.value === statusFilter)?.label}
            </p>
          )}
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
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                          <StudentNameLink
                            student={session.students}
                            className="font-medium"
                          />
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

