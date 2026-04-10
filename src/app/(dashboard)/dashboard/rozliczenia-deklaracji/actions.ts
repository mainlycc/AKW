'use server'

import { previewPayUPaymentsFromDeclarations, sendPayUPayments } from '@/lib/actions/payu'
import type { NotificationChannel } from '@/lib/types/notifications'

export async function sendPayUPaymentsAction(
  studentIds: string[],
  month: number,
  year: number,
  channel: NotificationChannel = 'email'
) {
  return await sendPayUPayments(studentIds, month, year, channel)
}

export async function previewPayUPaymentsAction(
  studentIds: string[],
  month: number,
  year: number,
  channel: NotificationChannel = 'email'
) {
  return await previewPayUPaymentsFromDeclarations(studentIds, month, year, channel)
}

