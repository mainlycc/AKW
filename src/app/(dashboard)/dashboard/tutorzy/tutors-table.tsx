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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TutorDetailDialog } from "./tutor-detail-dialog"
import { deleteTutor } from "./actions"
import { IconTrash } from "@tabler/icons-react"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface TutorWithStats {
  id: string
  full_name: string
  email: string
  phone: string | null
  bio: string | null
  hourly_rate: number | null
  created_at: string
  activeAssignments: number
  totalHours: number
  totalSessions: number
}

interface TutorSubjectLevel {
  id: string
  subject_id: string
  subject_level_id: string
  subjects: { id: string; name: string } | null
  subject_levels: { id: string; level_name: string; price_per_hour: number } | null
}

interface TutorsTableProps {
  tutors: TutorWithStats[]
  tutorSubjects: Record<string, TutorSubjectLevel[]>
}

export function TutorsTable({ tutors, tutorSubjects }: TutorsTableProps) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTutor, setSelectedTutor] = useState<TutorWithStats | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })

  const filteredTutors = tutors.filter(
    (tutor) =>
      tutor.full_name.toLowerCase().includes(search.toLowerCase()) ||
      tutor.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleRowClick = (tutor: TutorWithStats) => {
    setSelectedTutor(tutor)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setSelectedTutor(null)
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    
    const count = selectedIds.size
    setConfirmDialogContent({
      title: 'Usuwanie tutorów',
      description: `Czy na pewno chcesz usunąć ${count} ${count === 1 ? 'tutora' : 'tutorów'}?`,
      onConfirm: async () => {
        for (const id of selectedIds) {
          await deleteTutor(id)
        }
        setSelectedIds(new Set())
      }
    })
    setConfirmDialogOpen(true)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTutors.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredTutors.map(t => t.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

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

      {/* Wyszukiwarka i przyciski */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Szukaj tutora..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {selectedIds.size > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteSelected}
            >
              <IconTrash className="mr-2 h-4 w-4" />
              Usuń zaznaczone ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === filteredTutors.length && filteredTutors.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Stawka (zł/h)</TableHead>
              <TableHead className="text-right">Aktywne przypisania</TableHead>
              <TableHead className="text-right">Liczba sesji</TableHead>
              <TableHead className="text-right">Suma godzin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTutors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Brak tutorów do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredTutors.map((tutor) => (
                <TableRow 
                  key={tutor.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(tutor)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(tutor.id)}
                      onCheckedChange={() => toggleSelectOne(tutor.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{tutor.full_name}</TableCell>
                  <TableCell>{tutor.email}</TableCell>
                  <TableCell className="text-right">
                    {tutor.hourly_rate ? `${tutor.hourly_rate.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">{tutor.activeAssignments}</TableCell>
                  <TableCell className="text-right">{tutor.totalSessions}</TableCell>
                  <TableCell className="text-right">{tutor.totalHours.toFixed(2)}h</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TutorDetailDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        tutor={selectedTutor}
        tutorSubjects={selectedTutor ? tutorSubjects[selectedTutor.id] || [] : []}
      />

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title={confirmDialogContent.title}
        description={confirmDialogContent.description}
        onConfirm={confirmDialogContent.onConfirm}
        confirmText="Usuń"
        cancelText="Anuluj"
      />
    </div>
  )
}

