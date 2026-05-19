import type { BillingStatus } from '@/lib/actions/billing'

export type LessonPaymentStatus =
  | 'paid'
  | 'unpaid'
  | 'partially_covered'
  | 'no_billing'

export interface LessonForPaymentStatus {
  id: string
  session_date: string
  duration_minutes: number
  status: 'completed' | 'scheduled' | 'cancelled'
}

export interface PeriodBillingForLessons {
  month: number
  year: number
  status: BillingStatus
  totalPaid: number
  hourlyRate: number
}

function periodKey(month: number, year: number): string {
  return `${year}-${month}`
}

/**
 * FIFO allocation: within a partially paid month, oldest completed lessons
 * are marked covered until paid hours are exhausted.
 */
export function allocateLessonPaymentStatus(
  sessions: LessonForPaymentStatus[],
  periodMap: Map<string, PeriodBillingForLessons>,
  defaultHourlyRate: number
): Record<string, LessonPaymentStatus> {
  const result: Record<string, LessonPaymentStatus> = {}

  const completed = sessions.filter((s) => s.status === 'completed')
  const byPeriod = new Map<string, LessonForPaymentStatus[]>()

  for (const session of completed) {
    const date = new Date(session.session_date)
    const key = periodKey(date.getMonth() + 1, date.getFullYear())
    if (!byPeriod.has(key)) byPeriod.set(key, [])
    byPeriod.get(key)!.push(session)
  }

  for (const [key, periodSessions] of byPeriod) {
    const billing = periodMap.get(key)
    if (!billing) {
      for (const s of periodSessions) result[s.id] = 'no_billing'
      continue
    }

    const hourlyRate = billing.hourlyRate > 0 ? billing.hourlyRate : defaultHourlyRate

    if (billing.status === 'paid') {
      for (const s of periodSessions) result[s.id] = 'paid'
      continue
    }

    if (billing.status === 'unpaid') {
      for (const s of periodSessions) result[s.id] = 'unpaid'
      continue
    }

    // partially_paid — FIFO by session date ascending
    const sorted = [...periodSessions].sort(
      (a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
    )
    const paidHours = hourlyRate > 0 ? billing.totalPaid / hourlyRate : 0
    let coveredHours = 0

    for (const session of sorted) {
      const sessionHours = (session.duration_minutes || 0) / 60
      if (coveredHours + sessionHours <= paidHours + 1e-9) {
        result[session.id] = 'paid'
        coveredHours += sessionHours
      } else if (coveredHours < paidHours) {
        result[session.id] = 'partially_covered'
        coveredHours += sessionHours
      } else {
        result[session.id] = 'unpaid'
      }
    }
  }

  return result
}

export const lessonPaymentStatusLabels: Record<LessonPaymentStatus, string> = {
  paid: 'Opłacone',
  unpaid: 'Nieopłacone',
  partially_covered: 'Częściowo opłacone',
  no_billing: 'Brak rozliczenia',
}
