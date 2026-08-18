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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { IconPlus, IconMail, IconArrowUp, IconArrowDown, IconArrowsSort } from '@tabler/icons-react'
import type { StudentBillingWithParent, BillingStatus } from '@/lib/actions/billing'
import {
  sendReminderAction,
  markBillingsAsPaidAction,
  sendGroupRemindersAction,
  previewPayUPaymentsFromReportsAction,
  sendPayUPaymentsFromReportsAction,
  previewPayUAnnualPaymentsFromReportsAction,
  sendPayUAnnualPaymentsFromReportsAction,
} from './actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useState, useMemo, useEffect } from 'react'
import React from 'react'
import { PaymentDialog } from '../billing/payment-dialog'
import { formatHours } from '@/lib/utils'
import { StudentNameLink } from '@/components/student-name-link'
import type { NotificationChannel } from '@/lib/types/notifications'
import { ComposeSendDialog } from '@/components/messaging/compose-send-dialog'
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

interface BillingFromReportsTableProps {
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

const ITEMS_PER_PAGE = 50

type SortField = 'month' | 'student' | 'subject' | 'tutor' | 'balance' | 'status'
type SortDirection = 'asc' | 'desc'

function getStudentNameKey(billing: StudentBillingWithParent) {
  return `${billing.students.last_name.trim().toLowerCase()}::${billing.students.first_name.trim().toLowerCase()}`
}

function mergeYearBillings(
  items: StudentBillingWithParent[],
  year: number
): StudentBillingWithParent {
  const first = items[0]
  const totalHours = items.reduce((sum, b) => sum + (b.hours_this_month || 0), 0)
  const totalDue = items.reduce((sum, b) => sum + (b.total_due || 0), 0)
  const totalPaid = items.reduce((sum, b) => sum + (b.total_paid || 0), 0)
  const balance = totalDue - totalPaid

  let status: BillingStatus = 'unpaid'
  if (totalDue === 0) {
    status = 'unpaid'
  } else if (balance <= 0) {
    status = 'paid'
  } else if (totalPaid > 0) {
    status = 'partially_paid'
  }

  const tutors = new Map<string, { id: string; full_name: string }>()
  for (const b of items) {
    for (const t of b.tutors || []) {
      tutors.set(t.id, t)
    }
  }

  const categories = new Map<string, { subject_name: string; level_name: string }>()
  for (const b of items) {
    for (const c of b.categories || []) {
      categories.set(`${c.subject_name} - ${c.level_name}`, c)
    }
  }

  const parents = new Map<string, NonNullable<StudentBillingWithParent['parent']>>()
  for (const b of items) {
    for (const p of b.parents || []) {
      parents.set(p.id, p)
    }
    if (b.parent) {
      parents.set(b.parent.id, b.parent)
    }
  }
  const parentsList = Array.from(parents.values())

  const tutorHours = new Map<string, { tutor_id: string; tutor_name: string; hours: number }>()
  for (const b of items) {
    for (const th of b.tutor_hours || []) {
      const existing = tutorHours.get(th.tutor_id)
      tutorHours.set(th.tutor_id, {
        tutor_id: th.tutor_id,
        tutor_name: th.tutor_name,
        hours: (existing?.hours || 0) + (th.hours || 0),
      })
    }
  }
  const mergedTutorHours = Array.from(tutorHours.values()).sort((a, b) =>
    a.tutor_name.localeCompare(b.tutor_name, 'pl', { sensitivity: 'base' })
  )

  const nameKey = getStudentNameKey(first)

  return {
    ...first,
    id: `year::${year}::${nameKey}`,
    total_due: totalDue,
    total_paid: totalPaid,
    balance,
    status,
    hours_this_month: totalHours,
    total_hours: totalHours,
    tutors: Array.from(tutors.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name, 'pl', { sensitivity: 'base' })
    ),
    categories: Array.from(categories.values()).sort((a, b) =>
      a.subject_name.localeCompare(b.subject_name, 'pl', { sensitivity: 'base' })
    ),
    parents: parentsList,
    parent: parentsList.find((p) => p.email?.trim()) || parentsList[0] || first.parent,
    tutor_hours: mergedTutorHours.length > 0 ? mergedTutorHours : undefined,
    billing_periods: {
      ...first.billing_periods,
      month: 0, // marker: agregat roczny
      year,
    },
  }
}

export function BillingFromReportsTable({
  billings,
  students,
}: BillingFromReportsTableProps) {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('month')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedTutorHoursIds, setExpandedTutorHoursIds] = useState<Set<string>>(new Set())
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentDialogStudentId, setPaymentDialogStudentId] = useState<string | undefined>()
  const [paymentDialogMonth, setPaymentDialogMonth] = useState(new Date().getMonth() + 1)
  const [paymentDialogYear, setPaymentDialogYear] = useState(new Date().getFullYear())
  const [composeChannel, setComposeChannel] = useState<NotificationChannel>('email')
  const [payuChannel, setPayuChannel] = useState<NotificationChannel>('email')
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeDefaultMessage, setComposeDefaultMessage] = useState('')
  const [composeMode, setComposeMode] = useState<'single' | 'group'>('single')
  const [composeTarget, setComposeTarget] = useState<{ studentId: string; billingPeriodId: string } | null>(null)

  // 'all' | 'year:2026' | 'month:2026::3'
  const [periodFilter, setPeriodFilter] = useState<string>('all')
  const [payuDialogOpen, setPayuDialogOpen] = useState(false)
  const [sendingPayu, setSendingPayu] = useState(false)
  const [payuPreviewLoading, setPayuPreviewLoading] = useState(false)
  const [payuPreviewError, setPayuPreviewError] = useState<string | null>(null)
  const [payuPreviews, setPayuPreviews] = useState<
    Array<{
      studentId: string
      studentName: string
      parentName: string
      toEmail: string | null
      toPhone: string | null
      month: number
      year: number
      periodLabel?: string
      amount: number
      paymentUrl: string
      email?: { subject: string; html: string }
      sms?: { body: string }
    }>
  >([])

  const periodOptions = useMemo(() => {
    const years = new Set<number>()
    const months = new Map<string, { month: number; year: number; label: string }>()

    for (const b of billings) {
      const { month, year } = b.billing_periods
      years.add(year)
      const key = `${year}::${month}`
      if (!months.has(key)) {
        months.set(key, {
          month,
          year,
          label: `${monthNames[month]} ${year}`,
        })
      }
    }

    return {
      years: Array.from(years).sort((a, b) => b - a),
      months: Array.from(months.entries())
        .sort((a, b) => {
          if (b[1].year !== a[1].year) return b[1].year - a[1].year
          return b[1].month - a[1].month
        })
        .map(([key, value]) => ({ key, ...value })),
    }
  }, [billings])

  // Filtrowanie
  const filteredBillings = useMemo(() => {
    let result = billings

    if (periodFilter.startsWith('year:')) {
      const year = Number(periodFilter.slice(5))
      result = result.filter((b) => b.billing_periods.year === year)
    } else if (periodFilter.startsWith('month:')) {
      const [filterYear, filterMonth] = periodFilter.slice(6).split('::').map(Number)
      result = result.filter(
        (b) => b.billing_periods.month === filterMonth && b.billing_periods.year === filterYear
      )
    }

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      result = result.filter((billing) => {
        const studentName = `${billing.students.first_name} ${billing.students.last_name}`.toLowerCase()
        
        const allParents = billing.parents && billing.parents.length > 0 
          ? billing.parents 
          : billing.parent 
            ? [billing.parent] 
            : []
        
        const parentNames = allParents
          .map(p => `${p.first_name} ${p.last_name}`.toLowerCase())
          .join(' ')
        const parentEmails = allParents
          .map(p => p.email?.toLowerCase() || '')
          .join(' ')
        
        const subjectNames = billing.categories && billing.categories.length > 0
          ? billing.categories.map(c => c.subject_name.toLowerCase()).join(' ')
          : ''
        const tutorNames = billing.tutors && billing.tutors.length > 0
          ? billing.tutors.map(t => t.full_name.toLowerCase()).join(' ')
          : ''
        
        return (
          studentName.includes(searchLower) ||
          parentNames.includes(searchLower) ||
          parentEmails.includes(searchLower) ||
          subjectNames.includes(searchLower) ||
          tutorNames.includes(searchLower)
        )
      })
    }

    return result
  }, [billings, search, periodFilter])

  const isYearView = periodFilter.startsWith('year:')

  // Przy widoku roku: jeden wiersz na ucznia z sumą godzin i kwot ze wszystkich miesięcy
  const { displayBillings, yearSourceIds } = useMemo(() => {
    if (!isYearView) {
      return {
        displayBillings: filteredBillings,
        yearSourceIds: new Map<string, string[]>(),
      }
    }

    const year = Number(periodFilter.slice(5))
    const groups = new Map<string, StudentBillingWithParent[]>()

    for (const billing of filteredBillings) {
      const key = getStudentNameKey(billing)
      const group = groups.get(key)
      if (group) {
        group.push(billing)
      } else {
        groups.set(key, [billing])
      }
    }

    const sourceIds = new Map<string, string[]>()
    const aggregated = Array.from(groups.values()).map((items) => {
      const merged = mergeYearBillings(items, year)
      sourceIds.set(
        merged.id,
        items.map((item) => item.id)
      )
      return merged
    })

    return { displayBillings: aggregated, yearSourceIds: sourceIds }
  }, [filteredBillings, isYearView, periodFilter])

  // Sortowanie
  const sortedBillings = useMemo(() => {
    return [...displayBillings].sort((a, b) => {
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
          cmp = nameA.localeCompare(nameB, 'pl', { sensitivity: 'base' })
          break
        }
        case 'subject': {
          const aSubject = a.categories && a.categories.length > 0 ? a.categories[0].subject_name : ''
          const bSubject = b.categories && b.categories.length > 0 ? b.categories[0].subject_name : ''
          if (!aSubject && !bSubject) cmp = 0
          else if (!aSubject) cmp = 1
          else if (!bSubject) cmp = -1
          else cmp = aSubject.localeCompare(bSubject, 'pl', { sensitivity: 'base' })
          break
        }
        case 'tutor': {
          const aTutors = a.tutors && a.tutors.length > 0 
            ? a.tutors.map(t => t.full_name).join(', ')
            : ''
          const bTutors = b.tutors && b.tutors.length > 0
            ? b.tutors.map(t => t.full_name).join(', ')
            : ''
          if (!aTutors && !bTutors) cmp = 0
          else if (!aTutors) cmp = 1
          else if (!bTutors) cmp = -1
          else cmp = aTutors.localeCompare(bTutors, 'pl', { sensitivity: 'base' })
          break
        }
        case 'balance':
          cmp = (a.balance || 0) - (b.balance || 0)
          break
        case 'status': {
          const statusOrder: Record<BillingStatus, number> = { unpaid: 0, partially_paid: 1, paid: 2 }
          cmp = statusOrder[a.status] - statusOrder[b.status]
          break
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [displayBillings, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(sortedBillings.length / ITEMS_PER_PAGE)
  const paginatedBillings = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return sortedBillings.slice(startIndex, endIndex)
  }, [sortedBillings, currentPage])

  // Reset page on filter/sort change
  useEffect(() => {
    setCurrentPage(1)
  }, [sortField, sortDirection, search, periodFilter])

  const resolveSelectedMonthlyIds = () => {
    if (!isYearView) return Array.from(selectedIds)

    const monthlyIds: string[] = []
    for (const id of selectedIds) {
      const sources = yearSourceIds.get(id)
      if (sources) {
        monthlyIds.push(...sources)
      }
    }
    return monthlyIds
  }

  const selectedMonthlyBillings = useMemo(() => {
    if (!isYearView) {
      return billings.filter((b) => selectedIds.has(b.id))
    }

    const monthlyIdSet = new Set<string>()
    for (const id of selectedIds) {
      for (const sourceId of yearSourceIds.get(id) || []) {
        monthlyIdSet.add(sourceId)
      }
    }
    return billings.filter((b) => monthlyIdSet.has(b.id))
  }, [isYearView, selectedIds, yearSourceIds, billings])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'month' ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <IconArrowsSort className="h-4 w-4 opacity-50" />
    return sortDirection === 'asc'
      ? <IconArrowUp className="h-4 w-4" />
      : <IconArrowDown className="h-4 w-4" />
  }

  const handleSendReminder = async (
    studentId: string,
    billingPeriodId: string
  ) => {
    setComposeMode('single')
    setComposeTarget({ studentId, billingPeriodId })
    setComposeDefaultMessage(
      'Przypominamy o zaległej płatności za zajęcia. Prosimy o uregulowanie należności w najbliższym możliwym terminie.'
    )
    setComposeOpen(true)
  }

  const handleAddPayment = (billing: StudentBillingWithParent) => {
    setPaymentDialogStudentId(billing.student_id)
    setPaymentDialogMonth(billing.billing_periods.month)
    setPaymentDialogYear(billing.billing_periods.year)
    setPaymentDialogOpen(true)
  }

  const handlePaymentDialogClose = () => {
    setPaymentDialogOpen(false)
    setPaymentDialogStudentId(undefined)
  }

  const handlePaymentSuccess = () => {
    router.refresh()
  }

  const toggleSelectAll = () => {
    const currentPageIds = new Set(paginatedBillings.map(b => b.id))
    const allCurrentPageSelected = paginatedBillings.every(b => selectedIds.has(b.id))
    
    if (allCurrentPageSelected) {
      const newSelected = new Set(selectedIds)
      currentPageIds.forEach(id => newSelected.delete(id))
      setSelectedIds(newSelected)
    } else {
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

  const toggleTutorHoursExpanded = (id: string) => {
    const next = new Set(expandedTutorHoursIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExpandedTutorHoursIds(next)
  }

  const handleMarkAsPaid = async () => {
    if (selectedIds.size === 0) return
    const monthlyIds = resolveSelectedMonthlyIds()
    if (monthlyIds.length === 0) return

    try {
      await markBillingsAsPaidAction(monthlyIds)
      toast.success(`Oznaczono ${monthlyIds.length} ${monthlyIds.length === 1 ? 'rozliczenie' : 'rozliczeń'} jako opłacone`)
      setSelectedIds(new Set())
      router.refresh()
    } catch (error) {
      console.error('Mark as paid error:', error)
      toast.error('Nie udało się oznaczyć rozliczeń jako opłacone')
    }
  }

  const handleSendGroupReminders = async () => {
    if (selectedIds.size === 0) return

    setComposeMode('group')
    setComposeTarget(null)
    setComposeDefaultMessage(
      'Przypominamy o zaległej płatności za zajęcia. Prosimy o uregulowanie należności w najbliższym możliwym terminie.'
    )
    setComposeOpen(true)
  }

  const selectedBillings = selectedMonthlyBillings

  const composeStats = useMemo(() => {
    if (composeMode === 'single' && composeTarget) {
      const b = billings.find(
        (x) => x.student_id === composeTarget.studentId && x.billing_period_id === composeTarget.billingPeriodId
      )
      const parents = b?.parents && b.parents.length > 0 ? b.parents : b?.parent ? [b.parent] : []
      const hasEmail = parents.some((p) => !!(p.email && p.email.trim()))
      const hasPhone = parents.some((p) => !!(p.phone && p.phone.trim()))
      return {
        totalRecipients: 1,
        emailAvailable: hasEmail ? 1 : 0,
        smsAvailable: hasPhone ? 1 : 0,
        emailUnavailable: hasEmail ? 0 : 1,
        smsUnavailable: hasPhone ? 0 : 1,
      }
    }

    if (selectedBillings.length === 0) {
      return { totalRecipients: 0, emailAvailable: 0, smsAvailable: 0, emailUnavailable: 0, smsUnavailable: 0 }
    }

    const total = selectedBillings.length
    const emailAvailable = selectedBillings.filter((b) => {
      const parents = b.parents && b.parents.length > 0 ? b.parents : b.parent ? [b.parent] : []
      return parents.some((p) => !!(p.email && p.email.trim()))
    }).length
    const smsAvailable = selectedBillings.filter((b) => {
      const parents = b.parents && b.parents.length > 0 ? b.parents : b.parent ? [b.parent] : []
      return parents.some((p) => !!(p.phone && p.phone.trim()))
    }).length

    return {
      totalRecipients: total,
      emailAvailable,
      smsAvailable,
      emailUnavailable: total - emailAvailable,
      smsUnavailable: total - smsAvailable,
    }
  }, [billings, composeMode, composeTarget, selectedBillings])

  const selectedTotal = useMemo(() => {
    return selectedBillings.reduce((sum, b) => sum + (b.balance || 0), 0)
  }, [selectedBillings])

  const buildAnnualPayUTargets = () => {
    const year = Number(periodFilter.slice(5))
    const byStudent = new Map<
      string,
      Array<{ month: number; billingPeriodId: string; amount: number }>
    >()

    for (const billing of selectedBillings) {
      const amount =
        billing.balance && billing.balance > 0
          ? billing.balance
          : 0
      if (amount <= 0) continue
      if (!billing.billing_period_id) continue

      const list = byStudent.get(billing.student_id) || []
      list.push({
        month: billing.billing_periods.month,
        billingPeriodId: billing.billing_period_id,
        amount: Math.round(amount * 100) / 100,
      })
      byStudent.set(billing.student_id, list)
    }

    return Array.from(byStudent.entries()).map(([studentId, periods]) => ({
      studentId,
      year,
      periods,
    }))
  }

  const handleOpenPayuDialog = async () => {
    if (selectedIds.size === 0) {
      toast.error('Wybierz przynajmniej jedno rozliczenie')
      return
    }

    if (selectedBillings.length === 0) {
      toast.error('Brak rozliczeń do wysłania')
      return
    }

    setPayuDialogOpen(true)
    setPayuPreviewLoading(true)
    setPayuPreviewError(null)
    setPayuPreviews([])

    try {
      if (isYearView) {
        const targets = buildAnnualPayUTargets()
        if (targets.length === 0) {
          setPayuPreviewError('Brak salda do zapłaty w wybranych rozliczeniach')
          return
        }

        const result = await previewPayUAnnualPaymentsFromReportsAction(targets, payuChannel)
        if (result.errors?.length) {
          setPayuPreviewError(
            result.errors.map((e) => `${e.studentId}: ${e.error}`).join('\n')
          )
        }
        setPayuPreviews(result.previews || [])
        return
      }

      // Grupuj po okresie miesięcznym
      const byPeriod = new Map<string, { month: number; year: number; studentIds: string[] }>()
      for (const billing of selectedBillings) {
        const { month, year } = billing.billing_periods
        if (!month || !year) continue
        const key = `${year}::${month}`
        const existing = byPeriod.get(key)
        if (existing) {
          if (!existing.studentIds.includes(billing.student_id)) {
            existing.studentIds.push(billing.student_id)
          }
        } else {
          byPeriod.set(key, { month, year, studentIds: [billing.student_id] })
        }
      }

      if (byPeriod.size === 0) {
        setPayuPreviewError('Brak rozliczeń miesięcznych do wysłania')
        return
      }

      const allPreviews: typeof payuPreviews = []
      const allErrors: string[] = []

      for (const period of byPeriod.values()) {
        const result = await previewPayUPaymentsFromReportsAction(
          period.studentIds,
          period.month,
          period.year,
          payuChannel
        )
        if (result.previews?.length) {
          allPreviews.push(...result.previews)
        }
        if (result.errors?.length) {
          for (const e of result.errors) {
            allErrors.push(`${e.studentId} (${period.month}/${period.year}): ${e.error}`)
          }
        }
      }

      setPayuPreviewError(allErrors.length > 0 ? allErrors.join('\n') : null)
      setPayuPreviews(allPreviews)
    } catch (error) {
      setPayuPreviewError(error instanceof Error ? error.message : 'Nie udało się wygenerować podglądu')
    } finally {
      setPayuPreviewLoading(false)
    }
  }

  const handleSendPayu = async () => {
    if (selectedIds.size === 0 || selectedBillings.length === 0) return

    setSendingPayu(true)
    try {
      if (isYearView) {
        const targets = buildAnnualPayUTargets()
        if (targets.length === 0) {
          toast.error('Brak salda do zapłaty w wybranych rozliczeniach')
          return
        }

        const result = await sendPayUAnnualPaymentsFromReportsAction(targets, payuChannel)
        if ((result.sent || 0) > 0) {
          toast.success(
            `Wysłano ${result.sent} ${result.sent === 1 ? 'płatność PayU' : 'płatności PayU'} (suma za rok)`
          )
          if (result.failed > 0) {
            toast.warning(
              `Nie udało się wysłać ${result.failed} ${result.failed === 1 ? 'płatności' : 'płatności'}`
            )
          }
          setSelectedIds(new Set())
          setPayuDialogOpen(false)
          router.refresh()
        } else {
          toast.error('Nie udało się wysłać płatności')
        }
        return
      }

      const byPeriod = new Map<string, { month: number; year: number; studentIds: string[] }>()
      for (const billing of selectedBillings) {
        const { month, year } = billing.billing_periods
        if (!month || !year) continue
        const key = `${year}::${month}`
        const existing = byPeriod.get(key)
        if (existing) {
          if (!existing.studentIds.includes(billing.student_id)) {
            existing.studentIds.push(billing.student_id)
          }
        } else {
          byPeriod.set(key, { month, year, studentIds: [billing.student_id] })
        }
      }

      if (byPeriod.size === 0) {
        toast.error('Brak rozliczeń miesięcznych do wysłania')
        return
      }

      let sent = 0
      let failed = 0

      for (const period of byPeriod.values()) {
        const result = await sendPayUPaymentsFromReportsAction(
          period.studentIds,
          period.month,
          period.year,
          payuChannel
        )
        sent += result.sent || 0
        failed += result.failed || 0
      }

      if (sent > 0) {
        toast.success(
          `Wysłano ${sent} ${sent === 1 ? 'płatność PayU' : 'płatności PayU'}`
        )
        if (failed > 0) {
          toast.warning(
            `Nie udało się wysłać ${failed} ${failed === 1 ? 'płatności' : 'płatności'}`
          )
        }
        setSelectedIds(new Set())
        setPayuDialogOpen(false)
        router.refresh()
      } else {
        toast.error('Nie udało się wysłać płatności')
      }
    } catch (error) {
      console.error('[handleSendPayu] Error:', error)
      toast.error('Wystąpił błąd podczas wysyłania płatności')
    } finally {
      setSendingPayu(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <Input
            placeholder="Szukaj po uczniu, rodzicu, przedmiocie lub tutorze..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={periodFilter}
            onValueChange={setPeriodFilter}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Okres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie okresy</SelectItem>
              {periodOptions.years.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Lata</SelectLabel>
                  {periodOptions.years.map((year) => (
                    <SelectItem key={`year:${year}`} value={`year:${year}`}>
                      Cały rok {year}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {periodOptions.months.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Miesiące</SelectLabel>
                  {periodOptions.months.map((m) => (
                    <SelectItem key={`month:${m.key}`} value={`month:${m.key}`}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <Button
            onClick={handleMarkAsPaid}
            variant="outline"
            size="sm"
            disabled={selectedIds.size === 0}
          >
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
          <Button
            onClick={handleOpenPayuDialog}
            variant="default"
            size="sm"
            disabled={selectedIds.size === 0}
          >
            Wyślij płatność PayU {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
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
              <TableHead>
                <button
                  onClick={() => handleSort('month')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Okres
                  <SortIcon field="month" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('student')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Uczeń
                  <SortIcon field="student" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('subject')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Przedmiot
                  <SortIcon field="subject" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('tutor')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Tutor
                  <SortIcon field="tutor" />
                </button>
              </TableHead>
              <TableHead>Rodzic</TableHead>
              <TableHead className="text-right">Godz.</TableHead>
              <TableHead className="text-right">Należność</TableHead>
              <TableHead className="text-right">Zapłacono</TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort('balance')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                >
                  Saldo
                  <SortIcon field="balance" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Stan rozliczenia
                  <SortIcon field="status" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayBillings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  {billings.length === 0 
                    ? 'Brak rozliczeń do wyświetlenia'
                    : 'Brak wyników wyszukiwania'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedBillings.map((billing) => {
                const hasTutorHours = !!(billing.tutor_hours && billing.tutor_hours.length > 0)
                const tutorHoursExpanded = expandedTutorHoursIds.has(billing.id)
                const isYearAggregate = billing.billing_periods.month === 0

                return (
                  <React.Fragment key={billing.id}>
                    <TableRow>
                      <TableCell className="w-12">
                        <Checkbox
                          checked={selectedIds.has(billing.id)}
                          onCheckedChange={() => toggleSelectOne(billing.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap text-sm">
                          {isYearAggregate
                            ? `Cały rok ${billing.billing_periods.year}`
                            : `${monthNames[billing.billing_periods.month]} ${billing.billing_periods.year}`}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        <StudentNameLink
                          student={billing.students}
                          isAdmin
                        />
                      </TableCell>
                      <TableCell>
                        {billing.categories && billing.categories.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {billing.categories.map((category, idx) => (
                              <div key={idx}>
                                <div className="font-medium text-sm">{category.subject_name}</div>
                                {category.level_name && (
                                  <div className="text-xs text-muted-foreground">
                                    {category.level_name}
                                  </div>
                                )}
                              </div>
                            ))}
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
                        {billing.parents && billing.parents.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {billing.parents.map((parent) => (
                              <Badge key={parent.id} variant="outline" className="text-xs">
                                {parent.first_name} {parent.last_name}
                              </Badge>
                            ))}
                          </div>
                        ) : billing.parent ? (
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
                        <div className="flex flex-col items-end gap-2">
                          <span className="whitespace-nowrap">
                            {formatHours(billing.hours_this_month)} h
                          </span>
                          {hasTutorHours && (
                            <button
                              type="button"
                              onClick={() => toggleTutorHoursExpanded(billing.id)}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                              aria-expanded={tutorHoursExpanded}
                              aria-controls={`${billing.id}--tutor-hours`}
                            >
                              {tutorHoursExpanded ? 'Ukryj wg tutorów' : 'Pokaż wg tutorów'}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(billing.total_due.toFixed(2))} zł
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(billing.total_paid.toFixed(2))} zł
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {parseFloat(billing.balance.toFixed(2))} zł
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={statusColors[billing.status]}
                          variant="outline"
                        >
                          {statusLabels[billing.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {hasTutorHours && tutorHoursExpanded && (
                      <TableRow>
                        <TableCell className="w-12" />
                        <TableCell colSpan={10}>
                          <div className="py-2" id={`${billing.id}--tutor-hours`}>
                            <div className="text-xs text-muted-foreground mb-2">
                              Godziny ucznia z podziałem na tutorów
                            </div>
                            <div className="grid gap-1">
                              {(billing.tutor_hours || []).map((th) => (
                                <div key={th.tutor_id} className="text-sm">
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
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {displayBillings.length > ITEMS_PER_PAGE && (
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

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                )
                .map((page, index, array) => {
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
        currentMonth={paymentDialogMonth}
        currentYear={paymentDialogYear}
        initialStudentId={paymentDialogStudentId}
        onSuccess={handlePaymentSuccess}
      />

      {/* PayU Dialog */}
      <Dialog open={payuDialogOpen} onOpenChange={setPayuDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wyślij płatności PayU</DialogTitle>
            <DialogDescription>
              Poniżej widzisz dokładną treść wiadomości, która zostanie wysłana.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Wybrano <strong>{isYearView ? selectedIds.size : selectedBillings.length}</strong>{' '}
              {isYearView
                ? selectedIds.size === 1
                  ? 'ucznia'
                  : 'uczniów'
                : selectedBillings.length === 1
                  ? 'rozliczenie'
                  : 'rozliczeń'}
              {isYearView ? ' • jedna płatność z sumą za rok' : ''} • Łączna kwota:{' '}
              <strong>
                {(isYearView
                  ? payuPreviews.reduce((s, p) => s + p.amount, 0) || selectedTotal
                  : selectedTotal
                ).toFixed(2)}{' '}
                zł
              </strong>
            </div>

            {payuPreviewLoading ? (
              <div className="text-sm text-muted-foreground">Generowanie podglądu...</div>
            ) : (
              <>
                {payuPreviewError && (
                  <div className="p-3 border border-destructive/50 bg-destructive/10 rounded-md">
                    <pre className="text-xs whitespace-pre-wrap text-destructive">{payuPreviewError}</pre>
                  </div>
                )}
                {payuPreviews.length === 0 && !payuPreviewError ? (
                  <div className="text-sm text-muted-foreground">Brak podglądu do wyświetlenia.</div>
                ) : payuPreviews.length > 0 ? (
                  <div className="space-y-3 max-h-[420px] overflow-auto pr-2">
                    {payuPreviews.map((p) => (
                      <div key={`${p.studentId}-${p.month}-${p.year}-${p.periodLabel || ''}`} className="rounded-md border p-3 space-y-2">
                        <div className="text-sm">
                          <div className="font-medium">{p.studentName}</div>
                          <div className="text-xs text-muted-foreground">
                            Opiekun: {p.parentName}
                            {p.toEmail ? ` • ${p.toEmail}` : ''}
                            {p.toPhone ? ` • ${p.toPhone}` : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Kwota: {p.amount.toFixed(2)} zł • Okres:{' '}
                            {p.periodLabel ||
                              `${monthNames[p.month] || p.month} ${p.year}`}
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
                                title={`email-preview-${p.studentId}-${p.month}-${p.year}`}
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
                ) : null}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayuDialogOpen(false)} disabled={sendingPayu}>
              Anuluj
            </Button>
            <Button onClick={handleSendPayu} disabled={sendingPayu || payuPreviews.length === 0}>
              {sendingPayu ? 'Wysyłanie...' : 'Wyślij płatności'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComposeSendDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        title="Wyślij przypomnienie o płatności"
        description={
          composeMode === 'group'
            ? `Wyślij przypomnienie dla ${selectedIds.size} ${selectedIds.size === 1 ? 'rozliczenia' : 'rozliczeń'}`
            : 'Wyślij przypomnienie do wybranego rozliczenia'
        }
        defaultMessage={composeDefaultMessage}
        defaultChannel={composeChannel}
        stats={composeStats}
        messagePlaceholder="Wpisz treść przypomnienia..."
        confirmLabel="Wyślij przypomnienie"
        onSend={async ({ message, channel }) => {
          setComposeChannel(channel)

          if (composeMode === 'single' && composeTarget) {
            const result = await sendReminderAction(
              composeTarget.studentId,
              composeTarget.billingPeriodId,
              channel,
              message
            )
            if (result.success) {
              toast.success('Przypomnienie wysłane')
              if (result.error) toast.warning(result.error)
            } else {
              toast.error(result.error || 'Nie udało się wysłać przypomnienia')
              throw new Error(result.error || 'Nie udało się wysłać przypomnienia')
            }
            return
          }

          if (selectedIds.size === 0) return
          const monthlyIds = resolveSelectedMonthlyIds()
          if (monthlyIds.length === 0) return
          const result = await sendGroupRemindersAction(monthlyIds, channel, message)
          if (result.success) {
            toast.success(`Wysłano ${result.sent} przypomnień`)
          } else {
            toast.warning(`Wysłano ${result.sent} przypomnień, ${result.failed} błędów`)
          }
          if (result.warnings?.length) {
            console.error('Warnings sending reminders:', result.warnings)
          }
          setSelectedIds(new Set())
          router.refresh()
        }}
      />
    </div>
  )
}
