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
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set in environment variables')
      return { success: false, error: 'RESEND_API_KEY is not configured' }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
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
      console.error('Resend error:', error)
      return { success: false, error: error.message }
    }

    console.log('Booking confirmation email sent successfully:', data)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending booking confirmation email:', error)
    return { success: false, error: 'Nieoczekiwany błąd podczas wysyłania emaila' }
  }
}
