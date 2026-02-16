'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IconEdit, IconDownload, IconPlus } from '@tabler/icons-react'
import { PaymentDialog } from './payment-dialog'
import { exportPaymentsToCSV, type PaymentFilters } from '@/lib/actions/payments'
import { toast } from 'sonner'
import type { PaymentWithParent } from '@/lib/actions/payments'
import Link from 'next/link'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { StudentNameLink } from '@/components/student-name-link'

interface PaymentsTableProps {
  payments: PaymentWithParent[]
  students: { id: string; first_name: string; last_name: string }[]
  parents: { id: string; first_name: string; last_name: string }[]
}

const paymentMethodLabels: Record<'transfer' | 'cash' | 'online', string> = {
  transfer: 'Przelew',
  cash: 'Gotówka',
  online: 'Online',
}

const ITEMS_PER_PAGE = 50

export function PaymentsTable({
  payments,
  students,
  parents,
}: PaymentsTableProps) {
  const [editingPayment, setEditingPayment] =
    useState<PaymentWithParent | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [studentFilter, setStudentFilter] = useState<string>('all')
  const [parentFilter, setParentFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filteredPayments = payments.filter((payment) => {
    if (studentFilter !== 'all' && payment.student_id !== studentFilter) {
      return false
    }
    if (
      parentFilter !== 'all' &&
      payment.parent?.id !== parentFilter
    ) {
      return false
    }
    if (methodFilter !== 'all' && payment.payment_method !== methodFilter) {
      return false
    }
    if (dateFrom && payment.payment_date < dateFrom) {
      return false
    }
    if (dateTo && payment.payment_date > dateTo) {
      return false
    }
    return true
  })

  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE)
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleEdit = (payment: PaymentWithParent) => {
    setEditingPayment(payment)
    setDialogOpen(true)
  }

  const handleExport = async () => {
    try {
      const filters: PaymentFilters = {}
      if (studentFilter !== 'all') filters.studentId = studentFilter
      if (parentFilter !== 'all') filters.parentId = parentFilter
      if (methodFilter !== 'all')
        filters.paymentMethod = methodFilter as 'transfer' | 'cash' | 'online'
      if (dateFrom) filters.startDate = dateFrom
      if (dateTo) filters.endDate = dateTo

      const csv = await exportPaymentsToCSV(filters)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `platnosci_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Eksport zakończony pomyślnie')
    } catch {
      toast.error('Nie udało się wyeksportować danych')
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingPayment(null)
    // Refresh will be handled by parent component
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
          <div className="space-y-2">
            <label className="text-sm font-medium">Uczeń</label>
            <Select value={studentFilter} onValueChange={setStudentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Wszyscy uczniowie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszyscy uczniowie</SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.first_name} {student.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rodzic</label>
            <Select value={parentFilter} onValueChange={setParentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Wszyscy rodzice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszyscy rodzice</SelectItem>
                {parents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.first_name} {parent.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Metoda</label>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Wszystkie metody" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie metody</SelectItem>
                <SelectItem value="transfer">Przelew</SelectItem>
                <SelectItem value="cash">Gotówka</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Data od</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Data do</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard/payments/new">
              <IconPlus className="h-4 w-4 mr-2" />
              Dodaj płatność
            </Link>
          </Button>
          <Button onClick={handleExport} variant="outline">
            <IconDownload className="h-4 w-4 mr-2" />
            Eksport CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Uczeń</TableHead>
              <TableHead>Rodzic</TableHead>
              <TableHead className="text-right">Kwota</TableHead>
              <TableHead>Metoda</TableHead>
              <TableHead>Miesiąc</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Brak płatności
                </TableCell>
              </TableRow>
            ) : (
              paginatedPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {new Date(payment.payment_date).toLocaleDateString('pl-PL')}
                  </TableCell>
                  <TableCell>
                    <StudentNameLink
                      student={{
                        id: payment.student_id,
                        first_name: payment.students.first_name,
                        last_name: payment.students.last_name,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {payment.parent ? (
                      <div>
                        <div className="font-medium">
                          {payment.parent.first_name} {payment.parent.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.parent.email}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Brak rodzica</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {payment.amount.toFixed(2)} zł
                  </TableCell>
                  <TableCell>
                    {paymentMethodLabels[payment.payment_method]}
                  </TableCell>
                  <TableCell>
                    {payment.billing_periods.month}/{payment.billing_periods.year}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(payment)}
                    >
                      <IconEdit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filteredPayments.length > 0 && totalPages > 1 && (
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
                className={
                  currentPage === 1
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer'
                }
              />
            </PaginationItem>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (page) => {
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
              }
            )}

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
                className={
                  currentPage === totalPages
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer'
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <PaymentDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        payment={editingPayment}
        onSuccess={() => {
          window.location.reload()
        }}
      />
    </div>
  )
}

