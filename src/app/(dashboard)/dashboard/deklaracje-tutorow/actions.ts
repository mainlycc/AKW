'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/actions/notifications'
import { sendWithChannel } from '@/lib/notifications/send-with-channel'
import type { NotificationChannel } from '@/lib/types/notifications'
import { sendDeclarationReminderEmail } from '@/lib/email/send'
import { sendDeclarationReminderSms } from '@/lib/sms/send'
import { LABELS, nextMonthPlanReminderMessage } from '@/lib/labels/reports-declarations'

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
  channel: NotificationChannel = 'email',
  message?: string
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
  const notificationMessage =
    (message && message.trim()) ||
    nextMonthPlanReminderMessage(monthName, year)

  await createNotification({
    userId: tutorId,
    type: 'declaration_reminder',
    title: LABELS.reminderNextMonthPlanTitle,
    message: notificationMessage,
    metadata: {
      month,
      year,
      month_name: monthName,
    },
  })

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
              customMessage: message,
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
              customMessage: message,
            })
        : undefined,
  })

  if (!result.success || result.error) {
    console.error('Declaration reminder notification not fully successful:', {
      tutorId,
      email: tutorEmail,
      phone: tutorPhone,
      success: result.success,
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
  channel: NotificationChannel = 'email',
  message?: string
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
    return { success: true, sent: 0, errors: [] as string[], message: LABELS.allTutorsSubmittedNextMonthPlan }
  }

  const monthName = monthNames[month - 1] || `Miesiąc ${month}`
  const notificationMessage =
    (message && message.trim()) ||
    nextMonthPlanReminderMessage(monthName, year)
  const errors: string[] = []
  const warnings: string[] = []
  let sentCount = 0

  for (const tutor of tutorsWithoutDeclarations) {
    try {
      await createNotification({
        userId: tutor.id,
        type: 'declaration_reminder',
        title: LABELS.reminderNextMonthPlanTitle,
        message: notificationMessage,
        metadata: {
          month,
          year,
          month_name: monthName,
        },
        skipRevalidate: true,
      })

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
                  customMessage: message,
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
                  customMessage: message,
                })
            : undefined,
      })

      if (result.success) {
        sentCount++
        if (result.error || result.details?.email || result.details?.sms) {
          warnings.push(
            `${tutor.full_name}: ${
              result.error || result.details?.email || result.details?.sms || 'Częściowa wysyłka'
            }`
          )
        }
      } else {
        errors.push(
          `${tutor.full_name}: ${
            result.error || result.details?.email || result.details?.sms || 'Nie udało się wysłać powiadomienia'
          }`
        )
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
      ? warnings.length > 0
        ? `Wysłano ${sentCount} przypomnień, ale część kanałów nie była dostępna lub nie powiodła się: ${warnings.join('; ')}`
        : `Wysłano ${sentCount} przypomnień`
      : `Wysłano ${sentCount} przypomnień, ${errors.length} błędów`,
  }
}

