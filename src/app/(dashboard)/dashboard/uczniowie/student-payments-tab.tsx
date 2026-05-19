'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LABELS } from '@/lib/labels/reports-declarations'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { IconPlus } from '@tabler/icons-react'
import type { BillingStatus } from '@/lib/actions/billing'
import type { StudentPaymentOverview } from '@/lib/actions/student-payment-overview'
import type { Payment } from '@/lib/actions/payments'
import {
  lessonPaymentStatusLabels,
  type LessonPaymentStatus,
} from '@/lib/billing/lesson-payment-status'
import { PaymentDialog } from '@/app/(dashboard)/dashboard/billing/payment-dialog'
import {
  getCachedPaymentOverview,
  isPaymentOverviewCacheFresh,
  setCachedPaymentOverview,
  invalidatePaymentOverviewCache,
} from './payment-overview-cache'
import type { LessonHistoryItem } from './lesson-history-cache'
import { formatHours } from '@/lib/utils'

const monthLabels: Record<number, string> = {
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

const billingStatusLabels: Record<BillingStatus, string> = {
  paid: 'Opłacone',
  partially_paid: 'Częściowo opłacone',
  unpaid: 'Nieopłacone',
}

const billingStatusColors: Record<BillingStatus, string> = {
  paid: 'bg-green-500/10 text-green-700 dark:text-green-400',
  partially_paid: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  unpaid: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

const lessonPaymentBadgeColors: Record<LessonPaymentStatus, string> = {
  paid: 'bg-green-500/10 text-green-700 dark:text-green-400',
  unpaid: 'bg-red-500/10 text-red-700 dark:text-red-400',
  partially_covered: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  no_billing: 'bg-muted text-muted-foreground',
}

const paymentMethodLabels: Record<Payment['payment_method'], string> = {
  transfer: 'Przelew',
  cash: 'Gotówka',
  online: 'Online',
}

interface StudentPaymentsTabProps {
  studentId: string
  student: {
    id: string
    first_name: string
    last_name: string
  }
  lessons: LessonHistoryItem[] | null
  primaryParent?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
  }
}

export function StudentPaymentsTab({
  studentId,
  student,
  lessons,
  primaryParent,
}: StudentPaymentsTabProps) {
  const router = useRouter()
  const [overview, setOverview] = useState<StudentPaymentOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [billingSource, setBillingSource] = useState<'reports' | 'declarations'>('reports')
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentDialogMonth, setPaymentDialogMonth] = useState(new Date().getMonth() + 1)
  const [paymentDialogYear, setPaymentDialogYear] = useState(new Date().getFullYear())

  useEffect(() => {
    const controller = new AbortController()
    const cached = getCachedPaymentOverview(studentId)
    const cacheFresh = isPaymentOverviewCacheFresh(studentId)

    if (cached) {
      setOverview(cached)
      setBillingSource(cached.defaultSource)
      setLoading(false)
      setError(null)
    } else {
      setOverview(null)
      setLoading(true)
    }

    if (cacheFresh) {
      return () => controller.abort()
    }

    const load = async () => {
      try {
        if (!cached) setLoading(true)
        setError(null)

        const res = await fetch(`/api/students/${studentId}/payment-overview`, {
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error('Nie udało się pobrać danych płatności')
        }

        const data = (await res.json()) as StudentPaymentOverview
        setCachedPaymentOverview(studentId, data)
        setOverview(data)
        setBillingSource(data.defaultSource)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Błąd ładowania')
      } finally {
        setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [studentId])

  const activePeriods = useMemo(() => {
    if (!overview) return []
    return billingSource === 'reports'
      ? overview.sources.reports
      : overview.sources.declarations
  }, [overview, billingSource])

  const balanceDue = useMemo(
    () => activePeriods.reduce((sum, p) => sum + Math.max(0, p.balance), 0),
    [activePeriods]
  )

  const totalPaidLifetime = useMemo(
    () => overview?.payments.reduce((sum, p) => sum + p.amount, 0) ?? 0,
    [overview]
  )

  const overduePeriodsCount = useMemo(
    () => activePeriods.filter((p) => p.balance > 0).length,
    [activePeriods]
  )

  const lessonHints = useMemo(() => {
    if (!overview) return {}
    return billingSource === 'reports'
      ? overview.lessonPaymentHints.reports
      : overview.lessonPaymentHints.declarations
  }, [overview, billingSource])

  const completedLessons = useMemo(
    () =>
      (lessons ?? [])
        .filter((l) => l.status === 'completed')
        .sort(
          (a, b) =>
            new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
        ),
    [lessons]
  )

  const studentsForDialog = useMemo(
    () => [
      {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        parent: primaryParent,
      },
    ],
    [student, primaryParent]
  )

  const handleAddPayment = (month: number, year: number) => {
    setPaymentDialogMonth(month)
    setPaymentDialogYear(year)
    setPaymentDialogOpen(true)
  }

  const handlePaymentSuccess = () => {
    invalidatePaymentOverviewCache(studentId)
    setPaymentDialogOpen(false)
    setOverview(null)
    setLoading(true)
    router.refresh()
    fetch(`/api/students/${studentId}/payment-overview`)
      .then((res) => res.json())
      .then((data: StudentPaymentOverview) => {
        setCachedPaymentOverview(studentId, data)
        setOverview(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  if (loading && !overview) {
    return (
      <p className="text-xs text-muted-foreground italic py-4">
        Ładowanie danych płatności...
      </p>
    )
  }

  if (error && !overview) {
    return <p className="text-xs text-destructive py-4">{error}</p>
  }

  if (!overview) return null

  const hasConflictInView = activePeriods.some((p) =>
    overview.conflictingPeriodKeys.includes(`${p.year}-${p.month}`)
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Saldo do zapłaty
          </p>
          <p className="text-lg font-bold text-foreground mt-0.5">
            {balanceDue.toFixed(2)} zł
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Łącznie wpłacono
          </p>
          <p className="text-lg font-bold text-foreground mt-0.5">
            {totalPaidLifetime.toFixed(2)} zł
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Okresy z zaległością
          </p>
          <p className="text-lg font-bold text-foreground mt-0.5">
            {overduePeriodsCount}
          </p>
        </div>
      </div>

      <Tabs
        value={billingSource}
        onValueChange={(v) => setBillingSource(v as 'reports' | 'declarations')}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reports">
            {LABELS.completedLessons} ({overview.sources.reports.length})
          </TabsTrigger>
          <TabsTrigger value="declarations">
            {LABELS.nextMonthPlans} ({overview.sources.declarations.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {hasConflictInView && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-md px-3 py-2">
          {LABELS.hoursMismatchWarning} aktywny tryb rozliczeń.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Okresy rozliczeniowe</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              const now = new Date()
              handleAddPayment(now.getMonth() + 1, now.getFullYear())
            }}
          >
            <IconPlus className="h-3.5 w-3.5 mr-1" />
            Dodaj wpłatę
          </Button>
        </div>

        {activePeriods.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Brak rozliczeń w tym źródle.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Okres</TableHead>
                  <TableHead className="text-xs text-right">Godz.</TableHead>
                  <TableHead className="text-xs text-right">Należność</TableHead>
                  <TableHead className="text-xs text-right">Wpłacono</TableHead>
                  <TableHead className="text-xs text-right">Saldo</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePeriods.map((period) => (
                  <TableRow key={`${period.year}-${period.month}`}>
                    <TableCell className="text-xs font-medium py-2">
                      {monthLabels[period.month]} {period.year}
                    </TableCell>
                    <TableCell className="text-xs text-right py-2">
                      {formatHours(period.hours)} h
                    </TableCell>
                    <TableCell className="text-xs text-right py-2">
                      {period.totalDue.toFixed(2)} zł
                    </TableCell>
                    <TableCell className="text-xs text-right py-2">
                      {period.totalPaid.toFixed(2)} zł
                    </TableCell>
                    <TableCell className="text-xs text-right py-2 font-medium">
                      {period.balance.toFixed(2)} zł
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${billingStatusColors[period.status]}`}
                      >
                        {billingStatusLabels[period.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title="Dodaj wpłatę za ten okres"
                        onClick={() => handleAddPayment(period.month, period.year)}
                      >
                        <IconPlus className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Historia płatności</h3>
        {overview.payments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Brak wpłat.</p>
        ) : (
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {overview.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-medium">
                    {format(new Date(payment.payment_date), 'dd.MM.yyyy', {
                      locale: pl,
                    })}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    {monthLabels[payment.billing_periods.month]}{' '}
                    {payment.billing_periods.year}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    · {paymentMethodLabels[payment.payment_method]}
                  </span>
                </div>
                <span className="font-semibold shrink-0">
                  {payment.amount.toFixed(2)} zł
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Lekcje a rozliczenie</h3>
        {completedLessons.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Brak potwierdzonych lekcji.
          </p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {completedLessons.slice(0, 30).map((lesson) => {
              const paymentStatus = lessonHints[lesson.id] ?? 'no_billing'
              return (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">
                        {format(new Date(lesson.session_date), 'dd.MM.yyyy HH:mm', {
                          locale: pl,
                        })}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {lesson.duration_minutes} min
                      </span>
                    </div>
                    {(lesson.subject_name || lesson.tutor_name) && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[lesson.subject_name, lesson.tutor_name]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 shrink-0 ${lessonPaymentBadgeColors[paymentStatus]}`}
                  >
                    {lessonPaymentStatusLabels[paymentStatus]}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        students={studentsForDialog}
        currentMonth={paymentDialogMonth}
        currentYear={paymentDialogYear}
        initialStudentId={student.id}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  )
}
