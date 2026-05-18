'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendTutorGroupMessageEmail } from '@/lib/email/send'
import type { NotificationChannel } from '@/lib/types/notifications'
import { sendTutorGroupMessageSms } from '@/lib/sms/send'
import { sendWithChannel } from '@/lib/notifications/send-with-channel'
import {
  createBulkSendStats,
  formatBulkSendResultMessage,
  recordBulkSendOutcome,
} from '@/lib/notifications/bulk-send-summary'

export async function updateTutorDetails(
  tutorId: string,
  data: {
    full_name: string
    phone: string
    bio: string
    hourly_rate: number | null
    public_booking_enabled: boolean
  }
) {
  const supabase = await createClient()

  // Najpierw sprawdźmy czy tutora istnieje i czy użytkownik ma uprawnienia
  const { data: profile, error: checkError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', tutorId)
    .eq('role', 'tutor')
    .single()

  if (checkError || !profile) {
    throw new Error('Nie znaleziono tutora do aktualizacji')
  }

  // Teraz wykonajmy aktualizację
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: data.full_name.trim(),
      phone: data.phone.trim() || null,
      bio: data.bio.trim() || null,
      hourly_rate: data.hourly_rate,
      public_booking_enabled: data.public_booking_enabled,
    })
    .eq('id', tutorId)
    .eq('role', 'tutor')

  if (error) {
    console.error('Error updating tutor details:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    console.error('Error details:', error.details)
    console.error('Error hint:', error.hint)
    
    // Jeśli błąd związany z RLS (brak uprawnień)
    if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
      throw new Error('Brak uprawnień do aktualizacji. Upewnij się, że migracja 037_add_profiles_admin_update_policy.sql została uruchomiona.')
    }
    
    throw new Error(`Nie udało się zaktualizować danych tutora: ${error.message} (Kod: ${error.code})`)
  }

  revalidatePath('/dashboard/tutorzy')
  revalidatePath(`/dashboard/tutorzy/${tutorId}`)
}

export async function deleteTutor(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.from('profiles').delete().eq('id', id).eq('role', 'tutor').select()

  if (error) {
    console.error('Błąd podczas usuwania tutora:', error)
    throw new Error(`Nie udało się usunąć tutora: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error('Nie znaleziono tutora do usunięcia lub brak uprawnień')
  }

  revalidatePath('/dashboard/tutorzy')
}

export async function setTutorsPublicBookingEnabled(params: {
  tutorIds: string[]
  enabled: boolean
}) {
  const supabase = await createClient()

  const tutorIds = Array.from(new Set(params.tutorIds)).filter(Boolean)
  if (tutorIds.length === 0) {
    return
  }

  const { error } = await supabase
    .from('profiles')
    .update({ public_booking_enabled: params.enabled })
    .in('id', tutorIds)
    .eq('role', 'tutor')

  if (error) {
    console.error('Error updating tutors public_booking_enabled:', error)
    throw new Error(`Nie udało się zaktualizować dostępności tutorów: ${error.message}`)
  }

  revalidatePath('/dashboard/tutorzy')
  for (const id of tutorIds) {
    revalidatePath(`/dashboard/tutorzy/${id}`)
  }
}

export async function sendGroupMessageToTutors(
  selectedTutorIds: string[],
  message: string,
  channel: NotificationChannel = 'email'
): Promise<{ success: boolean; error?: string; sentCount?: number; failedCount?: number }> {
  const supabase = await createClient()

  // Proste ograniczenie prędkości wysyłki maili, żeby nie przekraczać limitów Resend
  // Resend pozwala na 2 żądania na sekundę, więc wprowadzamy odstęp między wysyłkami.
  const RATE_LIMIT_PER_SECOND = 2
  const REQUEST_INTERVAL_MS = Math.ceil(1000 / RATE_LIMIT_PER_SECOND) + 100 // mały zapas ponad limit

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  if (!selectedTutorIds || selectedTutorIds.length === 0) {
    return { success: false, error: 'Nie wybrano tutorów' }
  }

  if (!message || !message.trim()) {
    return { success: false, error: 'Treść wiadomości nie może być pusta' }
  }

  // Pobierz tutorów z danymi kontaktowymi
  const { data: tutors, error: tutorsError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .in('id', selectedTutorIds)
    .eq('role', 'tutor')

  if (tutorsError) {
    console.error('Error fetching tutors:', tutorsError)
    return { success: false, error: 'Nie udało się pobrać danych tutorów' }
  }

  if (!tutors || tutors.length === 0) {
    return { success: false, error: 'Nie znaleziono zaznaczonych tutorów' }
  }

  // Wyślij wiadomość do każdego tutora według wybranego kanału
  let sentCount = 0
  let failedCount = 0
  const bulkStats = createBulkSendStats()

  // URL aplikacji do budowy absolutnego linku do obrazka
  let appUrl = 'http://localhost:3000'
  if (process.env.NEXT_PUBLIC_APP_URL) {
    appUrl = process.env.NEXT_PUBLIC_APP_URL
  } else if (process.env.VERCEL_URL) {
    appUrl = `https://${process.env.VERCEL_URL}`
  }
  const headerImageUrl = `${appUrl}/akademia_wiedzy.png`

  for (let index = 0; index < tutors.length; index++) {
    const tutor = tutors[index]

    const hasEmail = !!(tutor.email && tutor.email.trim())
    const hasPhone = !!(tutor.phone && tutor.phone.trim())

    const result = await sendWithChannel(channel, {
      sendEmail:
        hasEmail && (channel === 'email' || channel === 'both')
          ? () =>
              sendTutorGroupMessageEmail({
                to: tutor.email as string,
                tutorName: tutor.full_name,
                message: message.trim(),
                headerImageUrl,
              })
          : undefined,
      sendSms:
        hasPhone && (channel === 'sms' || channel === 'both')
          ? () =>
              sendTutorGroupMessageSms({
                toPhone: tutor.phone as string,
                tutorName: tutor.full_name,
                message: message.trim(),
              })
          : undefined,
    })

    if (result.success) {
      sentCount++
      recordBulkSendOutcome(bulkStats, {
        success: true,
        channel,
        hasEmail,
        hasPhone,
        details: result.details,
      })
    } else {
      failedCount++
      recordBulkSendOutcome(bulkStats, {
        success: false,
        channel,
        hasEmail,
        hasPhone,
        details: result.details,
      })
    }

    // Jeżeli są jeszcze kolejni tutorzy, odczekaj chwilę, aby nie przekroczyć limitu 2 req/s
    if (index < tutors.length - 1) {
      await sleep(REQUEST_INTERVAL_MS)
    }
  }

  revalidatePath('/dashboard/tutorzy')

  const summaryMessage = formatBulkSendResultMessage(sentCount, bulkStats)

  if (failedCount > 0 && sentCount === 0) {
    return {
      success: false,
      error: summaryMessage ?? 'Nie udało się wysłać żadnej wiadomości.',
      sentCount,
      failedCount,
    }
  }

  if (summaryMessage) {
    return {
      success: true,
      error: summaryMessage,
      sentCount,
      failedCount,
    }
  }

  return {
    success: true,
    sentCount,
    failedCount: 0,
  }
}

