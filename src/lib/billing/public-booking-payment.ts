import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export function billingPeriodFromDateString(dateStr: string): { month: number; year: number } | null {
  const parts = dateStr.split('-')
  if (parts.length < 2) return null
  const year = Number(parts[0])
  const month = Number(parts[1])
  if (!year || month < 1 || month > 12) return null
  return { month, year }
}

/** Billing periods up to the current calendar month (no future months). */
export function isBillingPeriodAllowed(
  month: number,
  year: number,
  now = new Date()
): boolean {
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  if (year > currentYear) return false
  if (year === currentYear && month > currentMonth) return false
  return true
}

export async function getOrCreateBillingPeriodAdmin(
  admin: AdminClient,
  month: number,
  year: number,
  options?: { allowFuture?: boolean }
): Promise<string | null> {
  if (!options?.allowFuture && !isBillingPeriodAllowed(month, year)) {
    return null
  }

  const { data: period } = await admin
    .from('billing_periods')
    .select('id')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (period) {
    return period.id
  }

  const { data: newPeriod, error } = await admin
    .from('billing_periods')
    .insert({ month, year })
    .select('id')
    .single()

  if (error || !newPeriod) {
    console.error('[getOrCreateBillingPeriodAdmin] Failed to create billing period:', error)
    return null
  }

  return newPeriod.id
}

type BookingWithSession = {
  request_date: string
  session_id: string | null
  tutoring_sessions: {
    session_date: string
    status: string
  } | {
    session_date: string
    status: string
  }[] | null
}

function resolveSession(booking: BookingWithSession): { session_date: string; status: string } | null {
  if (!booking.tutoring_sessions) return null
  const session = Array.isArray(booking.tutoring_sessions)
    ? booking.tutoring_sessions[0]
    : booking.tutoring_sessions
  if (!session?.session_date) return null
  return session
}

async function resolvePaymentCreatedBy(
  admin: AdminClient,
  bookingRequestId: string
): Promise<string | null> {
  const { data: booking } = await admin
    .from('public_booking_requests')
    .select('tutor_id')
    .eq('id', bookingRequestId)
    .maybeSingle()

  if (booking?.tutor_id) {
    const { data: tutorProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('id', booking.tutor_id)
      .maybeSingle()

    if (tutorProfile?.id) {
      return tutorProfile.id
    }
  }

  const { data: adminProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  return adminProfile?.id ?? null
}

/**
 * Record a completed PayU public-booking payment in the payments table for payment history.
 * Uses the payment date month as billing period (when the money was received).
 */
export async function recordPublicBookingPaymentHistory(
  admin: AdminClient,
  params: {
    studentId: string
    bookingRequestId: string
    orderId: string
    amount: number
    paymentMethodType?: string
    paymentDate?: string
  }
): Promise<boolean> {
  const { data: existingPayments } = await admin
    .from('payments')
    .select('id')
    .eq('payu_order_id', params.orderId)
    .limit(1)

  if (existingPayments && existingPayments.length > 0) {
    return false
  }

  const { data: booking, error: bookingError } = await admin
    .from('public_booking_requests')
    .select('request_date, student_first_name, student_last_name')
    .eq('id', params.bookingRequestId)
    .single()

  if (bookingError || !booking) {
    console.error('[recordPublicBookingPaymentHistory] Booking request not found:', bookingError)
    return false
  }

  const paymentDate = params.paymentDate || new Date().toISOString().split('T')[0]
  const paymentPeriod = billingPeriodFromDateString(paymentDate)
  if (!paymentPeriod) {
    return false
  }

  const billingPeriodId = await getOrCreateBillingPeriodAdmin(
    admin,
    paymentPeriod.month,
    paymentPeriod.year
  )

  if (!billingPeriodId) {
    return false
  }

  const methodLabel = params.paymentMethodType || 'unknown'
  const lessonDate = booking.request_date
  const studentName = `${booking.student_first_name} ${booking.student_last_name}`.trim()

  const createdBy = await resolvePaymentCreatedBy(admin, params.bookingRequestId)
  if (!createdBy) {
    console.error('[recordPublicBookingPaymentHistory] No valid created_by profile found')
    return false
  }

  const { error: paymentError } = await admin.from('payments').insert({
    student_id: params.studentId,
    billing_period_id: billingPeriodId,
    amount: params.amount,
    payment_method: 'online',
    payment_date: paymentDate,
    payu_order_id: params.orderId,
    notes: `Płatność online PayU za rezerwację publiczną (${studentName}, lekcja ${lessonDate}) - ${methodLabel}`,
    created_by: createdBy,
  })

  if (paymentError) {
    console.error('[recordPublicBookingPaymentHistory] Failed to insert payment:', paymentError)
    return false
  }

  return true
}

export type BookingPayuPaymentRow = {
  student_id: string
  amount: number
  order_id: string
  booking_request_id: string
}

/**
 * Completed PayU payments for public bookings with completed lessons in a billing period.
 * Used for lesson receivables (not payment history).
 */
export async function getCompletedBookingPayuPaymentsForPeriod(
  admin: AdminClient,
  studentIds: string[],
  month: number,
  year: number
): Promise<BookingPayuPaymentRow[]> {
  if (studentIds.length === 0 || !isBillingPeriodAllowed(month, year)) {
    return []
  }

  const { data: bookingPayments, error } = await admin
    .from('payu_payments')
    .select(
      `
      student_id,
      amount,
      order_id,
      booking_request_id,
      public_booking_requests!payu_payments_booking_request_id_fkey (
        request_date,
        session_id,
        tutoring_sessions (
          session_date,
          status
        )
      )
    `
    )
    .in('student_id', studentIds)
    .eq('status', 'COMPLETED')
    .not('booking_request_id', 'is', null)

  if (error || !bookingPayments) {
    console.error('[getCompletedBookingPayuPaymentsForPeriod] Query failed:', error)
    return []
  }

  const result: BookingPayuPaymentRow[] = []

  for (const row of bookingPayments) {
    if (!row.order_id || !row.booking_request_id) {
      continue
    }

    const booking = Array.isArray(row.public_booking_requests)
      ? row.public_booking_requests[0]
      : row.public_booking_requests

    if (!booking) {
      continue
    }

    const session = resolveSession(booking as BookingWithSession)
    if (!session || session.status !== 'completed') {
      continue
    }

    const periodParts = billingPeriodFromDateString(session.session_date)
    if (!periodParts || periodParts.month !== month || periodParts.year !== year) {
      continue
    }

    result.push({
      student_id: row.student_id,
      amount: parseFloat(row.amount?.toString() || '0'),
      order_id: row.order_id,
      booking_request_id: row.booking_request_id,
    })
  }

  return result
}

/** Ensure payment history row exists after PayU booking payment (idempotent). */
export async function ensurePublicBookingPaymentHistory(
  admin: AdminClient,
  bookingRequestId: string,
  paymentMethodType?: string
): Promise<boolean> {
  const { data: payuPayment } = await admin
    .from('payu_payments')
    .select('student_id, order_id, amount, status, updated_at')
    .eq('booking_request_id', bookingRequestId)
    .eq('status', 'COMPLETED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payuPayment?.order_id || !payuPayment.student_id) {
    return false
  }

  const paymentDate = payuPayment.updated_at
    ? new Date(payuPayment.updated_at).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  return recordPublicBookingPaymentHistory(admin, {
    studentId: payuPayment.student_id,
    bookingRequestId,
    orderId: payuPayment.order_id,
    amount: parseFloat(payuPayment.amount?.toString() || '0'),
    paymentMethodType,
    paymentDate,
  })
}
