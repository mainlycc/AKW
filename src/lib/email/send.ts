import { Resend } from 'resend'
import { FROM_EMAIL } from './client'
import { generateInvitationEmail } from './templates/invitation-email'
import { generateBookingConfirmationEmail, type BookingConfirmationEmailData } from './templates/booking-confirmation-email'
import { generateFinalBookingConfirmationEmail, type FinalBookingConfirmationEmailData } from './templates/final-booking-confirmation-email'
import { generateGroupMessageEmail, type GroupMessageEmailData } from './templates/group-message-email'
import { generateTutorGroupMessageEmail, type TutorGroupMessageEmailData } from './templates/tutor-group-message-email'
import { generatePaymentReminderEmail, type PaymentReminderEmailData } from './templates/payment-reminder-email'

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

export interface SendFinalBookingConfirmationEmailParams extends FinalBookingConfirmationEmailData {
  to: string
}

export async function sendFinalBookingConfirmationEmail({
  to,
  studentName,
  tutorName,
  subject,
  level,
  date,
  time,
  duration,
}: SendFinalBookingConfirmationEmailParams): Promise<SendEmailResult> {
  try {
    // Szczegółowe sprawdzenie zmiennej środowiskowej
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      const errorMsg = 'RESEND_API_KEY is not set in environment variables'
      console.error('Final booking confirmation email sending failed:', {
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
      console.error('Final booking confirmation email sending failed:', {
        error: errorMsg,
        keyPrefix: resendApiKey.substring(0, 5),
        keyLength: resendApiKey.length,
      })
      return { success: false, error: errorMsg }
    }

    const resend = new Resend(resendApiKey)
    const html = generateFinalBookingConfirmationEmail({
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
      subject: `✅ Potwierdzenie rezerwacji - ${subject} (${level}) - ${date}`,
      html,
    })

    if (error) {
      console.error('Resend API error (final confirmation):', {
        message: error.message,
        name: error.name,
        email: to,
        fromEmail: FROM_EMAIL,
      })
      return { success: false, error: error.message }
    }

    console.log('Final booking confirmation email sent successfully:', {
      messageId: data?.id,
      email: to,
    })
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending final booking confirmation email:', {
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

export interface SendGroupMessageEmailParams extends GroupMessageEmailData {
  to: string
}

export async function sendGroupMessageEmail({
  to,
  parentName,
  studentNames,
  message,
}: SendGroupMessageEmailParams): Promise<SendEmailResult> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      const errorMsg = 'RESEND_API_KEY is not set in environment variables'
      console.error('Group message email sending failed:', {
        error: errorMsg,
        environment: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV,
        hasFromEmail: !!FROM_EMAIL,
      })
      return { success: false, error: errorMsg }
    }

    if (!resendApiKey.startsWith('re_')) {
      const errorMsg = 'RESEND_API_KEY appears to be invalid (should start with "re_")'
      console.error('Group message email sending failed:', {
        error: errorMsg,
        keyPrefix: resendApiKey.substring(0, 5),
        keyLength: resendApiKey.length,
      })
      return { success: false, error: errorMsg }
    }

    const resend = new Resend(resendApiKey)
    const html = generateGroupMessageEmail({
      parentName,
      studentNames,
      message,
    })
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Wiadomość grupowa - Akademia Wiedzy',
      html,
    })

    if (error) {
      console.error('Resend API error (group message):', {
        message: error.message,
        name: error.name,
        email: to,
        fromEmail: FROM_EMAIL,
      })
      return { success: false, error: error.message }
    }

    console.log('Group message email sent successfully:', {
      messageId: data?.id,
      email: to,
      parentName,
      studentCount: studentNames.length,
    })
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending group message email:', {
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

export interface SendTutorGroupMessageEmailParams extends TutorGroupMessageEmailData {
  to: string
}

export async function sendTutorGroupMessageEmail({
  to,
  tutorName,
  message,
}: SendTutorGroupMessageEmailParams): Promise<SendEmailResult> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      const errorMsg = 'RESEND_API_KEY is not set in environment variables'
      console.error('Tutor group message email sending failed:', {
        error: errorMsg,
        environment: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV,
        hasFromEmail: !!FROM_EMAIL,
      })
      return { success: false, error: errorMsg }
    }

    if (!resendApiKey.startsWith('re_')) {
      const errorMsg = 'RESEND_API_KEY appears to be invalid (should start with "re_")'
      console.error('Tutor group message email sending failed:', {
        error: errorMsg,
        keyPrefix: resendApiKey.substring(0, 5),
        keyLength: resendApiKey.length,
      })
      return { success: false, error: errorMsg }
    }

    const resend = new Resend(resendApiKey)
    const html = generateTutorGroupMessageEmail({
      tutorName,
      message,
    })
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Wiadomość grupowa - Akademia Wiedzy',
      html,
    })

    if (error) {
      console.error('Resend API error (tutor group message):', {
        message: error.message,
        name: error.name,
        email: to,
        fromEmail: FROM_EMAIL,
      })
      return { success: false, error: error.message }
    }

    console.log('Tutor group message email sent successfully:', {
      messageId: data?.id,
      email: to,
      tutorName,
    })
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending tutor group message email:', {
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

export interface SendPaymentReminderEmailParams extends PaymentReminderEmailData {
  to: string
}

export async function sendPaymentReminderEmail({
  to,
  parentName,
  studentName,
  month,
  year,
  totalDue,
  totalPaid,
  balance,
  hours,
}: SendPaymentReminderEmailParams): Promise<SendEmailResult> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      const errorMsg = 'RESEND_API_KEY is not set in environment variables'
      console.error('Payment reminder email sending failed:', {
        error: errorMsg,
        environment: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV,
        hasFromEmail: !!FROM_EMAIL,
      })
      return { success: false, error: errorMsg }
    }

    if (!resendApiKey.startsWith('re_')) {
      const errorMsg = 'RESEND_API_KEY appears to be invalid (should start with "re_")'
      console.error('Payment reminder email sending failed:', {
        error: errorMsg,
        keyPrefix: resendApiKey.substring(0, 5),
        keyLength: resendApiKey.length,
      })
      return { success: false, error: errorMsg }
    }

    const resend = new Resend(resendApiKey)
    const html = generatePaymentReminderEmail({
      parentName,
      studentName,
      month,
      year,
      totalDue,
      totalPaid,
      balance,
      hours,
    })
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Przypomnienie o płatności - ${studentName} - Akademia Wiedzy`,
      html,
    })

    if (error) {
      console.error('Resend API error (payment reminder):', {
        message: error.message,
        name: error.name,
        email: to,
        fromEmail: FROM_EMAIL,
      })
      return { success: false, error: error.message }
    }

    console.log('Payment reminder email sent successfully:', {
      messageId: data?.id,
      email: to,
      parentName,
      studentName,
    })
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending payment reminder email:', {
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
