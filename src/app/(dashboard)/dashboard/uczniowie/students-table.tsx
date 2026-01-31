'use client'

import { useState, useEffect } from "react"
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
import { deleteStudent } from "./actions"
import { IconPlus, IconTrash, IconMail, IconArrowUp, IconArrowDown, IconArrowsSort } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

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
  tutorSubjectLevels?: { subject_level_id: string; subjects: { id: string; name: string } | null; subject_levels: { id: string; level_name: string } | null }[]
  currentUserId?: string
}

const ITEMS_PER_PAGE = 50

export function StudentsTable({
  students,
  isTutor,
  allParents = [],
  allSubjects = [],
  tutorId,
  defaultStudentRate = 50,
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
  const [sortBy, setSortBy] = useState<'subjects' | 'tutors' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const filteredStudents = students.filter(
    (student) =>
      student.first_name.toLowerCase().includes(search.toLowerCase()) ||
      student.last_name.toLowerCase().includes(search.toLowerCase())
  )

  // Sortowanie po przedmiotach lub tutorach
  const sortedStudents = [...filteredStudents].sort((a, b) => {
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

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingStudent(null)
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
              <TableHead>Imię i nazwisko</TableHead>
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
                <TableCell colSpan={isTutor ? 4 : 5} className="text-center text-muted-foreground">
                  Brak uczniów do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              paginatedStudents.map((student) => {
                const parents = student.student_parents || []
                const subjects = student.student_subjects || []
                const assignments = student.student_assignments || []
                const activeTutors = assignments
                  .filter(sa => sa.status === 'active' && sa.profiles)
                  .map(sa => sa.profiles?.full_name || '')
                  .filter(Boolean)
                  .filter((value, index, self) => self.indexOf(value) === index) // unique

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
                      ) : '-'}
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
        studentAssignments={editingStudent?.student_assignments}
        allParents={allParents}
        allSubjects={allSubjects}
        isTutor={isTutor}
        tutorId={tutorId}
        defaultStudentRate={defaultStudentRate}
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
          selectedStudents={filteredStudents.filter(s => selectedIds.has(s.id))}
        />
      )}
    </div>
  )
}

