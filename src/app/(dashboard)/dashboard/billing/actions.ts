'use server'

import { revalidatePath } from 'next/cache'
import {
  recalculateBillingsForPeriod,
  sendPaymentReminder,
} from '@/lib/actions/billing'
import type { NotificationChannel } from '@/lib/types/notifications'
import { createClient } from '@/lib/supabase/server'

export async function recalculateBillingsAction(month: number, year: number) {
  await recalculateBillingsForPeriod(month, year)
  revalidatePath('/dashboard/billing')
}

export async function sendReminderAction(
  studentId: string,
  billingPeriodId: string,
  channel: NotificationChannel = 'email',
  message?: string
) {
  const result = await sendPaymentReminder(studentId, billingPeriodId, channel, message)
  revalidatePath('/dashboard/billing')
  return result
}

export async function markBillingsAsPaidAction(billingIds: string[]) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  // Get billing records to update
  const { data: billings, error: fetchError } = await supabase
    .from('student_billings')
    .select('id, student_id, billing_period_id, total_due, total_paid')
    .in('id', billingIds)

  if (fetchError) {
    throw new Error(`Failed to fetch billings: ${fetchError.message}`)
  }

  // For each billing, add a payment for the remaining balance
  // This will automatically update the status via trigger
  for (const billing of billings || []) {
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

  revalidatePath('/dashboard/billing')
}

export async function sendGroupRemindersAction(
  billingIds: string[],
  channel: NotificationChannel = 'email',
  message?: string
) {
  const supabase = await createClient()
  
  // Get billing records
  const { data: billings, error: fetchError } = await supabase
    .from('student_billings')
    .select('student_id, billing_period_id')
    .in('id', billingIds)

  if (fetchError) {
    throw new Error(`Failed to fetch billings: ${fetchError.message}`)
  }

  let sent = 0
  let failed = 0
  const warnings: string[] = []

  for (const billing of billings || []) {
    const result = await sendPaymentReminder(billing.student_id, billing.billing_period_id, channel, message)
    if (result.success) {
      sent++
      if (result.error) warnings.push(result.error)
    } else {
      failed++
      warnings.push(result.error || 'Nie udało się wysłać przypomnienia')
    }
  }

  revalidatePath('/dashboard/billing')
  return { success: failed === 0, sent, failed, warnings }
}

