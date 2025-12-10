'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/actions/notifications'

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'paid'

export async function createOrUpdateReport(
  tutorId: string,
  month: number,
  year: number,
  entries: { student_id: string; hours: number }[],
  status: ReportStatus = 'draft'
) {
  const supabase = await createClient()

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)

  // Check if report exists
  const { data: existing } = await supabase
    .from('monthly_reports')
    .select('id')
    .eq('tutor_id', tutorId)
    .eq('month', month)
    .eq('year', year)
    .single()

  // Jeśli raport jest składany, automatycznie go zatwierdzamy
  const shouldAutoApprove = status === 'submitted'
  const finalStatus = shouldAutoApprove ? 'approved' : status

  // Pobierz dane potrzebne do automatycznego zatwierdzania
  let adminId: string | null = null
  let hourlyRate: number = 0
  let totalAmount: number = 0

  if (shouldAutoApprove) {
    try {
      // Pobierz pierwszego admina
      const admin = createAdminClient()
      const { data: admins } = await admin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)

      if (admins && admins.length > 0) {
        adminId = admins[0].id
      }

      // Pobierz stawkę godzinową tutora
      const { data: tutorProfile } = await supabase
        .from('profiles')
        .select('hourly_rate')
        .eq('id', tutorId)
        .single()

      hourlyRate = tutorProfile?.hourly_rate || 0
      totalAmount = totalHours * hourlyRate
    } catch (error) {
      console.error('Failed to get admin or tutor rate:', error)
      // Kontynuujemy bez automatycznego zatwierdzania jeśli nie udało się pobrać danych
    }
  }

  let reportId: string

  if (existing) {
    // Update existing report
    await supabase
      .from('monthly_reports')
      .update({
        total_hours: totalHours,
        status: finalStatus,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
        ...(shouldAutoApprove && adminId ? {
          approved_at: new Date().toISOString(),
          approved_by: adminId,
          total_amount: totalAmount,
        } : {}),
      })
      .eq('id', existing.id)

    // Delete old entries
    await supabase
      .from('monthly_report_entries')
      .delete()
      .eq('report_id', existing.id)

    // Insert new entries
    if (entries.length > 0) {
      await supabase
        .from('monthly_report_entries')
        .insert(
          entries.map(e => ({
            report_id: existing.id,
            student_id: e.student_id,
            hours: e.hours,
          }))
        )
    }
    reportId = existing.id
  } else {
    // Create new report
    const { data: report, error } = await supabase
      .from('monthly_reports')
      .insert({
        tutor_id: tutorId,
        month,
        year,
        total_hours: totalHours,
        status: finalStatus,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
        ...(shouldAutoApprove && adminId ? {
          approved_at: new Date().toISOString(),
          approved_by: adminId,
          total_amount: totalAmount,
        } : {}),
      })
      .select()
      .single()

    if (error) throw error

    // Insert entries
    if (entries.length > 0) {
      await supabase
        .from('monthly_report_entries')
        .insert(
          entries.map(e => ({
            report_id: report.id,
            student_id: e.student_id,
            hours: e.hours,
          }))
        )
    }
    reportId = report.id
  }

  // Powiadomienie dla tutora o zatwierdzeniu raportu (gdy automatycznie zatwierdzony)
  if (shouldAutoApprove && adminId) {
    try {
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
      const monthName = monthNames[month - 1] || month.toString()

      await createNotification({
        userId: tutorId,
        type: 'report_approved',
        title: 'Raport zatwierdzony',
        message: `Twój raport za ${monthName} ${year} został automatycznie zatwierdzony. Kwota do wypłaty: ${totalAmount.toFixed(2)} zł`,
        metadata: {
          report_id: reportId,
          month,
          year,
          total_hours: totalHours,
          total_amount: totalAmount,
        },
        skipRevalidate: true,
      })
    } catch (notificationError) {
      // Logujemy błąd, ale nie przerywamy procesu
      console.error('Failed to create notification:', notificationError)
    }
  }

  revalidatePath('/dashboard/moje-raporty')
}

export async function deleteReport(reportId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('monthly_reports')
    .delete()
    .eq('id', reportId)

  if (error) throw error

  revalidatePath('/dashboard/moje-raporty')
}

