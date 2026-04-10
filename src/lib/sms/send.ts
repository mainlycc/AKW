import { getSmsClient } from './client'
import type { SendNotificationResult } from '@/lib/types/notifications'

const MAX_SMS_LENGTH = 320

function truncate(body: string): string {
  if (body.length <= MAX_SMS_LENGTH) return body
  return `${body.slice(0, MAX_SMS_LENGTH - 3)}...`
}

export interface SendInvitationSmsParams {
  toPhone: string
  invitationLink: string
}

export async function sendInvitationSms({
  toPhone,
  invitationLink,
}: SendInvitationSmsParams): Promise<SendNotificationResult> {
  const client = getSmsClient()
  const body = truncate(
    `Akademia Wiedzy: zaproszenie do panelu tutora. Zarejestruj się przez link: ${invitationLink}`
  )

  const result = await client.sendSms({ to: toPhone, body })
  return result.success
    ? { success: true }
    : { success: false, error: result.error, details: { sms: result.error } }
}

export interface BookingConfirmationSmsParams {
  toPhone: string
  studentName: string
  tutorName: string
  subject: string
  level: string
  date: string
  time: string
}

export async function sendBookingConfirmationSms(
  params: BookingConfirmationSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()
  const body = truncate(
    `Akademia Wiedzy: potwierdzenie rezerwacji dla ${params.studentName} u ${params.tutorName}, ${params.subject} (${params.level}), ${params.date} ${params.time}.`
  )

  const result = await client.sendSms({ to: params.toPhone, body })
  return result.success
    ? { success: true }
    : { success: false, error: result.error, details: { sms: result.error } }
}

export interface GroupMessageSmsParams {
  toPhone: string
  parentName: string
  studentNames: string[]
  message: string
}

export async function sendGroupMessageSms(
  params: GroupMessageSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()
  const studentsLabel =
    params.studentNames.length === 1
      ? params.studentNames[0]
      : `${params.studentNames[0]} i inni`

  const body = truncate(
    `Akademia Wiedzy: wiadomość dla opiekuna ${params.parentName} (${studentsLabel}): ${params.message}`
  )

  const result = await client.sendSms({ to: params.toPhone, body })
  return result.success
    ? { success: true }
    : { success: false, error: result.error, details: { sms: result.error } }
}

export interface TutorGroupMessageSmsParams {
  toPhone: string
  tutorName: string
  message: string
}

export async function sendTutorGroupMessageSms(
  params: TutorGroupMessageSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()

  const body = truncate(
    `Akademia Wiedzy: wiadomość do tutora ${params.tutorName}: ${params.message}`
  )

  const result = await client.sendSms({ to: params.toPhone, body })
  return result.success
    ? { success: true }
    : { success: false, error: result.error, details: { sms: result.error } }
}

export interface PaymentReminderSmsParams {
  toPhone: string
  parentName: string
  studentName: string
  month: number
  year: number
  totalDue: number
  totalPaid: number
  balance: number
  hours: number
}

export async function sendPaymentReminderSms(
  params: PaymentReminderSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()
  const formattedBalance = params.balance.toFixed(2)

  const body = truncate(
    `Akademia Wiedzy: przypomnienie o płatności za zajęcia ${params.studentName}. Zaległość: ${formattedBalance} zł za ${params.hours.toFixed(
      1
    )} h (${params.month}/${params.year}).`
  )

  const result = await client.sendSms({ to: params.toPhone, body })
  return result.success
    ? { success: true }
    : { success: false, error: result.error, details: { sms: result.error } }
}

export interface PaymentLinkSmsParams {
  toPhone: string
  parentName: string
  studentName: string
  amount: number
  month: number
  year: number
  paymentUrl: string
}

export async function sendPaymentLinkSms(
  params: PaymentLinkSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()
  const formattedAmount = params.amount.toFixed(2)

  const body = truncate(
    `Akademia Wiedzy: płatność za ${params.studentName}, kwota ${formattedAmount} zł za ${params.month}/${params.year}. Link: ${params.paymentUrl}`
  )

  const result = await client.sendSms({ to: params.toPhone, body })
  return result.success
    ? { success: true }
    : { success: false, error: result.error, details: { sms: result.error } }
}

export interface ReportReminderSmsParams {
  toPhone: string
  tutorName: string
  month: number
  year: number
}

export async function sendReportReminderSms(
  params: ReportReminderSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()

  const body = truncate(
    `Akademia Wiedzy: przypomnienie o raporcie za ${params.month}/${params.year}. Prosimy o uzupełnienie raportu w panelu tutora.`
  )

  const result = await client.sendSms({ to: params.toPhone, body })
  return result.success
    ? { success: true }
    : { success: false, error: result.error, details: { sms: result.error } }
}

export interface DeclarationReminderSmsParams {
  toPhone: string
  tutorName: string
  month: number
  year: number
}

export async function sendDeclarationReminderSms(
  params: DeclarationReminderSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()

  const body = truncate(
    `Akademia Wiedzy: przypomnienie o deklaracji za ${params.month}/${params.year}. Prosimy o złożenie deklaracji w panelu tutora.`
  )

  const result = await client.sendSms({ to: params.toPhone, body })
  return result.success
    ? { success: true }
    : { success: false, error: result.error, details: { sms: result.error } }
}

