'use client'

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Student } from "@/lib/types/database.types"
import { createStudent, updateStudent, deleteStudent, createStudentWithAssignment, updateStudentSubjects } from "./actions"
import { createStudentNote } from "@/lib/actions/student-notes"
import { linkParentToStudent, unlinkParentFromStudent, createParent } from "@/lib/actions/parents"
import { IconTrash, IconPlus } from "@tabler/icons-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { ConfirmDialog } from "@/components/confirm-dialog"

interface Parent {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  parent_type: string
}

interface StudentParent {
  id: string
  is_primary: boolean
  parents: Parent
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

interface SubjectWithLevels {
  id: string
  name: string
  subject_levels: {
    id: string
    level_name: string
    level_order: number
    price_per_hour: number
  }[]
}

interface TutorSubjectLevel {
  subject_level_id: string
  subjects: { id: string; name: string } | null
  subject_levels: { id: string; level_name: string } | null
}

interface StudentDialogProps {
  open: boolean
  onClose: () => void
  student: Student | null
  studentParents?: StudentParent[]
  studentNotes?: StudentNote[]
  studentSubjects?: string[]
  allParents?: Parent[]
  allSubjects?: SubjectWithLevels[]
  isTutor?: boolean
  tutorId?: string
  tutorSubjectLevels?: TutorSubjectLevel[]
  currentUserId?: string
}

export function StudentDialog({
  open,
  onClose,
  student,
  studentParents = [],
  studentNotes = [],
  studentSubjects = [],
  allParents = [],
  allSubjects = [],
  isTutor = false,
  tutorId,
  tutorSubjectLevels = [],
  currentUserId,
}: StudentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    hourly_rate: 50,
  })
  const [parentData, setParentData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  })
  const [selectedSubjectLevels, setSelectedSubjectLevels] = useState<Set<string>>(new Set())
  const [selectedParentId, setSelectedParentId] = useState<string>('')
  const [newNote, setNewNote] = useState('')
  const [tutorSelectedLevel, setTutorSelectedLevel] = useState('')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })

  useEffect(() => {
    if (open) {
      if (student) {
        setFormData({
          first_name: student.first_name,
          last_name: student.last_name,
          hourly_rate: student.hourly_rate ?? 50,
        })
        setSelectedSubjectLevels(new Set(studentSubjects))
      } else {
        setFormData({
          first_name: '',
          last_name: '',
          hourly_rate: 50,
        })
        setParentData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
        })
        setSelectedSubjectLevels(new Set())
        setTutorSelectedLevel('')
      }
      setNewNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let newStudentId: string | undefined

      if (isTutor && !student) {
        // Tutor creating new student
        if (!tutorSelectedLevel) {
          alert('Wybierz przedmiot i poziom')
          setLoading(false)
          return
        }
        const result = await createStudentWithAssignment(
          {
            first_name: formData.first_name,
            last_name: formData.last_name,
            hourly_rate: formData.hourly_rate,
            subject_level_id: tutorSelectedLevel,
            parent: parentData.email || parentData.first_name || parentData.last_name ? {
              first_name: parentData.first_name,
              last_name: parentData.last_name,
              email: parentData.email,
              phone: parentData.phone || '',
            } : undefined,
          },
          tutorId!
        )
        newStudentId = result.id
      } else if (student) {
        // Updating existing student
        await updateStudent(student.id, formData)
        
        // Update subjects (only for admin)
        if (!isTutor) {
          await updateStudentSubjects(student.id, Array.from(selectedSubjectLevels))
        }
      } else {
        // Admin creating new student
        const result = await createStudent(
          formData,
          parentData.email || parentData.first_name || parentData.last_name ? {
            first_name: parentData.first_name,
            last_name: parentData.last_name,
            email: parentData.email,
            phone: parentData.phone || '',
          } : undefined
        )
        newStudentId = result.id
        
        // Update subjects (only for admin)
        if (selectedSubjectLevels.size > 0) {
          await updateStudentSubjects(result.id, Array.from(selectedSubjectLevels))
        }
      }

      // Create parent if data provided (for both new and existing students)
      const studentId = student?.id || newStudentId
      if (studentId && (parentData.email || parentData.first_name || parentData.last_name)) {
        if (!parentData.email) {
          alert('Email rodzica jest wymagany')
          setLoading(false)
          return
        }
        
        try {
          const parent = await createParent({
            first_name: parentData.first_name || 'Rodzic',
            last_name: parentData.last_name || formData.last_name,
            email: parentData.email,
            phone: parentData.phone || '',
            parent_type: 'other',
          })
          
          await linkParentToStudent(parent.id, studentId, !student) // isPrimary = true dla nowego ucznia
        } catch (error) {
          console.error('Error creating parent:', error)
          alert('Błąd podczas tworzenia rodzica. Uczeń został zapisany.')
        }
      }

      onClose()
    } catch (error) {
      console.error('Error saving student:', error)
      alert('Błąd podczas zapisywania ucznia')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!student) return
    
    setConfirmDialogContent({
      title: 'Usuwanie ucznia',
      description: `Czy na pewno chcesz usunąć ucznia ${formData.first_name} ${formData.last_name}?`,
      onConfirm: async () => {
        setDeleting(true)
        try {
          await deleteStudent(student.id)
          onClose()
        } catch (error) {
          console.error('Error deleting student:', error)
          alert('Błąd podczas usuwania ucznia')
        } finally {
          setDeleting(false)
        }
      }
    })
    setConfirmDialogOpen(true)
  }

  const toggleSubjectLevel = (levelId: string) => {
    const newSelected = new Set(selectedSubjectLevels)
    if (newSelected.has(levelId)) {
      newSelected.delete(levelId)
    } else {
      newSelected.add(levelId)
    }
    setSelectedSubjectLevels(newSelected)
  }

  const handleAddParent = async () => {
    if (!student || !selectedParentId) return
    
    try {
      await linkParentToStudent(selectedParentId, student.id)
      setSelectedParentId('')
    } catch (error) {
      console.error('Error linking parent:', error)
      alert('Błąd podczas przypisywania rodzica')
    }
  }

  const handleRemoveParent = async (parentId: string) => {
    if (!student) return
    
    setConfirmDialogContent({
      title: 'Usuwanie przypisania rodzica',
      description: 'Czy na pewno chcesz usunąć to przypisanie rodzica?',
      onConfirm: async () => {
        try {
          await unlinkParentFromStudent(parentId, student.id)
        } catch (error) {
          console.error('Error unlinking parent:', error)
          alert('Błąd podczas usuwania przypisania rodzica')
        }
      }
    })
    setConfirmDialogOpen(true)
  }

  const handleAddNote = async () => {
    if (!student || !newNote.trim() || !currentUserId) return
    
    try {
      await createStudentNote(student.id, newNote, currentUserId)
      setNewNote('')
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Błąd podczas dodawania notatki')
    }
  }

  const availableParents = allParents.filter(
    p => !studentParents.some(sp => sp.parents.id === p.id)
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {student ? 'Edytuj ucznia' : isTutor ? 'Dodaj nowego ucznia' : 'Dodaj nowego ucznia'}
          </DialogTitle>
          <DialogDescription>
            {student ? 'Zaktualizuj dane ucznia' : 'Wprowadź dane nowego ucznia'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Podstawowe dane */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Dane podstawowe</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Imię</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                  disabled={loading || deleting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nazwisko</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                  disabled={loading || deleting}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Stawka godzinowa (PLN)</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 50 })}
                  required
                  disabled={loading || deleting}
                />
              </div>
            </div>
          </div>

          {/* Rodzice */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm">Rodzice</h3>
            
            {/* Lista przypisanych rodziców - tylko dla istniejącego ucznia */}
            {student && studentParents.length > 0 && (
              <div className="space-y-2">
                {studentParents.map((sp) => (
                  <div key={sp.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">
                        {sp.parents.first_name} {sp.parents.last_name}
                        {sp.is_primary && <Badge variant="secondary" className="ml-2">Główny</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">{sp.parents.email}</p>
                    </div>
                    {!isTutor && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveParent(sp.parents.id)}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Dodaj nowego rodzica */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">
                {student ? 'Dodaj nowego rodzica' : 'Dane rodzica (opcjonalnie)'}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parent_first_name">Imię rodzica</Label>
                  <Input
                    id="parent_first_name"
                    type="text"
                    value={parentData.first_name}
                    onChange={(e) => setParentData({ ...parentData, first_name: e.target.value })}
                    disabled={loading || deleting}
                    placeholder="Imię"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_last_name">Nazwisko rodzica</Label>
                  <Input
                    id="parent_last_name"
                    type="text"
                    value={parentData.last_name}
                    onChange={(e) => setParentData({ ...parentData, last_name: e.target.value })}
                    disabled={loading || deleting}
                    placeholder="Nazwisko"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parent_email">Email rodzica</Label>
                  <Input
                    id="parent_email"
                    type="email"
                    value={parentData.email}
                    onChange={(e) => setParentData({ ...parentData, email: e.target.value })}
                    disabled={loading || deleting}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_phone">Telefon rodzica</Label>
                  <Input
                    id="parent_phone"
                    type="tel"
                    value={parentData.phone}
                    onChange={(e) => setParentData({ ...parentData, phone: e.target.value })}
                    disabled={loading || deleting}
                    placeholder="+48 123 456 789"
                  />
                </div>
              </div>
            </div>

            {/* Wybierz istniejącego rodzica - tylko dla istniejącego ucznia i admina */}
            {student && !isTutor && availableParents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Lub wybierz istniejącego rodzica</h4>
                <div className="flex gap-2">
                  <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz rodzica" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableParents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.first_name} {parent.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={handleAddParent} disabled={!selectedParentId}>
                    <IconPlus className="mr-2 h-4 w-4" />
                    Dodaj
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Przedmioty i poziomy */}
          {isTutor && !student ? (
            // Tutor adding new student - select one level
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm">Przedmiot i poziom</h3>
              <Select value={tutorSelectedLevel} onValueChange={setTutorSelectedLevel} required>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz przedmiot i poziom" />
                </SelectTrigger>
                <SelectContent>
                  {tutorSubjectLevels.map((tsl) => (
                    <SelectItem key={tsl.subject_level_id} value={tsl.subject_level_id}>
                      {tsl.subjects?.name} - {tsl.subject_levels?.level_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : !isTutor ? (
            // Admin - checkboxes (both adding and editing)
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm">Przedmioty i poziomy</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {allSubjects.map((subject) => (
                  <div key={subject.id} className="space-y-2">
                    <p className="font-medium text-sm">{subject.name}</p>
                    <div className="grid gap-2 pl-4">
                      {subject.subject_levels
                        .sort((a, b) => a.level_order - b.level_order)
                        .map((level) => (
                          <div key={level.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={level.id}
                              checked={selectedSubjectLevels.has(level.id)}
                              onCheckedChange={() => toggleSubjectLevel(level.id)}
                              disabled={loading || deleting}
                            />
                            <label
                              htmlFor={level.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {level.level_name}
                            </label>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Notatki - tylko dla istniejącego ucznia */}
          {student && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm">Notatki</h3>
              
              {studentNotes.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {studentNotes.map((note) => (
                    <div key={note.id} className="p-3 border rounded bg-muted/30">
                      <p className="text-sm">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(note.created_at), 'dd.MM.yyyy HH:mm', { locale: pl })} - {note.profiles.full_name}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Brak notatek</p>
              )}

              <div className="space-y-2">
                <Label htmlFor="new_note">Dodaj notatkę</Label>
                <Textarea
                  id="new_note"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Wpisz notatkę..."
                  rows={3}
                />
                <Button type="button" size="sm" onClick={handleAddNote} disabled={!newNote.trim()}>
                  <IconPlus className="h-4 w-4 mr-2" />
                  Dodaj notatkę
                </Button>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-between gap-2 border-t pt-4">
            {student && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDelete} 
                disabled={loading || deleting}
              >
                {deleting ? 'Usuwanie...' : 'Usuń'}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading || deleting}>
                Anuluj
              </Button>
              <Button type="submit" disabled={loading || deleting}>
                {loading ? 'Zapisywanie...' : student ? 'Zapisz zmiany' : 'Dodaj ucznia'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title={confirmDialogContent.title}
        description={confirmDialogContent.description}
        onConfirm={confirmDialogContent.onConfirm}
        confirmText="Usuń"
        cancelText="Anuluj"
      />
    </Dialog>
  )
}
