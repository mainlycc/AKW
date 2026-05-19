'use server'

import { createClient } from '@/lib/supabase/server'
import { getDefaultTutorRate } from '@/app/(dashboard)/dashboard/stawki/actions'
import { exportReportsToCSV } from '@/app/(dashboard)/dashboard/raporty-tutorow/actions'

export type TutorSettlementStatus = 'approved' | 'paid'

export interface TutorSettlementRow {
  report_id: string
  tutor_id: string
  tutor_name: string
  month: number
  year: number
  status: TutorSettlementStatus
  total_hours: number
  hourly_rate: number
  total_amount: number
}

type ReportProfileRow = {
  id: string
  full_name: string | null
  hourly_rate: number | string | null
}

type MonthlyReportRow = {
  id: string
  tutor_id: string
  month: number
  year: number
  status: TutorSettlementStatus
  total_hours: number | string
  total_amount: number | string | null
  profiles: ReportProfileRow | ReportProfileRow[] | null
}

function coerceNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

export async function getTutorSettlements(params: {
  month: number
  year: number
  status?: TutorSettlementStatus
}): Promise<TutorSettlementRow[]> {
  const supabase = await createClient()

  const defaultTutorRate = await getDefaultTutorRate()

  const statusFilter: TutorSettlementStatus[] = params.status
    ? [params.status]
    : ['approved', 'paid']

  const { data, error } = await supabase
    .from('monthly_reports')
    .select(
      `
      id,
      tutor_id,
      month,
      year,
      status,
      total_hours,
      total_amount,
      profiles!monthly_reports_tutor_id_fkey (
        id,
        full_name,
        hourly_rate
      )
    `
    )
    .eq('month', params.month)
    .eq('year', params.year)
    .in('status', statusFilter)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Błąd pobierania rozliczeń tutorów: ${error.message}`)
  }

  const rows: TutorSettlementRow[] = ((data || []) as MonthlyReportRow[])
    .map((r) => {
      const profileData = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      if (!profileData) return null

      const tutorHourlyRateRaw = profileData.hourly_rate
      const hourlyRate =
        tutorHourlyRateRaw === null || tutorHourlyRateRaw === undefined
          ? defaultTutorRate ?? 0
          : coerceNumber(tutorHourlyRateRaw)

      const totalHours = coerceNumber(r.total_hours)
      const totalAmount = totalHours * hourlyRate

      return {
        report_id: r.id,
        tutor_id: r.tutor_id,
        tutor_name: profileData.full_name || '(brak)',
        month: r.month,
        year: r.year,
        status: r.status as TutorSettlementStatus,
        total_hours: totalHours,
        hourly_rate: hourlyRate,
        total_amount: totalAmount,
      } satisfies TutorSettlementRow
    })
    .filter(Boolean) as TutorSettlementRow[]

  rows.sort((a, b) =>
    a.tutor_name.localeCompare(b.tutor_name, 'pl', { sensitivity: 'base' })
  )

  return rows
}

export async function exportTutorSettlementsToCSV(rows: TutorSettlementRow[]) {
  return await exportReportsToCSV(
    rows.map((r) => ({
      tutor_name: r.tutor_name,
      month: r.month,
      year: r.year,
      total_hours: r.total_hours,
      hourly_rate: r.hourly_rate,
      total_amount: r.total_amount,
      status: r.status,
    }))
  )
}

