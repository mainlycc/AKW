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
import { Badge } from "@/components/ui/badge"
import { Student } from "@/lib/types/database.types"
import { StudentDialog } from "./student-dialog"
import { deleteStudent } from "./actions"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface StudentParent {
  id: string
  is_primary: boolean
  parents: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
    parent_type: string
  }
}

interface StudentNote {
  id: string
  content: string
  created_at: string
  profiles: {
    id: string
    full_name: string
  }
}

interface StudentSubject {
  subject_level_id: string
  subjects: { name: string } | null
  subject_levels: { level_name: string } | null
}

interface StudentExtended extends Student {
  student_parents?: StudentParent[]
  student_notes?: StudentNote[]
  student_subjects?: StudentSubject[]
}

interface StudentsTableProps {
  students: StudentExtended[]
  isAdmin: boolean
  isTutor: boolean
  allParents?: { id: string; first_name: string; last_name: string; email: string; phone: string | null; parent_type: string }[]
  allSubjects?: { id: string; name: string; subject_levels: { id: string; level_name: string; level_order: number; price_per_hour: number }[] }[]
  tutorId?: string
  tutorSubjectLevels?: { subject_level_id: string; subjects: { id: string; name: string } | null; subject_levels: { id: string; level_name: string } | null }[]
  currentUserId?: string
}

export function StudentsTable({
  students,
  isTutor,
  allParents = [],
  allSubjects = [],
  tutorId,
  tutorSubjectLevels = [],
  currentUserId,
}: StudentsTableProps) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<StudentExtended | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })

  const filteredStudents = students.filter(
    (student) =>
      student.first_name.toLowerCase().includes(search.toLowerCase()) ||
      student.last_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleRowClick = (student: StudentExtended) => {
    setEditingStudent(student)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingStudent(null)
    setDialogOpen(true)
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    
    const count = selectedIds.size
    setConfirmDialogContent({
      title: 'Usuwanie uczniów',
      description: `Czy na pewno chcesz usunąć ${count} ${count === 1 ? 'ucznia' : 'uczniów'}?`,
      onConfirm: async () => {
        for (const id of selectedIds) {
          await deleteStudent(id)
        }
        setSelectedIds(new Set())
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingStudent(null)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)))
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Szukaj ucznia..."
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
        <Button onClick={handleAdd}>
          <IconPlus className="mr-2 h-4 w-4" />
          Dodaj ucznia
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Imię</TableHead>
              <TableHead>Nazwisko</TableHead>
              <TableHead>Rodzice</TableHead>
              <TableHead>Przedmioty</TableHead>
              <TableHead>Ostatnia notatka</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Brak uczniów do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => {
                const parents = student.student_parents || []
                const subjects = student.student_subjects || []
                const notes = student.student_notes || []
                const lastNote = notes.length > 0 ? notes[0] : null

                return (
                  <TableRow 
                    key={student.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(student)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(student.id)}
                        onCheckedChange={() => toggleSelectOne(student.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{student.first_name}</TableCell>
                    <TableCell>{student.last_name}</TableCell>
                    <TableCell>
                      {parents.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {parents.map(sp => (
                            <Badge key={sp.id} variant="outline" className="text-xs">
                              {sp.parents.first_name} {sp.parents.last_name}
                            </Badge>
                          ))}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {subjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {subjects.map((ss, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {ss.subjects?.name}
                            </Badge>
                          ))}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {lastNote ? lastNote.content : '-'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <StudentDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        student={editingStudent}
        studentParents={editingStudent?.student_parents}
        studentNotes={editingStudent?.student_notes}
        studentSubjects={editingStudent?.student_subjects?.map(ss => ss.subject_level_id)}
        allParents={allParents}
        allSubjects={allSubjects}
        isTutor={isTutor}
        tutorId={tutorId}
        tutorSubjectLevels={tutorSubjectLevels}
        currentUserId={currentUserId}
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

