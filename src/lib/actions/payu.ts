'use server'

import { createClient } from '@/lib/supabase/server'
import { createPayUClient } from '@/lib/payu/client'
import { getUserProfile } from '@/lib/actions/auth'
import { revalidatePath } from 'next/cache'
import type { StudentBillingWithParent } from '@/lib/actions/billing'

export interface CreatePayUOrderResult {
  success: boolean
  orderId?: string
  redirectUrl?: string
  error?: string
}

export interface SendPayUPaymentsResult {
  success: boolean
  sent: number
  failed: number
  errors: Array<{ studentId: string; error: string }>
}

/**
 * Create PayU order for a student billing
 */
export async function createPayUOrder(
  studentId: string,
  billingPeriodId: string,
  amount: number,
  parentEmail: string,
  parentName: string,
  studentName: string,
  month: number,
  year: number
): Promise<CreatePayUOrderResult> {
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

    // Generate external order ID - for test purposes make it unique on every call
    // so that PayU doesn't return ORDER_NOT_UNIQUE for repeated test orders
    const extOrderId = `${studentId}-${billingPeriodId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`

    // Check if order already exists
    const { data: existingOrder } = await supabase
      .from('payu_payments')
      .select('id, order_id, status, redirect_url')
      .eq('ext_order_id', extOrderId)
      .eq('billing_period_id', billingPeriodId)
      .single()

    if (existingOrder && existingOrder.status !== 'CANCELED') {
      // Return existing order
      return {
        success: true,
        orderId: existingOrder.order_id,
        redirectUrl: existingOrder.redirect_url || undefined,
      }
    }

    // Get base URL for return and notification URLs
    // Normalize to avoid double slashes when NEXT_PUBLIC_APP_URL ends with "/"
    const baseUrlRaw = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const baseUrl = baseUrlRaw.replace(/\/+$/, '')
    const continueUrl = `${baseUrl}/dashboard/rozliczenia-deklaracji?month=${month}&year=${year}`
    const notifyUrl = `${baseUrl}/api/payu/webhook`

    // Month names for description
    const monthNames = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ]
    const monthName = monthNames[month - 1] || `Miesiąc ${month}`

    // Create PayU client
    const payuClient = createPayUClient()

    // Split parent name for buyer info
    const nameParts = parentName.split(' ')
    const firstName = nameParts[0] || parentName
    const lastName = nameParts.slice(1).join(' ') || ''

    // Create order in PayU
    // Amount must be in grosze (smallest currency unit)
    const totalAmount = Math.round(amount * 100).toString()

    const orderResponse = await payuClient.createOrder({
      customerIp: '185.68.12.34', // Test IP for sandbox (PayU may reject 127.0.0.1)
      description: `Opłata za korepetycje - ${studentName} - ${monthName} ${year}`,
      currencyCode: 'PLN',
      totalAmount,
      extOrderId,
      buyer: {
        email: parentEmail,
        firstName,
        lastName,
        language: 'pl',
      },
      products: [
        {
          name: `Korepetycje - ${studentName} - ${monthName} ${year}`,
          unitPrice: totalAmount,
          quantity: '1',
        },
      ],
      continueUrl,
      notifyUrl,
    })

    // Save order to database
    // PayU GPO Europe API v2 zwraca paymentId i redirectUrl
    const { data: payuPayment, error: dbError } = await supabase
      .from('payu_payments')
      .insert({
        order_id: orderResponse.paymentId, // paymentId z PayU GPO Europe API v2
        ext_order_id: extOrderId,
        student_id: studentId,
        billing_period_id: billingPeriodId,
        status: 'PENDING',
        amount,
        currency: 'PLN',
        redirect_url: orderResponse.redirectUrl, // redirectUrl z PayU GPO Europe API v2
        notify_url: notifyUrl,
        continue_url: continueUrl,
        description: `Opłata za korepetycje - ${studentName} - ${monthName} ${year}`,
        buyer_email: parentEmail,
        buyer_first_name: firstName,
        buyer_last_name: lastName,
      })
      .select('id, order_id, redirect_url')
      .single()

    if (dbError) {
      console.error('Error saving PayU order to database:', dbError)
      return {
        success: false,
        error: `Nie udało się zapisać zamówienia w bazie: ${dbError.message}`,
      }
    }

    console.log('PayU order created successfully:', {
      paymentId: orderResponse.paymentId,
      extOrderId,
      studentId,
      amount,
    })

    return {
      success: true,
      orderId: payuPayment.order_id,
      redirectUrl: payuPayment.redirect_url || orderResponse.redirectUrl || undefined,
    }
  } catch (error) {
    console.error('Error creating PayU order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nieznany błąd',
    }
  }
}

/**
 * Send PayU payment links to multiple students
 */
export async function sendPayUPayments(
  studentIds: string[],
  month: number,
  year: number
): Promise<SendPayUPaymentsResult> {
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

    const results: SendPayUPaymentsResult = {
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

      // Create order
      const orderResult = await createPayUOrder(
        studentId,
        billingPeriodId,
        amount,
        parent.email,
        parent.name,
        studentName,
        month,
        year
      )

      if (!orderResult.success || !orderResult.redirectUrl) {
        results.failed++
        results.errors.push({
          studentId,
          error: orderResult.error || 'Nie udało się utworzyć zamówienia',
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
        paymentUrl: orderResult.redirectUrl,
      })

      if (emailResult.success) {
        results.sent++
      } else {
        results.failed++
        results.errors.push({
          studentId,
          error: `Zamówienie utworzone, ale email nie został wysłany: ${emailResult.error}`,
        })
      }
    }

    results.success = results.failed === 0

    revalidatePath('/dashboard/rozliczenia-deklaracji')
    return results
  } catch (error) {
    console.error('Error sending PayU payments:', error)
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
 * Process PayU webhook notification
 */
export async function processPayUWebhook(
  notification: {
    orderId: string
    extOrderId: string
    status: string
    totalAmount: string
    currencyCode: string
    payMethod?: {
      type: string
      value?: string
    }
    buyer?: {
      email: string
      firstName?: string
      lastName?: string
    }
  }
): Promise<void> {
  try {
    const supabase = await createClient()

    // Update payu_payments table
    const { data: payuPayment, error: updateError } = await supabase
      .from('payu_payments')
      .update({
        status: notification.status,
        payment_method: notification.payMethod?.type || null,
        buyer_email: notification.buyer?.email || null,
        buyer_first_name: notification.buyer?.firstName || null,
        buyer_last_name: notification.buyer?.lastName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', notification.orderId)
      .select('id, student_id, billing_period_id, amount, ext_order_id')
      .single()

    if (updateError) {
      console.error('Error updating payu_payments:', updateError)
      throw new Error(`Failed to update payu_payments: ${updateError.message}`)
    }

    if (!payuPayment) {
      console.warn('PayU payment not found for orderId:', notification.orderId)
      return
    }

    console.log('PayU payment updated:', {
      orderId: notification.orderId,
      status: notification.status,
      studentId: payuPayment.student_id,
    })

    // If payment completed, create or update payment record
    if (notification.status === 'COMPLETED') {
      // Check if payment record already exists
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('payu_order_id', notification.orderId)
        .single()

      if (!existingPayment) {
        // Create new payment record
        const paymentDate = new Date().toISOString().split('T')[0]
        const amount = parseFloat(notification.totalAmount) / 100 // Convert grosze to PLN

        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            student_id: payuPayment.student_id,
            billing_period_id: payuPayment.billing_period_id,
            amount: amount,
            payment_method: 'online',
            payment_date: paymentDate,
            payu_order_id: notification.orderId,
            notes: `Płatność online PayU - ${notification.payMethod?.type || 'unknown'}`,
            created_by: payuPayment.student_id, // Will be updated by RLS with actual user
          })

        if (paymentError) {
          console.error('Error creating payment record:', paymentError)
          // Don't throw - the payu_payment is already updated
        } else {
          console.log('Payment record created for completed PayU order:', notification.orderId)
          
          // Revalidate paths
          revalidatePath('/dashboard/payments')
          revalidatePath('/dashboard/billing')
          revalidatePath('/dashboard/rozliczenia-deklaracji')
        }
      } else {
        console.log('Payment record already exists for orderId:', notification.orderId)
      }
    }
  } catch (error) {
    console.error('Error processing PayU webhook:', error)
    throw error
  }
}

/**
 * Get PayU payment status
 */
export async function getPayUPaymentStatus(orderId: string): Promise<{
  success: boolean
  status?: string
  error?: string
}> {
  try {
    const profile = await getUserProfile()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'tutor')) {
      return { success: false, error: 'Brak uprawnień' }
    }

    const payuClient = createPayUClient()
    const orderStatus = await payuClient.getOrderStatus(orderId)

    if (!orderStatus.orders || orderStatus.orders.length === 0) {
      return { success: false, error: 'Zamówienie nie zostało znalezione' }
    }

    const order = orderStatus.orders[0]

    // Update database with latest status
    const supabase = await createClient()
    await supabase
      .from('payu_payments')
      .update({
        status: order.status,
        payment_method: order.payMethod?.type || null,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)

    return {
      success: true,
      status: order.status,
    }
  } catch (error) {
    console.error('Error getting PayU payment status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nieznany błąd',
    }
  }
}
