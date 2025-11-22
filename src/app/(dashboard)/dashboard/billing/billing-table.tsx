'use client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IconPlus, IconMail, IconEye, IconRefresh, IconArrowUp, IconArrowDown, IconArrowsSort } from '@tabler/icons-react'
import type { StudentBillingWithParent, BillingStatus } from '@/lib/actions/billing'
import { sendReminderAction, recalculateBillingsAction, markBillingsAsPaidAction, sendGroupRemindersAction } from './actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useState, useMemo, useEffect } from 'react'
import React from 'react'
import { PaymentDialog } from './payment-dialog'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface Student {
  id: string
  first_name: string
  last_name: string
  parent?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
  }
}

interface BillingTableProps {
  billings: StudentBillingWithParent[]
  currentMonth: number
  currentYear: number
  students: Student[]
}

const months = [
  { value: 1, label: 'Styczeń' },
  { value: 2, label: 'Luty' },
  { value: 3, label: 'Marzec' },
  { value: 4, label: 'Kwiecień' },
  { value: 5, label: 'Maj' },
  { value: 6, label: 'Czerwiec' },
  { value: 7, label: 'Lipiec' },
  { value: 8, label: 'Sierpień' },
  { value: 9, label: 'Wrzesień' },
  { value: 10, label: 'Październik' },
  { value: 11, label: 'Listopad' },
  { value: 12, label: 'Grudzień' },
]

const statusLabels: Record<BillingStatus, string> = {
  paid: 'Opłacone',
  partially_paid: 'Częściowo opłacone',
  unpaid: 'Nieopłacone',
}

const statusColors: Record<BillingStatus, string> = {
  paid: 'bg-green-500/10 text-green-700 dark:text-green-400',
  partially_paid: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  unpaid: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

const ITEMS_PER_PAGE = 50

export function BillingTable({
  billings,
  currentMonth,
  currentYear,
  students,
}: BillingTableProps) {
  const router = useRouter()
  const [recalculating, setRecalculating] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'subject' | 'tutor' | 'status' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentDialogStudentId, setPaymentDialogStudentId] = useState<string | undefined>()
  const currentDate = new Date()
  const years = Array.from(
    { length: 5 },
    (_, i) => currentDate.getFullYear() - 2 + i
  )

  // Filtrowanie po wyszukiwaniu
  const filteredBillings = useMemo(() => {
    if (!search.trim()) {
      return billings
    }
    
    const searchLower = search.toLowerCase()
    return billings.filter((billing) => {
      const studentName = `${billing.students.first_name} ${billing.students.last_name}`.toLowerCase()
      const parentName = billing.parent 
        ? `${billing.parent.first_name} ${billing.parent.last_name}`.toLowerCase()
        : ''
      const parentEmail = billing.parent?.email?.toLowerCase() || ''
      const subjectName = billing.category?.subject_name?.toLowerCase() || ''
      const tutorNames = billing.tutors && billing.tutors.length > 0
        ? billing.tutors.map(t => t.full_name.toLowerCase()).join(' ')
        : ''
      
      return (
        studentName.includes(searchLower) ||
        parentName.includes(searchLower) ||
        parentEmail.includes(searchLower) ||
        subjectName.includes(searchLower) ||
        tutorNames.includes(searchLower)
      )
    })
  }, [billings, search])

  // Sortowanie
  const sortedBillings = useMemo(() => {
    const sorted = [...filteredBillings].sort((a, b) => {
      if (sortBy === 'subject') {
        const aSubject = a.category?.subject_name || ''
        const bSubject = b.category?.subject_name || ''
        if (!aSubject && !bSubject) return 0
        if (!aSubject) return 1
        if (!bSubject) return -1
        const comparison = aSubject.localeCompare(bSubject, 'pl', { sensitivity: 'base' })
        return sortDirection === 'asc' ? comparison : -comparison
      }
      
      if (sortBy === 'tutor') {
        const aTutors = a.tutors && a.tutors.length > 0 
          ? a.tutors.map(t => t.full_name).join(', ')
          : ''
        const bTutors = b.tutors && b.tutors.length > 0
          ? b.tutors.map(t => t.full_name).join(', ')
          : ''
        if (!aTutors && !bTutors) return 0
        if (!aTutors) return 1
        if (!bTutors) return -1
        const comparison = aTutors.localeCompare(bTutors, 'pl', { sensitivity: 'base' })
        return sortDirection === 'asc' ? comparison : -comparison
      }
      
      if (sortBy === 'status') {
        const statusOrder: Record<BillingStatus, number> = {
          paid: 1,
          partially_paid: 2,
          unpaid: 3,
        }
        const aStatus = statusOrder[a.status] || 0
        const bStatus = statusOrder[b.status] || 0
        const comparison = aStatus - bStatus
        return sortDirection === 'asc' ? comparison : -comparison
      }
      
      return 0
    })
    return sorted
  }, [filteredBillings, sortBy, sortDirection])

  // Calculate pagination
  const totalPages = Math.ceil(sortedBillings.length / ITEMS_PER_PAGE)
  const paginatedBillings = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return sortedBillings.slice(startIndex, endIndex)
  }, [sortedBillings, currentPage])

  // Reset to page 1 when billings change (e.g., when month/year changes)
  useEffect(() => {
    setCurrentPage(1)
  }, [currentMonth, currentYear, sortBy, sortDirection, search])

  const handleSortBySubject = () => {
    if (sortBy === 'subject') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy('subject')
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const handleSortByTutor = () => {
    if (sortBy === 'tutor') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy('tutor')
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const handleSortByStatus = () => {
    if (sortBy === 'status') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy('status')
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const handleSendReminder = async (
    studentId: string,
    billingPeriodId: string
  ) => {
    try {
      await sendReminderAction(studentId, billingPeriodId)
      toast.success('Przypomnienie wysłane')
    } catch {
      toast.error('Nie udało się wysłać przypomnienia')
    }
  }

  const handleAddPayment = (studentId: string, _billingPeriodId: string) => {
    setPaymentDialogStudentId(studentId)
    setPaymentDialogOpen(true)
  }

  const handlePaymentDialogClose = () => {
    setPaymentDialogOpen(false)
    setPaymentDialogStudentId(undefined)
  }

  const handlePaymentSuccess = () => {
    router.refresh()
  }

  const handleViewDetails = (studentId: string, billingPeriodId: string) => {
    router.push(
      `/dashboard/payments?studentId=${studentId}&billingPeriodId=${billingPeriodId}`
    )
  }

  const handleMonthChange = (newMonth: number) => {
    router.push(
      `/dashboard/billing?month=${newMonth}&year=${currentYear}`
    )
  }

  const handleYearChange = (newYear: number) => {
    router.push(
      `/dashboard/billing?month=${currentMonth}&year=${newYear}`
    )
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      await recalculateBillingsAction(currentMonth, currentYear)
      toast.success('Rozliczenia przeliczone pomyślnie')
      router.refresh()
    } catch (error) {
      console.error('Recalculation error:', error)
      toast.error('Nie udało się przeliczyć rozliczeń. Spróbuj ponownie.')
    } finally {
      setRecalculating(false)
    }
  }

  const toggleSelectAll = () => {
    const currentPageIds = new Set(paginatedBillings.map(b => b.id))
    const allCurrentPageSelected = paginatedBillings.every(b => selectedIds.has(b.id))
    
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

  const handleMarkAsPaid = async () => {
    if (selectedIds.size === 0) return

    try {
      await markBillingsAsPaidAction(Array.from(selectedIds))
      toast.success(`Oznaczono ${selectedIds.size} ${selectedIds.size === 1 ? 'rozliczenie' : 'rozliczeń'} jako opłacone`)
      setSelectedIds(new Set())
      router.refresh()
    } catch (error) {
      console.error('Mark as paid error:', error)
      toast.error('Nie udało się oznaczyć rozliczeń jako opłacone')
    }
  }

  const handleSendGroupReminders = async () => {
    if (selectedIds.size === 0) return

    try {
      await sendGroupRemindersAction(Array.from(selectedIds))
      toast.success(`Wysłano przypomnienia dla ${selectedIds.size} ${selectedIds.size === 1 ? 'rozliczenia' : 'rozliczeń'}`)
      setSelectedIds(new Set())
      router.refresh()
    } catch (error) {
      console.error('Send group reminders error:', error)
      toast.error('Nie udało się wysłać przypomnień')
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <Input
            placeholder="Szukaj po uczniu, rodzicu, przedmiocie lub tutorze..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Button
            onClick={handleRecalculate}
            disabled={recalculating}
            variant="outline"
            size="sm"
          >
            <IconRefresh className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Przeliczanie...' : 'Przelicz rozliczenia'}
          </Button>
          <Button
            onClick={handleMarkAsPaid}
            variant="outline"
            size="sm"
            disabled={selectedIds.size === 0}
          >
            <IconMail className="mr-2 h-4 w-4" />
            Ustaw jako opłacone {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
          <Button
            onClick={handleSendGroupReminders}
            variant="outline"
            size="sm"
            disabled={selectedIds.size === 0}
          >
            <IconMail className="mr-2 h-4 w-4" />
            Wyślij przypomnienie {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 flex-shrink-0">
          <div className="space-y-2">
            <label className="text-sm font-medium">Miesiąc</label>
            <Select
              value={currentMonth.toString()}
              onValueChange={(v) => handleMonthChange(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rok</label>
            <Select
              value={currentYear.toString()}
              onValueChange={(v) => handleYearChange(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={paginatedBillings.length > 0 && paginatedBillings.every(b => selectedIds.has(b.id))}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Uczeń</TableHead>
              <TableHead>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSortBySubject()
                  }}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Przedmiot
                  {sortBy === 'subject' ? (
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
              <TableHead>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSortByTutor()
                  }}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Tutor
                  {sortBy === 'tutor' ? (
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
              <TableHead>Rodzic</TableHead>
              <TableHead className="text-right">Godz. (miesiąc)</TableHead>
              <TableHead className="text-right">Należność</TableHead>
              <TableHead className="text-right">Zapłacono</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSortByStatus()
                  }}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Stan rozliczenia
                  {sortBy === 'status' ? (
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
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBillings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  {billings.length === 0 
                    ? 'Brak rozliczeń dla wybranego okresu'
                    : 'Brak wyników wyszukiwania'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedBillings.map((billing) => (
                <TableRow key={billing.id}>
                  <TableCell className="w-12">
                    <Checkbox
                      checked={selectedIds.has(billing.id)}
                      onCheckedChange={() => toggleSelectOne(billing.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {billing.students.first_name} {billing.students.last_name}
                  </TableCell>
                  <TableCell>
                    {billing.category ? (
                      <div>
                        <div className="font-medium">{billing.category.subject_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {billing.category.level_name}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {billing.tutors && billing.tutors.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {billing.tutors.map((tutor, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tutor.full_name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {billing.parent ? (
                      <div>
                        <div className="font-medium">
                          {billing.parent.first_name} {billing.parent.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {billing.parent.email}
                        </div>
                        {billing.parent.phone && (
                          <div className="text-sm text-muted-foreground">
                            {billing.parent.phone}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Brak rodzica</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {billing.hours_this_month.toFixed(2)} h
                  </TableCell>
                  <TableCell className="text-right">
                    {billing.total_due.toFixed(2)} zł
                  </TableCell>
                  <TableCell className="text-right">
                    {billing.total_paid.toFixed(2)} zł
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {billing.balance.toFixed(2)} zł
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={statusColors[billing.status]}
                      variant="outline"
                    >
                      {statusLabels[billing.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleSendReminder(
                            billing.student_id,
                            billing.billing_period_id
                          )
                        }
                        title="Wyślij przypomnienie"
                      >
                        <IconMail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleAddPayment(
                            billing.student_id,
                            billing.billing_period_id
                          )
                        }
                        title="Dodaj płatność"
                      >
                        <IconPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleViewDetails(
                            billing.student_id,
                            billing.billing_period_id
                          )
                        }
                        title="Szczegóły"
                      >
                        <IconEye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filteredBillings.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Wyświetlanie {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, sortedBillings.length)} z{' '}
            {sortedBillings.length} rekordów
            {search && ` (z ${billings.length} wszystkich)`}
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) {
                      setCurrentPage(currentPage - 1)
                    }
                  }}
                  className={
                    currentPage === 1 ? 'pointer-events-none opacity-50' : ''
                  }
                />
              </PaginationItem>

              {/* First page */}
              {currentPage > 3 && (
                <>
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(1)
                      }}
                    >
                      1
                    </PaginationLink>
                  </PaginationItem>
                  {currentPage > 4 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                </>
              )}

              {/* Page numbers around current page */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                )
                .map((page, index, array) => {
                  // Add ellipsis if there's a gap
                  const showEllipsisBefore =
                    index > 0 && page - array[index - 1] > 1

                  return (
                    <React.Fragment key={page}>
                      {showEllipsisBefore && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setCurrentPage(page)
                          }}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </React.Fragment>
                  )
                })}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) {
                      setCurrentPage(currentPage + 1)
                    }
                  }}
                  className={
                    currentPage === totalPages
                      ? 'pointer-events-none opacity-50'
                      : ''
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onClose={handlePaymentDialogClose}
        students={students}
        currentMonth={currentMonth}
        currentYear={currentYear}
        initialStudentId={paymentDialogStudentId}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  )
}

