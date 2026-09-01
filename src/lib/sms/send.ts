import { getSmsClient } from './client'
import { smsCompletedLessonsReminder, smsNextMonthPlanReminder } from '@/lib/labels/reports-declarations'
import { smsAvailabilityReminder } from '@/lib/labels/availability'
import type { SendNotificationResult } from '@/lib/types/notifications'

const MAX_SMS_LENGTH = 320
/** Limit pojedynczego SMS GSM-7 (bez polskich znaków diakrytycznych). */
const MAX_GSM_SMS_LENGTH = 160

function truncate(body: string, maxLength = MAX_SMS_LENGTH): string {
  if (body.length <= maxLength) return body
  return `${body.slice(0, maxLength - 3)}...`
}

/**
 * Krótka treść SMS zaproszenia — ASCII (GSM-7), z linkiem skracanym przez SerwerSMS (#URL:...#).
 * Pełny URL w emailu; w SMS wystarczy krótki link rejestracyjny.
 */
export function buildInvitationSmsBody(invitationLink: string): string {
  return truncate(
    `Akademia Wiedzy: zarejestruj sie jako tutor: #URL:${invitationLink}#`,
    MAX_GSM_SMS_LENGTH
  )
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
  const body = buildInvitationSmsBody(invitationLink)

  const result = await client.sendSms({ to: toPhone, body, utf: false })
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

export interface TutorAdminBookingNotificationSmsParams {
  toPhone: string
  studentName: string
  subject: string
  date: string
  time: string
}

export async function sendTutorAdminBookingNotificationSms(
  params: TutorAdminBookingNotificationSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()
  const body = truncate(
    `Akademia Wiedzy: admin wpisal rezerwacje - ${params.studentName}, ${params.subject}, ${params.date} ${params.time}.`
  )

  const result = await client.sendSms({ to: params.toPhone, body, utf: false })
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

export interface AvailabilityReminderSmsParams {
  toPhone: string
  tutorName: string
  customMessage?: string
}

export async function sendAvailabilityReminderSms(
  params: AvailabilityReminderSmsParams
): Promise<SendNotificationResult> {
  const client = getSmsClient()

  const custom = params.customMessage?.trim()
  const body = truncate(
    `Akademia Wiedzy: ${
      custom && custom.length > 0
        ? custom
        : smsAvailabilityReminder()
    }`
  )

  const result = await client.sendSms({ to: params.toPhone, body })
  return result.success
    ? { success: true }
    : { success: false, error: result.error, details: { sms: result.error } }
}

