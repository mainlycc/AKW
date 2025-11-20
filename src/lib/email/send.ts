import { Resend } from 'resend'
import { FROM_EMAIL } from './client'
import { generateInvitationEmail } from './templates/invitation-email'
import { generateBookingConfirmationEmail, type BookingConfirmationEmailData } from './templates/booking-confirmation-email'

export interface SendInvitationEmailParams {
  to: string
  invitationLink: string
  expiryDays?: number
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendInvitationEmail({
  to,
  invitationLink,
  expiryDays = 7,
}: SendInvitationEmailParams): Promise<SendEmailResult> {
  try {
    // Twórz instancję Resend w funkcji, aby uniknąć problemów przy buildzie
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set in environment variables')
      return { success: false, error: 'RESEND_API_KEY is not configured' }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const html = generateInvitationEmail('Nowy Tutor', invitationLink, expiryDays)
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Zaproszenie do Akademii Wiedzy - Aktywuj swoje konto',
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    console.log('Email sent successfully:', data)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending email:', error)
    return { success: false, error: 'Nieoczekiwany błąd podczas wysyłania emaila' }
  }
}

export interface SendBookingConfirmationEmailParams extends BookingConfirmationEmailData {
  to: string
}

export async function sendBookingConfirmationEmail({
  to,
  studentName,
  tutorName,
  subject,
  level,
  date,
  time,
  duration,
}: SendBookingConfirmationEmailParams): Promise<SendEmailResult> {
  try {
    // Szczegółowe sprawdzenie zmiennej środowiskowej
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      const errorMsg = 'RESEND_API_KEY is not set in environment variables'
      console.error('Email sending failed:', {
        error: errorMsg,
        environment: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV,
        hasFromEmail: !!FROM_EMAIL,
      })
      return { success: false, error: errorMsg }
    }

    // Sprawdź czy klucz ma poprawny format (powinien zaczynać się od 're_')
    if (!resendApiKey.startsWith('re_')) {
      const errorMsg = 'RESEND_API_KEY appears to be invalid (should start with "re_")'
      console.error('Email sending failed:', {
        error: errorMsg,
        keyPrefix: resendApiKey.substring(0, 5),
        keyLength: resendApiKey.length,
      })
      return { success: false, error: errorMsg }
    }

    const resend = new Resend(resendApiKey)
    const html = generateBookingConfirmationEmail({
      studentName,
      tutorName,
      subject,
      level,
      date,
      time,
      duration,
    })
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Potwierdzenie rezerwacji - ${subject} (${level}) - ${date}`,
      html,
    })

    if (error) {
      console.error('Resend API error:', {
        message: error.message,
        name: error.name,
        email: to,
        fromEmail: FROM_EMAIL,
      })
      return { success: false, error: error.message }
    }

    console.log('Booking confirmation email sent successfully:', {
      messageId: data?.id,
      email: to,
    })
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending booking confirmation email:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      email: to,
      environment: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
    })
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Nieoczekiwany błąd podczas wysyłania emaila' 
    }
  }
}
