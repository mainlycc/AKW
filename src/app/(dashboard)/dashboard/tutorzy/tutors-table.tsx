'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { GroupMessageDialog } from "./group-message-dialog"
import { deleteTutor } from "./actions"
import { IconTrash, IconMail, IconSearch } from "@tabler/icons-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { formatHours } from "@/lib/utils"

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
  weeklyLessons: number
  totalSessions: number
}

interface TutorSubjectLevel {
  id: string
  subject_id: string
  subject_level_id: string
  subjects: { id: string; name: string; color?: string | null } | null
  subject_levels: { id: string; level_name: string; price_per_hour: number } | null
}

interface TutorsTableProps {
  tutors: TutorWithStats[]
  tutorSubjects: Record<string, TutorSubjectLevel[]>
  defaultTutorRate?: number | null
}

export function TutorsTable({ tutors, tutorSubjects, defaultTutorRate = null }: TutorsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })
  const [groupMessageDialogOpen, setGroupMessageDialogOpen] = useState(false)

  const filteredTutors = tutors.filter((tutor) => {
    if (!search.trim()) return true
    
    const searchLower = search.toLowerCase().trim()
    const fullNameLower = tutor.full_name.toLowerCase()
    const emailLower = tutor.email.toLowerCase()
    
    // Wyszukiwanie po pełnym imieniu i nazwisku
    if (fullNameLower.includes(searchLower) || emailLower.includes(searchLower)) {
      return true
    }
    
    // Wyszukiwanie po osobnych słowach (imię lub nazwisko)
    const nameWords = fullNameLower.split(/\s+/)
    const searchWords = searchLower.split(/\s+/)
    
    // Sprawdź czy wszystkie słowa z wyszukiwania znajdują się w imieniu/nazwisku
    return searchWords.every(word => 
      nameWords.some(nameWord => nameWord.includes(word))
    )
  })

  const handleRowClick = (tutor: TutorWithStats) => {
    router.push(`/dashboard/tutorzy/${tutor.id}`)
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    
    const count = selectedIds.size
    setConfirmDialogContent({
      title: 'Usuwanie tutorów',
      description: `Czy na pewno chcesz usunąć ${count} ${count === 1 ? 'tutora' : 'tutorów'}?`,
      onConfirm: async () => {
        try {
          for (const id of selectedIds) {
            await deleteTutor(id)
          }
          setSelectedIds(new Set())
          setConfirmDialogOpen(false)
          router.refresh()
        } catch (error) {
          console.error('Błąd podczas usuwania tutorów:', error)
          const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd'
          alert(`Wystąpił błąd podczas usuwania tutorów: ${errorMessage}`)
        }
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
            <div className="text-2xl font-bold">{formatHours(totalStats.totalHours)}h</div>
            <p className="text-xs text-muted-foreground">Wszystkie przeprowadzone sesje</p>
          </CardContent>
        </Card>
      </div>

      {/* Wyszukiwarka i przyciski */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj tutora..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setGroupMessageDialogOpen(true)}
            disabled={selectedIds.size === 0}
          >
            <IconMail className="mr-2 h-4 w-4" />
            Wyślij wiadomość grupową {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Usuń zaznaczone {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
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
              <TableHead className="text-right">Liczba uczniów</TableHead>
              <TableHead className="text-right">Lekcje/tydz.</TableHead>
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
                    {tutor.hourly_rate 
                      ? `${tutor.hourly_rate.toFixed(0)}` 
                      : defaultTutorRate 
                        ? `${defaultTutorRate.toFixed(0)}` 
                        : '-'}
                  </TableCell>
                  <TableCell className="text-right">{tutor.activeAssignments}</TableCell>
                  <TableCell className="text-right">{tutor.weeklyLessons || 0}</TableCell>
                  <TableCell className="text-right">{formatHours(tutor.totalHours)}h</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title={confirmDialogContent.title}
        description={confirmDialogContent.description}
        onConfirm={confirmDialogContent.onConfirm}
        confirmText="Usuń"
        cancelText="Anuluj"
      />

      <GroupMessageDialog
        open={groupMessageDialogOpen}
        onOpenChange={setGroupMessageDialogOpen}
        selectedTutors={filteredTutors.filter(t => selectedIds.has(t.id))}
      />
    </div>
  )
}

