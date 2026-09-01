'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/actions/auth'
import { createNotification } from '@/lib/actions/notifications'
import { sendWithChannel } from '@/lib/notifications/send-with-channel'
import type { NotificationChannel } from '@/lib/types/notifications'
import { sendAvailabilityReminderEmail } from '@/lib/email/send'
import { sendAvailabilityReminderSms } from '@/lib/sms/send'
import { AVAILABILITY_LABELS, availabilityReminderMessage } from '@/lib/labels/availability'
import { getTutorAvailability } from '@/lib/actions/availability'

async function assertAdmin() {
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'admin') {
    throw new Error('Brak uprawnień administratora')
  }
  return profile
}

export async function sendAvailabilityReminderToTutor(
  tutorId: string,
  channel: NotificationChannel = 'email',
  message?: string
) {
  await assertAdmin()

  const availability = await getTutorAvailability(tutorId)
  if (availability) {
    throw new Error('Tutor ma już wypełniony grafik dostępności')
  }

  const supabase = await createClient()

  const { data: tutor, error: tutorError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('id', tutorId)
    .eq('role', 'tutor')
    .single()

  if (tutorError || !tutor) {
    throw new Error(`Nie znaleziono tutora: ${tutorError?.message || 'Nieznany błąd'}`)
  }

  const notificationMessage =
    (message && message.trim()) || availabilityReminderMessage()

  try {
    await createNotification({
      userId: tutorId,
      type: 'availability_reminder',
      title: AVAILABILITY_LABELS.reminderAvailabilityTitle,
      message: notificationMessage,
      metadata: {},
    })
  } catch (notificationError) {
    console.error('Failed to create availability reminder notification:', notificationError)
  }

  const tutorEmail = tutor.email?.trim() || null
  const tutorPhone = tutor.phone?.trim() || null

  const result = await sendWithChannel(channel, {
    sendEmail:
      tutorEmail && (channel === 'email' || channel === 'both')
        ? () =>
            sendAvailabilityReminderEmail({
              to: tutorEmail,
              tutorName: tutor.full_name,
              customMessage: message,
            })
        : undefined,
    sendSms:
      tutorPhone && (channel === 'sms' || channel === 'both')
        ? () =>
            sendAvailabilityReminderSms({
              toPhone: tutorPhone,
              tutorName: tutor.full_name,
              customMessage: message,
            })
        : undefined,
  })

  if (!result.success || result.error) {
    console.error('Availability reminder notification not fully successful:', {
      tutorId,
      email: tutorEmail,
      phone: tutorPhone,
      success: result.success,
      error: result.error,
      details: result.details,
    })
  }

  revalidatePath(`/dashboard/tutorzy/${tutorId}`)
  revalidatePath('/dashboard/dostepnosc-tutorow')
  revalidatePath('/dashboard/powiadomienia')
  revalidatePath('/dashboard', 'layout')

  return result
}
