'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/actions/notifications'
import { sendReportReminderEmail } from '@/lib/email/send'

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

export async function autoApproveSubmittedReports() {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Pobierz pierwszego admina
  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  if (!admins || admins.length === 0) {
    console.error('No admin found for auto-approval')
    return
  }

  const adminId = admins[0].id

  // Pobierz wszystkie raporty ze statusem 'submitted'
  const { data: submittedReports, error: fetchError } = await supabase
    .from('monthly_reports')
    .select(`
      id,
      tutor_id,
      month,
      year,
      total_hours,
      profiles!monthly_reports_tutor_id_fkey (
        hourly_rate
      )
    `)
    .eq('status', 'submitted')

  if (fetchError) {
    console.error('Error fetching submitted reports:', fetchError)
    return
  }

  if (!submittedReports || submittedReports.length === 0) {
    return
  }

  // Zatwierdź każdy raport
  for (const report of submittedReports) {
    try {
      const profiles = report.profiles as unknown as { hourly_rate: number } | null
      const hourlyRate = profiles?.hourly_rate || 0
      const totalAmount = report.total_hours * hourlyRate

      const { error: updateError } = await supabase
        .from('monthly_reports')
        .update({
          status: 'approved',
          total_amount: totalAmount,
          approved_at: new Date().toISOString(),
          approved_by: adminId,
        })
        .eq('id', report.id)

      if (updateError) {
        console.error(`Error approving report ${report.id}:`, updateError)
        continue
      }

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
            message: `Twój raport za ${monthName} ${report.year} został automatycznie zatwierdzony. Kwota do wypłaty: ${totalAmount.toFixed(2)} zł`,
            metadata: {
              report_id: report.id,
              month: report.month,
              year: report.year,
              total_hours: report.total_hours,
              total_amount: totalAmount,
            },
            skipRevalidate: true,
          })
        }
      } catch (notificationError) {
        console.error(`Failed to create notification for report ${report.id}:`, notificationError)
      }
    } catch (error) {
      console.error(`Error processing report ${report.id}:`, error)
    }
  }

  // Revalidate paths after all notifications are created
  revalidatePath('/dashboard/raporty-tutorow')
  revalidatePath('/dashboard/moje-raporty')
  revalidatePath('/dashboard/powiadomienia')
  revalidatePath('/dashboard', 'layout')
}

export async function deleteReports(reportIds: string[]) {
  const supabase = await createClient()

  // Usuń raporty (monthly_report_entries powinny być usunięte automatycznie przez CASCADE)
  const { error } = await supabase
    .from('monthly_reports')
    .delete()
    .in('id', reportIds)

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

const monthNames = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
]

/**
 * Wysyła przypomnienie o raporcie do pojedynczego tutora
 */
export async function sendReportReminderToTutor(tutorId: string, month: number, year: number) {
  const supabase = await createClient()
  
  // Pobierz dane tutora z emailem
  const { data: tutor, error: tutorError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', tutorId)
    .eq('role', 'tutor')
    .single()

  if (tutorError || !tutor) {
    throw new Error(`Tutor not found: ${tutorError?.message || 'Unknown error'}`)
  }

  const monthName = monthNames[month - 1] || `Miesiąc ${month}`

  // Utwórz powiadomienie
  try {
    await createNotification({
      userId: tutorId,
      type: 'report_reminder',
      title: 'Przypomnienie o raporcie miesięcznym',
      message: `Przypominamy o złożeniu raportu miesięcznego za okres ${monthName} ${year}.`,
      metadata: {
        month,
        year,
        month_name: monthName,
      },
    })

    // Wyślij email, jeśli tutor ma adres email
    if (tutor.email && tutor.email.trim()) {
      try {
        const emailResult = await sendReportReminderEmail({
          to: tutor.email,
          tutorName: tutor.full_name,
          month,
          year,
        })

        if (!emailResult.success) {
          console.error('Failed to send reminder email:', {
            tutorId,
            email: tutor.email,
            error: emailResult.error,
          })
          // Nie przerywamy procesu - powiadomienie zostało wysłane
        } else {
          console.log('Reminder email sent successfully:', {
            tutorId,
            email: tutor.email,
            messageId: emailResult.messageId,
          })
        }
      } catch (emailError) {
        console.error('Error sending reminder email:', {
          tutorId,
          email: tutor.email,
          error: emailError,
        })
        // Nie przerywamy procesu - powiadomienie zostało wysłane
      }
    } else {
      console.warn('Tutor does not have email address:', {
        tutorId,
        tutorName: tutor.full_name,
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to send reminder notification:', error)
    throw error
  }
}

/**
 * Wysyła przypomnienia o raporcie do wszystkich tutorów, którzy nie złożyli raportu za dany miesiąc
 */
export async function sendReportRemindersToAllMissing(month: number, year: number) {
  const supabase = await createClient()
  
  // Pobierz wszystkich tutorów z emailami
  const { data: allTutors, error: tutorsError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'tutor')
    .order('full_name')

  if (tutorsError) {
    throw new Error(`Error fetching tutors: ${tutorsError.message}`)
  }

  if (!allTutors || allTutors.length === 0) {
    return { success: true, sent: 0, errors: [] }
  }

  // Pobierz tutorów, którzy już złożyli raport za ten okres (status submitted, approved lub paid)
  const { data: existingReports, error: reportsError } = await supabase
    .from('monthly_reports')
    .select('tutor_id')
    .eq('month', month)
    .eq('year', year)
    .in('status', ['submitted', 'approved', 'paid'])

  if (reportsError) {
    throw new Error(`Error fetching reports: ${reportsError.message}`)
  }

  // Utwórz zbiór ID tutorów, którzy już złożyli raport
  const tutorsWithReports = new Set(existingReports?.map(r => r.tutor_id) || [])

  // Znajdź tutorów bez raportu
  const tutorsWithoutReports = allTutors.filter(tutor => !tutorsWithReports.has(tutor.id))

  if (tutorsWithoutReports.length === 0) {
    return { success: true, sent: 0, errors: [], message: 'Wszyscy tutorzy złożyli już raport za ten okres.' }
  }

  const monthName = monthNames[month - 1] || `Miesiąc ${month}`
  const errors: string[] = []
  let sentCount = 0

  // Wyślij przypomnienia do każdego tutora bez raportu
  for (const tutor of tutorsWithoutReports) {
    try {
      // Utwórz powiadomienie
      await createNotification({
        userId: tutor.id,
        type: 'report_reminder',
        title: 'Przypomnienie o raporcie miesięcznym',
        message: `Przypominamy o złożeniu raportu miesięcznego za okres ${monthName} ${year}.`,
        metadata: {
          month,
          year,
          month_name: monthName,
        },
        skipRevalidate: true, // Skip individual revalidations, do one at the end
      })

      // Wyślij email, jeśli tutor ma adres email
      if (tutor.email && tutor.email.trim()) {
        try {
          const emailResult = await sendReportReminderEmail({
            to: tutor.email,
            tutorName: tutor.full_name,
            month,
            year,
          })

          if (!emailResult.success) {
            console.error('Failed to send reminder email:', {
              tutorId: tutor.id,
              email: tutor.email,
              error: emailResult.error,
            })
            // Nie przerywamy procesu - powiadomienie zostało wysłane
          } else {
            console.log('Reminder email sent successfully:', {
              tutorId: tutor.id,
              email: tutor.email,
              messageId: emailResult.messageId,
            })
          }
        } catch (emailError) {
          console.error('Error sending reminder email:', {
            tutorId: tutor.id,
            email: tutor.email,
            error: emailError,
          })
          // Nie przerywamy procesu - powiadomienie zostało wysłane
        }
      } else {
        console.warn('Tutor does not have email address:', {
          tutorId: tutor.id,
          tutorName: tutor.full_name,
        })
      }

      sentCount++
    } catch (error) {
      const errorMessage = `Błąd przy wysyłaniu przypomnienia do ${tutor.full_name}: ${error instanceof Error ? error.message : 'Nieznany błąd'}`
      console.error(errorMessage, error)
      errors.push(errorMessage)
    }
  }

  // Revalidate paths after all notifications are created
  revalidatePath('/dashboard/raporty-tutorow')
  revalidatePath('/dashboard/powiadomienia')
  revalidatePath('/dashboard', 'layout')

  return {
    success: errors.length === 0,
    sent: sentCount,
    errors,
    message: `Wysłano ${sentCount} przypomnień do tutorów bez raportu za ${monthName} ${year}.`,
  }
}

