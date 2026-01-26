'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Wysyła email z linkiem do resetowania hasła
 */
export async function requestPasswordReset(email: string) {
  try {
    const supabase = await createClient()
    
    // Supabase automatycznie wyśle email z linkiem do resetu
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
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
