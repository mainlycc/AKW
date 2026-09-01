'use client'

import { useMemo, useState } from "react"
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
import { GroupMessageDialog } from "./group-message-dialog"
import { deleteTutor, setTutorsPublicBookingEnabled } from "./actions"
import { Badge } from "@/components/ui/badge"
import { IconTrash, IconMail, IconSearch, IconX, IconCheck } from "@tabler/icons-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { TableSelectionBar } from "@/components/table-selection-bar"
import { formatHours } from "@/lib/utils"

interface TutorWithStats {
  id: string
  full_name: string
  email: string
  phone: string | null
  bio: string | null
  hourly_rate: number | null
  public_booking_enabled?: boolean | null
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
  const [confirmDialogContent, setConfirmDialogContent] = useState<{
    title: string
    description: string
    confirmText: string
    onConfirm: () => void
  }>({ title: '', description: '', confirmText: 'OK', onConfirm: () => {} })
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
      confirmText: 'Usuń',
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

  const handleSetPublicBookingEnabledSelected = async (enabled: boolean) => {
    if (selectedIds.size === 0) return

    const count = selectedIds.size
    setConfirmDialogContent({
      title: enabled ? 'Włączanie dostępności' : 'Wyłączanie dostępności',
      description: enabled
        ? `Czy na pewno chcesz włączyć publiczne rezerwacje dla ${count} ${count === 1 ? 'tutora' : 'tutorów'}?`
        : `Czy na pewno chcesz wyłączyć publiczne rezerwacje dla ${count} ${count === 1 ? 'tutora' : 'tutorów'}?`,
      confirmText: enabled ? 'Włącz' : 'Wyłącz',
      onConfirm: async () => {
        try {
          await setTutorsPublicBookingEnabled({
            tutorIds: Array.from(selectedIds),
            enabled,
          })
          setSelectedIds(new Set())
          setConfirmDialogOpen(false)
          router.refresh()
        } catch (error) {
          console.error('Błąd podczas aktualizacji dostępności tutorów:', error)
          const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd'
          alert(`Wystąpił błąd podczas aktualizacji dostępności tutorów: ${errorMessage}`)
        }
      },
    })
    setConfirmDialogOpen(true)
  }

  const filteredTutorIds = useMemo(
    () => new Set(filteredTutors.map((t) => t.id)),
    [filteredTutors]
  )

  const selectedTutors = useMemo(
    () => tutors.filter((t) => selectedIds.has(t.id)),
    [tutors, selectedIds]
  )

  const allFilteredSelected =
    filteredTutors.length > 0 &&
    filteredTutors.every((t) => selectedIds.has(t.id))
  const someFilteredSelected = filteredTutors.some((t) => selectedIds.has(t.id))

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const newSelected = new Set(selectedIds)
      filteredTutors.forEach((t) => newSelected.delete(t.id))
      setSelectedIds(newSelected)
    } else {
      const newSelected = new Set(selectedIds)
      filteredTutors.forEach((t) => newSelected.add(t.id))
      setSelectedIds(newSelected)
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

  return (
    <div className="space-y-4">
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
            variant="outline"
            size="sm"
            onClick={() => handleSetPublicBookingEnabledSelected(false)}
            disabled={selectedIds.size === 0}
            className="border-red-600/60 text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            <IconX className="mr-2 h-4 w-4" />
            Wyłącz dostępność {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSetPublicBookingEnabledSelected(true)}
            disabled={selectedIds.size === 0}
            className="border-emerald-600/60 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            <IconCheck className="mr-2 h-4 w-4" />
            Włącz dostępność {selectedIds.size > 0 && `(${selectedIds.size})`}
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

      <TableSelectionBar
        items={selectedTutors.map((t) => ({ id: t.id, label: t.full_name }))}
        visibleIds={filteredTutorIds}
        onRemove={(id) => {
          const newSelected = new Set(selectedIds)
          newSelected.delete(id)
          setSelectedIds(newSelected)
        }}
        onClearAll={() => setSelectedIds(new Set())}
      />

      {/* Tabela */}
      <div className="rounded-md border" data-tour="tutors-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    allFilteredSelected
                      ? true
                      : someFilteredSelected
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Dostępność</TableHead>
              <TableHead className="text-right">Stawka (zł/h)</TableHead>
              <TableHead className="text-right">Liczba uczniów</TableHead>
              <TableHead className="text-right">Lekcje/tydz.</TableHead>
              <TableHead className="text-right">Suma godzin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTutors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
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
                  <TableCell>
                    {tutor.public_booking_enabled === false ? (
                      <span className="inline-flex items-center gap-2" aria-label="Dostępność wyłączona">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                        <span className="sr-only">Wyłączona</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2" aria-label="Dostępność włączona">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                        <span className="sr-only">Włączona</span>
                      </span>
                    )}
                  </TableCell>
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
        confirmText={confirmDialogContent.confirmText}
        cancelText="Anuluj"
      />

      <GroupMessageDialog
        open={groupMessageDialogOpen}
        onOpenChange={setGroupMessageDialogOpen}
        selectedTutors={selectedTutors}
      />
    </div>
  )
}

