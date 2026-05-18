'use server'

import { createClient } from '@/lib/supabase/server'
import {
  getStudentBillingsFromReports,
  getStudentBillingsFromDeclarations,
  type BillingStatus,
  type StudentBillingWithParent,
} from '@/lib/actions/billing'
import { getPayments, type Payment } from '@/lib/actions/payments'
import {
  allocateLessonPaymentStatus,
  type LessonForPaymentStatus,
  type LessonPaymentStatus,
} from '@/lib/billing/lesson-payment-status'

export interface StudentBillingPeriodSummary {
  month: number
  year: number
  billingPeriodId: string
  hours: number
  totalDue: number
  totalPaid: number
  balance: number
  status: BillingStatus
}

export interface StudentPaymentOverview {
  mergedStudentIds: string[]
  hourlyRate: number
  sources: {
    reports: StudentBillingPeriodSummary[]
    declarations: StudentBillingPeriodSummary[]
  }
  payments: Payment[]
  lessonPaymentHints: {
    reports: Record<string, LessonPaymentStatus>
    declarations: Record<string, LessonPaymentStatus>
  }
  defaultSource: 'reports' | 'declarations'
  conflictingPeriodKeys: string[]
}

function normalizeName(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()} ${lastName.trim().toLowerCase()}`.replace(/\s+/g, ' ')
}

function periodKey(month: number, year: number): string {
  return `${year}-${month}`
}

function findBillingForStudent(
  billings: StudentBillingWithParent[],
  mergedIds: Set<string>,
  firstName: string,
  lastName: string
): StudentBillingWithParent | null {
  const normalized = normalizeName(firstName, lastName)

  const matches = billings.filter((b) => {
    if (mergedIds.has(b.student_id)) return true
    const bName = normalizeName(b.students.first_name, b.students.last_name)
    return bName === normalized
  })

  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  const first = matches[0]
  const totalDue = matches.reduce((s, b) => s + b.total_due, 0)
  const totalPaid = matches.reduce((s, b) => s + b.total_paid, 0)
  const balance = totalDue - totalPaid
  let status: BillingStatus = 'unpaid'
  if (totalDue === 0) status = 'unpaid'
  else if (balance <= 0) status = 'paid'
  else if (totalPaid > 0) status = 'partially_paid'

  const hours = matches.reduce((s, b) => s + (b.hours_this_month || 0), 0)

  return {
    ...first,
    total_due: totalDue,
    total_paid: totalPaid,
    balance,
    status,
    hours_this_month: hours,
    total_hours: hours,
  }
}

function billingToSummary(billing: StudentBillingWithParent): StudentBillingPeriodSummary {
  return {
    month: billing.billing_periods.month,
    year: billing.billing_periods.year,
    billingPeriodId: billing.billing_period_id,
    hours: billing.hours_this_month || billing.total_hours || 0,
    totalDue: billing.total_due,
    totalPaid: billing.total_paid,
    balance: billing.balance,
    status: billing.status,
  }
}

async function getMergedStudentIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string
): Promise<string[]> {
  const { data: matchingStudents, error } = await supabase.rpc(
    'get_student_history_student_ids',
    { p_student_id: studentId }
  )

  if (error) {
    console.error('get_student_history_student_ids error:', error)
    return [studentId]
  }

  const ids = new Set<string>([studentId])
  for (const row of matchingStudents || []) {
    if (row?.id) ids.add(row.id)
  }
  return Array.from(ids)
}

async function collectPeriodsFromReports(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mergedIds: string[]
): Promise<Array<{ month: number; year: number }>> {
  const { data: reports } = await supabase
    .from('monthly_reports')
    .select(
      `
      month,
      year,
      monthly_report_entries ( student_id )
    `
    )
    .in('status', ['approved', 'paid'])

  const periods = new Set<string>()
  for (const report of reports || []) {
    const entries = report.monthly_report_entries || []
    const hasStudent = entries.some(
      (e: { student_id: string }) => mergedIds.includes(e.student_id)
    )
    if (hasStudent) {
      periods.add(periodKey(report.month, report.year))
    }
  }

  return Array.from(periods).map((p) => {
    const [year, month] = p.split('-').map(Number)
    return { month, year }
  })
}

async function collectPeriodsFromDeclarations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mergedIds: string[]
): Promise<Array<{ month: number; year: number }>> {
  const { data: declarations } = await supabase
    .from('monthly_declarations')
    .select(
      `
      month,
      year,
      monthly_declaration_entries ( student_id )
    `
    )
    .in('status', ['submitted', 'approved'])

  const periods = new Set<string>()
  for (const declaration of declarations || []) {
    const entries = declaration.monthly_declaration_entries || []
    const hasStudent = entries.some(
      (e: { student_id: string }) => mergedIds.includes(e.student_id)
    )
    if (hasStudent) {
      periods.add(periodKey(declaration.month, declaration.year))
    }
  }

  return Array.from(periods).map((p) => {
    const [year, month] = p.split('-').map(Number)
    return { month, year }
  })
}

async function buildPeriodSummaries(
  periods: Array<{ month: number; year: number }>,
  fetchBillings: (month: number, year: number) => Promise<StudentBillingWithParent[]>,
  mergedIds: Set<string>,
  firstName: string,
  lastName: string
): Promise<StudentBillingPeriodSummary[]> {
  const summaries: StudentBillingPeriodSummary[] = []

  for (const { month, year } of periods) {
    try {
      const billings = await fetchBillings(month, year)
      const match = findBillingForStudent(billings, mergedIds, firstName, lastName)
      if (match && ((match.hours_this_month || 0) > 0 || match.total_due > 0)) {
        summaries.push(billingToSummary(match))
      }
    } catch (error) {
      console.error(`Error building period summary for ${month}/${year}:`, error)
    }
  }

  summaries.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    return b.month - a.month
  })

  return summaries
}

async function fetchCompletedSessions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mergedIds: string[]
): Promise<LessonForPaymentStatus[]> {
  const { data, error } = await supabase
    .from('tutoring_sessions')
    .select('id, session_date, duration_minutes, status')
    .in('student_id', mergedIds)
    .eq('status', 'completed')
    .order('session_date', { ascending: false })
    .limit(300)

  if (error) {
    console.error('Error fetching sessions for payment overview:', error)
    return []
  }

  return (data || []) as LessonForPaymentStatus[]
}

export async function getStudentPaymentOverview(
  studentId: string
): Promise<StudentPaymentOverview> {
  const supabase = await createClient()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, first_name, last_name, hourly_rate')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    throw new Error('Student not found')
  }

  const mergedStudentIds = await getMergedStudentIds(supabase, studentId)
  const mergedIds = new Set(mergedStudentIds)

  let hourlyRate = parseFloat(student.hourly_rate?.toString() || '0')
  if (!hourlyRate || isNaN(hourlyRate)) {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'default_student_rate')
      .maybeSingle()
    hourlyRate = setting?.value ? parseFloat(setting.value) : 50
    if (isNaN(hourlyRate)) hourlyRate = 50
  }

  const [reportPeriods, declarationPeriods] = await Promise.all([
    collectPeriodsFromReports(supabase, mergedStudentIds),
    collectPeriodsFromDeclarations(supabase, mergedStudentIds),
  ])

  const [reports, declarations, payments, sessions] = await Promise.all([
    buildPeriodSummaries(
      reportPeriods,
      getStudentBillingsFromReports,
      mergedIds,
      student.first_name,
      student.last_name
    ),
    buildPeriodSummaries(
      declarationPeriods,
      getStudentBillingsFromDeclarations,
      mergedIds,
      student.first_name,
      student.last_name
    ),
    getPayments({ studentIds: mergedStudentIds }),
    fetchCompletedSessions(supabase, mergedStudentIds),
  ])

  const conflictingPeriodKeys: string[] = []
  const reportsMap = new Map(reports.map((r) => [periodKey(r.month, r.year), r]))
  const declarationsMap = new Map(
    declarations.map((d) => [periodKey(d.month, d.year), d])
  )

  for (const key of reportsMap.keys()) {
    const decl = declarationsMap.get(key)
    const rep = reportsMap.get(key)
    if (decl && rep && Math.abs(rep.hours - decl.hours) > 0.01) {
      conflictingPeriodKeys.push(key)
    }
  }

  const defaultSource: 'reports' | 'declarations' =
    reports.length > 0 ? 'reports' : 'declarations'

  const toPeriodMap = (periods: StudentBillingPeriodSummary[]) =>
    new Map(
      periods.map((p) => [
        periodKey(p.month, p.year),
        {
          month: p.month,
          year: p.year,
          status: p.status,
          totalPaid: p.totalPaid,
          hourlyRate,
        },
      ])
    )

  const lessonPaymentHints = {
    reports: allocateLessonPaymentStatus(sessions, toPeriodMap(reports), hourlyRate),
    declarations: allocateLessonPaymentStatus(
      sessions,
      toPeriodMap(declarations),
      hourlyRate
    ),
  }

  return {
    mergedStudentIds,
    hourlyRate,
    sources: { reports, declarations },
    payments,
    lessonPaymentHints,
    defaultSource,
    conflictingPeriodKeys,
  }
}
