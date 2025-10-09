'use client'

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TutorWithStats {
  id: string
  full_name: string
  email: string
  created_at: string
  activeAssignments: number
  totalHours: number
  totalSessions: number
}

interface TutorsTableProps {
  tutors: TutorWithStats[]
}

export function TutorsTable({ tutors }: TutorsTableProps) {
  const [search, setSearch] = useState("")

  const filteredTutors = tutors.filter(
    (tutor) =>
      tutor.full_name.toLowerCase().includes(search.toLowerCase()) ||
      tutor.email.toLowerCase().includes(search.toLowerCase())
  )

  const totalStats = {
    totalTutors: tutors.length,
    totalActiveAssignments: tutors.reduce((acc, t) => acc + t.activeAssignments, 0),
    totalHours: tutors.reduce((acc, t) => acc + t.totalHours, 0),
  }

  return (
    <div className="space-y-4">
      {/* Statystyki */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liczba tutorów</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalTutors}</div>
            <p className="text-xs text-muted-foreground">Wszyscy tutorzy w systemie</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktywne przypisania</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalActiveAssignments}</div>
            <p className="text-xs text-muted-foreground">Suma wszystkich przypisań</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suma godzin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalHours.toFixed(2)}h</div>
            <p className="text-xs text-muted-foreground">Wszystkie przeprowadzone sesje</p>
          </CardContent>
        </Card>
      </div>

      {/* Wyszukiwarka */}
      <Input
        placeholder="Szukaj tutora..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Tabela */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Aktywne przypisania</TableHead>
              <TableHead className="text-right">Liczba sesji</TableHead>
              <TableHead className="text-right">Suma godzin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTutors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Brak tutorów do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredTutors.map((tutor) => (
                <TableRow key={tutor.id}>
                  <TableCell className="font-medium">{tutor.full_name}</TableCell>
                  <TableCell>{tutor.email}</TableCell>
                  <TableCell className="text-right">{tutor.activeAssignments}</TableCell>
                  <TableCell className="text-right">{tutor.totalSessions}</TableCell>
                  <TableCell className="text-right">{tutor.totalHours.toFixed(2)}h</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

