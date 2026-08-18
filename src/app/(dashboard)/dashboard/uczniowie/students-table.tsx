'use client'

import { useState, useEffect, useMemo } from "react"
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
import { SubjectBadge } from "@/components/subject-badge"
import { StudentDialog } from "./student-dialog"
import { GroupMessageDialog } from "./group-message-dialog"
import { TutorGroupMessageDialog } from "./tutor-group-message-dialog"
import { deleteStudent, mergeStudentsAction } from "./actions"
import { IconPlus, IconTrash, IconMail, IconArrowUp, IconArrowDown, IconArrowsSort } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { TableSelectionBar } from "@/components/table-selection-bar"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

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
  subjects: { name: string; color?: string | null } | null
  subject_levels: { level_name: string } | null
}

interface StudentAssignment {
  id: string
  tutor_id: string
  status: string
  profiles?: {
    id: string
    full_name: string
  } | null
  subjects?: { name: string; color?: string | null } | null
  subject_levels?: { level_name: string } | null
  subject_level_id?: string | null
}

interface StudentExtended extends Student {
  student_parents?: StudentParent[]
  student_notes?: StudentNote[]
  student_subjects?: StudentSubject[]
  student_assignments?: StudentAssignment[]
}

interface StudentsTableProps {
  students: StudentExtended[]
  isAdmin: boolean
  isTutor: boolean
  allParents?: { id: string; first_name: string; last_name: string; email: string; phone: string | null; parent_type: string }[]
  allSubjects?: { id: string; name: string; subject_levels: { id: string; level_name: string; level_order: number; price_per_hour: number }[] }[]
  tutorId?: string
  defaultStudentRate?: number
  defaultStudentRatesByLevel?: { 1: number; 2: number; 3: number }
  tutorSubjectLevels?: { subject_level_id: string; subjects: { id: string; name: string } | null; subject_levels: { id: string; level_name: string } | null }[]
  currentUserId?: string
}

const ITEMS_PER_PAGE = 50

export function StudentsTable({
  students,
  isAdmin,
  isTutor,
  allParents = [],
  allSubjects = [],
  tutorId,
  defaultStudentRate = 50,
  defaultStudentRatesByLevel,
  tutorSubjectLevels = [],
  currentUserId,
}: StudentsTableProps) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<StudentExtended | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogContent, setConfirmDialogContent] = useState<{ title: string; description: string; onConfirm: () => void }>({ title: '', description: '', onConfirm: () => {} })
  const [groupMessageDialogOpen, setGroupMessageDialogOpen] = useState(false)
  const [tutorGroupMessageDialogOpen, setTutorGroupMessageDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'name' | 'subjects' | 'tutors' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [mergePrimaryId, setMergePrimaryId] = useState<string>('')
  const [merging, setMerging] = useState(false)

  const filteredStudents = students.filter(
    (student) =>
      student.first_name.toLowerCase().includes(search.toLowerCase()) ||
      student.last_name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredStudentIds = useMemo(
    () => new Set(filteredStudents.map((s) => s.id)),
    [filteredStudents]
  )

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedIds.has(s.id)),
    [students, selectedIds]
  )

  // Sortowanie po przedmiotach lub tutorach
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortBy === 'name') {
      const nameA = `${a.last_name} ${a.first_name}`.toLowerCase()
      const nameB = `${b.last_name} ${b.first_name}`.toLowerCase()
      const comparison = nameA.localeCompare(nameB, 'pl', { sensitivity: 'base' })
      return sortDirection === 'asc' ? comparison : -comparison
    }
    if (sortBy === 'subjects') {
      const aSubjects = (a.student_subjects || [])
        .map(ss => ss.subjects?.name || '')
        .filter(Boolean)
        .sort()
        .join(', ')
      
      const bSubjects = (b.student_subjects || [])
        .map(ss => ss.subjects?.name || '')
        .filter(Boolean)
        .sort()
        .join(', ')
      
      if (!aSubjects && !bSubjects) return 0
      if (!aSubjects) return 1
      if (!bSubjects) return -1
      
      const comparison = aSubjects.localeCompare(bSubjects, 'pl', { sensitivity: 'base' })
      return sortDirection === 'asc' ? comparison : -comparison
    }
    
    if (sortBy === 'tutors') {
      const aTutors = (a.student_assignments || [])
        .filter(sa => sa.status === 'active' && sa.profiles)
        .map(sa => sa.profiles?.full_name || '')
        .filter(Boolean)
        .sort()
        .join(', ')
      
      const bTutors = (b.student_assignments || [])
        .filter(sa => sa.status === 'active' && sa.profiles)
        .map(sa => sa.profiles?.full_name || '')
        .filter(Boolean)
        .sort()
        .join(', ')
      
      if (!aTutors && !bTutors) return 0
      if (!aTutors) return 1
      if (!bTutors) return -1
      
      const comparison = aTutors.localeCompare(bTutors, 'pl', { sensitivity: 'base' })
      return sortDirection === 'asc' ? comparison : -comparison
    }
    
    return 0
  })
  const handleSortByName = () => {
    if (sortBy === 'name') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy('name')
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }


  // Paginacja
  const totalPages = Math.ceil(sortedStudents.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedStudents = sortedStudents.slice(startIndex, endIndex)

  const handleSortBySubjects = () => {
    if (sortBy === 'subjects') {
      // Zmień kierunek sortowania
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Ustaw sortowanie po przedmiotach
      setSortBy('subjects')
      setSortDirection('asc')
    }
    setCurrentPage(1) // Resetuj stronę przy sortowaniu
  }

  const handleSortByTutors = () => {
    if (sortBy === 'tutors') {
      // Zmień kierunek sortowania
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Ustaw sortowanie po tutorach
      setSortBy('tutors')
      setSortDirection('asc')
    }
    setCurrentPage(1) // Resetuj stronę przy sortowaniu
  }

  // Resetuj stronę gdy zmienia się wyszukiwanie lub sortowanie
  useEffect(() => {
    setCurrentPage(1)
  }, [search, sortBy, sortDirection])

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

  const handleOpenMerge = () => {
    if (isTutor) return
    if (selectedIds.size !== 2) {
      toast.error('Zaznacz dokładnie 2 rekordy uczniów do scalenia')
      return
    }
    const ids = Array.from(selectedIds)
    setMergePrimaryId(ids[0] || '')
    setMergeDialogOpen(true)
  }

  const handleConfirmMerge = async () => {
    if (selectedIds.size !== 2) return
    const ids = Array.from(selectedIds)
    const primary = mergePrimaryId || ids[0]
    const duplicate = ids.find(id => id !== primary)
    if (!primary || !duplicate) {
      toast.error('Nieprawidłowy wybór uczniów do scalenia')
      return
    }
    setMerging(true)
    try {
      const res = await mergeStudentsAction(primary, duplicate)
      if (!res?.success) {
        toast.error(res?.message || 'Nie udało się scalić uczniów')
        return
      }
      toast.success('Uczniowie zostali scaleni')
      setMergeDialogOpen(false)
      setSelectedIds(new Set())
      window.location.reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nie udało się scalić uczniów')
    } finally {
      setMerging(false)
    }
  }

  // Przy zamykaniu NIE czyścimy od razu `editingStudent`, żeby zawartość dialogu
  // nie przeskakiwała na inny widok w trakcie animacji zamykania.
  const handleDialogClose = () => {
    setDialogOpen(false)
  }

  const toggleSelectAll = () => {
    const currentPageIds = new Set(paginatedStudents.map(s => s.id))
    const allCurrentPageSelected = paginatedStudents.every(s => selectedIds.has(s.id))
    
    if (allCurrentPageSelected) {
      // Odznacz wszystkie z aktualnej strony
      const newSelected = new Set(selectedIds)
      currentPageIds.forEach(id => newSelected.delete(id))
      setSelectedIds(newSelected)
    } else {
      // Zaznacz wszystkie z aktualnej strony
      const newSelected = new Set(selectedIds)
      currentPageIds.forEach(id => newSelected.add(id))
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

  const formatStudentRate = (student: StudentExtended) => {
    const level = (typeof student.rate_level === 'number' ? student.rate_level : 1) as 1 | 2 | 3
    const fallback =
      defaultStudentRatesByLevel?.[level] ??
      defaultStudentRate

    // Ujednolicenie z widokiem profilu (StudentDialog):
    // - gdy override jest OFF -> stawka ma wynikać z poziomu (ustawienia systemowe),
    // - gdy override jest ON  -> pokazujemy stawkę ręcznie ustawioną na uczniu (hourly_rate).
    const hasValidManualRate =
      typeof student.hourly_rate === 'number' && !Number.isNaN(student.hourly_rate)
    const isOverridden = Boolean(student.hourly_rate_is_overridden)

    const rate = isOverridden && hasValidManualRate ? student.hourly_rate : fallback

    return {
      rate,
      isOverridden,
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0">
          <Input
            placeholder="Szukaj ucznia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-sm"
          />
          <div className="flex items-center gap-2 flex-wrap">
            {isTutor ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setTutorGroupMessageDialogOpen(true)}
                disabled={students.length === 0}
                className="flex-1 sm:flex-initial"
              >
                <IconMail className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Wyślij do wszystkich uczniów</span>
                <span className="sm:hidden">Wyślij wszystkim</span>
                {students.length > 0 && ` (${students.length})`}
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setGroupMessageDialogOpen(true)}
                  disabled={selectedIds.size === 0}
                  className="flex-1 sm:flex-initial"
                >
                  <IconMail className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Wyślij wiadomość grupową</span>
                  <span className="sm:hidden">Wiadomość</span>
                  {selectedIds.size > 0 && ` (${selectedIds.size})`}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenMerge}
                  disabled={selectedIds.size !== 2}
                  className="flex-1 sm:flex-initial"
                >
                  Scal uczniów {selectedIds.size === 2 ? '(2)' : ''}
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0}
                  className="flex-1 sm:flex-initial"
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Usuń zaznaczone</span>
                  <span className="sm:hidden">Usuń</span>
                  {selectedIds.size > 0 && ` (${selectedIds.size})`}
                </Button>
              </>
            )}
          </div>
        </div>
        <Button onClick={handleAdd} className="w-full sm:w-auto">
          <IconPlus className="mr-2 h-4 w-4" />
          Dodaj ucznia
        </Button>
      </div>

      {!isTutor && (
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold">*</span> oznacza indywidualną stawkę (nadpisaną ręcznie), niezależną od domyślnej stawki z poziomu.
        </div>
      )}

      {!isTutor && (
        <TableSelectionBar
          items={selectedStudents.map((s) => ({
            id: s.id,
            label: `${s.first_name} ${s.last_name}`,
          }))}
          visibleIds={filteredStudentIds}
          onRemove={(id) => {
            const newSelected = new Set(selectedIds)
            newSelected.delete(id)
            setSelectedIds(newSelected)
          }}
          onClearAll={() => setSelectedIds(new Set())}
        />
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={paginatedStudents.length > 0 && paginatedStudents.every(s => selectedIds.has(s.id))}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>
                {!isTutor ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSortByName()
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Imię i nazwisko
                    {sortBy === 'name' ? (
                      sortDirection === 'asc' ? (
                        <IconArrowUp className="h-4 w-4" />
                      ) : (
                        <IconArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <IconArrowsSort className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                ) : (
                  'Imię i nazwisko'
                )}
              </TableHead>
              {!isTutor && <TableHead className="whitespace-nowrap">Stawka</TableHead>}
              <TableHead>Rodzice</TableHead>
              <TableHead>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSortBySubjects()
                  }}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Przedmioty
                  {sortBy === 'subjects' ? (
                    sortDirection === 'asc' ? (
                      <IconArrowUp className="h-4 w-4" />
                    ) : (
                      <IconArrowDown className="h-4 w-4" />
                    )
                  ) : (
                    <IconArrowsSort className="h-4 w-4 opacity-50" />
                  )}
                </button>
              </TableHead>
              {!isTutor && (
                <TableHead>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSortByTutors()
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Tutor
                    {sortBy === 'tutors' ? (
                      sortDirection === 'asc' ? (
                        <IconArrowUp className="h-4 w-4" />
                      ) : (
                        <IconArrowDown className="h-4 w-4" />
                      )
                    ) : (
                      <IconArrowsSort className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isTutor ? 4 : 6} className="text-center text-muted-foreground">
                  Brak uczniów do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              paginatedStudents.map((student) => {
                const parents = student.student_parents || []
                const subjects = student.student_subjects || []
                const assignments = student.student_assignments || []
                const activeAssignmentsForTutor = isTutor && tutorId
                  ? assignments.filter(sa => sa.status === 'active' && sa.tutor_id === tutorId)
                  : []
                const activeTutors = assignments
                  .filter(sa => sa.status === 'active' && sa.profiles)
                  .map(sa => sa.profiles?.full_name || '')
                  .filter(Boolean)
                  .filter((value, index, self) => self.indexOf(value) === index) // unique
                const { rate, isOverridden } = !isTutor ? formatStudentRate(student) : { rate: null, isOverridden: false }

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
                    <TableCell className="font-medium">
                      <span className="hover:underline">
                        {student.first_name} {student.last_name}
                      </span>
                    </TableCell>
                    {!isTutor && (
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{Math.round((rate as number) * 100) / 100} zł/h</span>
                          {isOverridden && (
                            <span className="text-sm font-semibold text-muted-foreground" aria-label="Indywidualna stawka">
                              *
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
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
                      {isTutor ? (
                        activeAssignmentsForTutor.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {activeAssignmentsForTutor.map((a) => (
                              <div key={a.id} className="flex flex-col gap-0.5">
                                {a.subjects ? (
                                  <SubjectBadge subject={a.subjects} className="text-xs w-fit" />
                                ) : (
                                  <Badge variant="outline" className="text-xs w-fit">
                                    Przedmiot
                                  </Badge>
                                )}
                                {a.subject_levels?.level_name ? (
                                  <span className="text-[11px] text-muted-foreground">
                                    {a.subject_levels.level_name}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">-</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )
                      ) : subjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {subjects.map((ss, idx) =>
                            ss.subjects ? (
                              <SubjectBadge
                                key={idx}
                                subject={ss.subjects}
                                className="text-xs"
                              />
                            ) : null
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    {!isTutor && (
                      <TableCell>
                        {activeTutors.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {activeTutors.map((tutorName, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tutorName}
                              </Badge>
                            ))}
                          </div>
                        ) : '-'}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {filteredStudents.length > 0 && totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (currentPage > 1) {
                    setCurrentPage(currentPage - 1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(page)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              } else if (
                page === currentPage - 2 ||
                page === currentPage + 2
              ) {
                return (
                  <PaginationItem key={page}>
                    <PaginationEllipsis />
                  </PaginationItem>
                )
              }
              return null
            })}
            
            <PaginationItem>
              <PaginationNext 
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (currentPage < totalPages) {
                    setCurrentPage(currentPage + 1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <StudentDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        student={editingStudent}
        studentParents={editingStudent?.student_parents}
        studentNotes={editingStudent?.student_notes}
        studentSubjects={editingStudent?.student_subjects?.map(ss => ss.subject_level_id)}
        studentSubjectsDetail={editingStudent?.student_subjects}
        studentAssignments={editingStudent?.student_assignments}
        allParents={allParents}
        allSubjects={allSubjects}
        isTutor={isTutor}
        isAdmin={isAdmin}
        tutorId={tutorId}
        defaultStudentRate={defaultStudentRate}
        defaultStudentRatesByLevel={defaultStudentRatesByLevel}
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

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Scal uczniów</DialogTitle>
            <DialogDescription>
              Zaznaczone rekordy zostaną scalone w jeden. Wszystkie lekcje, płatności i historia z duplikatu zostaną przypisane do wybranego ucznia docelowego.
            </DialogDescription>
          </DialogHeader>

          {selectedIds.size === 2 ? (
            (() => {
              const ids = Array.from(selectedIds)
              const s1 = students.find(s => s.id === ids[0])
              const s2 = students.find(s => s.id === ids[1])
              const opt1 = s1 ? `${s1.first_name} ${s1.last_name}` : ids[0]
              const opt2 = s2 ? `${s2.first_name} ${s2.last_name}` : ids[1]
              return (
                <div className="space-y-3">
                  <div className="text-sm font-medium">Który rekord ma zostać jako docelowy?</div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="mergePrimary"
                        value={ids[0]}
                        checked={mergePrimaryId === ids[0]}
                        onChange={() => setMergePrimaryId(ids[0])}
                      />
                      <span>{opt1}</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="mergePrimary"
                        value={ids[1]}
                        checked={mergePrimaryId === ids[1]}
                        onChange={() => setMergePrimaryId(ids[1])}
                      />
                      <span>{opt2}</span>
                    </label>
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="text-sm text-muted-foreground">
              Zaznacz dokładnie 2 uczniów w tabeli.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} disabled={merging}>
              Anuluj
            </Button>
            <Button onClick={handleConfirmMerge} disabled={merging || selectedIds.size !== 2 || !mergePrimaryId}>
              {merging ? 'Scalanie...' : 'Scal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isTutor && tutorId ? (
        <TutorGroupMessageDialog
          open={tutorGroupMessageDialogOpen}
          onOpenChange={setTutorGroupMessageDialogOpen}
          tutorId={tutorId}
          studentsCount={students.length}
        />
      ) : (
        <GroupMessageDialog
          open={groupMessageDialogOpen}
          onOpenChange={setGroupMessageDialogOpen}
          selectedStudents={selectedStudents}
        />
      )}
    </div>
  )
}

