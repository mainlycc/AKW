'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/actions/notifications'
import { sendWithChannel } from '@/lib/notifications/send-with-channel'
import type { NotificationChannel } from '@/lib/types/notifications'
import { sendDeclarationReminderEmail } from '@/lib/email/send'
import { sendDeclarationReminderSms } from '@/lib/sms/send'

const monthNames = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
]

/**
 * Wysyła przypomnienie o deklaracji do pojedynczego tutora
 */
export async function sendDeclarationReminderToTutor(
  tutorId: string,
  month: number,
  year: number,
  channel: NotificationChannel = 'email'
) {
  const supabase = await createClient()

  const { data: tutor, error: tutorError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('id', tutorId)
    .eq('role', 'tutor')
    .single()

  if (tutorError || !tutor) {
    throw new Error(`Tutor not found: ${tutorError?.message || 'Unknown error'}`)
  }

  const monthName = monthNames[month - 1] || `Miesiąc ${month}`

  // Nie blokuj wysyłki email/SMS, jeśli system powiadomień (DB enum) nie jest zaktualizowany.
  try {
    await createNotification({
      userId: tutorId,
      type: 'declaration_reminder',
      title: 'Przypomnienie o deklaracji miesięcznej',
      message: `Przypominamy o złożeniu deklaracji miesięcznej za okres ${monthName} ${year}.`,
      metadata: {
        month,
        year,
        month_name: monthName,
      },
    })
  } catch (notificationError) {
    console.error('Failed to create declaration reminder notification:', notificationError)
  }

  const tutorEmail = tutor.email?.trim() || null
  const tutorPhone = tutor.phone?.trim() || null

  const result = await sendWithChannel(channel, {
    sendEmail:
      tutorEmail && (channel === 'email' || channel === 'both')
        ? () =>
            sendDeclarationReminderEmail({
              to: tutorEmail,
              tutorName: tutor.full_name,
              month,
              year,
            })
        : undefined,
    sendSms:
      tutorPhone && (channel === 'sms' || channel === 'both')
        ? () =>
            sendDeclarationReminderSms({
              toPhone: tutorPhone,
              tutorName: tutor.full_name,
              month,
              year,
            })
        : undefined,
  })

  if (!result.success) {
    console.error('Failed to send declaration reminder notification:', {
      tutorId,
      email: tutorEmail,
      phone: tutorPhone,
      error: result.error,
      details: result.details,
    })
  }

  revalidatePath('/dashboard/deklaracje-tutorow')
  revalidatePath('/dashboard/powiadomienia')
  revalidatePath('/dashboard', 'layout')

  return result
}

/**
 * Wysyła przypomnienia o deklaracji do wszystkich tutorów, którzy nie złożyli deklaracji za dany miesiąc
 */
export async function sendDeclarationRemindersToAllMissing(
  month: number,
  year: number,
  channel: NotificationChannel = 'email'
) {
  const supabase = await createClient()

  const { data: allTutors, error: tutorsError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('role', 'tutor')
    .order('full_name')

  if (tutorsError) {
    throw new Error(`Error fetching tutors: ${tutorsError.message}`)
  }

  if (!allTutors || allTutors.length === 0) {
    return { success: true, sent: 0, errors: [] as string[] }
  }

  const { data: existingDeclarations, error: declarationsError } = await supabase
    .from('monthly_declarations')
    .select('tutor_id, status')
    .eq('month', month)
    .eq('year', year)
    .in('status', ['submitted', 'approved'])

  if (declarationsError) {
    throw new Error(`Error fetching declarations: ${declarationsError.message}`)
  }

  const tutorsWithDeclarations = new Set(existingDeclarations?.map(d => d.tutor_id) || [])
  const tutorsWithoutDeclarations = allTutors.filter(t => !tutorsWithDeclarations.has(t.id))

  if (tutorsWithoutDeclarations.length === 0) {
    return { success: true, sent: 0, errors: [] as string[], message: 'Wszyscy tutorzy złożyli już deklarację za ten okres.' }
  }

  const monthName = monthNames[month - 1] || `Miesiąc ${month}`
  const errors: string[] = []
  let sentCount = 0

  for (const tutor of tutorsWithoutDeclarations) {
    try {
      try {
        await createNotification({
          userId: tutor.id,
          type: 'declaration_reminder',
          title: 'Przypomnienie o deklaracji miesięcznej',
          message: `Przypominamy o złożeniu deklaracji miesięcznej za okres ${monthName} ${year}.`,
          metadata: {
            month,
            year,
            month_name: monthName,
          },
          skipRevalidate: true,
        })
      } catch (notificationError) {
        console.error('Failed to create declaration reminder notification (batch):', {
          tutorId: tutor.id,
          error: notificationError,
        })
      }

      const tutorEmail = tutor.email?.trim() || null
      const tutorPhone = tutor.phone?.trim() || null

      const result = await sendWithChannel(channel, {
        sendEmail:
          tutorEmail && (channel === 'email' || channel === 'both')
            ? () =>
                sendDeclarationReminderEmail({
                  to: tutorEmail,
                  tutorName: tutor.full_name,
                  month,
                  year,
                })
            : undefined,
        sendSms:
          tutorPhone && (channel === 'sms' || channel === 'both')
            ? () =>
                sendDeclarationReminderSms({
                  toPhone: tutorPhone,
                  tutorName: tutor.full_name,
                  month,
                  year,
                })
            : undefined,
      })

      if (!result.success) {
        errors.push(`${tutor.full_name}: ${result.error || 'Nie udało się wysłać powiadomienia'}`)
      } else {
        sentCount++
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Nieznany błąd'
      errors.push(`${tutor.full_name}: ${msg}`)
    }
  }

  revalidatePath('/dashboard/deklaracje-tutorow')
  revalidatePath('/dashboard/powiadomienia')
  revalidatePath('/dashboard', 'layout')

  const success = errors.length === 0
  return {
    success,
    sent: sentCount,
    errors,
    message: success
      ? `Wysłano ${sentCount} przypomnień`
      : `Wysłano ${sentCount} przypomnień, ${errors.length} błędów`,
  }
}

