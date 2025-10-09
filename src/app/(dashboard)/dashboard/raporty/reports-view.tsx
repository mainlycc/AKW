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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { IconDownload } from "@tabler/icons-react"

interface Session {
  id: string
  session_date: string
  duration_minutes: number
  students: { id: string; first_name: string; last_name: string }
  profiles: { id: string; full_name: string }
  student_assignments: {
    subjects: { id: string; name: string }
    subject_levels: { price_per_hour: number }
  }
}

interface Tutor {
  id: string
  full_name: string
}

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface Subject {
  id: string
  name: string
}

interface ReportsViewProps {
  sessions: Session[]
  tutors: Tutor[]
  students: Student[]
  subjects: Subject[]
}

export function ReportsView({ sessions, tutors, students, subjects }: ReportsViewProps) {
  const [tutorFilter, setTutorFilter] = useState<string>('all')
  const [studentFilter, setStudentFilter] = useState<string>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (tutorFilter !== 'all' && session.profiles.id !== tutorFilter) return false
      if (studentFilter !== 'all' && session.students.id !== studentFilter) return false
      if (subjectFilter !== 'all' && session.student_assignments.subjects.id !== subjectFilter) return false
      
      const sessionDate = new Date(session.session_date)
      if (dateFrom && sessionDate < new Date(dateFrom)) return false
      if (dateTo && sessionDate > new Date(dateTo)) return false
      
      return true
    })
  }, [sessions, tutorFilter, studentFilter, subjectFilter, dateFrom, dateTo])

  const reportData = useMemo(() => {
    const data: Record<
      string,
      {
        tutorName: string
        studentName: string
        subjectName: string
        totalMinutes: number
        sessionCount: number
        totalCost: number
      }
    > = {}

    filteredSessions.forEach((session) => {
      const key = `${session.profiles.id}-${session.students.id}-${session.student_assignments.subjects.id}`
      
      if (!data[key]) {
        data[key] = {
          tutorName: session.profiles.full_name,
          studentName: `${session.students.first_name} ${session.students.last_name}`,
          subjectName: session.student_assignments.subjects.name,
          totalMinutes: 0,
          sessionCount: 0,
          totalCost: 0,
        }
      }
      
      data[key].totalMinutes += session.duration_minutes
      data[key].sessionCount += 1
      data[key].totalCost +=
        (session.duration_minutes / 60) * session.student_assignments.subject_levels.price_per_hour
    })

    return Object.values(data)
  }, [filteredSessions])

  const totalStats = useMemo(() => {
    return {
      totalHours: filteredSessions.reduce((acc, s) => acc + s.duration_minutes, 0) / 60,
      totalSessions: filteredSessions.length,
      totalCost: reportData.reduce((acc, r) => acc + r.totalCost, 0),
    }
  }, [filteredSessions, reportData])

  const handleExportCSV = () => {
    const headers = ['Tutor', 'Uczeń', 'Przedmiot', 'Liczba sesji', 'Suma godzin', 'Koszt (zł)']
    const rows = reportData.map((row) => [
      row.tutorName,
      row.studentName,
      row.subjectName,
      row.sessionCount,
      (row.totalMinutes / 60).toFixed(2),
      row.totalCost.toFixed(2),
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `raport-godzin-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Statystyki ogólne */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suma godzin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalHours.toFixed(2)}h</div>
            <p className="text-xs text-muted-foreground">
              {totalStats.totalSessions} sesji
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liczba sesji</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              Wszystkie sesje w wybranym okresie
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Całkowity koszt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalCost.toFixed(2)} zł</div>
            <p className="text-xs text-muted-foreground">
              Suma kosztów wszystkich sesji
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtry */}
      <Card>
        <CardHeader>
          <CardTitle>Filtry</CardTitle>
          <CardDescription>Filtruj raporty według wybranych kryteriów</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Tutor</Label>
              <Select value={tutorFilter} onValueChange={setTutorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszyscy tutorzy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy tutorzy</SelectItem>
                  {tutors.map((tutor) => (
                    <SelectItem key={tutor.id} value={tutor.id}>
                      {tutor.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Uczeń</Label>
              <Select value={studentFilter} onValueChange={setStudentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszyscy uczniowie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy uczniowie</SelectItem>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Przedmiot</Label>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie przedmioty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie przedmioty</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data od</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Data do</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela raportów */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Raport szczegółowy</CardTitle>
            <CardDescription>Podsumowanie godzin według tutora, ucznia i przedmiotu</CardDescription>
          </div>
          <Button onClick={handleExportCSV} variant="outline">
            <IconDownload className="mr-2 h-4 w-4" />
            Eksportuj CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Uczeń</TableHead>
                  <TableHead>Przedmiot</TableHead>
                  <TableHead className="text-right">Liczba sesji</TableHead>
                  <TableHead className="text-right">Suma godzin</TableHead>
                  <TableHead className="text-right">Koszt (zł)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Brak danych do wyświetlenia
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.tutorName}</TableCell>
                      <TableCell>{row.studentName}</TableCell>
                      <TableCell>{row.subjectName}</TableCell>
                      <TableCell className="text-right">{row.sessionCount}</TableCell>
                      <TableCell className="text-right">
                        {(row.totalMinutes / 60).toFixed(2)}h
                      </TableCell>
                      <TableCell className="text-right">{row.totalCost.toFixed(2)} zł</TableCell>
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

