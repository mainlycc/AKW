import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set in environment variables')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

// Konfiguracja nadawcy
// UWAGA: Użyj domeny zweryfikowanej w Resend (nie używaj onboarding@resend.dev)
// Jeśli zweryfikowałeś główną domenę (np. akademiawiedzy.pl), możesz użyć dowolnej subdomeny (np. noreply@mail.akademiawiedzy.pl)
export const FROM_EMAIL = 'Akademia Wiedzy <noreply@akademiawiedzy.mainly.pl>' // Zweryfikowana domena
export const REPLY_TO_EMAIL = 'kontakt@akademiawiedzy.mainly.pl' // Opcjonalnie

