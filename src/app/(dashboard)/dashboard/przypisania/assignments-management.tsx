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
import { Badge } from "@/components/ui/badge"
import { SubjectBadge } from "@/components/subject-badge"
import { AssignmentDialog } from "./assignment-dialog"
import { updateAssignmentStatus } from "./actions"
import { IconPlus } from "@tabler/icons-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Assignment {
  id: string
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  students: { id: string; first_name: string; last_name: string }
  profiles: { id: string; full_name: string }
  subjects: { id: string; name: string; color?: string | null }
  subject_levels: { id: string; level_name: string; price_per_hour: number }
}

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface Tutor {
  id: string
  full_name: string
}

interface Subject {
  id: string
  name: string
  subject_levels: {
    id: string
    level_name: string
    level_order: number
    price_per_hour: number
  }[]
}

interface AssignmentsManagementProps {
  assignments: Assignment[]
  students: Student[]
  tutors: Tutor[]
  subjects: Subject[]
  adminId: string
}

export function AssignmentsManagement({
  assignments,
  students,
  tutors,
  subjects,
  adminId,
}: AssignmentsManagementProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredAssignments = assignments.filter((assignment) => {
    if (statusFilter === 'all') return true
    return assignment.status === statusFilter
  })

  const handleStatusChange = async (id: string, status: 'active' | 'completed' | 'cancelled') => {
    await updateAssignmentStatus(id, status)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    }
    const labels = {
      active: 'Aktywne',
      completed: 'Zakończone',
      cancelled: 'Anulowane',
    }
    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtruj po statusie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            <SelectItem value="active">Aktywne</SelectItem>
            <SelectItem value="completed">Zakończone</SelectItem>
            <SelectItem value="cancelled">Anulowane</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setDialogOpen(true)}>
          <IconPlus className="mr-2 h-4 w-4" />
          Nowe przypisanie
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Uczeń</TableHead>
              <TableHead>Tutor</TableHead>
              <TableHead>Przedmiot</TableHead>
              <TableHead>Poziom</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Brak przypisań do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredAssignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">
                    {assignment.students.first_name} {assignment.students.last_name}
                  </TableCell>
                  <TableCell>{assignment.profiles.full_name}</TableCell>
                  <TableCell>
                    <SubjectBadge subject={assignment.subjects} className="text-xs" />
                  </TableCell>
                  <TableCell>{assignment.subject_levels.level_name}</TableCell>
                  <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                  <TableCell className="text-right">
                    {assignment.status === 'active' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(assignment.id, 'completed')}
                        >
                          Zakończ
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(assignment.id, 'cancelled')}
                        >
                          Anuluj
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AssignmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        students={students}
        tutors={tutors}
        subjects={subjects}
        adminId={adminId}
      />
    </div>
  )
}

