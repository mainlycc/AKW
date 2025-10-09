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
import { Student } from "@/lib/types/database.types"
import { StudentDialog } from "./student-dialog"
import { deleteStudent } from "./actions"
import { IconEdit, IconTrash, IconPlus } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"

interface StudentsTableProps {
  students: Student[]
  isAdmin: boolean
}

export function StudentsTable({ students, isAdmin }: StudentsTableProps) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  const filteredStudents = students.filter(
    (student) =>
      student.first_name.toLowerCase().includes(search.toLowerCase()) ||
      student.last_name.toLowerCase().includes(search.toLowerCase()) ||
      student.parent_email.toLowerCase().includes(search.toLowerCase())
  )

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingStudent(null)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć tego ucznia?')) {
      await deleteStudent(id)
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingStudent(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Szukaj ucznia..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {isAdmin && (
          <Button onClick={handleAdd}>
            <IconPlus className="mr-2 h-4 w-4" />
            Dodaj ucznia
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imię</TableHead>
              <TableHead>Nazwisko</TableHead>
              <TableHead>Email rodzica</TableHead>
              <TableHead>Telefon rodzica</TableHead>
              <TableHead>Notatki</TableHead>
              {isAdmin && <TableHead className="text-right">Akcje</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground">
                  Brak uczniów do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.first_name}</TableCell>
                  <TableCell>{student.last_name}</TableCell>
                  <TableCell>{student.parent_email}</TableCell>
                  <TableCell>{student.parent_phone || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {student.notes || '-'}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(student)}
                        >
                          <IconEdit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(student.id)}
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {isAdmin && (
        <StudentDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          student={editingStudent}
        />
      )}
    </div>
  )
}

