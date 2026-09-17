'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserProfile } from '@/lib/actions/auth'
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
    messenger_url: string
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
      messenger_url: data.messenger_url.trim() || null,
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

function isTransientSupabaseError(error: { message?: string; details?: string; code?: string } | null | undefined) {
  if (!error) return false
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.code ?? ''}`.toLowerCase()
  return (
    text.includes('fetch failed') ||
    text.includes('connect_timeout') ||
    text.includes('und_err') ||
    text.includes('network') ||
    text.includes('econnreset') ||
    text.includes('etimedout')
  )
}

function formatDeleteError(prefix: string, error: { message?: string }) {
  if (isTransientSupabaseError(error)) {
    return `${prefix}: brak połączenia z bazą (timeout). Spróbuj ponownie za chwilę.`
  }
  return `${prefix}: ${error.message ?? 'Nieznany błąd'}`
}

async function withSupabaseRetry<T extends { error: { message?: string; details?: string; code?: string } | null }>(
  operation: () => PromiseLike<T>,
  attempts = 3
): Promise<T> {
  let last: T | undefined
  for (let i = 0; i < attempts; i++) {
    last = await operation()
    if (!last.error || !isTransientSupabaseError(last.error)) {
      return last
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)))
    }
  }
  return last as T
}

export async function deleteTutor(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const profile = await getUserProfile()
  if (!profile || profile.role !== 'admin') {
    return { success: false, error: 'Brak uprawnień do usuwania tutorów' }
  }

  try {
    // Sesja użytkownika (RLS admin) — mniej round-tripów niż pełny cleanup audytu
    const supabase = await createClient()

    const { data: tutor, error: tutorError } = await withSupabaseRetry(() =>
      supabase
        .from('profiles')
        .select('id')
        .eq('id', id)
        .eq('role', 'tutor')
        .maybeSingle()
    )

    if (tutorError) {
      console.error('Błąd podczas sprawdzania tutora:', tutorError)
      return { success: false, error: formatDeleteError('Nie udało się sprawdzić tutora', tutorError) }
    }

    if (!tutor) {
      return { success: false, error: 'Nie znaleziono tutora do usunięcia' }
    }

    // Usuń sloty przed profilem (RESTRICT na assignment) — z retry przy timeoutach sieci
    const { error: slotsError } = await withSupabaseRetry(() =>
      supabase.from('booked_slots').delete().eq('tutor_id', id)
    )

    if (slotsError) {
      console.error('Błąd podczas usuwania slotów tutora:', slotsError)
      return {
        success: false,
        error: formatDeleteError('Nie udało się usunąć rezerwacji tutora', slotsError),
      }
    }

    const { data, error } = await withSupabaseRetry(() =>
      supabase.from('profiles').delete().eq('id', id).eq('role', 'tutor').select('id')
    )

    if (error) {
      // Awaryjnie: przepnij audyt tylko gdy FK nadal blokuje
      const isFk = `${error.message} ${error.code ?? ''}`.toLowerCase().includes('foreign key')
        || error.code === '23503'

      if (isFk) {
        const admin = createAdminClient()
        const auditReassignments: Array<{ table: string; column: string }> = [
          { table: 'booked_slots', column: 'created_by' },
          { table: 'tutoring_sessions', column: 'created_by' },
          { table: 'student_assignments', column: 'assigned_by' },
          { table: 'student_notes', column: 'created_by' },
          { table: 'payments', column: 'created_by' },
          { table: 'monthly_reports', column: 'approved_by' },
          { table: 'monthly_declarations', column: 'approved_by' },
        ]

        for (const { table, column } of auditReassignments) {
          const { error: reassignError } = await admin
            .from(table as 'booked_slots')
            .update({ [column]: profile.id })
            .eq(column, id)

          if (reassignError) {
            console.error(`Błąd podczas przepinania ${table}.${column}:`, reassignError)
            return {
              success: false,
              error: formatDeleteError(`Nie udało się odpiąć powiązań (${table}.${column})`, reassignError),
            }
          }
        }

        const retry = await withSupabaseRetry(() =>
          supabase.from('profiles').delete().eq('id', id).eq('role', 'tutor').select('id')
        )

        if (retry.error) {
          console.error('Błąd podczas usuwania tutora (retry):', retry.error)
          return { success: false, error: formatDeleteError('Nie udało się usunąć tutora', retry.error) }
        }

        if (!retry.data || retry.data.length === 0) {
          return { success: false, error: 'Nie znaleziono tutora do usunięcia lub brak uprawnień' }
        }
      } else {
        console.error('Błąd podczas usuwania tutora:', error)
        return { success: false, error: formatDeleteError('Nie udało się usunąć tutora', error) }
      }
    } else if (!data || data.length === 0) {
      return { success: false, error: 'Nie znaleziono tutora do usunięcia lub brak uprawnień' }
    }

    try {
      const admin = createAdminClient()
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(id)
      if (authDeleteError) {
        console.error('Błąd podczas usuwania konta auth tutora:', authDeleteError)
      }
    } catch (authError) {
      console.error('Błąd podczas usuwania konta auth tutora:', authError)
    }

    revalidatePath('/dashboard/tutorzy', 'page')
    revalidatePath('/dashboard/tutorzy', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Nieoczekiwany błąd podczas usuwania tutora:', error)
    const message = error instanceof Error ? error.message : 'Nieznany błąd'
    if (message.toLowerCase().includes('fetch failed')) {
      return {
        success: false,
        error: 'Brak połączenia z bazą (timeout). Spróbuj ponownie za chwilę.',
      }
    }
    return { success: false, error: message }
  }
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

