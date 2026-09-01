'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensurePublicBookingPaymentHistory } from '@/lib/billing/public-booking-payment'
import { backfillAdminReservationPayuPayments } from '@/lib/actions/payu'
import { revalidatePath } from 'next/cache'

export type PaymentMethod = 'transfer' | 'cash' | 'online'

export interface Payment {
  id: string
  student_id: string
  billing_period_id: string
  amount: number
  payment_method: PaymentMethod
  payment_date: string
  notes: string | null
  payu_order_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  students: {
    id: string
    first_name: string
    last_name: string
  }
  billing_periods: {
    id: string
    month: number
    year: number
  }
}

export interface PaymentWithParent extends Payment {
  parent?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
  }
}

export interface PaymentFilters {
  studentId?: string
  studentIds?: string[]
  parentId?: string
  paymentMethod?: PaymentMethod
  startDate?: string
  endDate?: string
  month?: number
  year?: number
}

export interface CreatePaymentData {
  student_id: string
  billing_period_id: string
  amount: number
  payment_method: PaymentMethod
  payment_date: string
  notes?: string
}

/**
 * Get or create billing period
 */
export async function getOrCreateBillingPeriod(
  month: number,
  year: number
): Promise<string> {
  const supabase = await createClient()

  const { data: period } = await supabase
    .from('billing_periods')
    .select('id')
    .eq('month', month)
    .eq('year', year)
    .single()

  if (period) {
    return period.id
  }

  // Create new period
  const { data: newPeriod, error } = await supabase
    .from('billing_periods')
    .insert({ month, year })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to create billing period: ${error.message}`)
  }

  return newPeriod.id
}

/**
 * Create a payment
 */
export async function createPayment(
  data: CreatePaymentData,
  createdBy: string
): Promise<string> {
  const supabase = await createClient()

  // For online payments, save as pending (will be confirmed via PayU webhook)
  // For transfer/cash, save directly as completed
  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      student_id: data.student_id,
      billing_period_id: data.billing_period_id,
      amount: data.amount,
      payment_method: data.payment_method,
      payment_date: data.payment_date,
      notes: data.notes || null,
      created_by: createdBy,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to create payment: ${error.message}`)
  }

  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/billing')

  return payment.id
}

/**
 * Update a payment
 */
export async function updatePayment(
  id: string,
  data: Partial<CreatePaymentData>
): Promise<void> {
  const supabase = await createClient()

  const updateData: {
    amount?: number
    payment_method?: PaymentMethod
    payment_date?: string
    notes?: string | null
  } = {}
  if (data.amount !== undefined) updateData.amount = data.amount
  if (data.payment_method !== undefined)
    updateData.payment_method = data.payment_method
  if (data.payment_date !== undefined) updateData.payment_date = data.payment_date
  if (data.notes !== undefined) updateData.notes = data.notes || null

  const { error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update payment: ${error.message}`)
  }

  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/billing')
}

/**
 * Delete a payment
 */
export async function deletePayment(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from('payments').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete payment: ${error.message}`)
  }

  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/billing')
}

/**
 * Get payments with filters
 */
export async function getPayments(
  filters?: PaymentFilters
): Promise<PaymentWithParent[]> {
  const supabase = await createClient()

  // Backfill payment history for completed public-booking PayU orders
  try {
    const admin = createAdminClient()
    const { data: completedBookingPayu } = await admin
      .from('payu_payments')
      .select('booking_request_id')
      .eq('status', 'COMPLETED')
      .not('booking_request_id', 'is', null)

    for (const row of completedBookingPayu || []) {
      if (row.booking_request_id) {
        await ensurePublicBookingPaymentHistory(admin, row.booking_request_id)
      }
    }
  } catch (error) {
    console.error('[getPayments] Public booking payment backfill failed:', error)
  }

  try {
    await backfillAdminReservationPayuPayments()
  } catch (error) {
    console.error('[getPayments] Admin reservation payment backfill failed:', error)
  }

  let query = supabase
    .from('payments')
    .select(
      `
      *,
      students (
        id,
        first_name,
        last_name
      ),
      billing_periods (
        id,
        month,
        year
      )
    `
    )
    .order('payment_date', { ascending: false })

  if (filters?.studentIds && filters.studentIds.length > 0) {
    query = query.in('student_id', filters.studentIds)
  } else if (filters?.studentId) {
    query = query.eq('student_id', filters.studentId)
  }

  if (filters?.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod)
  }

  if (filters?.startDate) {
    query = query.gte('payment_date', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('payment_date', filters.endDate)
  }

  if (filters?.month && filters?.year) {
    const { data: period } = await supabase
      .from('billing_periods')
      .select('id')
      .eq('month', filters.month)
      .eq('year', filters.year)
      .single()

    if (period) {
      query = query.eq('billing_period_id', period.id)
    }
  }

  const { data: payments, error } = await query

  if (error) {
    throw new Error(`Failed to fetch payments: ${error.message}`)
  }

  // Get parent information for each payment
  const paymentsWithParents: PaymentWithParent[] = []

  for (const payment of payments || []) {
    const paymentData = payment as Payment

    // Get parents (prefer primary with contact data, then any with contact, then first)
    const { data: parentRows } = await supabase
      .from('student_parents')
      .select(
        `
        is_primary,
        parents (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `
      )
      .eq('student_id', paymentData.student_id)
      .order('is_primary', { ascending: false })

    const parentsArray = (parentRows || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => {
        const p = row?.parents
          ? (Array.isArray(row.parents) ? row.parents[0] : row.parents)
          : null
        return {
          is_primary: Boolean(row?.is_primary),
          parent: p as {
            id: string
            first_name: string
            last_name: string
            email: string
            phone: string | null
          } | null,
        }
      })
      .filter((x) => Boolean(x.parent))

    const hasContact = (p: { email: string; phone: string | null }) =>
      Boolean((p.email && p.email.trim()) || (p.phone && p.phone.trim()))

    const primaryWithContact = parentsArray.find((x) => x.is_primary && x.parent && hasContact(x.parent))
    const anyWithContact = parentsArray.find((x) => x.parent && hasContact(x.parent))
    const firstAny = parentsArray[0]

    const selected = (primaryWithContact || anyWithContact || firstAny)?.parent || undefined

    paymentsWithParents.push({
      ...paymentData,
      parent: selected
        ? {
            id: selected.id,
            first_name: selected.first_name,
            last_name: selected.last_name,
            email: selected.email,
            phone: selected.phone,
          }
        : undefined,
    })
  }

  // Filter by parent if specified
  if (filters?.parentId) {
    return paymentsWithParents.filter(
      (p) => p.parent?.id === filters.parentId
    )
  }

  return paymentsWithParents
}

/**
 * Export payments to CSV
 */
export async function exportPaymentsToCSV(
  filters?: PaymentFilters
): Promise<string> {
  const payments = await getPayments(filters)

  // CSV header
  const headers = [
    'Data',
    'Uczeń',
    'Rodzic',
    'Kwota',
    'Metoda',
    'Miesiąc',
    'Notatka',
  ]

  // CSV rows
  const rows = payments.map((payment) => {
    const studentName = `${payment.students.first_name} ${payment.students.last_name}`
    const parentName = payment.parent
      ? `${payment.parent.first_name} ${payment.parent.last_name}`
      : ''
    const monthYear = `${payment.billing_periods.month}/${payment.billing_periods.year}`
    const methodMap: Record<PaymentMethod, string> = {
      transfer: 'Przelew',
      cash: 'Gotówka',
      online: 'Online',
    }

    return [
      payment.payment_date,
      studentName,
      parentName,
      payment.amount.toFixed(2),
      methodMap[payment.payment_method],
      monthYear,
      payment.notes || '',
    ]
  })

  // Combine header and rows
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')

  return csvContent
}


