'use server'

import { revalidatePath } from 'next/cache'
import {
  sendPaymentReminder,
} from '@/lib/actions/billing'
import type { NotificationChannel } from '@/lib/types/notifications'
import { createClient } from '@/lib/supabase/server'

export async function sendReminderAction(
  studentId: string,
  billingPeriodId: string,
  channel: NotificationChannel = 'email'
) {
  try {
    console.log('[sendReminderAction] Called with:', {
      studentId,
      billingPeriodId,
    })
    await sendPaymentReminder(studentId, billingPeriodId, channel)
    console.log('[sendReminderAction] Reminder sent successfully')
    revalidatePath('/dashboard/billing-from-reports')
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
  // Note: billing IDs from reports are temporary (student_id-period_id format)
  // We need to extract student_id and billing_period_id from them
  const billingData = billingIds.map(id => {
    const [studentId, billingPeriodId] = id.split('-')
    return { studentId, billingPeriodId, originalId: id }
  })

  // For each billing, add a payment for the remaining balance
  for (const { studentId, billingPeriodId } of billingData) {
    // Get actual billing record from database
    const { data: billing, error: fetchError } = await supabase
      .from('student_billings')
      .select('id, student_id, billing_period_id, total_due, total_paid')
      .eq('student_id', studentId)
      .eq('billing_period_id', billingPeriodId)
      .single()

    if (fetchError || !billing) {
      // If billing doesn't exist, create it first
      // This can happen when billing is calculated from reports but not yet saved
      // For now, we'll skip it or create a basic record
      console.warn(`Billing not found for student ${studentId}, period ${billingPeriodId}`)
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
          payment_method: 'transfer', // Default to transfer for manual marking
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
  channel: NotificationChannel = 'email'
) {
  // Extract student_id and billing_period_id from billing IDs
  const billingData = billingIds.map(id => {
    const [studentId, billingPeriodId] = id.split('-')
    return { studentId, billingPeriodId }
  })

  // Send reminder for each billing (kanał email domyślny – kanał grupowy jest przekazywany z UI)
  for (const { studentId, billingPeriodId } of billingData) {
    await sendPaymentReminder(studentId, billingPeriodId, channel)
  }

  revalidatePath('/dashboard/billing-from-reports')
}

