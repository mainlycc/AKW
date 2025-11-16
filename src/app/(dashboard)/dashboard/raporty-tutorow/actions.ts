'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/actions/notifications'

export async function approveReport(reportId: string, adminId: string) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Get report with tutor hourly rate
  const { data: report } = await supabase
    .from('monthly_reports')
    .select(`
      tutor_id,
      month,
      year,
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

  // Powiadomienie dla tutora o zatwierdzeniu raportu
  try {
    if (report.tutor_id) {
      const monthNames = [
        'Styczeń',
        'Luty',
        'Marzec',
        'Kwiecień',
        'Maj',
        'Czerwiec',
        'Lipiec',
        'Sierpień',
        'Wrzesień',
        'Październik',
        'Listopad',
        'Grudzień',
      ]
      const monthName = monthNames[report.month - 1] || report.month.toString()

      await createNotification({
        userId: report.tutor_id,
        type: 'report_approved',
        title: 'Raport zatwierdzony',
        message: `Twój raport za ${monthName} ${report.year} został zatwierdzony. Kwota do wypłaty: ${totalAmount.toFixed(2)} zł`,
        metadata: {
          report_id: reportId,
          month: report.month,
          year: report.year,
          total_hours: report.total_hours,
          total_amount: totalAmount,
        },
      })
    }
  } catch (notificationError) {
    // Logujemy błąd, ale nie przerywamy procesu
    console.error('Failed to create notification:', notificationError)
  }

  revalidatePath('/dashboard/raporty-tutorow')
}

export async function markAsPaid(reportId: string) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Pobierz dane raportu przed aktualizacją
  const { data: report } = await supabase
    .from('monthly_reports')
    .select('tutor_id, month, year, total_amount')
    .eq('id', reportId)
    .single()

  const { error } = await supabase
    .from('monthly_reports')
    .update({
      status: 'paid',
    })
    .eq('id', reportId)

  if (error) throw error

  // Powiadomienie dla tutora o oznaczeniu jako opłacony
  try {
    if (report?.tutor_id) {
      const monthNames = [
        'Styczeń',
        'Luty',
        'Marzec',
        'Kwiecień',
        'Maj',
        'Czerwiec',
        'Lipiec',
        'Sierpień',
        'Wrzesień',
        'Październik',
        'Listopad',
        'Grudzień',
      ]
      const monthName = monthNames[report.month - 1] || report.month.toString()

      await createNotification({
        userId: report.tutor_id,
        type: 'report_paid',
        title: 'Raport opłacony',
        message: `Raport za ${monthName} ${report.year} został oznaczony jako opłacony. Wypłacona kwota: ${report.total_amount?.toFixed(2) || '0.00'} zł`,
        metadata: {
          report_id: reportId,
          month: report.month,
          year: report.year,
          total_amount: report.total_amount,
        },
      })
    }
  } catch (notificationError) {
    // Logujemy błąd, ale nie przerywamy procesu
    console.error('Failed to create notification:', notificationError)
  }

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

