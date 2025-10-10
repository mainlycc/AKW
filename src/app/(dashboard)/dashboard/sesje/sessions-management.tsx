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
import { Input } from "@/components/ui/input"
import { SessionDialog } from "./session-dialog"
import { deleteSession } from "./actions"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface Session {
  id: string
  session_date: string
  duration_minutes: number
  notes: string | null
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)

  const filteredSessions = sessions.filter((session) => {
    const searchLower = search.toLowerCase()
    return (
      session.students.first_name.toLowerCase().includes(searchLower) ||
      session.students.last_name.toLowerCase().includes(searchLower) ||
      session.profiles.full_name.toLowerCase().includes(searchLower) ||
      session.student_assignments.subjects.name.toLowerCase().includes(searchLower)
    )
  })

  const handleDelete = async (id: string) => {
    setSessionToDelete(id)
    setConfirmDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (sessionToDelete) {
      await deleteSession(sessionToDelete)
      setSessionToDelete(null)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: pl })
    } catch {
      return dateString
    }
  }

  const totalHours = filteredSessions.reduce((acc, s) => acc + s.duration_minutes, 0) / 60

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Szukaj sesji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Suma godzin: <span className="font-bold">{totalHours.toFixed(2)}h</span>
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
              <TableHead>Data i godzina</TableHead>
              <TableHead>Uczeń</TableHead>
              {isAdmin && <TableHead>Tutor</TableHead>}
              <TableHead>Przedmiot</TableHead>
              <TableHead>Poziom</TableHead>
              <TableHead>Czas trwania</TableHead>
              <TableHead>Notatki</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="text-center text-muted-foreground">
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
                  {isAdmin && <TableCell>{session.profiles.full_name}</TableCell>}
                  <TableCell>{session.student_assignments.subjects.name}</TableCell>
                  <TableCell>{session.student_assignments.subject_levels.level_name}</TableCell>
                  <TableCell>{session.duration_minutes} min</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {session.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(session.id)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </TableCell>
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
        title="Usuwanie sesji"
        description="Czy na pewno chcesz usunąć tę sesję?"
        onConfirm={confirmDelete}
        confirmText="Usuń"
        cancelText="Anuluj"
      />
    </div>
  )
}

