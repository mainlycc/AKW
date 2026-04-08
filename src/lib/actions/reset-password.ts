'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPasswordResetEmail } from '@/lib/email/send'

function getAppBaseUrl(): string {
  let baseUrl = 'http://localhost:3000'

  if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL
  } else if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
  }

  return baseUrl.replace(/\/+$/, '')
}

/**
 * Supabase czasem zwraca w action_link tylko Site URL (bez /reset-password), jeśli
 * pełny redirect nie jest dopasowany w panelu — wtedy po verify lądujemy na stronie głównej.
 * Nadpisujemy redirect_to w linku verify, żeby zawsze trafić na formularz resetu.
 */
function withRecoveryRedirectTo(actionLink: string, redirectTo: string): string {
  try {
    const url = new URL(actionLink)
    if (url.pathname.includes('/verify') && url.searchParams.get('type') === 'recovery') {
      url.searchParams.set('redirect_to', redirectTo)
      return url.toString()
    }
  } catch {
    // nieparsowalny URL — zostaw oryginał
  }
  return actionLink
}

/**
 * Wysyła email z linkiem do resetowania hasła (Resend + link z Supabase Admin API).
 * Nie używa resetPasswordForEmail — wtedy mail idzie z Supabase i często psuje się redirect.
 */
export async function requestPasswordReset(email: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { success: true }
    }

    const baseUrl = getAppBaseUrl()
    const redirectTo = `${baseUrl}/reset-password`

    let admin
    try {
      admin = createAdminClient()
    } catch (e) {
      console.error(
        'requestPasswordReset: brak klienta admin (SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL):',
        e
      )
      return { success: true }
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo,
      },
    })

    if (error) {
      console.warn('requestPasswordReset generateLink:', error.message)
      return { success: true }
    }

    const actionLink = data?.properties?.action_link
    if (!actionLink) {
      console.error('requestPasswordReset: brak action_link w odpowiedzi generateLink')
      return { success: true }
    }

    const recoveryLink = withRecoveryRedirectTo(actionLink, redirectTo)

    const sendResult = await sendPasswordResetEmail({
      to: normalizedEmail,
      resetLink: recoveryLink,
    })

    if (!sendResult.success) {
      console.error('requestPasswordReset Resend:', sendResult.error)
    }

    return { success: true }
  } catch (error) {
    console.error('Error requesting password reset:', error)
    return { success: true }
  }
}

/**
 * Aktualizuje hasło użytkownika
 */
export async function updatePassword(newPassword: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error('Error updating password:', error)
      return {
        success: false,
        error: 'Nie udało się zaktualizować hasła. Spróbuj ponownie.',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating password:', error)
    return {
      success: false,
      error: 'Wystąpił błąd. Spróbuj ponownie.',
    }
  }
}
