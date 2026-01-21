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
import { SessionDialog } from "./session-dialog"
import { deleteSession, confirmSession } from "./actions"
import { IconPlus, IconTrash, IconCheck } from "@tabler/icons-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { SessionStatus } from "@/lib/types/database.types"
import { formatHours } from "@/lib/utils"
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

interface Assignment {
  id: string
  students: { id: string; first_name: string; last_name: string }
  profiles: { id: string; full_name: string }
  subjects: { id: string; name: string }
  subject_levels: { id: string; level_name: string }
}

interface SessionsManagementProps {
  sessions: Session[]
  assignments: Assignment[]
  userId: string
  isAdmin: boolean
}

export function SessionsManagement({
  sessions,
  assignments,
  userId,
  isAdmin,
}: SessionsManagementProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })
  const [confirmingSessionId, setConfirmingSessionId] = useState<string | null>(null)

  const filteredSessions = sessions.filter((session) => {
    const searchLower = search.toLowerCase()
    return (
      session.students?.first_name?.toLowerCase().includes(searchLower) ||
      session.students?.last_name?.toLowerCase().includes(searchLower) ||
      session.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      session.student_assignments?.subjects?.name?.toLowerCase().includes(searchLower)
    )
  })

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    
    const count = selectedIds.size
    setConfirmDialogContent({
      title: 'Usuwanie sesji',
      description: `Czy na pewno chcesz usunąć ${count} ${count === 1 ? 'sesję' : 'sesji'}?`,
      onConfirm: async () => {
        for (const id of selectedIds) {
          await deleteSession(id)
        }
        setSelectedIds(new Set())
      }
    })
    setConfirmDialogOpen(true)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSessions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSessions.map(s => s.id)))
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

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: pl })
    } catch {
      return dateString
    }
  }

  const totalHours = filteredSessions.reduce((acc, s) => acc + s.duration_minutes, 0) / 60

  const getStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500">Odbyta</Badge>
      case 'scheduled':
        return <Badge variant="outline" className="bg-blue-500/20 text-blue-700 border-blue-500">Zaplanowana</Badge>
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-500/20 text-red-700 border-red-500">Anulowana</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleConfirmSession = async (sessionId: string) => {
    setConfirmingSessionId(sessionId)
    try {
      await confirmSession(sessionId)
      toast.success('Lekcja została potwierdzona')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Błąd podczas potwierdzania lekcji')
    } finally {
      setConfirmingSessionId(null)
    }
  }

  const canConfirmSession = (session: Session) => {
    if (isAdmin) return false // Admin nie potwierdza lekcji
    const sessionDate = new Date(session.session_date)
    const now = new Date()
    return session.status === 'scheduled' && sessionDate < now
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Szukaj sesji..."
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
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Suma godzin: <span className="font-bold">{formatHours(totalHours)}h</span>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <IconPlus className="mr-2 h-4 w-4" />
            Dodaj sesję
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === filteredSessions.length && filteredSessions.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Data i godzina</TableHead>
              <TableHead>Uczeń</TableHead>
              {isAdmin && <TableHead>Tutor</TableHead>}
              <TableHead>Przedmiot</TableHead>
              <TableHead>Poziom</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notatki</TableHead>
              {!isAdmin && <TableHead>Akcje</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 8} className="text-center text-muted-foreground">
                  Brak sesji do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredSessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(session.id)}
                      onCheckedChange={() => toggleSelectOne(session.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatDate(session.session_date)}
                  </TableCell>
                  <TableCell>
                    {session.students ? (
                      <StudentNameLink
                        student={session.students}
                        className="font-medium"
                      />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  {isAdmin && <TableCell>{session.profiles?.full_name || '-'}</TableCell>}
                  <TableCell>{session.student_assignments?.subjects?.name || '-'}</TableCell>
                  <TableCell>{session.student_assignments?.subject_levels?.level_name || '-'}</TableCell>
                  <TableCell>
                    {getStatusBadge(session.status)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {session.notes || '-'}
                  </TableCell>
                  {!isAdmin && (
                    <TableCell>
                      {canConfirmSession(session) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfirmSession(session.id)}
                          disabled={confirmingSessionId === session.id}
                        >
                          <IconCheck className="mr-2 h-4 w-4" />
                          {confirmingSessionId === session.id ? 'Potwierdzanie...' : 'Potwierdź'}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <SessionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        assignments={assignments}
        userId={userId}
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

