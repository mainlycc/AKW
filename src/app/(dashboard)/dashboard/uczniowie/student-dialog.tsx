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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { createStudent, updateStudent, deleteStudent, createStudentWithAssignment, updateStudentSubjects, createParentAndLinkToStudentAction } from "./actions"
import { createStudentNote } from "@/lib/actions/student-notes"
import { linkParentToStudentAction, unlinkParentFromStudentAction } from "./actions"
import { IconTrash, IconPlus, IconChevronDown } from "@tabler/icons-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatHours, cn } from "@/lib/utils"
import { StudentPaymentsTab } from "./student-payments-tab"

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

import {
  getCachedLessonHistory,
  invalidateLessonHistoryCache,
  isLessonHistoryCacheFresh,
  setCachedLessonHistory,
  type LessonHistoryItem,
} from './lesson-history-cache'

interface StudentSubjectRow {
  subject_level_id: string
  subjects: { name: string; color?: string | null } | null
  subject_levels: { level_name: string } | null
}

interface StudentDialogProps {
  open: boolean
  onClose: () => void
  student: Student | null
  studentParents?: StudentParent[]
  studentNotes?: StudentNote[]
  studentSubjects?: string[]
  /** Z API (nested subjects + levels) — wymagane gdy brak allSubjects, np. widok tutora */
  studentSubjectsDetail?: StudentSubjectRow[]
  studentAssignments?: StudentAssignment[]
  allParents?: Parent[]
  allSubjects?: SubjectWithLevels[]
  isTutor?: boolean
  isAdmin?: boolean
  tutorId?: string
  defaultStudentRate?: number
  defaultStudentRatesByLevel?: { 1: number; 2: number; 3: number }
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
  studentSubjectsDetail = [],
  studentAssignments = [],
  allParents = [],
  allSubjects = [],
  isTutor = false,
  isAdmin = false,
  tutorId,
  defaultStudentRate = 50,
  defaultStudentRatesByLevel,
  tutorSubjectLevels = [],
  currentUserId,
}: StudentDialogProps) {
  const router = useRouter()
  const profileSubjectCount =
    studentSubjectsDetail.length > 0 ? studentSubjectsDetail.length : studentSubjects.length
  const profileSubjectSuffix =
    profileSubjectCount === 1 ? '' : profileSubjectCount < 5 ? 'y' : 'ów'
  const [isEditMode, setIsEditMode] = useState<boolean>(!student)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const getDefaultRateForLevel = (level: 1 | 2 | 3) => {
    if (defaultStudentRatesByLevel) {
      return defaultStudentRatesByLevel[level]
    }
    return defaultStudentRate
  }
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    rate_level: 1 as 1 | 2 | 3,
    hourly_rate_is_overridden: false,
    hourly_rate: getDefaultRateForLevel(1),
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
  const [lessonHistory, setLessonHistory] = useState<LessonHistoryItem[] | null>(null)
  const [lessonHistoryLoading, setLessonHistoryLoading] = useState(false)
  const [lessonHistoryError, setLessonHistoryError] = useState<string | null>(null)
  const [lessonTab, setLessonTab] = useState<'history' | 'planned'>('history')
  const [profileTab, setProfileTab] = useState<'profile' | 'payments'>('profile')
  const nowTime = Date.now()
  const lessons = lessonHistory ?? []
  const pastLessons = lessons
    .filter((lesson) => new Date(lesson.session_date).getTime() <= nowTime)
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
  const plannedLessons = lessons
    .filter((lesson) => lesson.status === 'scheduled' && new Date(lesson.session_date).getTime() > nowTime)
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
  const visibleLessons = lessonTab === 'planned' ? plannedLessons : pastLessons
  const completedLessonCount = pastLessons.filter((lesson) => lesson.status === 'completed').length
  const pastScheduledLessonCount = pastLessons.filter((lesson) => lesson.status === 'scheduled').length
  const plannedLessonCount = plannedLessons.length
  const cancelledLessonCount = pastLessons.filter((lesson) => lesson.status === 'cancelled').length
  const completedLessonHours = pastLessons
    ?.filter((lesson) => lesson.status === 'completed')
    .reduce((sum, lesson) => sum + (lesson.duration_minutes || 0) / 60, 0) ?? 0
  const pastScheduledLessonHours = pastLessons
    ?.filter((lesson) => lesson.status === 'scheduled')
    .reduce((sum, lesson) => sum + (lesson.duration_minutes || 0) / 60, 0) ?? 0
  const getLessonStatusLabel = (lesson: LessonHistoryItem) => {
    if (lesson.status === 'completed') return 'Potwierdzona'
    if (lesson.status === 'cancelled') return 'Odwołana'
    return new Date(lesson.session_date).getTime() > nowTime ? 'Zaplanowana' : 'Niepotwierdzona'
  }
  const getLessonStatusVariant = (lesson: LessonHistoryItem): 'secondary' | 'destructive' | 'outline' => {
    if (lesson.status === 'completed') return 'secondary'
    if (lesson.status === 'cancelled') return 'destructive'
    return 'outline'
  }

  const getLevelsForSubject = (subjectId: string) => {
    const subject = allSubjects.find(s => s.id === subjectId)
    if (!subject) return []
    return subject.subject_levels.sort((a, b) => a.level_order - b.level_order)
  }

  // Przy każdym OTWARCIU dialogu ustaw tryb:
  // - istniejący uczeń -> podgląd
  // - nowy uczeń       -> edycja
  // Zależność tylko od `open`, żeby uniknąć mrugania widokiem przy zmianie `student`
  useEffect(() => {
    if (!open) return
    setIsEditMode(!student)
    setAddParentOpen(false)
    setNotesOpen(false)
    setLessonHistoryError(null)
    setLessonTab('history')
    setProfileTab('profile')
  }, [open])

  // Update formData when default rates change (only for NEW student and only when override is OFF)
  useEffect(() => {
    if (!student && open && formData.hourly_rate_is_overridden === false) {
      setFormData(prev => ({
        ...prev,
        hourly_rate: getDefaultRateForLevel(prev.rate_level),
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStudentRate, defaultStudentRatesByLevel, student, open])

  // Inicjalizacja danych formularza przy OTWARCIU dialogu.
  // Zależność tylko od `open`, żeby uniknąć zmiany widoku przy technicznych zmianach `student` podczas zamykania.
  useEffect(() => {
    if (!open) return

    if (student) {
      // Edycja istniejącego ucznia
      setFormData({
        first_name: student.first_name,
        last_name: student.last_name,
        rate_level: ((student as unknown as { rate_level?: number }).rate_level ?? 1) as 1 | 2 | 3,
        hourly_rate_is_overridden: (student as unknown as { hourly_rate_is_overridden?: boolean }).hourly_rate_is_overridden ?? false,
        hourly_rate: student.hourly_rate ?? defaultStudentRate,
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
      // Tworzenie nowego ucznia
      setFormData({
        first_name: '',
        last_name: '',
        rate_level: 1,
        hourly_rate_is_overridden: false,
        hourly_rate: getDefaultRateForLevel(1),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Jeśli override jest wyłączony, stawka powinna automatycznie wynikać z poziomu
  useEffect(() => {
    if (!open) return
    if (formData.hourly_rate_is_overridden) return
    setFormData(prev => ({
      ...prev,
      hourly_rate: getDefaultRateForLevel(prev.rate_level),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.rate_level, formData.hourly_rate_is_overridden, open, defaultStudentRatesByLevel, defaultStudentRate])

  // Historia lekcji – cache w sesji; przy ponownym otwarciu tego samego ucznia bez czekania
  useEffect(() => {
    if (!open || !student?.id) return

    const studentId = student.id
    const controller = new AbortController()
    const cached = getCachedLessonHistory(studentId)
    const cacheFresh = isLessonHistoryCacheFresh(studentId)

    if (cached) {
      setLessonHistory(cached)
      setLessonHistoryLoading(false)
      setLessonHistoryError(null)
    } else {
      setLessonHistory(null)
      setLessonHistoryLoading(true)
    }

    if (cacheFresh) {
      return () => controller.abort()
    }

    const loadHistory = async () => {
      try {
        if (!cached) {
          setLessonHistoryLoading(true)
        }
        setLessonHistoryError(null)

        const res = await fetch(`/api/students/${studentId}/lesson-history`, {
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error('Nie udało się pobrać historii lekcji')
        }

        const data = await res.json() as { sessions: LessonHistoryItem[] }
        const sessions = data.sessions || []
        setCachedLessonHistory(studentId, sessions)
        setLessonHistory(sessions)
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        console.error('Error loading lesson history:', error)
        if (!cached) {
          setLessonHistoryError(
            error instanceof Error ? error.message : 'Błąd podczas pobierania historii lekcji'
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLessonHistoryLoading(false)
        }
      }
    }

    loadHistory()

    return () => {
      controller.abort()
    }
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
            rate_level: formData.rate_level,
            hourly_rate_is_overridden: formData.hourly_rate_is_overridden,
            subject_level_id: tutorSelectedLevelId,
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

      if (student?.id) {
        invalidateLessonHistoryCache(student.id)
      }
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
        setAddParentOpen(false)
        // Close dialog to reload with fresh data
        onClose()
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

  const handleCreateAndAddParent = async () => {
    if (!student) return

    const email = parentData.email?.trim()
    if (!email) {
      alert('Email rodzica jest wymagany')
      return
    }

    try {
      setLoading(true)
      const result = await createParentAndLinkToStudentAction(
        student.id,
        {
          first_name: parentData.first_name,
          last_name: parentData.last_name || formData.last_name,
          email,
          phone: parentData.phone || '',
          parent_type: 'other',
        },
        false
      )

      if (!result?.success) {
        alert(`Błąd podczas tworzenia/przypisywania rodzica: ${result?.message || 'Nieznany błąd'}`)
        return
      }

      setParentData({ first_name: '', last_name: '', email: '', phone: '' })
      setSelectedParentId('')
      setAddParentOpen(false)
      onClose()
      router.refresh()
    } catch (error) {
      console.error('Error creating/linking parent:', error)
      alert(`Błąd podczas tworzenia/przypisywania rodzica: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
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
          // Close dialog to reload with fresh data
          onClose()
          router.refresh()
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
      <DialogContent
        className={cn(
          'w-[95vw] max-h-[90vh] overflow-hidden flex flex-col',
          student && !isEditMode && isAdmin && profileTab === 'payments'
            ? 'sm:max-w-[640px]'
            : 'sm:max-w-[500px]'
        )}
      >
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
                    {!isTutor && (
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary">
                        <span className="text-sm font-semibold">
                          {formData.hourly_rate != null ? `${formData.hourly_rate.toFixed(0)} zł/h` : '-'}
                        </span>
                      </div>
                    )}
                    {profileSubjectCount > 0 && (
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-muted-foreground">
                        <span className="text-sm">
                          {profileSubjectCount} przedmiot{profileSubjectSuffix}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isAdmin && (
              <Tabs
                value={profileTab}
                onValueChange={(value) => setProfileTab(value as 'profile' | 'payments')}
                className="space-y-3"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="profile">Profil</TabsTrigger>
                  <TabsTrigger value="payments">Płatności</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {profileTab === 'payments' && isAdmin && student && (
              <StudentPaymentsTab
                studentId={student.id}
                student={{
                  id: student.id,
                  first_name: student.first_name,
                  last_name: student.last_name,
                }}
                lessons={lessonHistory}
                primaryParent={(() => {
                  const sp = studentParents.find((p) => p.is_primary) ?? studentParents[0]
                  if (!sp?.parents) return undefined
                  return {
                    id: sp.parents.id,
                    first_name: sp.parents.first_name,
                    last_name: sp.parents.last_name,
                    email: sp.parents.email,
                    phone: sp.parents.phone,
                  }
                })()}
              />
            )}

            {profileTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Przedmioty i poziomy */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <h3 className="font-semibold text-sm">Przedmioty</h3>
                {studentSubjectsDetail.length > 0 ? (
                  <div className="space-y-2">
                    {studentSubjectsDetail.map((ss) => (
                      <div key={ss.subject_level_id} className="flex flex-col gap-1">
                        {ss.subjects ? (
                          <SubjectBadge subject={ss.subjects} className="text-xs px-2 py-0.5 w-fit" />
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">Przedmiot</span>
                        )}
                        {ss.subject_levels?.level_name && (
                          <p className="text-xs text-muted-foreground pl-0.5">{ss.subject_levels.level_name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : studentSubjects.length > 0 ? (
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

              {/* Lekcje ucznia */}
              <div className="rounded-lg border bg-card p-4 space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Lekcje ucznia</h3>
                  {lessonHistory && lessonHistory.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {lessonHistory.length}
                    </Badge>
                  )}
                </div>

                {lessonHistoryLoading && (
                  <p className="text-xs text-muted-foreground italic">
                    Ładowanie historii lekcji...
                  </p>
                )}

                {lessonHistoryError && !lessonHistoryLoading && (
                  <p className="text-xs text-destructive">
                    {lessonHistoryError}
                  </p>
                )}

                {!lessonHistoryLoading && !lessonHistoryError && lessonHistory && (
                  <>
                    {pastLessons.length > 0 || plannedLessons.length > 0 ? (
                      <div className="space-y-2">
                        <Tabs
                          value={lessonTab}
                          onValueChange={(value) => setLessonTab(value as 'history' | 'planned')}
                          className="space-y-2"
                        >
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="history">
                              Historia ({pastLessons.length})
                            </TabsTrigger>
                            <TabsTrigger value="planned">
                              Zaplanowane ({plannedLessonCount})
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            Odbyte: <span className="font-semibold text-foreground">{completedLessonCount}</span>
                          </span>
                          <span>
                            Godziny odbyte:{" "}
                            <span className="font-semibold text-foreground">
                              {formatHours(completedLessonHours)}
                              {" "}h
                            </span>
                          </span>
                          {plannedLessonCount > 0 && (
                            <span>
                              Zaplanowane:{" "}
                              <span className="font-semibold text-foreground">
                                {plannedLessonCount}
                              </span>
                            </span>
                          )}
                          {pastScheduledLessonCount > 0 && (
                            <span>
                              Przeszłe niepotwierdzone:{" "}
                              <span className="font-semibold text-foreground">
                                {pastScheduledLessonCount}
                              </span>
                              {" "}({formatHours(pastScheduledLessonHours)} h)
                            </span>
                          )}
                          {cancelledLessonCount > 0 && (
                            <span>
                              Odwołane:{" "}
                              <span className="font-semibold text-foreground">
                                {cancelledLessonCount}
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Lista ostatnich lekcji */}
                        <div className="space-y-1 max-h-40 overflow-y-auto mt-1">
                          {visibleLessons.slice(0, 20).map((lesson) => (
                            <div
                              key={lesson.id}
                              className="flex flex-col gap-0.5 p-2 rounded-md bg-muted/40"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium">
                                  {format(new Date(lesson.session_date), 'dd.MM.yyyy HH:mm', {
                                    locale: pl,
                                  })}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <Badge
                                    variant={getLessonStatusVariant(lesson)}
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    {getLessonStatusLabel(lesson)}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {lesson.duration_minutes} min
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                                {lesson.subject_name && (
                                  <span className="font-medium text-foreground">
                                    {lesson.subject_name}
                                  </span>
                                )}
                                {lesson.level_name && (
                                  <span>· {lesson.level_name}</span>
                                )}
                                {lesson.tutor_name && (
                                  <span>· Tutor: {lesson.tutor_name}</span>
                                )}
                              </div>
                              {lesson.notes && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                  {lesson.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {visibleLessons.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">
                            {lessonTab === 'planned'
                              ? 'Brak zaplanowanych przyszłych lekcji dla tego ucznia.'
                              : 'Brak przeszłych lekcji dla tego ucznia.'}
                          </p>
                        )}

                        {visibleLessons.length > 20 && (
                          <p className="text-[11px] text-muted-foreground">
                            Wyświetlono 20 z {lessonHistory.length} lekcji. Pełną listę znajdziesz w zakładce{" "}
                            <span className="font-medium">Sesje / Historia</span>.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Brak lekcji zapisanych dla tego ucznia.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            )}

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
              {/* Uwaga: modal ma wąską szerokość (sm:max-w-[500px]), więc 4 kolumny przy md potrafią powodować nachodzenie treści.
                  Trzymamy maks 2 kolumny dla stabilnego układu na desktopie. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
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
                <div className="space-y-1.5 min-w-0">
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
                {!isTutor && (
                  <>
                    <div className="space-y-1.5 min-w-0">
                      <Label className="text-xs">Poziom ucznia</Label>
                      <Select
                        value={String(formData.rate_level)}
                        onValueChange={(value) => {
                          const nextLevel = (parseInt(value, 10) || 1) as 1 | 2 | 3
                          setFormData((prev) => ({
                            ...prev,
                            rate_level: nextLevel,
                            ...(prev.hourly_rate_is_overridden
                              ? {}
                              : { hourly_rate: getDefaultRateForLevel(nextLevel) }),
                          }))
                        }}
                        disabled={loading || deleting}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Wybierz poziom" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 – Podstawowa</SelectItem>
                          <SelectItem value="2">2 – Średnia (podstawa)</SelectItem>
                          <SelectItem value="3">3 – Średnia (rozszerzenie)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="hourly_rate" className="text-xs">Stawka/h (PLN)</Label>
                      <Input
                        id="hourly_rate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.hourly_rate}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value)
                          const fallback = formData.hourly_rate_is_overridden
                            ? defaultStudentRate
                            : getDefaultRateForLevel(formData.rate_level)
                          setFormData({
                            ...formData,
                            hourly_rate: Number.isNaN(parsed) ? fallback : parsed,
                          })
                        }}
                        required
                        disabled={loading || deleting || !formData.hourly_rate_is_overridden}
                        className="h-9"
                      />
                      <label className="flex items-start gap-2 pt-1 cursor-pointer select-none min-w-0">
                        <Checkbox
                          checked={formData.hourly_rate_is_overridden}
                          onCheckedChange={(checked) => {
                            const next = checked === true
                            setFormData((prev) => ({
                              ...prev,
                              hourly_rate_is_overridden: next,
                              ...(next ? {} : { hourly_rate: getDefaultRateForLevel(prev.rate_level) }),
                            }))
                          }}
                          disabled={loading || deleting}
                        />
                        <span className="text-xs text-muted-foreground leading-snug break-words">
                          Ustaw indywidualną stawkę (override)
                        </span>
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Rodzice — tutor nie dodaje rodziców (brak sekcji przy „Dodaj ucznia”; przy edycji tylko podgląd listy) */}
            {!(isTutor && !student) && (
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

              {/* Opcjonalne dane rodzica przy tworzeniu — tylko admin */}
              {!student && (
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
              )}

              {/* Dodaj rodzica przy edycji — tylko admin */}
              {student && !isTutor && (
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
                          <Label htmlFor="parent_first_name_edit" className="text-xs">Imię</Label>
                          <Input
                            id="parent_first_name_edit"
                            type="text"
                            value={parentData.first_name}
                            onChange={(e) => setParentData({ ...parentData, first_name: e.target.value })}
                            disabled={loading || deleting}
                            placeholder="Imię"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="parent_last_name_edit" className="text-xs">Nazwisko</Label>
                          <Input
                            id="parent_last_name_edit"
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
                          <Label htmlFor="parent_email_edit" className="text-xs">Email</Label>
                          <Input
                            id="parent_email_edit"
                            type="email"
                            value={parentData.email}
                            onChange={(e) => setParentData({ ...parentData, email: e.target.value })}
                            disabled={loading || deleting}
                            placeholder="email@example.com"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="parent_phone_edit" className="text-xs">Telefon</Label>
                          <Input
                            id="parent_phone_edit"
                            type="tel"
                            value={parentData.phone}
                            onChange={(e) => setParentData({ ...parentData, phone: e.target.value })}
                            disabled={loading || deleting}
                            placeholder="+48 123 456 789"
                            className="h-9"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full"
                        onClick={handleCreateAndAddParent}
                        disabled={loading || deleting || !parentData.email.trim()}
                      >
                        <IconPlus className="mr-1 h-3.5 w-3.5" />
                        Utwórz i przypisz
                      </Button>
                    </div>

                    {availableParents.length > 0 && (
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
            )}

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
