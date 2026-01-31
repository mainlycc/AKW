'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPayUClient } from '@/lib/payu/client'
import { getUserProfile } from '@/lib/actions/auth'
import { revalidatePath } from 'next/cache'
import type { StudentBillingWithParent } from '@/lib/actions/billing'
import { sendFinalBookingConfirmationEmail } from '@/lib/email/send'
import { createNotification } from '@/lib/actions/notifications'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { SLOT_DURATION_MINUTES } from '@/lib/types/availability.types'

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
 * Create PayU order for a booking request
 */
export async function createPayUOrderForBooking(
  bookingRequestId: string
): Promise<CreatePayUOrderResult> {
  try {
    // Use admin client to bypass RLS - this is called from public booking page
    const admin = createAdminClient()
    const supabase = await createClient() // Still use regular client for reading booking request (has RLS for public)

    // Get booking request details
    const { data: bookingRequest, error: bookingError } = await supabase
      .from('public_booking_requests')
      .select(`
        id,
        student_id,
        status,
        student_first_name,
        student_last_name,
        contact_email,
        contact_phone,
        request_date,
        start_time,
        end_time,
        tutor:profiles!public_booking_requests_tutor_id_fkey (id, full_name),
        subject:subjects!public_booking_requests_subject_id_fkey (id, name),
        subject_level:subject_levels!public_booking_requests_subject_level_id_fkey (id, level_name)
      `)
      .eq('id', bookingRequestId)
      .single()

    if (bookingError || !bookingRequest) {
      return { success: false, error: 'Rezerwacja nie została znaleziona' }
    }

    // Check if booking is already paid or confirmed
    if (bookingRequest.status === 'confirmed') {
      return { success: false, error: 'Rezerwacja została już potwierdzona' }
    }

    if (!bookingRequest.student_id) {
      return { success: false, error: 'Brak powiązania z uczniem' }
    }

    // Calculate lesson price
    const { calculateLessonPrice } = await import('@/lib/actions/public-booking')
    const amount = await calculateLessonPrice(bookingRequest.student_id)

    if (amount <= 0) {
      return { success: false, error: 'Nieprawidłowa cena lekcji' }
    }

    // Generate external order ID
    const extOrderId = `booking-${bookingRequestId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`

    // Check if order already exists (use admin client to bypass RLS)
    const { data: existingOrder } = await admin
      .from('payu_payments')
      .select('id, order_id, status, redirect_url')
      .eq('booking_request_id', bookingRequestId)
      .eq('status', 'PENDING')
      .maybeSingle()

    if (existingOrder && existingOrder.status !== 'CANCELED') {
      // Return existing order
      return {
        success: true,
        orderId: existingOrder.order_id,
        redirectUrl: existingOrder.redirect_url || undefined,
      }
    }

    // Get base URL for return and notification URLs
    const baseUrlRaw = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const baseUrl = baseUrlRaw.replace(/\/+$/, '')
    const continueUrl = `${baseUrl}/public/rezerwacje/platnosc/sukces?bookingId=${bookingRequestId}`
    const notifyUrl = `${baseUrl}/api/payu/webhook`

    // Format date and time for description
    const tutor = Array.isArray(bookingRequest.tutor) ? bookingRequest.tutor[0] : bookingRequest.tutor
    const subject = Array.isArray(bookingRequest.subject) ? bookingRequest.subject[0] : bookingRequest.subject
    const subjectLevel = Array.isArray(bookingRequest.subject_level) ? bookingRequest.subject_level[0] : bookingRequest.subject_level

    const tutorName = tutor?.full_name || 'Tutor'
    const subjectName = subject?.name || 'Przedmiot'
    const levelName = subjectLevel?.level_name || 'Poziom'
    const studentName = `${bookingRequest.student_first_name} ${bookingRequest.student_last_name}`
    
    // Format date
    const bookingDate = new Date(bookingRequest.request_date)
    const formattedDate = bookingDate.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    // Create PayU client
    const payuClient = createPayUClient()

    // Split contact name for buyer info (use student name if no separate contact name)
    const contactName = studentName
    const nameParts = contactName.split(' ')
    const firstName = nameParts[0] || contactName
    const lastName = nameParts.slice(1).join(' ') || ''

    // Create order in PayU
    // Amount must be in grosze (smallest currency unit)
    const totalAmount = Math.round(amount * 100).toString()

    const orderResponse = await payuClient.createOrder({
      customerIp: '185.68.12.34', // Test IP for sandbox (PayU may reject 127.0.0.1)
      description: `Płatność za lekcję - ${subjectName} (${levelName}) - ${formattedDate} ${bookingRequest.start_time.substring(0, 5)}`,
      currencyCode: 'PLN',
      totalAmount,
      extOrderId,
      buyer: {
        email: bookingRequest.contact_email,
        firstName,
        lastName,
        language: 'pl',
      },
      products: [
        {
          name: `Lekcja - ${subjectName} (${levelName}) - ${tutorName} - ${formattedDate} ${bookingRequest.start_time.substring(0, 5)}`,
          unitPrice: totalAmount,
          quantity: '1',
        },
      ],
      continueUrl,
      notifyUrl,
    })

    // Save order to database (use admin client to bypass RLS)
    const { data: payuPayment, error: dbError } = await admin
      .from('payu_payments')
      .insert({
        order_id: orderResponse.paymentId,
        ext_order_id: extOrderId,
        student_id: bookingRequest.student_id,
        billing_period_id: null, // No billing period for booking payments
        booking_request_id: bookingRequestId,
        status: 'PENDING',
        amount,
        currency: 'PLN',
        redirect_url: orderResponse.redirectUrl,
        notify_url: notifyUrl,
        continue_url: continueUrl,
        description: `Płatność za lekcję - ${subjectName} (${levelName}) - ${formattedDate} ${bookingRequest.start_time.substring(0, 5)}`,
        buyer_email: bookingRequest.contact_email,
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

    console.log('PayU order created successfully for booking:', {
      paymentId: orderResponse.paymentId,
      extOrderId,
      bookingRequestId,
      amount,
    })

    return {
      success: true,
      orderId: payuPayment.order_id,
      redirectUrl: payuPayment.redirect_url || orderResponse.redirectUrl || undefined,
    }
  } catch (error) {
    console.error('Error creating PayU order for booking:', error)
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
 * Handle booking payment completion - confirm booking and send email
 */
async function handleBookingPaymentCompletion(bookingRequestId: string): Promise<void> {
  try {
    const admin = createAdminClient()

    // Get booking request details
    const { data: booking, error: fetchError } = await admin
      .from('public_booking_requests')
      .select(
        'id, assignment_id, booked_slot_id, tutor_id, request_date, weekday, start_time, end_time, student_first_name, student_last_name, contact_email, subject_id, subject_level_id, status'
      )
      .eq('id', bookingRequestId)
      .single()

    if (fetchError || !booking) {
      console.error('Error fetching booking request:', fetchError)
      return
    }

    // Check if already confirmed
    if (booking.status === 'confirmed') {
      console.log('Booking already confirmed:', bookingRequestId)
      return
    }

    // Update booking status to confirmed
    const { error: updateError } = await admin
      .from('public_booking_requests')
      .update({ status: 'confirmed' })
      .eq('id', bookingRequestId)

    if (updateError) {
      console.error('Error updating booking status:', updateError)
      return
    }

    // Update assignment status to active
    if (booking.assignment_id) {
      const { error: assignmentError } = await admin
        .from('student_assignments')
        .update({ status: 'active' })
        .eq('id', booking.assignment_id)

      if (assignmentError) {
        console.error('Error updating assignment status:', assignmentError)
      }
    }

    // Create booked_slot if it doesn't exist
    if (!booking.booked_slot_id && booking.assignment_id) {
      // Check if slot already exists
      const { data: existingSlot } = await admin
        .from('booked_slots')
        .select('id, status')
        .eq('tutor_id', booking.tutor_id)
        .eq('student_assignment_id', booking.assignment_id)
        .eq('weekday', booking.weekday)
        .eq('start_time', booking.start_time)
        .eq('end_time', booking.end_time)
        .maybeSingle()

      if (existingSlot) {
        // Update existing slot to booked
        if (existingSlot.status !== 'booked') {
          await admin
            .from('booked_slots')
            .update({ status: 'booked' })
            .eq('id', existingSlot.id)
        }

        // Update booking request with booked_slot_id
        await admin
          .from('public_booking_requests')
          .update({ booked_slot_id: existingSlot.id })
          .eq('id', bookingRequestId)
      } else {
        // Create new booked_slot
        const { data: newSlot, error: slotInsertError } = await admin
          .from('booked_slots')
          .insert({
            tutor_id: booking.tutor_id,
            student_assignment_id: booking.assignment_id,
            weekday: booking.weekday,
            start_time: booking.start_time,
            end_time: booking.end_time,
            status: 'booked',
            created_by: booking.tutor_id,
          })
          .select('id')
          .single()

        if (!slotInsertError && newSlot) {
          // Update booking request with booked_slot_id
          await admin
            .from('public_booking_requests')
            .update({ booked_slot_id: newSlot.id })
            .eq('id', bookingRequestId)
        } else {
          console.error('Error creating booked_slot:', slotInsertError)
        }
      }
    }

    // Get data for email and notification
    const [tutorData, subjectData, levelData] = await Promise.all([
      admin
        .from('profiles')
        .select('full_name')
        .eq('id', booking.tutor_id)
        .single(),
      booking.subject_id
        ? admin
            .from('subjects')
            .select('name')
            .eq('id', booking.subject_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      booking.subject_level_id
        ? admin
            .from('subject_levels')
            .select('level_name')
            .eq('id', booking.subject_level_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const formattedDate = format(parseISO(booking.request_date), 'd MMMM yyyy', { locale: pl })
    const timeRange = `${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)}`
    const studentName = `${booking.student_first_name} ${booking.student_last_name}`

    // Send notification to tutor
    if (tutorData.data) {
      try {
        const subjectLabel = subjectData.data?.name
          ? `${subjectData.data.name}${levelData.data?.level_name ? ` - ${levelData.data.level_name}` : ''}`
          : ''

        await createNotification({
          userId: booking.tutor_id,
          type: 'public_booking_confirmed',
          title: 'Rezerwacja potwierdzona',
          message: `Rezerwacja dla ${studentName} na ${formattedDate} ${timeRange}${subjectLabel ? ` (${subjectLabel})` : ''} została potwierdzona.`,
          metadata: {
            booking_id: bookingRequestId,
            student_name: studentName,
            date: booking.request_date,
            time: timeRange,
          },
        })
      } catch (notificationError) {
        console.error('Error creating notification:', notificationError)
      }
    }

    // Send confirmation email
    if (
      booking.contact_email &&
      tutorData.data &&
      subjectData.data &&
      levelData.data
    ) {
      try {
        const emailResult = await sendFinalBookingConfirmationEmail({
          to: booking.contact_email,
          studentName: studentName,
          tutorName: tutorData.data.full_name,
          subject: subjectData.data.name,
          level: levelData.data.level_name,
          date: formattedDate,
          time: timeRange,
          duration: SLOT_DURATION_MINUTES,
        })

        if (!emailResult.success) {
          console.error('Final booking confirmation email failed:', {
            error: emailResult.error,
            email: booking.contact_email,
            bookingId: bookingRequestId,
          })
        } else {
          console.log('Final booking confirmation email sent successfully:', {
            messageId: emailResult.messageId,
            email: booking.contact_email,
            bookingId: bookingRequestId,
          })
        }
      } catch (emailError) {
        console.error('Failed to send final booking confirmation email:', {
          error: emailError instanceof Error ? emailError.message : String(emailError),
          email: booking.contact_email,
          bookingId: bookingRequestId,
        })
      }
    }

    // Revalidate paths
    revalidatePath('/dashboard/rezerwacje-publiczne')
    revalidatePath('/public/rezerwacje')
    revalidatePath('/dashboard')

    console.log('Booking payment completed successfully:', bookingRequestId)
  } catch (error) {
    console.error('Error handling booking payment completion:', error)
    // Don't throw - we don't want to break the webhook processing
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
      .select('id, student_id, billing_period_id, booking_request_id, amount, ext_order_id')
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
      bookingRequestId: payuPayment.booking_request_id,
    })

    // Handle booking payment completion
    if (notification.status === 'COMPLETED' && payuPayment.booking_request_id) {
      await handleBookingPaymentCompletion(payuPayment.booking_request_id)
    }

    // If payment completed, create or update payment record (for billing payments)
    if (notification.status === 'COMPLETED' && payuPayment.billing_period_id) {
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
