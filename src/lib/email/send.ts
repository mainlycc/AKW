import { resend, FROM_EMAIL } from './client'
import { generateInvitationEmail } from './templates/invitation-email'

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

