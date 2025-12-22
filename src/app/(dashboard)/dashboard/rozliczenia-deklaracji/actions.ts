'use server'

import { sendPaynowPayments } from '@/lib/actions/paynow'

export async function sendPaynowPaymentsAction(
  studentIds: string[],
  month: number,
  year: number
) {
  return await sendPaynowPayments(studentIds, month, year)
}

