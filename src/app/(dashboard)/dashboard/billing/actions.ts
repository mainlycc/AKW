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
  channel: NotificationChannel = 'email'
) {
  await sendPaymentReminder(studentId, billingPeriodId, channel)
  revalidatePath('/dashboard/billing')
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
  channel: NotificationChannel = 'email'
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

  // Send reminder for each billing (kanał email domyślny – kanał grupowy jest przekazywany z UI)
  for (const billing of billings || []) {
    await sendPaymentReminder(billing.student_id, billing.billing_period_id, channel)
  }

  revalidatePath('/dashboard/billing')
}

