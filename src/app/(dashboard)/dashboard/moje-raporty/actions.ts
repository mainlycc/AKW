'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

