'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TutorAvailabilityDialog } from './tutor-availability-dialog'
import type { TutorAvailabilitySummary } from '@/lib/types/availability.types'
import { IconEye, IconCalendar } from '@tabler/icons-react'

interface TutorAvailabilityListProps {
  tutors: TutorAvailabilitySummary[]
}

export function TutorAvailabilityList({ tutors }: TutorAvailabilityListProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'has' | 'missing'>('all')
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const filteredTutors = tutors.filter((tutor) => {
    const matchesSearch = tutor.tutor_name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'all' ||
      (filter === 'has' && tutor.has_availability) ||
      (filter === 'missing' && !tutor.has_availability)
    return matchesSearch && matchesFilter
  })

  const stats = {
    total: tutors.length,
    withAvailability: tutors.filter((t) => t.has_availability).length,
    withoutAvailability: tutors.filter((t) => !t.has_availability).length,
  }

  const handleView = (tutorId: string) => {
    setSelectedTutorId(tutorId)
    setDialogOpen(true)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      {/* Statystyki */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wszyscy tutorzy</CardTitle>
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Z dostępnością</CardTitle>
            <IconCalendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.withAvailability}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((stats.withAvailability / stats.total) * 100)}% wszystkich
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bez dostępności</CardTitle>
            <IconCalendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.withoutAvailability}</div>
            <p className="text-xs text-muted-foreground">Do uzupełnienia</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtry */}
      <Card>
        <CardHeader>
          <CardTitle>Dostępność tutorów</CardTitle>
          <CardDescription>Przeglądaj i monitoruj grafiki dostępności</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Szukaj tutora..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszyscy</SelectItem>
                <SelectItem value="has">Z dostępnością</SelectItem>
                <SelectItem value="missing">Bez dostępności</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Wersja</TableHead>
                  <TableHead>Ostatnia aktualizacja</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
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
                    <TableRow key={tutor.tutor_id}>
                      <TableCell className="font-medium">{tutor.tutor_name}</TableCell>
                      <TableCell>
                        {tutor.has_availability ? (
                          <Badge variant="default" className="bg-green-600">
                            Wypełniony
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Brak</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {tutor.version ? `v${tutor.version}` : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(tutor.last_updated)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(tutor.tutor_id)}
                          disabled={!tutor.has_availability}
                        >
                          <IconEye className="h-4 w-4 mr-2" />
                          Podgląd
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog podglądu */}
      {selectedTutorId && (
        <TutorAvailabilityDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          tutorId={selectedTutorId}
        />
      )}
    </div>
  )
}

