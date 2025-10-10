'use client'

import { useState, useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Session {
  id: string
  session_date: string
  duration_minutes: number
  notes: string | null
  students: { id: string; first_name: string; last_name: string }
  student_assignments: {
    subjects: { id: string; name: string }
    subject_levels: { level_name: string }
  }
}

interface HistoryViewProps {
  sessions: Session[]
}

export function HistoryView({ sessions }: HistoryViewProps) {
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const searchLower = search.toLowerCase()
      const matchesSearch =
        session.students.first_name.toLowerCase().includes(searchLower) ||
        session.students.last_name.toLowerCase().includes(searchLower) ||
        session.student_assignments.subjects.name.toLowerCase().includes(searchLower)

      if (!matchesSearch) return false

      const sessionDate = new Date(session.session_date)
      if (dateFrom && sessionDate < new Date(dateFrom)) return false
      if (dateTo && sessionDate > new Date(dateTo)) return false

      return true
    })
  }, [sessions, search, dateFrom, dateTo])

  const stats = useMemo(() => {
    const totalMinutes = filteredSessions.reduce((acc, s) => acc + s.duration_minutes, 0)

    return {
      totalHours: totalMinutes / 60,
      totalSessions: filteredSessions.length,
    }
  }, [filteredSessions])

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return new Intl.DateTimeFormat('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    } catch {
      return dateString
    }
  }

  return (
    <div className="space-y-6">
      {/* Statystyki */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suma godzin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours.toFixed(2)}h</div>
            <p className="text-xs text-muted-foreground">{stats.totalSessions} sesji</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liczba sesji</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
            <p className="text-xs text-muted-foreground">Wszystkie sesje</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtry */}
      <Card>
        <CardHeader>
          <CardTitle>Filtry</CardTitle>
          <CardDescription>Filtruj historię sesji</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Szukaj</Label>
              <Input
                placeholder="Uczeń lub przedmiot..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data od</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data do</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Historia sesji</CardTitle>
          <CardDescription>Wszystkie przeprowadzone sesje</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data i godzina</TableHead>
                  <TableHead>Uczeń</TableHead>
                  <TableHead>Przedmiot</TableHead>
                  <TableHead>Poziom</TableHead>
                  <TableHead className="text-right">Czas trwania</TableHead>
                  <TableHead>Notatki</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Brak sesji do wyświetlenia
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {formatDate(session.session_date)}
                      </TableCell>
                      <TableCell>
                        {session.students.first_name} {session.students.last_name}
                      </TableCell>
                      <TableCell>{session.student_assignments.subjects.name}</TableCell>
                      <TableCell>{session.student_assignments.subject_levels.level_name}</TableCell>
                      <TableCell className="text-right">{session.duration_minutes} min</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {session.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

