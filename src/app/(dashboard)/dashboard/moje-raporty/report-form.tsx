'use client'

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createOrUpdateReport, getSessionsForReport, type SessionForReport } from "./actions"
import { formatHours } from "@/lib/utils"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay } from "date-fns"
import { pl } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { IconArrowLeft } from "@tabler/icons-react"
import Link from "next/link"

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface ReportFormProps {
  tutorId: string
  students: Student[]
  initialReport?: { month: number; year: number; entries: { student_id: string; hours: number }[] }
}

const months = [
  { value: 1, label: 'Styczeń' },
  { value: 2, label: 'Luty' },
  { value: 3, label: 'Marzec' },
  { value: 4, label: 'Kwiecień' },
  { value: 5, label: 'Maj' },
  { value: 6, label: 'Czerwiec' },
  { value: 7, label: 'Lipiec' },
  { value: 8, label: 'Sierpień' },
  { value: 9, label: 'Wrzesień' },
  { value: 10, label: 'Październik' },
  { value: 11, label: 'Listopad' },
  { value: 12, label: 'Grudzień' },
]

export function ReportForm({ tutorId, students, initialReport }: ReportFormProps) {
  const router = useRouter()
  const currentDate = new Date()
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(currentDate.getMonth() + 1)
  const [year, setYear] = useState(currentDate.getFullYear())
  const [hours, setHours] = useState<Record<string, string>>({})
  const [sessions, setSessions] = useState<SessionForReport[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  useEffect(() => {
    if (initialReport) {
      setMonth(initialReport.month)
      setYear(initialReport.year)
      const mapped: Record<string, string> = {}
      initialReport.entries.forEach(e => {
        mapped[e.student_id] = e.hours.toString()
      })
      setHours(mapped)
    } else {
      const date = new Date()
      setMonth(date.getMonth() + 1)
      setYear(date.getFullYear())
      setHours({})
    }
  }, [initialReport])

  // Pobierz sesje przy zmianie miesiąca/roku
  useEffect(() => {
    if (!initialReport) {
      fetchSessionsForMonth()
    }
  }, [month, year, initialReport])

  const fetchSessionsForMonth = async () => {
    setLoadingSessions(true)
    try {
      const fetchedSessions = await getSessionsForReport(tutorId, month, year)
      setSessions(fetchedSessions)
    } catch (error) {
      console.error('Error fetching sessions:', error)
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }

  const generateHoursFromSessions = () => {
    // Filtruj tylko sesje ze statusem completed
    const completedSessions = sessions.filter(s => s.status === 'completed')
    
    // Grupuj po student_id i sumuj duration_minutes
    const hoursByStudent: Record<string, number> = {}
    completedSessions.forEach(session => {
      const studentId = session.student_id
      if (!hoursByStudent[studentId]) {
        hoursByStudent[studentId] = 0
      }
      hoursByStudent[studentId] += session.duration_minutes
    })

    // Konwertuj minuty na godziny i wypełnij pola
    const newHours: Record<string, string> = {}
    Object.entries(hoursByStudent).forEach(([studentId, minutes]) => {
      const hoursValue = minutes / 60
      newHours[studentId] = hoursValue.toFixed(2)
    })

    setHours(newHours)
  }

  const handleHoursChange = (studentId: string, value: string) => {
    setHours(prev => ({ ...prev, [studentId]: value }))
  }

  const getTotalHours = () => {
    return Object.values(hours).reduce((sum, h) => sum + (parseFloat(h) || 0), 0)
  }

  const handleSaveDraft = async () => {
    await handleSubmit('draft')
  }

  const handleSubmitReport = async () => {
    await handleSubmit('submitted')
  }

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    setLoading(true)

    try {
      const entries = Object.entries(hours)
        .filter(([, h]) => parseFloat(h) > 0)
        .map(([studentId, h]) => ({
          student_id: studentId,
          hours: parseFloat(h),
        }))

      if (entries.length === 0) {
        alert('Dodaj co najmniej jednego ucznia z godzinami')
        setLoading(false)
        return
      }

      await createOrUpdateReport(tutorId, month, year, entries, status)
      router.push('/dashboard/moje-raporty')
      router.refresh()
    } catch (error) {
      console.error('Error saving report:', error)
      alert('Błąd podczas zapisywania raportu')
    } finally {
      setLoading(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i)

  // Obliczenia dla kalendarza
  const currentMonthDate = useMemo(() => new Date(year, month - 1, 1), [year, month])
  const monthStart = startOfMonth(currentMonthDate)
  const monthEnd = endOfMonth(currentMonthDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const firstDayOfWeek = (getDay(monthStart) + 6) % 7
  const weekDays = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie']

  // Grupuj sesje według daty
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, SessionForReport[]> = {}
    sessions.forEach(session => {
      const dateKey = format(new Date(session.session_date), 'yyyy-MM-dd')
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(session)
    })
    return grouped
  }, [sessions])

  // Statystyki dla miesiąca
  const monthStats = useMemo(() => {
    const monthSessions = sessions.filter(session => {
      const sessionDate = new Date(session.session_date)
      return isSameMonth(sessionDate, currentMonthDate)
    })

    const totalSessions = monthSessions.length
    const completedSessions = monthSessions.filter(s => s.status === 'completed').length
    const totalMinutes = monthSessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + s.duration_minutes, 0)
    const totalHours = totalMinutes / 60

    return {
      total: totalSessions,
      completed: completedSessions,
      totalHours: totalHours.toFixed(2),
    }
  }, [sessions, currentMonthDate])

  const getStatusColor = (status: string) => {
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

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
  }

  const getSelectedDaySessions = () => {
    if (!selectedDate) return []
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    return sessionsByDate[dateKey] || []
  }

  // Oblicz które lekcje będą w raporcie (tylko completed)
  const reportSessions = useMemo(() => {
    return sessions.filter(s => s.status === 'completed')
  }, [sessions])

  // Grupuj lekcje z raportu po dacie
  const reportSessionsByDate = useMemo(() => {
    const grouped: Record<string, SessionForReport[]> = {}
    reportSessions.forEach(session => {
      const dateKey = format(new Date(session.session_date), 'yyyy-MM-dd')
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(session)
    })
    return grouped
  }, [reportSessions])

  // Oblicz godziny na podstawie wprowadzonych wartości
  const reportHoursByStudent = useMemo(() => {
    const result: Record<string, { hours: number; student: Student }> = {}
    Object.entries(hours).forEach(([studentId, hoursValue]) => {
      const parsedHours = parseFloat(hoursValue)
      if (parsedHours > 0) {
        const student = students.find(s => s.id === studentId)
        if (student) {
          result[studentId] = {
            hours: parsedHours,
            student
          }
        }
      }
    })
    return result
  }, [hours, students])

  return (
    <div className="space-y-6">
      {/* Przycisk powrotu */}
      <Link href="/dashboard/moje-raporty">
        <Button variant="ghost" size="sm">
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Powrót do listy raportów
        </Button>
      </Link>

      {/* Wybór miesiąca i roku */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Miesiąc</Label>
          <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))} disabled={!!initialReport}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value.toString()}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {initialReport && <p className="text-xs text-muted-foreground">Miesiąc nie może być zmieniony podczas edycji.</p>}
        </div>
        <div className="space-y-2">
          <Label>Rok</Label>
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))} disabled={!!initialReport}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {initialReport && <p className="text-xs text-muted-foreground">Rok nie może być zmieniony podczas edycji.</p>}
        </div>
      </div>

      {/* Kalendarz lekcji */}
      {!initialReport && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Kalendarz lekcji</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Tylko lekcje ze statusem <span className="font-semibold text-green-600">"Odbyta"</span> będą uwzględnione w raporcie
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateHoursFromSessions}
              disabled={loadingSessions || sessions.length === 0}
            >
              {loadingSessions ? 'Ładowanie...' : 'Wygeneruj z kalendarza'}
            </Button>
          </div>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {format(currentMonthDate, 'MMMM yyyy', { locale: pl })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ładowanie lekcji...
                </div>
              ) : (
                <>
                  {/* Statystyki */}
                  <div className="grid grid-cols-3 gap-2 mb-4 p-2 bg-muted rounded text-sm">
                    <div>
                      <div className="text-muted-foreground">Wszystkie lekcje</div>
                      <div className="font-semibold">{monthStats.total}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        <span className="font-semibold text-green-600">W raporcie</span> (odbyte)
                      </div>
                      <div className="font-semibold text-green-600">{monthStats.completed}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Godziny w raporcie</div>
                      <div className="font-semibold text-blue-600">{monthStats.totalHours}h</div>
                    </div>
                  </div>

                  {/* Kalendarz */}
                  <div className="space-y-2">
                    {/* Nagłówki dni tygodnia */}
                    <div className="grid grid-cols-7 gap-1">
                      {weekDays.map((day) => (
                        <div
                          key={day}
                          className="text-center text-xs font-medium text-muted-foreground p-1"
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
                        const dayReportSessions = reportSessionsByDate[dateKey] || []
                        const isToday = isSameDay(day, new Date())
                        const hasReportSessions = dayReportSessions.length > 0
                        
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
                              "aspect-square p-1 rounded-md border transition-colors text-xs",
                              "hover:bg-accent hover:text-accent-foreground",
                              "flex flex-col items-start gap-0.5 overflow-hidden",
                              isToday && "ring-2 ring-primary",
                              daySessions.length > 0 && "bg-muted",
                              hasReportSessions && "ring-2 ring-green-500 border-green-500"
                            )}
                            title={hasReportSessions ? `${dayReportSessions.length} lekcja/lekcje w raporcie` : undefined}
                          >
                            <span className={cn(
                              "text-xs font-medium flex-shrink-0",
                              isToday && "text-primary"
                            )}>
                              {format(day, 'd')}
                            </span>
                            {sortedSessions.length > 0 && (
                              <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                                {sortedSessions.slice(0, 2).map((session) => {
                                  const studentName = `${session.students.first_name} ${session.students.last_name}`
                                  const time = format(new Date(session.session_date), 'HH:mm')
                                  const isInReport = session.status === 'completed'
                                  return (
                                    <div
                                      key={session.id}
                                      className={cn(
                                        "text-[10px] px-1 py-0.5 rounded leading-tight truncate",
                                        "flex items-center gap-0.5 w-full",
                                        getStatusColor(session.status),
                                        isInReport && "ring-1 ring-green-600 font-semibold"
                                      )}
                                      title={`${time} - ${studentName}${isInReport ? ' (w raporcie)' : ''}`}
                                    >
                                      <span className="font-medium">{time}</span>
                                      {isInReport && <span className="text-[8px]">✓</span>}
                                    </div>
                                  )
                                })}
                                {sortedSessions.length > 2 && (
                                  <div className="text-[10px] text-muted-foreground px-1">
                                    +{sortedSessions.length - 2}
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Legenda */}
                    <div className="mt-3 pt-3 border-t flex flex-wrap gap-3 text-xs">
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
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Szczegóły sesji dla wybranego dnia */}
          {selectedDate && getSelectedDaySessions().length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Sesje z dnia {format(selectedDate, 'd MMMM yyyy', { locale: pl })}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(null)}
                    className="h-6 w-6 p-0"
                  >
                    ×
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getSelectedDaySessions().map((session) => (
                    <Card key={session.id}>
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={getStatusColor(session.status)}
                              >
                                {session.status === 'completed' ? 'Odbyta' : session.status === 'scheduled' ? 'Zaplanowana' : 'Anulowana'}
                              </Badge>
                              <span className="font-medium text-sm">
                                {format(new Date(session.session_date), 'HH:mm', { locale: pl })}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {session.duration_minutes} min
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Uczeń: </span>
                            {session.students.first_name} {session.students.last_name}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Podsumowanie lekcji w raporcie */}
      {!initialReport && reportSessions.length > 0 && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-green-600">✓</span>
              Lekcje w raporcie ({reportSessions.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Poniżej znajdują się wszystkie lekcje, które będą uwzględnione w raporcie (tylko lekcje ze statusem "Odbyta")
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {reportSessions
                .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
                .map((session) => {
                  const studentName = `${session.students.first_name} ${session.students.last_name}`
                  const sessionDate = new Date(session.session_date)
                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border border-green-200"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={getStatusColor(session.status)}>
                          Odbyta
                        </Badge>
                        <div className="text-sm">
                          <div className="font-medium">{studentName}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(sessionDate, 'd MMMM yyyy, HH:mm', { locale: pl })}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-green-600">
                        {(session.duration_minutes / 60).toFixed(2)} h
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista uczniów */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Godziny w raporcie</CardTitle>
          <p className="text-sm text-muted-foreground">
            Wprowadź liczbę godzin dla każdego ucznia. Wartości mogą być automatycznie wygenerowane z kalendarza (tylko lekcje "Odbyta").
          </p>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak przypisanych uczniów</p>
          ) : (
            <div className="space-y-2">
              {Object.keys(reportHoursByStudent).length > 0 && (
                <div className="mb-3 p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded text-sm">
                  <div className="font-semibold text-green-700 dark:text-green-400 mb-1">
                    ✓ Wprowadzone godziny (będą w raporcie):
                  </div>
                  <div className="space-y-1">
                    {Object.values(reportHoursByStudent).map(({ student, hours }) => (
                      <div key={student.id} className="flex justify-between text-xs">
                        <span>{student.first_name} {student.last_name}</span>
                        <span className="font-semibold">{formatHours(hours)} h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2 max-h-80 overflow-y-auto border rounded p-3">
                {students.map(student => {
                  const hasHours = parseFloat(hours[student.id] || '0') > 0
                  return (
                    <div key={student.id} className={cn(
                      "flex items-center gap-3 p-2 rounded",
                      hasHours && "bg-green-50 dark:bg-green-950/20 border border-green-200"
                    )}>
                      <span className={cn(
                        "flex-1 text-sm",
                        hasHours && "font-semibold"
                      )}>
                        {student.first_name} {student.last_name}
                        {hasHours && <span className="ml-2 text-green-600 text-xs">✓ w raporcie</span>}
                      </span>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="0"
                        value={hours[student.id] || ''}
                        onChange={(e) => handleHoursChange(student.id, e.target.value)}
                        disabled={loading}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground w-8">h</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Podsumowanie */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-lg">Suma godzin w raporcie:</div>
              <div className="text-sm text-muted-foreground mt-1">
                {Object.keys(reportHoursByStudent).length} {Object.keys(reportHoursByStudent).length === 1 ? 'uczeń' : 'uczniów'} • {reportSessions.length} {reportSessions.length === 1 ? 'lekcja' : 'lekcji'}
              </div>
            </div>
            <span className="text-2xl font-bold text-primary">{formatHours(getTotalHours())} h</span>
          </div>
        </CardContent>
      </Card>

      {/* Przyciski */}
      <div className="flex justify-end gap-2">
        <Link href="/dashboard/moje-raporty">
          <Button type="button" variant="outline" disabled={loading}>
            Anuluj
          </Button>
        </Link>
        <Button type="button" variant="secondary" onClick={handleSaveDraft} disabled={loading}>
          {loading ? 'Zapisywanie...' : 'Zapisz roboczą'}
        </Button>
        <Button type="button" onClick={handleSubmitReport} disabled={loading}>
          {loading ? 'Wysyłanie...' : 'Złóż raport'}
        </Button>
      </div>
    </div>
  )
}

