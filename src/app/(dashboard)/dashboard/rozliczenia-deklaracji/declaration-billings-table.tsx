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
import { toast } from 'sonner'
import { IconCreditCard } from '@tabler/icons-react'

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

export function DeclarationBillingsTable({
  billings,
  currentMonth,
  currentYear,
}: DeclarationBillingsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [payuDialogOpen, setPayuDialogOpen] = useState(false)
  const [sendingPayments, setSendingPayments] = useState(false)
  const currentDate = new Date()
  const years = Array.from(
    { length: 5 },
    (_, i) => currentDate.getFullYear() - 2 + i
  )

  const filteredBillings = useMemo(() => {
    if (!search.trim()) {
      return billings
    }
    
    const searchLower = search.toLowerCase()
    return billings.filter((billing) => {
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
  }, [billings, search])

  const handleMonthChange = (newMonth: number) => {
    router.push(
      `/dashboard/rozliczenia-deklaracji?month=${newMonth}&year=${currentYear}`
    )
  }

  const handleYearChange = (newYear: number) => {
    router.push(
      `/dashboard/rozliczenia-deklaracji?month=${currentMonth}&year=${newYear}`
    )
  }

  const totalStats = useMemo(() => {
    return {
      totalDue: filteredBillings.reduce((sum, b) => sum + (b.total_due || 0), 0),
      totalPaid: filteredBillings.reduce((sum, b) => sum + (b.total_paid || 0), 0),
      totalBalance: filteredBillings.reduce((sum, b) => sum + (b.balance || 0), 0),
      totalHours: filteredBillings.reduce((sum, b) => sum + (b.hours || 0), 0),
    }
  }, [filteredBillings])

  const toggleSelectOne = (studentId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId)
    } else {
      newSelected.add(studentId)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBillings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredBillings.map(b => b.student_id)))
    }
  }

  const allSelected = filteredBillings.length > 0 && selectedIds.size === filteredBillings.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredBillings.length

  const handleSendPayUPayments = async () => {
    if (selectedIds.size === 0) {
      toast.error('Wybierz przynajmniej jednego ucznia')
      return
    }

    setSendingPayments(true)
    try {
      const result = await sendPayUPaymentsAction(
        Array.from(selectedIds),
        currentMonth,
        currentYear
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
    return filteredBillings.filter(b => selectedIds.has(b.student_id))
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
              <TableHead>Uczeń</TableHead>
              <TableHead>Rodzic</TableHead>
              <TableHead className="text-right">Godziny</TableHead>
              <TableHead className="text-right">Stawka</TableHead>
              <TableHead className="text-right">Do zapłaty</TableHead>
              <TableHead className="text-right">Zapłacono</TableHead>
              <TableHead className="text-right">Pozostało</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBillings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Brak rozliczeń do wyświetlenia
                </TableCell>
              </TableRow>
            ) : (
              filteredBillings.map((billing) => {
                const hourlyRate = billing.hours && billing.hours > 0
                  ? (billing.total_due || 0) / billing.hours
                  : 0

                return (
                  <TableRow key={billing.student_id}>
                    <TableCell className="w-12">
                      <Checkbox
                        checked={selectedIds.has(billing.student_id)}
                        onCheckedChange={() => toggleSelectOne(billing.student_id)}
                        aria-label="Wybierz wiersz"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {billing.students.first_name} {billing.students.last_name}
                    </TableCell>
                    <TableCell>
                      {billing.parent 
                        ? `${billing.parent.first_name} ${billing.parent.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {billing.hours ? formatHours(billing.hours) : '0'} h
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

