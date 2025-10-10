'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function approveReport(reportId: string, adminId: string) {
  const supabase = await createClient()

  // Get report with tutor hourly rate
  const { data: report } = await supabase
    .from('monthly_reports')
    .select(`
      total_hours,
      profiles!monthly_reports_tutor_id_fkey (
        hourly_rate
      )
    `)
    .eq('id', reportId)
    .single()

  if (!report) throw new Error('Report not found')

  const profiles = report.profiles as unknown as { hourly_rate: number } | null
  const hourlyRate = profiles?.hourly_rate || 0
  const totalAmount = report.total_hours * hourlyRate

  const { error } = await supabase
    .from('monthly_reports')
    .update({
      status: 'approved',
      total_amount: totalAmount,
      approved_at: new Date().toISOString(),
      approved_by: adminId,
    })
    .eq('id', reportId)

  if (error) throw error

  revalidatePath('/dashboard/raporty-tutorow')
}

export async function markAsPaid(reportId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('monthly_reports')
    .update({
      status: 'paid',
    })
    .eq('id', reportId)

  if (error) throw error

  revalidatePath('/dashboard/raporty-tutorow')
}

export async function exportReportsToCSV(reports: {
  tutor_name: string
  month: number
  year: number
  total_hours: number
  hourly_rate: number
  total_amount: number
  status: string
}[]) {
  const headers = ['Tutor', 'Miesiąc', 'Rok', 'Godziny', 'Stawka (zł/h)', 'Kwota (zł)', 'Status']
  const rows = reports.map(r => [
    r.tutor_name,
    r.month,
    r.year,
    r.total_hours.toFixed(2),
    r.hourly_rate.toFixed(2),
    r.total_amount.toFixed(2),
    r.status,
  ])

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  return csv
}

