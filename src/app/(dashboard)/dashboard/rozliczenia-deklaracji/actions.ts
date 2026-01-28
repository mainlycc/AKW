'use server'

import { sendPayUPayments } from '@/lib/actions/payu'

export async function sendPayUPaymentsAction(
  studentIds: string[],
  month: number,
  year: number
) {
  return await sendPayUPayments(studentIds, month, year)
}

