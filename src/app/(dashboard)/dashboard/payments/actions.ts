'use server'

import { revalidatePath } from 'next/cache'
import {
  createPayment,
  updatePayment,
  deletePayment,
  type CreatePaymentData,
} from '@/lib/actions/payments'
import { getUserProfile } from '@/lib/actions/auth'

export async function createPaymentAction(data: CreatePaymentData) {
  const profile = await getUserProfile()
  if (!profile) {
    throw new Error('Unauthorized')
  }

  await createPayment(data, profile.id)
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/billing')
}

export async function updatePaymentAction(
  id: string,
  data: Partial<CreatePaymentData>
) {
  await updatePayment(id, data)
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/billing')
}

export async function deletePaymentAction(id: string) {
  await deletePayment(id)
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/billing')
}

