import { getSmsClient } from './client'
import { smsCompletedLessonsReminder, smsNextMonthPlanReminder } from '@/lib/labels/reports-declarations'
import type { SendNotificationResult } from '@/lib/types/notifications'

const MAX_SMS_LENGTH = 320

function truncate(body: string): string {
  if (body.length <= MAX_SMS_LENGTH) return body
  return `${body.slice(0, MAX_SMS_LENGTH - 3)}...`
}

const ANNOUNCEMENT_HEADER = 'AKADEMIA WIEDZY OGŁOSZENIE'

function buildAnnouncementSms(message: string): string {
  const content = message.trim()
  return truncate(`${ANNOUNCEMENT_HEADER}\n${content}`)
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
  const body = buildAnnouncementSms(params.message)

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
  const body = buildAnnouncementSms(params.message)

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
  customMessage?: string
}

export async function sendPaymentReminderSms(
  params: PaymentReminderSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()
  const formattedBalance = params.balance.toFixed(2)

  const custom = params.customMessage?.trim()
  const prefix = custom ? `${custom} ` : ''
  const body = truncate(
    `Akademia Wiedzy: ${prefix}Zaległość za zajęcia ${params.studentName}: ${formattedBalance} zł za ${params.hours.toFixed(
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
  periodLabel?: string
}

export async function sendPaymentLinkSms(
  params: PaymentLinkSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()
  const formattedAmount = params.amount.toFixed(2)
  const period = params.periodLabel || `${params.month}/${params.year}`

  const body = truncate(
    `Akademia Wiedzy: płatność za ${params.studentName}, kwota ${formattedAmount} zł za ${period}. Link: ${params.paymentUrl}`
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
  customMessage?: string
}

export async function sendReportReminderSms(
  params: ReportReminderSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()

  const custom = params.customMessage?.trim()
  const body = truncate(
    `Akademia Wiedzy: ${
      custom && custom.length > 0
        ? custom
        : smsCompletedLessonsReminder(params.month, params.year)
    }`
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
  customMessage?: string
}

export async function sendDeclarationReminderSms(
  params: DeclarationReminderSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()

  const custom = params.customMessage?.trim()
  const body = truncate(
    `Akademia Wiedzy: ${
      custom && custom.length > 0
        ? custom
        : smsNextMonthPlanReminder(params.month, params.year)
    }`
  )

  const result = await client.sendSms({ to: params.toPhone, body })
  return result.success
    ? { success: true }
    : { success: false, error: result.error, details: { sms: result.error } }
}

