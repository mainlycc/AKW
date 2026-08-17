'use server'

import { revalidatePath } from 'next/cache'
import {
  sendPaymentReminder,
} from '@/lib/actions/billing'
import type { NotificationChannel } from '@/lib/types/notifications'
import { createClient } from '@/lib/supabase/server'
import { previewPayUPaymentsFromReports, sendPayUPaymentsFromReports, previewPayUAnnualPaymentsFromReports, sendPayUAnnualPaymentsFromReports } from '@/lib/actions/payu'
import type { AnnualPayUStudentTarget } from '@/lib/actions/payu'

export async function sendReminderAction(
  studentId: string,
  billingPeriodId: string,
  channel: NotificationChannel = 'email',
  message?: string
) {
  try {
    console.log('[sendReminderAction] Called with:', {
      studentId,
      billingPeriodId,
    })
    const result = await sendPaymentReminder(studentId, billingPeriodId, channel, message)
    console.log('[sendReminderAction] Reminder sent successfully')
    revalidatePath('/dashboard/billing-from-reports')
    return result
  } catch (error) {
    console.error('[sendReminderAction] Error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      studentId,
      billingPeriodId,
    })
    throw error // Re-throw to let the UI handle it
  }
}

export async function markBillingsAsPaidAction(billingIds: string[]) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  // Get billing records to update
  // Note: billing IDs from reports use :: separator (student_id::period_id or student_id::period_id::merged)
  const billingData = billingIds.map(id => {
    const parts = id.split('::')
    return { studentId: parts[0], billingPeriodId: parts[1], originalId: id }
  })

  // For each billing, add a payment for the remaining balance
  for (const { studentId, billingPeriodId } of billingData) {
    if (!studentId || !billingPeriodId) {
      console.warn(`Invalid billing ID format, skipping: studentId=${studentId}, billingPeriodId=${billingPeriodId}`)
      continue
    }

    // Get actual billing record from database
    const { data: billing, error: fetchError } = await supabase
      .from('student_billings')
      .select('id, student_id, billing_period_id, total_due, total_paid')
      .eq('student_id', studentId)
      .eq('billing_period_id', billingPeriodId)
      .single()

    if (fetchError || !billing) {
      // If billing doesn't exist in student_billings table, create a payment directly
      // Get the billing period to calculate amount from reports
      console.warn(`Billing not found in student_billings for student ${studentId}, period ${billingPeriodId}. Checking payments table...`)
      
      // Get existing payments for this student+period
      const { data: existingPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('student_id', studentId)
        .eq('billing_period_id', billingPeriodId)

      const existingPaid = existingPayments?.reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0) || 0

      // Get hours from reports to calculate what's owed
      const { data: reportEntries } = await supabase
        .from('monthly_report_entries')
        .select(`
          hours,
          monthly_reports!inner (
            month,
            year,
            status
          )
        `)
        .eq('student_id', studentId)

      // Get student hourly rate
      const { data: student } = await supabase
        .from('students')
        .select('hourly_rate')
        .eq('id', studentId)
        .single()

      const hourlyRate = student?.hourly_rate ? parseFloat(student.hourly_rate.toString()) : 50
      
      // Filter by billing period and sum hours
      const { data: periodData } = await supabase
        .from('billing_periods')
        .select('month, year')
        .eq('id', billingPeriodId)
        .single()

      if (!periodData) {
        console.warn(`Billing period not found: ${billingPeriodId}`)
        continue
      }

      // Calculate total due from report entries for this period
      let totalHours = 0
      if (reportEntries) {
        for (const entry of reportEntries) {
          const report = Array.isArray(entry.monthly_reports) ? entry.monthly_reports[0] : entry.monthly_reports
          if (report && 
              (report as any).month === periodData.month && 
              (report as any).year === periodData.year &&
              ['approved', 'paid'].includes((report as any).status)) {
            totalHours += parseFloat(entry.hours?.toString() || '0')
          }
        }
      }

      const totalDue = totalHours * hourlyRate
      const remainingBalance = totalDue - existingPaid

      if (remainingBalance > 0) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            student_id: studentId,
            billing_period_id: billingPeriodId,
            amount: remainingBalance,
            payment_method: 'transfer',
            payment_date: new Date().toISOString().split('T')[0],
            notes: 'Oznaczono jako opłacone przez administratora',
            created_by: user.id,
          })

        if (paymentError) {
          throw new Error(`Failed to create payment for student ${studentId}: ${paymentError.message}`)
        }
      }
      continue
    }

    const remainingBalance = billing.total_due - billing.total_paid
    
    if (remainingBalance > 0) {
      // Add payment for the remaining balance
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          student_id: billing.student_id,
          billing_period_id: billing.billing_period_id,
          amount: remainingBalance,
          payment_method: 'transfer',
          payment_date: new Date().toISOString().split('T')[0],
          notes: 'Oznaczono jako opłacone przez administratora',
          created_by: user.id,
        })

      if (paymentError) {
        throw new Error(`Failed to create payment for billing ${billing.id}: ${paymentError.message}`)
      }
    }
  }

  revalidatePath('/dashboard/billing-from-reports')
}

export async function sendGroupRemindersAction(
  billingIds: string[],
  channel: NotificationChannel = 'email',
  message?: string
) {
  // Extract student_id and billing_period_id from billing IDs (:: separator)
  const billingData = billingIds.map(id => {
    const parts = id.split('::')
    return { studentId: parts[0], billingPeriodId: parts[1] }
  })

  let sent = 0
  let failed = 0
  const warnings: string[] = []

  for (const { studentId, billingPeriodId } of billingData) {
    if (!studentId || !billingPeriodId) continue
    const result = await sendPaymentReminder(studentId, billingPeriodId, channel, message)
    if (result.success) {
      sent++
      if (result.error) warnings.push(result.error)
    } else {
      failed++
      warnings.push(result.error || 'Nie udało się wysłać przypomnienia')
    }
  }

  revalidatePath('/dashboard/billing-from-reports')
  return { success: failed === 0, sent, failed, warnings }
}

export async function sendPayUPaymentsFromReportsAction(
  studentIds: string[],
  month: number,
  year: number,
  channel: NotificationChannel = 'email'
) {
  return await sendPayUPaymentsFromReports(studentIds, month, year, channel)
}

export async function previewPayUPaymentsFromReportsAction(
  studentIds: string[],
  month: number,
  year: number,
  channel: NotificationChannel = 'email'
) {
  return await previewPayUPaymentsFromReports(studentIds, month, year, channel)
}

export async function previewPayUAnnualPaymentsFromReportsAction(
  targets: AnnualPayUStudentTarget[],
  channel: NotificationChannel = 'email'
) {
  return await previewPayUAnnualPaymentsFromReports(targets, channel)
}

export async function sendPayUAnnualPaymentsFromReportsAction(
  targets: AnnualPayUStudentTarget[],
  channel: NotificationChannel = 'email'
) {
  return await sendPayUAnnualPaymentsFromReports(targets, channel)
}
