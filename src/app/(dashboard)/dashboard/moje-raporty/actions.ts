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

  let reportId: string

  if (existing) {
    // Update existing report
    await supabase
      .from('monthly_reports')
      .update({
        total_hours: totalHours,
        status,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
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
        status,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
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

  // Powiadomienie dla adminów gdy raport jest wysłany
  if (status === 'submitted') {
    try {
      // Pobierz wszystkich adminów
      const admin = createAdminClient()
      const { data: admins } = await admin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')

      if (admins && admins.length > 0) {
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

        // Utwórz powiadomienia dla wszystkich adminów
        await Promise.all(
          admins.map((adminProfile) =>
            createNotification({
              userId: adminProfile.id,
              type: 'report_submitted',
              title: 'Nowy raport do zatwierdzenia',
              message: `Tutor wysłał raport za ${monthName} ${year} (${totalHours.toFixed(1)} godzin)`,
              metadata: {
                report_id: reportId,
                tutor_id: tutorId,
                month,
                year,
                total_hours: totalHours,
              },
            })
          )
        )
      }
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

