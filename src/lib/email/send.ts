import { Resend } from 'resend'
import { FROM_EMAIL } from './client'
import { generateInvitationEmail } from './templates/invitation-email'
import { generateBookingConfirmationEmail, type BookingConfirmationEmailData } from './templates/booking-confirmation-email'
import { generateFinalBookingConfirmationEmail, type FinalBookingConfirmationEmailData } from './templates/final-booking-confirmation-email'
import { generateGroupMessageEmail, type GroupMessageEmailData } from './templates/group-message-email'
import { generateTutorGroupMessageEmail, type TutorGroupMessageEmailData } from './templates/tutor-group-message-email'
import { generatePaymentReminderEmail, type PaymentReminderEmailData } from './templates/payment-reminder-email'
import { generatePaymentLinkEmail, type PaymentLinkEmailData } from './templates/payment-link-email'
import { generateReportReminderEmail, type ReportReminderEmailData } from './templates/report-reminder-email'
import { generateDeclarationReminderEmail, type DeclarationReminderEmailData } from './templates/declaration-reminder-email'
import { generateAvailabilityReminderEmail, type AvailabilityReminderEmailData } from './templates/availability-reminder-email'
import { AVAILABILITY_LABELS } from '@/lib/labels/availability'
import { generateTutorBookingNotificationEmail, type TutorBookingNotificationEmailData } from './templates/tutor-booking-notification-email'
import { generatePasswordResetEmail } from './templates/password-reset-email'
import { LABELS } from '@/lib/labels/reports-declarations'

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

export async function sendPasswordResetEmail({
  to,
  resetLink,
}: {
  to: string
  resetLink: string
}): Promise<SendEmailResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set in environment variables')
      return { success: false, error: 'RESEND_API_KEY is not configured' }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const html = generatePasswordResetEmail(resetLink)

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Resetowanie hasła – Akademia Wiedzy',
      html,
    })

    if (error) {
      console.error('Resend error (password reset):', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending password reset email:', error)
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
    // URL aplikacji do budowy absolutnego linku do obrazka
    let appUrl = 'http://localhost:3000'
    if (process.env.NEXT_PUBLIC_APP_URL) {
      appUrl = process.env.NEXT_PUBLIC_APP_URL
    } else if (process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`
    }

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
      headerImageUrl: `${appUrl}/akademia_wiedzy.png`,
    })
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Wiadomość z Akademii Wiedzy',
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
    // URL aplikacji do budowy absolutnego linku do obrazka
    let appUrl = 'http://localhost:3000'
    if (process.env.NEXT_PUBLIC_APP_URL) {
      appUrl = process.env.NEXT_PUBLIC_APP_URL
    } else if (process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`
    }

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
      headerImageUrl: `${appUrl}/akademia_wiedzy.png`,
    })
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Wiadomość z Akademii Wiedzy',
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
  customMessage,
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
      customMessage,
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

export interface SendPaymentLinkEmailParams extends PaymentLinkEmailData {
  to: string
}

export async function sendPaymentLinkEmail({
  to,
  parentName,
  studentName,
  amount,
  month,
  year,
  paymentUrl,
  periodLabel,
}: SendPaymentLinkEmailParams): Promise<SendEmailResult> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      const errorMsg = 'RESEND_API_KEY is not set in environment variables'
      console.error('Payment link email sending failed:', {
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
      console.error('Payment link email sending failed:', {
        error: errorMsg,
        keyPrefix: resendApiKey.substring(0, 5),
        keyLength: resendApiKey.length,
      })
      return { success: false, error: errorMsg }
    }

    const resend = new Resend(resendApiKey)
    const html = generatePaymentLinkEmail({
      parentName,
      studentName,
      amount,
      month,
      year,
      paymentUrl,
      periodLabel,
    })
    
    const monthNames = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ]
    const monthName = monthNames[month - 1] || `Miesiąc ${month}`
    const subjectPeriod = periodLabel || `${monthName} ${year}`
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Płatność za korepetycje - ${studentName} - ${subjectPeriod} - Akademia Wiedzy`,
      html,
    })

    if (error) {
      console.error('Resend API error (payment link):', {
        message: error.message,
        name: error.name,
        email: to,
        fromEmail: FROM_EMAIL,
      })
      return { success: false, error: error.message }
    }

    console.log('Payment link email sent successfully:', {
      messageId: data?.id,
      email: to,
      parentName,
      studentName,
    })
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending payment link email:', {
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

export interface SendReportReminderEmailParams extends ReportReminderEmailData {
  to: string
}

export async function sendReportReminderEmail({
  to,
  tutorName,
  month,
  year,
  customMessage,
}: SendReportReminderEmailParams): Promise<SendEmailResult> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      const errorMsg = 'RESEND_API_KEY is not set in environment variables'
      console.error('Report reminder email sending failed:', {
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
      console.error('Report reminder email sending failed:', {
        error: errorMsg,
        keyPrefix: resendApiKey.substring(0, 5),
        keyLength: resendApiKey.length,
      })
      return { success: false, error: errorMsg }
    }

    const resend = new Resend(resendApiKey)
    const monthNames = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ]
    const monthName = monthNames[month - 1] || `Miesiąc ${month}`
    
    // Określ URL aplikacji
    let appUrl = 'http://localhost:3000'
    if (process.env.NEXT_PUBLIC_APP_URL) {
      appUrl = process.env.NEXT_PUBLIC_APP_URL
    } else if (process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`
    }
    
    const html = generateReportReminderEmail({
      tutorName,
      month,
      year,
      appUrl,
      customMessage,
    })
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `${LABELS.reminderCompletedLessonsTitle} - ${monthName} ${year} - Akademia Wiedzy`,
      html,
    })

    if (error) {
      console.error('Resend API error (report reminder):', {
        message: error.message,
        name: error.name,
        email: to,
        fromEmail: FROM_EMAIL,
      })
      return { success: false, error: error.message }
    }

    console.log('Report reminder email sent successfully:', {
      messageId: data?.id,
      email: to,
      tutorName,
      month,
      year,
    })
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending report reminder email:', {
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

export interface SendDeclarationReminderEmailParams extends DeclarationReminderEmailData {
  to: string
}

export async function sendDeclarationReminderEmail({
  to,
  tutorName,
  month,
  year,
  customMessage,
}: SendDeclarationReminderEmailParams): Promise<SendEmailResult> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      const errorMsg = 'RESEND_API_KEY is not set in environment variables'
      console.error('Declaration reminder email sending failed:', {
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
      console.error('Declaration reminder email sending failed:', {
        error: errorMsg,
        keyPrefix: resendApiKey.substring(0, 5),
        keyLength: resendApiKey.length,
      })
      return { success: false, error: errorMsg }
    }

    const resend = new Resend(resendApiKey)
    const monthNames = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ]
    const monthName = monthNames[month - 1] || `Miesiąc ${month}`

    let appUrl = 'http://localhost:3000'
    if (process.env.NEXT_PUBLIC_APP_URL) {
      appUrl = process.env.NEXT_PUBLIC_APP_URL
    } else if (process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`
    }

    const html = generateDeclarationReminderEmail({
      tutorName,
      month,
      year,
      appUrl,
      customMessage,
    })

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `${LABELS.reminderNextMonthPlanTitle} - ${monthName} ${year} - Akademia Wiedzy`,
      html,
    })

    if (error) {
      console.error('Resend API error (declaration reminder):', {
        message: error.message,
        name: error.name,
        email: to,
        fromEmail: FROM_EMAIL,
      })
      return { success: false, error: error.message }
    }

    console.log('Declaration reminder email sent successfully:', {
      messageId: data?.id,
      email: to,
      tutorName,
      month,
      year,
    })
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending declaration reminder email:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      email: to,
      environment: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nieoczekiwany błąd podczas wysyłania emaila',
    }
  }
}

export interface SendAvailabilityReminderEmailParams extends AvailabilityReminderEmailData {
  to: string
}

export async function sendAvailabilityReminderEmail({
  to,
  tutorName,
  customMessage,
}: SendAvailabilityReminderEmailParams): Promise<SendEmailResult> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      const errorMsg = 'RESEND_API_KEY is not set in environment variables'
      console.error('Availability reminder email sending failed:', {
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
      console.error('Availability reminder email sending failed:', {
        error: errorMsg,
        keyPrefix: resendApiKey.substring(0, 5),
        keyLength: resendApiKey.length,
      })
      return { success: false, error: errorMsg }
    }

    const resend = new Resend(resendApiKey)

    let appUrl = 'http://localhost:3000'
    if (process.env.NEXT_PUBLIC_APP_URL) {
      appUrl = process.env.NEXT_PUBLIC_APP_URL
    } else if (process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`
    }

    const html = generateAvailabilityReminderEmail({
      tutorName,
      appUrl,
      customMessage,
    })

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `${AVAILABILITY_LABELS.reminderAvailabilityTitle} - Akademia Wiedzy`,
      html,
    })

    if (error) {
      console.error('Resend API error (availability reminder):', {
        message: error.message,
        name: error.name,
        email: to,
        fromEmail: FROM_EMAIL,
      })
      return { success: false, error: error.message }
    }

    console.log('Availability reminder email sent successfully:', {
      messageId: data?.id,
      email: to,
      tutorName,
    })
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending availability reminder email:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      email: to,
      environment: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nieoczekiwany błąd podczas wysyłania emaila',
    }
  }
}

export interface SendTutorBookingNotificationEmailParams extends TutorBookingNotificationEmailData {
  to: string
}

export async function sendTutorBookingNotificationEmail({
  to,
  tutorName,
  studentName,
  subject,
  level,
  date,
  time,
  duration,
  contactEmail,
  contactPhone,
  notes,
  source,
}: SendTutorBookingNotificationEmailParams): Promise<SendEmailResult> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      const errorMsg = 'RESEND_API_KEY is not set in environment variables'
      console.error('Tutor booking notification email sending failed:', {
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
      console.error('Tutor booking notification email sending failed:', {
        error: errorMsg,
        keyPrefix: resendApiKey.substring(0, 5),
        keyLength: resendApiKey.length,
      })
      return { success: false, error: errorMsg }
    }

    const resend = new Resend(resendApiKey)
    const html = generateTutorBookingNotificationEmail({
      tutorName,
      studentName,
      subject,
      level,
      date,
      time,
      duration,
      contactEmail,
      contactPhone,
      notes,
      source,
    })
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Nowa rezerwacja - ${studentName} - ${subject} (${level}) - ${date}`,
      html,
    })

    if (error) {
      console.error('Resend API error (tutor booking notification):', {
        message: error.message,
        name: error.name,
        email: to,
        fromEmail: FROM_EMAIL,
      })
      return { success: false, error: error.message }
    }

    console.log('Tutor booking notification email sent successfully:', {
      messageId: data?.id,
      email: to,
      tutorName,
      studentName,
    })
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Unexpected error sending tutor booking notification email:', {
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
