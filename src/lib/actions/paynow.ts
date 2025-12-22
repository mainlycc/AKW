'use server'

import { createClient } from '@/lib/supabase/server'
import { createPaynowClient } from '@/lib/paynow/client'
import { getUserProfile } from '@/lib/actions/auth'
import { revalidatePath } from 'next/cache'
import type { StudentBillingWithParent } from '@/lib/actions/billing'

export interface CreatePaynowPaymentResult {
  success: boolean
  paymentId?: string
  redirectUrl?: string
  error?: string
}

export interface SendPaynowPaymentsResult {
  success: boolean
  sent: number
  failed: number
  errors: Array<{ studentId: string; error: string }>
}

/**
 * Create Paynow payment for a student billing
 */
export async function createPaynowPayment(
  studentId: string,
  billingPeriodId: string,
  amount: number,
  parentEmail: string,
  parentName: string,
  studentName: string,
  month: number,
  year: number
): Promise<CreatePaynowPaymentResult> {
  try {
    const profile = await getUserProfile()
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Brak uprawnień' }
    }

    const supabase = await createClient()

    // Get billing period details
    const { data: period, error: periodError } = await supabase
      .from('billing_periods')
      .select('month, year')
      .eq('id', billingPeriodId)
      .single()

    if (periodError || !period) {
      return { success: false, error: 'Okres rozliczeniowy nie został znaleziony' }
    }

    // Generate external ID (student_id + billing_period_id)
    const externalId = `${studentId}-${billingPeriodId}`

    // Check if payment already exists
    const { data: existingPayment } = await supabase
      .from('paynow_payments')
      .select('id, payment_id, status, redirect_url')
      .eq('external_id', externalId)
      .eq('billing_period_id', billingPeriodId)
      .single()

    if (existingPayment && existingPayment.status !== 'REJECTED' && existingPayment.status !== 'EXPIRED') {
      // Return existing payment
      return {
        success: true,
        paymentId: existingPayment.payment_id,
        redirectUrl: existingPayment.redirect_url || undefined,
      }
    }

    // Get base URL for return and notification URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const returnUrl = `${baseUrl}/dashboard/rozliczenia-deklaracji?month=${month}&year=${year}`
    const notificationUrl = `${baseUrl}/api/paynow/webhook`

    // Create Paynow client
    const paynowClient = createPaynowClient()

    // Create payment in Paynow
    const paymentResponse = await paynowClient.createPayment({
      amount: amount,
      currency: 'PLN',
      externalId: externalId,
      description: `Płatność za korepetycje - ${studentName} - ${month}/${year}`,
      buyer: {
        email: parentEmail,
        firstName: parentName.split(' ')[0] || parentName,
        lastName: parentName.split(' ').slice(1).join(' ') || '',
      },
      continueUrl: returnUrl,
      notificationUrl: notificationUrl,
    })

    // Save payment to database
    const { data: paynowPayment, error: dbError } = await supabase
      .from('paynow_payments')
      .insert({
        payment_id: paymentResponse.paymentId,
        external_id: externalId,
        student_id: studentId,
        billing_period_id: billingPeriodId,
        status: paymentResponse.status,
        amount: amount,
        currency: 'PLN',
        redirect_url: paymentResponse.redirectUrl,
        notification_url: notificationUrl,
        return_url: returnUrl,
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('Error saving Paynow payment to database:', dbError)
      return { success: false, error: 'Błąd podczas zapisywania płatności' }
    }

    return {
      success: true,
      paymentId: paymentResponse.paymentId,
      redirectUrl: paymentResponse.redirectUrl,
    }
  } catch (error) {
    console.error('Error creating Paynow payment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nieznany błąd',
    }
  }
}

/**
 * Send Paynow payment links to multiple students
 */
export async function sendPaynowPayments(
  studentIds: string[],
  month: number,
  year: number
): Promise<SendPaynowPaymentsResult> {
  try {
    const profile = await getUserProfile()
    if (!profile || profile.role !== 'admin') {
      return {
        success: false,
        sent: 0,
        failed: studentIds.length,
        errors: studentIds.map(id => ({ studentId: id, error: 'Brak uprawnień' })),
      }
    }

    const supabase = await createClient()

    // Get billing period
    const { data: period, error: periodError } = await supabase
      .from('billing_periods')
      .select('id')
      .eq('month', month)
      .eq('year', year)
      .single()

    if (periodError || !period) {
      return {
        success: false,
        sent: 0,
        failed: studentIds.length,
        errors: studentIds.map(id => ({ studentId: id, error: 'Okres rozliczeniowy nie został znaleziony' })),
      }
    }

    const billingPeriodId = period.id

    // Get student billings from declarations
    // Use the same function that calculates billings from declarations
    const { getStudentBillingsFromDeclarations } = await import('@/lib/actions/billing')
    let billings: StudentBillingWithParent[]
    try {
      billings = await getStudentBillingsFromDeclarations(month, year)
      // Filter to only selected students
      billings = billings.filter(b => studentIds.includes(b.student_id))
    } catch (error) {
      console.error('Error fetching billings from declarations:', error)
      return {
        success: false,
        sent: 0,
        failed: studentIds.length,
        errors: studentIds.map(id => ({ 
          studentId: id, 
          error: error instanceof Error ? error.message : 'Błąd podczas pobierania danych' 
        })),
      }
    }

    // Billings already contain parent information from getStudentBillingsFromDeclarations
    // Create parent map from billings
    const parentMap = new Map<string, { email: string; name: string }>()
    for (const billing of billings) {
      if (billing.parent && billing.parent.email && !parentMap.has(billing.student_id)) {
        parentMap.set(billing.student_id, {
          email: billing.parent.email,
          name: `${billing.parent.first_name} ${billing.parent.last_name}`,
        })
      }
    }

    const results: SendPaynowPaymentsResult = {
      success: true,
      sent: 0,
      failed: 0,
      errors: [],
    }

    // Process each student
    for (const billing of billings || []) {
      const studentId = billing.student_id
      const student = billing.students

      if (!student) {
        results.failed++
        results.errors.push({ studentId, error: 'Uczeń nie został znaleziony' })
        continue
      }

      const parent = parentMap.get(studentId)
      if (!parent || !parent.email) {
        results.failed++
        results.errors.push({ studentId, error: 'Brak adresu email rodzica' })
        continue
      }

      // Use balance (remaining amount to pay) or total_due if balance is 0
      const amount = parseFloat(
        (billing.balance && billing.balance > 0 
          ? billing.balance 
          : billing.total_due || 0
        ).toString()
      )
      
      if (amount <= 0) {
        results.failed++
        results.errors.push({ studentId, error: 'Kwota do zapłaty wynosi 0' })
        continue
      }

      const studentName = `${student.first_name} ${student.last_name}`

      // Create payment
      const paymentResult = await createPaynowPayment(
        studentId,
        billingPeriodId,
        amount,
        parent.email,
        parent.name,
        studentName,
        month,
        year
      )

      if (!paymentResult.success || !paymentResult.redirectUrl) {
        results.failed++
        results.errors.push({
          studentId,
          error: paymentResult.error || 'Nie udało się utworzyć płatności',
        })
        continue
      }

      // Send email with payment link
      const { sendPaymentLinkEmail } = await import('@/lib/email/send')
      const emailResult = await sendPaymentLinkEmail({
        to: parent.email,
        parentName: parent.name,
        studentName: studentName,
        amount: amount,
        month: month,
        year: year,
        paymentUrl: paymentResult.redirectUrl,
      })

      if (emailResult.success) {
        results.sent++
      } else {
        results.failed++
        results.errors.push({
          studentId,
          error: `Płatność utworzona, ale email nie został wysłany: ${emailResult.error}`,
        })
      }
    }

    results.success = results.failed === 0

    revalidatePath('/dashboard/rozliczenia-deklaracji')
    return results
  } catch (error) {
    console.error('Error sending Paynow payments:', error)
    return {
      success: false,
      sent: 0,
      failed: studentIds.length,
      errors: studentIds.map(id => ({
        studentId: id,
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      })),
    }
  }
}

/**
 * Process Paynow webhook notification
 */
export async function processPaynowWebhook(
  notification: {
    paymentId: string
    externalId: string
    status: string
    modifiedAt: string
  }
): Promise<void> {
  const supabase = await createClient()

  // Find paynow payment
  const { data: paynowPayment, error: findError } = await supabase
    .from('paynow_payments')
    .select('id, student_id, billing_period_id, amount, status')
    .eq('payment_id', notification.paymentId)
    .single()

  if (findError || !paynowPayment) {
    console.error('Paynow payment not found:', notification.paymentId)
    throw new Error('Paynow payment not found')
  }

  // Update payment status
  const { error: updateError } = await supabase
    .from('paynow_payments')
    .update({
      status: notification.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paynowPayment.id)

  if (updateError) {
    console.error('Error updating Paynow payment status:', updateError)
    throw new Error('Failed to update payment status')
  }

  // If payment is confirmed, create payment record
  if (notification.status === 'CONFIRMED') {
    // Check if payment already exists
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('paynow_payment_id', notification.paymentId)
      .single()

    if (!existingPayment) {
      // Get admin user for created_by
      const { data: admin } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single()

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          student_id: paynowPayment.student_id,
          billing_period_id: paynowPayment.billing_period_id,
          amount: paynowPayment.amount,
          payment_method: 'online',
          payment_date: new Date().toISOString().split('T')[0],
          paynow_payment_id: notification.paymentId,
          created_by: admin?.id || paynowPayment.student_id, // Fallback to student_id if no admin
        })

      if (paymentError) {
        console.error('Error creating payment record:', paymentError)
        // Don't throw - payment status was updated, we can retry payment creation later
      } else {
        revalidatePath('/dashboard/rozliczenia-deklaracji')
        revalidatePath('/dashboard/payments')
      }
    }
  }
}

