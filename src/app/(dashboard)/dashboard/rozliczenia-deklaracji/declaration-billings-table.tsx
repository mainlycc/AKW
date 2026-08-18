'use client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StudentBillingWithParent, BillingStatus } from '@/lib/actions/billing'
import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { formatHours } from '@/lib/utils'
import { sendPayUPaymentsAction } from './actions'
import { previewPayUPaymentsAction } from './actions'
import type { NotificationChannel } from '@/lib/types/notifications'
import { toast } from 'sonner'
import { IconCreditCard, IconArrowUp, IconArrowDown, IconArrowsSort } from '@tabler/icons-react'
import { StudentNameLink } from '@/components/student-name-link'

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

interface DeclarationBillingsTableProps {
  billings: StudentBillingWithParent[]
  students: Student[]
}

const monthNames: Record<number, string> = {
  1: 'Styczeń',
  2: 'Luty',
  3: 'Marzec',
  4: 'Kwiecień',
  5: 'Maj',
  6: 'Czerwiec',
  7: 'Lipiec',
  8: 'Sierpień',
  9: 'Wrzesień',
  10: 'Październik',
  11: 'Listopad',
  12: 'Grudzień',
}

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

type SortField = 'month' | 'student' | 'subject' | 'tutor' | 'hours' | 'total_due' | 'balance' | 'status'
type SortDirection = 'asc' | 'desc'

export function DeclarationBillingsTable({
  billings,
}: DeclarationBillingsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedTutorHoursKeys, setExpandedTutorHoursKeys] = useState<Set<string>>(new Set())
  const [payuDialogOpen, setPayuDialogOpen] = useState(false)
  const [sendingPayments, setSendingPayments] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<
    Array<{
      studentId: string
      studentName: string
      parentName: string
      toEmail: string | null
      toPhone: string | null
      month: number
      year: number
      amount: number
      paymentUrl: string
      email?: { subject: string; html: string }
      sms?: { body: string }
    }>
  >([])
  const [channel, setChannel] = useState<NotificationChannel>('email')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('month')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Gather unique month/year combinations from billings
  const availableMonths = useMemo(() => {
    const set = new Map<string, { month: number; year: number; label: string }>()
    for (const b of billings) {
      const key = `${b.billing_periods.year}-${b.billing_periods.month}`
      if (!set.has(key)) {
        set.set(key, {
          month: b.billing_periods.month,
          year: b.billing_periods.year,
          label: `${monthNames[b.billing_periods.month]} ${b.billing_periods.year}`,
        })
      }
    }
    // Sort by year desc, month desc
    return Array.from(set.entries())
      .sort((a, b) => {
        if (b[1].year !== a[1].year) return b[1].year - a[1].year
        return b[1].month - a[1].month
      })
      .map(([key, value]) => ({ key, ...value }))
  }, [billings])

  const filteredBillings = useMemo(() => {
    let result = billings

    // Filter by month
    if (monthFilter !== 'all') {
      const [filterYear, filterMonth] = monthFilter.split('-').map(Number)
      result = result.filter(
        (b) => b.billing_periods.month === filterMonth && b.billing_periods.year === filterYear
      )
    }

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      result = result.filter((billing) => {
        const studentName = `${billing.students.first_name} ${billing.students.last_name}`.toLowerCase()
        const parent = billing.parent
        const parentName = parent ? `${parent.first_name} ${parent.last_name}`.toLowerCase() : ''
        const parentEmail = parent?.email?.toLowerCase() || ''
        const subjectNames =
          billing.categories && billing.categories.length > 0
            ? billing.categories
                .map((c) => `${c.subject_name} ${c.level_name}`.toLowerCase())
                .join(' ')
            : billing.category
              ? `${billing.category.subject_name} ${billing.category.level_name}`.toLowerCase()
              : ''
        const tutorNames = billing.tutors && billing.tutors.length > 0
          ? billing.tutors.map(t => t.full_name.toLowerCase()).join(' ')
          : ''

        return (
          studentName.includes(searchLower) ||
          parentName.includes(searchLower) ||
          parentEmail.includes(searchLower) ||
          subjectNames.includes(searchLower) ||
          tutorNames.includes(searchLower)
        )
      })
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'month': {
          if (a.billing_periods.year !== b.billing_periods.year) {
            cmp = a.billing_periods.year - b.billing_periods.year
          } else {
            cmp = a.billing_periods.month - b.billing_periods.month
          }
          break
        }
        case 'student': {
          const nameA = `${a.students.last_name} ${a.students.first_name}`.toLowerCase()
          const nameB = `${b.students.last_name} ${b.students.first_name}`.toLowerCase()
          cmp = nameA.localeCompare(nameB)
          break
        }
        case 'subject': {
          const aSubject =
            a.categories && a.categories.length > 0
              ? a.categories[0].subject_name
              : a.category?.subject_name || ''
          const bSubject =
            b.categories && b.categories.length > 0
              ? b.categories[0].subject_name
              : b.category?.subject_name || ''
          cmp = aSubject.localeCompare(bSubject, 'pl', { sensitivity: 'base' })
          break
        }
        case 'tutor': {
          const aTutors =
            a.tutors && a.tutors.length > 0 ? a.tutors.map((t) => t.full_name).join(', ') : ''
          const bTutors =
            b.tutors && b.tutors.length > 0 ? b.tutors.map((t) => t.full_name).join(', ') : ''
          cmp = aTutors.localeCompare(bTutors, 'pl', { sensitivity: 'base' })
          break
        }
        case 'hours':
          cmp = (a.hours || 0) - (b.hours || 0)
          break
        case 'total_due':
          cmp = (a.total_due || 0) - (b.total_due || 0)
          break
        case 'balance':
          cmp = (a.balance || 0) - (b.balance || 0)
          break
        case 'status': {
          const order: Record<BillingStatus, number> = { unpaid: 0, partially_paid: 1, paid: 2 }
          cmp = order[a.status] - order[b.status]
          break
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })

    return result
  }, [billings, search, monthFilter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'month' ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <IconArrowsSort className="h-3 w-3 ml-1 opacity-40" />
    return sortDirection === 'asc'
      ? <IconArrowUp className="h-3 w-3 ml-1" />
      : <IconArrowDown className="h-3 w-3 ml-1" />
  }

  // For selection, key = studentId::month::year
  const getBillingKey = (b: StudentBillingWithParent) =>
    `${b.student_id}::${b.billing_periods.month}::${b.billing_periods.year}`

  const toggleSelectOne = (key: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedIds(newSelected)
  }

  const toggleTutorHoursExpanded = (key: string) => {
    const next = new Set(expandedTutorHoursKeys)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setExpandedTutorHoursKeys(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBillings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredBillings.map(getBillingKey)))
    }
  }

  const allSelected = filteredBillings.length > 0 && selectedIds.size === filteredBillings.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredBillings.length

  const handleSendPayUPayments = async () => {
    if (selectedIds.size === 0) {
      toast.error('Wybierz przynajmniej jednego ucznia')
      return
    }

    // Group selected billings by month/year to send payments per period
    const selectedBillingsList = billings.filter(b => selectedIds.has(getBillingKey(b)))
    
    // For now, we need a single month/year for PayU payments
    // Check if all selected are from the same month
    const uniquePeriods = new Set(selectedBillingsList.map(b => `${b.billing_periods.month}-${b.billing_periods.year}`))
    if (uniquePeriods.size > 1) {
      toast.error('Wybierz uczniów z tego samego miesiąca, aby wysłać płatności PayU')
      return
    }

    const firstSelected = selectedBillingsList[0]
    const payMonth = firstSelected.billing_periods.month
    const payYear = firstSelected.billing_periods.year
    const studentIdsToSend = selectedBillingsList.map(b => b.student_id)

    setSendingPayments(true)
    try {
      const result = await sendPayUPaymentsAction(
        studentIdsToSend,
        payMonth,
        payYear,
        channel
      )

      if (result.success) {
        toast.success(
          `Wysłano płatności PayU dla ${result.sent} ${result.sent === 1 ? 'ucznia' : 'uczniów'}`
        )
        if (result.failed > 0) {
          toast.warning(
            `Nie udało się wysłać płatności dla ${result.failed} ${result.failed === 1 ? 'ucznia' : 'uczniów'}`
          )
        }
        setSelectedIds(new Set())
        setPayuDialogOpen(false)
        router.refresh()
      } else {
        toast.error('Nie udało się wysłać płatności')
        if (result.errors.length > 0) {
          console.error('PayU payment errors:', result.errors)
        }
      }
    } catch (error) {
      console.error('Error sending PayU payments:', error)
      toast.error('Wystąpił błąd podczas wysyłania płatności')
    } finally {
      setSendingPayments(false)
    }
  }

  const handleOpenPayuDialog = async () => {
    if (selectedIds.size === 0) {
      toast.error('Wybierz przynajmniej jednego ucznia')
      return
    }

    const selectedBillingsList = billings.filter((b) => selectedIds.has(getBillingKey(b)))
    const uniquePeriods = new Set(
      selectedBillingsList.map((b) => `${b.billing_periods.month}-${b.billing_periods.year}`)
    )
    if (uniquePeriods.size > 1) {
      toast.error('Wybierz uczniów z tego samego miesiąca, aby wysłać płatności PayU')
      return
    }

    const firstSelected = selectedBillingsList[0]
    const payMonth = firstSelected.billing_periods.month
    const payYear = firstSelected.billing_periods.year
    const studentIdsToSend = selectedBillingsList.map((b) => b.student_id)

    setPayuDialogOpen(true)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviews([])
    try {
      const result = await previewPayUPaymentsAction(studentIdsToSend, payMonth, payYear, channel)
      if (!result.success && result.errors?.length) {
        setPreviewError(result.errors.map((e: any) => `${e.studentId}: ${e.error}`).join('\n'))
      }
      setPreviews(result.previews || [])
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Nie udało się wygenerować podglądu')
    } finally {
      setPreviewLoading(false)
    }
  }

  const selectedBillings = useMemo(() => {
    return billings.filter(b => selectedIds.has(getBillingKey(b)))
  }, [billings, selectedIds])

  const selectedTotal = useMemo(() => {
    return selectedBillings.reduce((sum, b) => sum + (b.balance || 0), 0)
  }, [selectedBillings])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <Input
            placeholder="Szukaj po uczniu, rodzicu lub tutorze..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={monthFilter}
            onValueChange={setMonthFilter}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Wszystkie miesiące" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie miesiące</SelectItem>
              {availableMonths.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleOpenPayuDialog}
            variant="default"
            size="sm"
            disabled={selectedIds.size === 0}
          >
            <IconCreditCard className="h-4 w-4 mr-2" />
            Wyślij płatność PayU {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
        </div>
        <div className="flex-shrink-0">
          <div className="space-y-2">
            <label className="text-sm font-medium">Kanał powiadomień</label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as NotificationChannel)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="both">Email + SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Wybierz wszystkie"
                />
              </TableHead>
              <TableHead className="px-2">
                <button
                  className="flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort('month')}
                >
                  Okres
                  <SortIcon field="month" />
                </button>
              </TableHead>
              <TableHead className="px-2">
                <button
                  className="flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort('student')}
                >
                  Uczeń
                  <SortIcon field="student" />
                </button>
              </TableHead>
              <TableHead className="px-2">
                <button
                  className="flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort('subject')}
                >
                  Przedmiot
                  <SortIcon field="subject" />
                </button>
              </TableHead>
              <TableHead className="px-2">
                <button
                  className="flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort('tutor')}
                >
                  Tutor
                  <SortIcon field="tutor" />
                </button>
              </TableHead>
              <TableHead className="px-2">Rodzic</TableHead>
              <TableHead className="text-right px-2">
                <button
                  className="flex items-center justify-end hover:text-foreground transition-colors ml-auto"
                  onClick={() => handleSort('hours')}
                >
                  Godziny
                  <SortIcon field="hours" />
                </button>
              </TableHead>
              <TableHead className="text-right px-2">Stawka</TableHead>
              <TableHead className="text-right px-2">
                <button
                  className="flex items-center justify-end hover:text-foreground transition-colors ml-auto"
                  onClick={() => handleSort('total_due')}
                >
                  Należność
                  <SortIcon field="total_due" />
                </button>
              </TableHead>
              <TableHead className="text-right px-2">Zapłacono</TableHead>
              <TableHead className="text-right px-2">
                <button
                  className="flex items-center justify-end hover:text-foreground transition-colors ml-auto"
                  onClick={() => handleSort('balance')}
                >
                  Saldo
                  <SortIcon field="balance" />
                </button>
              </TableHead>
              <TableHead className="px-2">
                <button
                  className="flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort('status')}
                >
                  Stan rozliczenia
                  <SortIcon field="status" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBillings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
                  Brak rozliczeń do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredBillings.map((billing) => {
                const hourlyRate = billing.hours && billing.hours > 0
                  ? (billing.total_due || 0) / billing.hours
                  : 0
                const key = getBillingKey(billing)
                const hasTutorHours = !!(billing.tutor_hours && billing.tutor_hours.length > 0)
                const tutorHoursExpanded = expandedTutorHoursKeys.has(key)

                return (
                  <>
                    <TableRow key={key}>
                      <TableCell className="w-10 px-2">
                        <Checkbox
                          checked={selectedIds.has(key)}
                          onCheckedChange={() => toggleSelectOne(key)}
                          aria-label="Wybierz wiersz"
                        />
                      </TableCell>
                      <TableCell className="px-2">
                        <span className="whitespace-nowrap text-sm">
                          {monthNames[billing.billing_periods.month]} {billing.billing_periods.year}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium px-2">
                        <StudentNameLink
                          student={billing.students}
                        />
                      </TableCell>
                      <TableCell className="px-2">
                        {billing.categories && billing.categories.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {billing.categories.map((category, idx) => (
                              <div key={idx}>
                                <div className="font-medium text-sm leading-tight">{category.subject_name}</div>
                                {category.level_name && (
                                  <div className="text-xs text-muted-foreground leading-tight">
                                    {category.level_name}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : billing.category ? (
                          <div>
                            <div className="font-medium text-sm leading-tight">{billing.category.subject_name}</div>
                            {billing.category.level_name && (
                              <div className="text-xs text-muted-foreground leading-tight">
                                {billing.category.level_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="px-2">
                        {billing.tutors && billing.tutors.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {billing.tutors.map((tutor, idx) => (
                              <Badge key={idx} variant="outline" className="text-[11px] px-1.5 py-0.5">
                                {tutor.full_name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="px-2 whitespace-normal break-words">
                        {billing.parent
                          ? `${billing.parent.first_name} ${billing.parent.last_name}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right px-2">
                        <div className="flex flex-col items-end gap-2">
                          <span className="whitespace-nowrap">
                            {billing.hours ? formatHours(billing.hours) : '0'} h
                          </span>
                          {hasTutorHours && (
                            <button
                              type="button"
                              onClick={() => toggleTutorHoursExpanded(key)}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                              aria-expanded={tutorHoursExpanded}
                              aria-controls={`${key}--tutor-hours`}
                            >
                              {tutorHoursExpanded ? 'Ukryj wg tutorów' : 'Pokaż wg tutorów'}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-2">
                        {hourlyRate.toFixed(0)} zł/h
                      </TableCell>
                      <TableCell className="text-right px-2">
                        {(billing.total_due || 0).toFixed(2)} zł
                      </TableCell>
                      <TableCell className="text-right px-2">
                        {(billing.total_paid || 0).toFixed(2)} zł
                      </TableCell>
                      <TableCell className="text-right px-2">
                        {(billing.balance || 0).toFixed(2)} zł
                      </TableCell>
                      <TableCell className="px-2">
                        <Badge className={statusColors[billing.status]}>
                          {statusLabels[billing.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {hasTutorHours && tutorHoursExpanded && (
                      <TableRow key={`${key}::tutor-hours`}>
                        <TableCell className="w-10 px-2" />
                        <TableCell colSpan={11}>
                          <div className="py-2" id={`${key}--tutor-hours`}>
                            <div className="text-xs text-muted-foreground mb-2">
                              Godziny ucznia z podziałem na tutorów
                            </div>
                            <div className="grid gap-1">
                              {(billing.tutor_hours || []).map((th) => (
                                <div
                                  key={th.tutor_id}
                                  className="text-sm"
                                >
                                  <span className="font-medium">{th.tutor_name}</span>{' '}
                                  <span className="text-muted-foreground">—</span>{' '}
                                  <span className="whitespace-nowrap">{formatHours(th.hours)} h</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* PayU Payment Dialog */}
      <Dialog open={payuDialogOpen} onOpenChange={setPayuDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wyślij płatności PayU</DialogTitle>
            <DialogDescription>
              Poniżej widzisz dokładną treść wiadomości, która zostanie wysłana.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Wybrano <strong>{selectedIds.size}</strong>{' '}
                {selectedIds.size === 1 ? 'ucznia' : 'uczniów'}
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Łączna kwota do zapłaty: <strong>{selectedTotal.toFixed(2)} zł</strong>
              </p>
            </div>

            {previewLoading ? (
              <div className="text-sm text-muted-foreground">Generowanie podglądu...</div>
            ) : previewError ? (
              <div className="p-3 border border-destructive/50 bg-destructive/10 rounded-md">
                <pre className="text-xs whitespace-pre-wrap text-destructive">{previewError}</pre>
              </div>
            ) : previews.length === 0 ? (
              <div className="text-sm text-muted-foreground">Brak podglądu do wyświetlenia.</div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-auto pr-2">
                {previews.map((p) => (
                  <div key={p.studentId} className="rounded-md border p-3 space-y-2">
                    <div className="text-sm">
                      <div className="font-medium">{p.studentName}</div>
                      <div className="text-xs text-muted-foreground">
                        Opiekun: {p.parentName}
                        {p.toEmail ? ` • ${p.toEmail}` : ''}
                        {p.toPhone ? ` • ${p.toPhone}` : ''}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Kwota: {p.amount.toFixed(2)} zł • Okres: {p.month}/{p.year}
                      </div>
                    </div>

                    {p.email && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium">Email</div>
                        <div className="text-xs text-muted-foreground">
                          Temat: <span className="font-mono">{p.email.subject}</span>
                        </div>
                        <div className="rounded-md border overflow-hidden">
                          <iframe
                            title={`email-preview-${p.studentId}`}
                            srcDoc={p.email.html}
                            className="w-full h-[260px] bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {p.sms && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium">SMS</div>
                        <pre className="text-xs whitespace-pre-wrap rounded-md border p-2 bg-muted">
                          {p.sms.body}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayuDialogOpen(false)}
              disabled={sendingPayments}
            >
              Anuluj
            </Button>
            <Button onClick={handleSendPayUPayments} disabled={sendingPayments}>
              {sendingPayments ? 'Wysyłanie...' : 'Wyślij płatności'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
