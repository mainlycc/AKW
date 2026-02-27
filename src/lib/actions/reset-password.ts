'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Wysyła email z linkiem do resetowania hasła
 */
export async function requestPasswordReset(email: string) {
  try {
    const supabase = await createClient()

    // Ustal bazowy URL aplikacji:
    // 1) NEXT_PUBLIC_APP_URL (jeśli ustawiony – używany i lokalnie, i na produkcji)
    // 2) VERCEL_URL w produkcji
    // 3) localhost w development
    let baseUrl = 'http://localhost:3000'

    if (process.env.NEXT_PUBLIC_APP_URL) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL
    } else if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`
    }

    // Usuń ewentualny końcowy "/" żeby uniknąć podwójnych slashy
    baseUrl = baseUrl.replace(/\/+$/, '')

    // Supabase automatycznie wyśle email z linkiem do resetu,
    // który po kliknięciu przekieruje na stronę /reset-password
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    })

    if (error) {
      console.error('Error requesting password reset:', error)
      // Ze względów bezpieczeństwa nie ujawniamy czy email istnieje
      return { success: true }
    }

    return { success: true }
  } catch (error) {
    console.error('Error requesting password reset:', error)
    // Ze względów bezpieczeństwa zawsze zwracamy sukces
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
        error: 'Nie udało się zaktualizować hasła. Spróbuj ponownie.' 
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating password:', error)
    return { 
      success: false, 
      error: 'Wystąpił błąd. Spróbuj ponownie.' 
    }
  }
}
