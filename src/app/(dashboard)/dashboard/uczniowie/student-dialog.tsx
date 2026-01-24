'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { SubjectBadge } from "@/components/subject-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Student } from "@/lib/types/database.types"
import { createStudent, updateStudent, deleteStudent, createStudentWithAssignment, updateStudentSubjects } from "./actions"
import { createStudentNote } from "@/lib/actions/student-notes"
import { linkParentToStudentAction, unlinkParentFromStudentAction } from "./actions"
import { IconTrash, IconPlus, IconChevronDown } from "@tabler/icons-react"
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

interface StudentAssignment {
  id: string
  tutor_id: string
  status: string
  profiles?: {
    id: string
    full_name: string
    email?: string
  } | null
}

interface AdminSelectedSubjectLevel {
  id: string
  subjectId: string
  levelId: string
}

interface StudentDialogProps {
  open: boolean
  onClose: () => void
  student: Student | null
  studentParents?: StudentParent[]
  studentNotes?: StudentNote[]
  studentSubjects?: string[]
  studentAssignments?: StudentAssignment[]
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
  studentAssignments = [],
  allParents = [],
  allSubjects = [],
  isTutor = false,
  tutorId,
  tutorSubjectLevels = [],
  currentUserId,
}: StudentDialogProps) {
  const router = useRouter()
  const [isEditMode, setIsEditMode] = useState<boolean>(!student)
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
  const [tutorSelectedSubjectId, setTutorSelectedSubjectId] = useState('')
  const [tutorSelectedLevelId, setTutorSelectedLevelId] = useState('')
  const [adminSelections, setAdminSelections] = useState<AdminSelectedSubjectLevel[]>([])
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })
  const [addParentOpen, setAddParentOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  const getLevelsForSubject = (subjectId: string) => {
    const subject = allSubjects.find(s => s.id === subjectId)
    if (!subject) return []
    return subject.subject_levels.sort((a, b) => a.level_order - b.level_order)
  }

  // Przy każdym otwarciu dialogu ustaw tryb:
  // - istniejący uczeń -> podgląd
  // - nowy uczeń       -> edycja
  useEffect(() => {
    if (open) {
      setIsEditMode(!student)
      setAddParentOpen(false)
      setNotesOpen(false)
    }
  }, [open, student?.id])

  useEffect(() => {
    if (open) {
      if (student) {
        // Editing existing student - reset parent data (parents are added via handleAddParent)
        setFormData({
          first_name: student.first_name,
          last_name: student.last_name,
          hourly_rate: student.hourly_rate ?? 50,
        })
        setParentData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
        })
        setSelectedSubjectLevels(new Set(studentSubjects))

        // Inicjalizacja wyboru przedmiotów dla admina na podstawie istniejących przedmiotów ucznia
        if (!isTutor) {
          const initialSelections: AdminSelectedSubjectLevel[] = []
          studentSubjects.forEach((levelId, index) => {
            const subject = allSubjects.find(s =>
              s.subject_levels.some(level => level.id === levelId)
            )
            if (subject) {
              initialSelections.push({
                id: `existing-${index}`,
                subjectId: subject.id,
                levelId,
              })
            }
          })
          setAdminSelections(initialSelections)
        }
      } else {
        // Creating new student - allow parent data in form
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
        if (!isTutor && allSubjects.length > 0) {
          const firstSubject = allSubjects[0]
          const firstLevel = firstSubject.subject_levels[0]
          setAdminSelections(firstSubject && firstLevel ? [{
            id: `new-${Date.now()}`,
            subjectId: firstSubject.id,
            levelId: firstLevel.id,
          }] : [])
        } else {
          setAdminSelections([])
        }
        setTutorSelectedSubjectId('')
        setTutorSelectedLevelId('')
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
        if (!tutorSelectedSubjectId || !tutorSelectedLevelId) {
          alert('Wybierz przedmiot i poziom')
          setLoading(false)
          return
        }
        const result = await createStudentWithAssignment(
          {
            first_name: formData.first_name,
            last_name: formData.last_name,
            hourly_rate: formData.hourly_rate,
            subject_level_id: tutorSelectedLevelId,
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
          const adminLevelIds = adminSelections.length
            ? adminSelections
                .filter(sel => sel.subjectId && sel.levelId)
                .map(sel => sel.levelId)
            : Array.from(selectedSubjectLevels)

          if (adminLevelIds.length > 0) {
            await updateStudentSubjects(student.id, adminLevelIds)
          }
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
        if (!isTutor) {
          const adminLevelIds = adminSelections.length
            ? adminSelections
                .filter(sel => sel.subjectId && sel.levelId)
                .map(sel => sel.levelId)
            : Array.from(selectedSubjectLevels)

          if (adminLevelIds.length > 0) {
            await updateStudentSubjects(result.id, adminLevelIds)
          }
        }
      }

      // Parent creation and linking is now handled in server actions (createStudent and createStudentWithAssignment)
      // No need to duplicate the logic here

      onClose()
      router.refresh()
    } catch (error) {
      console.error('Error saving student:', error)
      const errorMessage = error instanceof Error ? error.message : 'Błąd podczas zapisywania ucznia'
      alert(errorMessage)
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
    
    // Validate inputs before calling
    if (!selectedParentId || typeof selectedParentId !== 'string') {
      alert('Nieprawidłowy ID rodzica')
      return
    }
    if (!student.id || typeof student.id !== 'string') {
      alert('Nieprawidłowy ID ucznia')
      return
    }
    
    try {
      console.log('Linking parent to student:', {
        parentId: selectedParentId,
        studentId: student.id,
      })
      
      let result: { success: boolean; message?: string }
      try {
        result = await linkParentToStudentAction(selectedParentId, student.id, false)
      } catch (actionError) {
        // Handle case where server action throws instead of returning
        console.error('Server action threw error:', actionError)
        const isEmptyObject = actionError && typeof actionError === 'object' && Object.keys(actionError).length === 0
        if (isEmptyObject || !actionError) {
          alert('Błąd serializacji odpowiedzi z serwera. Sprawdź konsolę serwera dla szczegółów.')
        } else {
          const errorMsg = actionError instanceof Error ? actionError.message : String(actionError)
          alert(`Błąd podczas przypisywania rodzica: ${errorMsg}`)
        }
        return
      }
      
      // Check if result is valid
      if (!result || typeof result !== 'object' || typeof result.success !== 'boolean') {
        console.error('Invalid result from linkParentToStudentAction:', result)
        alert('Błąd podczas przypisywania rodzica: Nieprawidłowa odpowiedź z serwera')
        return
      }
      
      if (result.success) {
        console.log('Parent linked successfully')
        setSelectedParentId('')
        // Refresh the page to show updated parent list
        router.refresh()
      } else {
        console.error('Error linking parent:', result.message)
        alert(`Błąd podczas przypisywania rodzica: ${result.message || 'Nieznany błąd'}`)
      }
    } catch (error) {
      // Handle serialization errors or other unexpected errors
      // Check if error is an empty object (common serialization issue)
      const isEmptyObject = error && typeof error === 'object' && Object.keys(error).length === 0
      
      console.error('Unexpected error linking parent:', {
        error,
        isEmptyObject,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorStringified: isEmptyObject ? '{}' : JSON.stringify(error, Object.getOwnPropertyNames(error)),
      })
      
      // Try to extract meaningful error message
      let errorMessage = 'Nieoczekiwany błąd podczas przypisywania rodzica'
      
      if (isEmptyObject) {
        // Empty object usually means serialization error - check server logs
        errorMessage = 'Błąd serializacji odpowiedzi z serwera. Sprawdź konsolę serwera dla szczegółów.'
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        // Try to extract message from error object
        const errorObj = error as Record<string, unknown>
        if (errorObj.message && typeof errorObj.message === 'string') {
          errorMessage = errorObj.message
        } else if (errorObj.error && typeof errorObj.error === 'string') {
          errorMessage = errorObj.error
        } else if (Object.keys(errorObj).length > 0) {
          // Only stringify if object has properties
          try {
            errorMessage = JSON.stringify(errorObj)
          } catch {
            errorMessage = 'Nieznany błąd podczas przypisywania rodzica'
          }
        }
      }
      
      alert(`Błąd podczas przypisywania rodzica: ${errorMessage}`)
    }
  }

  const handleRemoveParent = async (parentId: string) => {
    if (!student) return
    
    setConfirmDialogContent({
      title: 'Usuwanie przypisania rodzica',
      description: 'Czy na pewno chcesz usunąć to przypisanie rodzica?',
      onConfirm: async () => {
        try {
          await unlinkParentFromStudentAction(parentId, student.id)
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
      setNotesOpen(false) // Zamknij rozwijaną sekcję po dodaniu
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
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header tylko dla trybu edycji/tworzenia */}
        {(!student || isEditMode) && (
          <DialogHeader className="flex-shrink-0 pb-3">
            <DialogTitle className="text-lg">
              {student ? 'Edytuj ucznia' : 'Dodaj nowego ucznia'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {student ? 'Zaktualizuj dane ucznia' : 'Wprowadź dane nowego ucznia'}
            </DialogDescription>
          </DialogHeader>
        )}

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">

        {/* Tryb PODGLĄDU dla istniejącego ucznia */}
        {student && !isEditMode && (
          <div className="space-y-4">
            {/* Header profilu z avatarem i podstawowymi danymi */}
            <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl p-5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Profil ucznia</p>
              <div className="flex items-start gap-4">
                {/* Avatar z inicjałami */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg ring-4 ring-background">
                    <span className="text-2xl font-bold text-primary-foreground">
                      {formData.first_name.charAt(0)}{formData.last_name.charAt(0)}
                    </span>
                  </div>
                </div>

                {/* Dane podstawowe */}
                <div className="flex-1 min-w-0 pt-1">
                  <h2 className="text-xl font-bold text-foreground truncate">
                    {formData.first_name} {formData.last_name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary">
                      <span className="text-sm font-semibold">
                        {formData.hourly_rate != null ? `${formData.hourly_rate.toFixed(0)} zł/h` : '-'}
                      </span>
                    </div>
                    {studentSubjects.length > 0 && (
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-muted-foreground">
                        <span className="text-sm">{studentSubjects.length} przedmiot{studentSubjects.length === 1 ? '' : studentSubjects.length < 5 ? 'y' : 'ów'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Grid z sekcjami */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Przedmioty i poziomy */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <h3 className="font-semibold text-sm">Przedmioty</h3>
                {studentSubjects.length > 0 ? (
                  <div className="space-y-2">
                    {studentSubjects.map((levelId) => {
                      const subject = allSubjects.find(s =>
                        s.subject_levels.some(l => l.id === levelId)
                      )
                      const level = subject?.subject_levels.find(l => l.id === levelId)
                      if (!subject || !level) return null
                      return (
                        <div key={levelId} className="flex flex-col gap-1">
                          <SubjectBadge subject={subject} className="text-xs px-2 py-0.5 w-fit" />
                          <p className="text-xs text-muted-foreground pl-0.5">{level.level_name}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Brak przedmiotów</p>
                )}
              </div>

              {/* Rodzice */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Rodzice</h3>
                  {studentParents.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{studentParents.length}</Badge>
                  )}
                </div>
                {studentParents.length > 0 ? (
                  <div className="space-y-2">
                    {studentParents.map((sp) => (
                      <div key={sp.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {sp.parents.first_name.charAt(0)}{sp.parents.last_name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {sp.parents.first_name} {sp.parents.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{sp.parents.email}</p>
                        </div>
                        {sp.is_primary && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 flex-shrink-0">Główny</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Brak rodziców</p>
                )}
              </div>

              {/* Tutorzy - tylko dla admina */}
              {!isTutor && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Tutorzy</h3>
                    {studentAssignments.filter(a => a.status === 'active' && a.profiles).length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {studentAssignments.filter(a => a.status === 'active' && a.profiles).length}
                      </Badge>
                    )}
                  </div>
                  {studentAssignments.filter(a => a.status === 'active' && a.profiles).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {studentAssignments
                        .filter(a => a.status === 'active' && a.profiles)
                        .map((assignment) => (
                          <Badge key={assignment.id} variant="outline" className="text-xs px-2 py-0.5">
                            {assignment.profiles?.full_name}
                          </Badge>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Brak tutorów</p>
                  )}
                </div>
              )}

              {/* Notatki */}
              <div className={`rounded-lg border bg-card p-4 space-y-3 ${!isTutor ? '' : 'md:col-span-2'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Notatki</h3>
                  {studentNotes.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{studentNotes.length}</Badge>
                  )}
                </div>
                {studentNotes.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {studentNotes.map((note) => (
                      <div key={note.id} className="p-2.5 rounded-lg bg-muted/40 border-l-2 border-primary/30">
                        <p className="text-xs leading-relaxed">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                          <span className="font-medium">{note.profiles.full_name}</span>
                          <span>·</span>
                          <span>{format(new Date(note.created_at), 'dd.MM.yyyy HH:mm', { locale: pl })}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Brak notatek</p>
                )}
              </div>
            </div>

            {/* Przyciski dla podglądu */}
            <div className="flex justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={loading || deleting}
                className="gap-1.5"
              >
                <IconTrash className="w-4 h-4" />
                {deleting ? 'Usuwanie...' : 'Usuń'}
              </Button>
              <div className="flex gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={loading || deleting}
                >
                  Zamknij
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                  disabled={loading || deleting}
                  className="gap-1.5"
                >
                  Edytuj
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tryb EDYCJI (istniejący uczeń lub tworzenie nowego) */}
        {(!student || isEditMode) && (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Podstawowe dane */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-primary">Dane podstawowe</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name" className="text-xs">Imię</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    disabled={loading || deleting}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name" className="text-xs">Nazwisko</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    disabled={loading || deleting}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hourly_rate" className="text-xs">Stawka/h (PLN)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 50 })}
                    required
                    disabled={loading || deleting}
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Rodzice */}
            <div className="space-y-2 border-t pt-3">
              <h3 className="font-semibold text-sm text-primary">Rodzice</h3>
              
              {/* Lista przypisanych rodziców - tylko dla istniejącego ucznia */}
              {student && studentParents.length > 0 && (
                <div className="space-y-1.5">
                  {studentParents.map((sp) => (
                    <div key={sp.id} className="flex items-start justify-between p-2 border rounded-md bg-muted/20">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {sp.parents.first_name} {sp.parents.last_name}
                          {sp.is_primary && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">Główny</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{sp.parents.email}</p>
                        {sp.parents.phone && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{sp.parents.phone}</p>
                        )}
                      </div>
                      {!isTutor && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => handleRemoveParent(sp.parents.id)}
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {student && studentParents.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Brak przypisanych rodziców</p>
              )}

              {/* Rozwijana sekcja dodawania rodzica */}
              {!student ? (
                // Dla nowego ucznia - zwykła sekcja (bez Collapsible)
                <div className="space-y-2 pt-1">
                  <h4 className="text-xs font-medium text-muted-foreground">Dane rodzica (opcjonalnie)</h4>
                  <div className="space-y-2 rounded-md border p-3 bg-muted/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="parent_first_name" className="text-xs">Imię</Label>
                        <Input
                          id="parent_first_name"
                          type="text"
                          value={parentData.first_name}
                          onChange={(e) => setParentData({ ...parentData, first_name: e.target.value })}
                          disabled={loading || deleting}
                          placeholder="Imię"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="parent_last_name" className="text-xs">Nazwisko</Label>
                        <Input
                          id="parent_last_name"
                          type="text"
                          value={parentData.last_name}
                          onChange={(e) => setParentData({ ...parentData, last_name: e.target.value })}
                          disabled={loading || deleting}
                          placeholder="Nazwisko"
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="parent_email" className="text-xs">Email</Label>
                        <Input
                          id="parent_email"
                          type="email"
                          value={parentData.email}
                          onChange={(e) => setParentData({ ...parentData, email: e.target.value })}
                          disabled={loading || deleting}
                          placeholder="email@example.com"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="parent_phone" className="text-xs">Telefon</Label>
                        <Input
                          id="parent_phone"
                          type="tel"
                          value={parentData.phone}
                          onChange={(e) => setParentData({ ...parentData, phone: e.target.value })}
                          disabled={loading || deleting}
                          placeholder="+48 123 456 789"
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Dla istniejącego ucznia - rozwijana sekcja
                <Collapsible open={addParentOpen} onOpenChange={setAddParentOpen} className="space-y-1.5">
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex w-full justify-between h-8"
                    >
                      <span className="flex items-center gap-1.5 text-xs">
                        <IconPlus className="h-3.5 w-3.5" />
                        Dodaj rodzica
                      </span>
                      <IconChevronDown 
                        className={`h-3.5 w-3.5 transition-transform ${addParentOpen ? 'rotate-180' : ''}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-1">
                    {/* Dodaj nowego rodzica przez formularz */}
                    <div className="space-y-2 rounded-md border p-3 bg-muted/10">
                      <h4 className="text-xs font-medium">Utwórz nowego rodzica</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="parent_first_name" className="text-xs">Imię</Label>
                          <Input
                            id="parent_first_name"
                            type="text"
                            value={parentData.first_name}
                            onChange={(e) => setParentData({ ...parentData, first_name: e.target.value })}
                            disabled={loading || deleting}
                            placeholder="Imię"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="parent_last_name" className="text-xs">Nazwisko</Label>
                          <Input
                            id="parent_last_name"
                            type="text"
                            value={parentData.last_name}
                            onChange={(e) => setParentData({ ...parentData, last_name: e.target.value })}
                            disabled={loading || deleting}
                            placeholder="Nazwisko"
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="parent_email" className="text-xs">Email</Label>
                          <Input
                            id="parent_email"
                            type="email"
                            value={parentData.email}
                            onChange={(e) => setParentData({ ...parentData, email: e.target.value })}
                            disabled={loading || deleting}
                            placeholder="email@example.com"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="parent_phone" className="text-xs">Telefon</Label>
                          <Input
                            id="parent_phone"
                            type="tel"
                            value={parentData.phone}
                            onChange={(e) => setParentData({ ...parentData, phone: e.target.value })}
                            disabled={loading || deleting}
                            placeholder="+48 123 456 789"
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Wybierz istniejącego rodzica - tylko dla admina */}
                    {!isTutor && availableParents.length > 0 && (
                      <div className="space-y-2 rounded-md border p-3 bg-muted/10">
                        <h4 className="text-xs font-medium">Lub przypisz istniejącego</h4>
                        <div className="flex gap-2">
                          <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Wybierz..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableParents.map((parent) => (
                                <SelectItem key={parent.id} value={parent.id}>
                                  {parent.first_name} {parent.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" size="sm" className="h-9" onClick={handleAddParent} disabled={!selectedParentId}>
                            <IconPlus className="mr-1 h-3.5 w-3.5" />
                            Przypisz
                          </Button>
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            {/* Przedmioty i poziomy */}
            {isTutor && !student ? (
              // Tutor - wybór przedmiotu i poziomu (jedna kombinacja)
              <div className="space-y-2 border-t pt-3">
                <h3 className="font-semibold text-sm text-primary">Przedmiot i poziom</h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Przedmiot</Label>
                    <Select
                      value={tutorSelectedSubjectId}
                      onValueChange={(value) => {
                        setTutorSelectedSubjectId(value)
                        const firstLevelForSubject = tutorSubjectLevels.find(
                          (tsl) => tsl.subjects?.id === value
                        )
                        setTutorSelectedLevelId(firstLevelForSubject?.subject_levels?.id || '')
                      }}
                      required
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Wybierz przedmiot" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          new Map(
                            tutorSubjectLevels
                              .filter((tsl) => tsl.subjects)
                              .map((tsl) => [tsl.subjects!.id, tsl.subjects!])
                          ).values()
                        ).map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Poziom</Label>
                    <Select
                      value={tutorSelectedLevelId}
                      onValueChange={setTutorSelectedLevelId}
                      disabled={!tutorSelectedSubjectId}
                      required
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Wybierz poziom" />
                      </SelectTrigger>
                      <SelectContent>
                        {tutorSubjectLevels
                          .filter((tsl) => tsl.subjects?.id === tutorSelectedSubjectId)
                          .map((tsl) => (
                            <SelectItem
                              key={tsl.subject_level_id}
                              value={tsl.subject_level_id}
                            >
                              {tsl.subject_levels?.level_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : !isTutor ? (
              // Admin - wybór przedmiotów i poziomów
              <div className="space-y-2 border-t pt-3">
                <h3 className="font-semibold text-sm text-primary">Przedmioty i poziomy</h3>

                {adminSelections.map((selection) => {
                  const levels = getLevelsForSubject(selection.subjectId)

                  return (
                    <div key={selection.id} className="flex flex-col gap-2 md:flex-row md:items-end">
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-xs">Przedmiot</Label>
                        <Select
                          value={selection.subjectId}
                          onValueChange={(value) => {
                            setAdminSelections((prev) =>
                              prev.map((sel) => {
                                if (sel.id === selection.id) {
                                  const subjectLevels = getLevelsForSubject(value)
                                  const firstLevelId = subjectLevels[0]?.id || ''
                                  return {
                                    ...sel,
                                    subjectId: value,
                                    levelId: firstLevelId,
                                  }
                                }
                                return sel
                              })
                            )
                          }}
                          disabled={loading || deleting}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Wybierz" />
                          </SelectTrigger>
                          <SelectContent>
                            {allSubjects.map((subject) => (
                              <SelectItem key={subject.id} value={subject.id}>
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <Label className="text-xs">Poziom</Label>
                        <Select
                          value={selection.levelId}
                          onValueChange={(value) => {
                            setAdminSelections((prev) =>
                              prev.map((sel) =>
                                sel.id === selection.id ? { ...sel, levelId: value } : sel
                              )
                            )
                          }}
                          disabled={loading || deleting || !selection.subjectId}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Wybierz" />
                          </SelectTrigger>
                          <SelectContent>
                            {levels.map((level) => (
                              <SelectItem key={level.id} value={level.id}>
                                {level.level_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() =>
                          setAdminSelections((prev) =>
                            prev.filter((sel) => sel.id !== selection.id)
                          )
                        }
                        disabled={loading || deleting}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}

                {allSubjects.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Brak dostępnych przedmiotów
                  </p>
                )}

                <div className="flex justify-start items-center pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      if (allSubjects.length === 0) return
                      const firstSubject = allSubjects[0]
                      const firstLevel = firstSubject.subject_levels[0]
                      setAdminSelections((prev) => [
                        ...prev,
                        {
                          id: `new-${Date.now()}`,
                          subjectId: firstSubject.id,
                          levelId: firstLevel?.id || '',
                        },
                      ])
                    }}
                    disabled={loading || deleting || allSubjects.length === 0}
                  >
                    <IconPlus className="h-3.5 w-3.5 mr-1.5" />
                    <span className="text-xs">Dodaj przedmiot</span>
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Notatki - tylko dla istniejącego ucznia */}
            {student && (
              <div className="space-y-2 border-t pt-3">
                <h3 className="font-semibold text-sm text-primary">Notatki</h3>
                
                {/* Istniejące notatki - zawsze widoczne */}
                {studentNotes.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {studentNotes.map((note) => (
                      <div key={note.id} className="p-2 border rounded-md bg-muted/20">
                        <p className="text-xs leading-relaxed">{note.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(note.created_at), 'dd.MM.yyyy HH:mm', { locale: pl })} - {note.profiles.full_name}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Brak notatek</p>
                )}

                {/* Rozwijana sekcja dodawania nowej notatki */}
                <Collapsible open={notesOpen} onOpenChange={setNotesOpen} className="space-y-1.5">
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex w-full justify-between h-8"
                    >
                      <span className="flex items-center gap-1.5 text-xs">
                        <IconPlus className="h-3.5 w-3.5" />
                        Dodaj notatkę
                      </span>
                      <IconChevronDown 
                        className={`h-3.5 w-3.5 transition-transform ${notesOpen ? 'rotate-180' : ''}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-1">
                    <div className="space-y-2 rounded-md border p-3 bg-muted/10">
                      <div className="space-y-1.5">
                        <Label htmlFor="new_note" className="text-xs">Treść notatki</Label>
                        <Textarea
                          id="new_note"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Wpisz notatkę..."
                          rows={3}
                          className="text-xs resize-none"
                        />
                      </div>
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={handleAddNote} 
                        disabled={!newNote.trim()}
                        className="w-full h-8"
                      >
                        <IconPlus className="h-3.5 w-3.5 mr-1.5" />
                        <span className="text-xs">Zapisz notatkę</span>
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-between gap-2 border-t pt-3 mt-2">
              {student && (
                <Button 
                  type="button" 
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete} 
                  disabled={loading || deleting}
                >
                  {deleting ? 'Usuwanie...' : 'Usuń'}
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={student ? () => setIsEditMode(false) : onClose}
                  disabled={loading || deleting}
                >
                  {student ? 'Anuluj' : 'Anuluj'}
                </Button>
                <Button type="submit" size="sm" disabled={loading || deleting}>
                  {loading ? 'Zapisywanie...' : student ? 'Zapisz' : 'Dodaj'}
                </Button>
              </div>
            </div>
          </form>
        )}
        </div>
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
