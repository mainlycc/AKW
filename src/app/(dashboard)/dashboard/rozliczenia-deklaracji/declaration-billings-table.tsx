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

type SortField = 'month' | 'student' | 'hours' | 'total_due' | 'balance' | 'status'
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
        const tutorNames = billing.tutors && billing.tutors.length > 0
          ? billing.tutors.map(t => t.full_name.toLowerCase()).join(' ')
          : ''

        return (
          studentName.includes(searchLower) ||
          parentName.includes(searchLower) ||
          parentEmail.includes(searchLower) ||
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

  const totalStats = useMemo(() => {
    return {
      totalDue: filteredBillings.reduce((sum, b) => sum + (b.total_due || 0), 0),
      totalPaid: filteredBillings.reduce((sum, b) => sum + (b.total_paid || 0), 0),
      totalBalance: filteredBillings.reduce((sum, b) => sum + (b.balance || 0), 0),
      totalHours: filteredBillings.reduce((sum, b) => sum + (b.hours || 0), 0),
    }
  }, [filteredBillings])

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
    const selectedBillingsList = filteredBillings.filter(b => selectedIds.has(getBillingKey(b)))
    
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

  const selectedBillings = useMemo(() => {
    return filteredBillings.filter(b => selectedIds.has(getBillingKey(b)))
  }, [filteredBillings, selectedIds])

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
            onClick={() => setPayuDialogOpen(true)}
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

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Suma godzin</p>
          <p className="text-2xl font-bold">{formatHours(totalStats.totalHours)} h</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Do zapłaty</p>
          <p className="text-2xl font-bold">{totalStats.totalDue.toFixed(2)} zł</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Zapłacono</p>
          <p className="text-2xl font-bold">{totalStats.totalPaid.toFixed(2)} zł</p>
        </div>
        <div className="p-4 border rounded">
          <p className="text-sm text-muted-foreground">Pozostało</p>
          <p className="text-2xl font-bold">{totalStats.totalBalance.toFixed(2)} zł</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Wybierz wszystkie"
                />
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort('month')}
                >
                  Okres
                  <SortIcon field="month" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort('student')}
                >
                  Uczeń
                  <SortIcon field="student" />
                </button>
              </TableHead>
              <TableHead>Rodzic</TableHead>
              <TableHead className="text-right">
                <button
                  className="flex items-center justify-end hover:text-foreground transition-colors ml-auto"
                  onClick={() => handleSort('hours')}
                >
                  Godziny
                  <SortIcon field="hours" />
                </button>
              </TableHead>
              <TableHead className="text-right">Stawka</TableHead>
              <TableHead className="text-right">
                <button
                  className="flex items-center justify-end hover:text-foreground transition-colors ml-auto"
                  onClick={() => handleSort('total_due')}
                >
                  Do zapłaty
                  <SortIcon field="total_due" />
                </button>
              </TableHead>
              <TableHead className="text-right">Zapłacono</TableHead>
              <TableHead className="text-right">
                <button
                  className="flex items-center justify-end hover:text-foreground transition-colors ml-auto"
                  onClick={() => handleSort('balance')}
                >
                  Pozostało
                  <SortIcon field="balance" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center hover:text-foreground transition-colors"
                  onClick={() => handleSort('status')}
                >
                  Status
                  <SortIcon field="status" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBillings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
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
                      <TableCell className="w-12">
                        <Checkbox
                          checked={selectedIds.has(key)}
                          onCheckedChange={() => toggleSelectOne(key)}
                          aria-label="Wybierz wiersz"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap text-sm">
                          {monthNames[billing.billing_periods.month]} {billing.billing_periods.year}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        <StudentNameLink
                          student={billing.students}
                        />
                      </TableCell>
                      <TableCell>
                        {billing.parent
                          ? `${billing.parent.first_name} ${billing.parent.last_name}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
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
                      <TableCell className="text-right">
                        {hourlyRate.toFixed(0)} zł/h
                      </TableCell>
                      <TableCell className="text-right">
                        {(billing.total_due || 0).toFixed(2)} zł
                      </TableCell>
                      <TableCell className="text-right">
                        {(billing.total_paid || 0).toFixed(2)} zł
                      </TableCell>
                      <TableCell className="text-right">
                        {(billing.balance || 0).toFixed(2)} zł
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[billing.status]}>
                          {statusLabels[billing.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {hasTutorHours && tutorHoursExpanded && (
                      <TableRow key={`${key}::tutor-hours`}>
                        <TableCell className="w-12" />
                        <TableCell colSpan={9}>
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
              Wysyłanie linków do płatności PayU dla wybranych uczniów. Email z linkiem zostanie
              wysłany do rodziców.
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
              {selectedBillings.some(b => !b.parent?.email) && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ Niektórzy wybrani uczniowie nie mają przypisanego adresu email rodzica.
                    Płatności dla tych uczniów nie zostaną wysłane.
                  </p>
                </div>
              )}
            </div>
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
