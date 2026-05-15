import type { NotificationChannel, SendNotificationResult } from '@/lib/types/notifications'
import type { SendEmailResult } from '@/lib/email/send'

type SenderFn = () => Promise<SendNotificationResult | SendEmailResult>

function normalizeResult(result: SendNotificationResult | SendEmailResult): SendNotificationResult {
  if ('messageId' in result || 'error' in result || 'success' in result) {
    // To jest wynik z warstwy email (SendEmailResult)
    return {
      success: result.success,
      error: result.error,
    }
  }

  return result
}

interface SendWithChannelOptions {
  sendEmail?: SenderFn
  sendSms?: SenderFn
}

/**
 * Helper do wysyłki powiadomień z uwzględnieniem kanału.
 *
 * Zamiast duplikować logikę "email / sms / oba" w wielu akcjach,
 * przekazujemy tutaj funkcje wysyłające dla poszczególnych kanałów.
 */
export async function sendWithChannel(
  channel: NotificationChannel,
  { sendEmail, sendSms }: SendWithChannelOptions
): Promise<SendNotificationResult> {
  const needsEmail = channel === 'email' || channel === 'both'
  const needsSms = channel === 'sms' || channel === 'both'

  const details: SendNotificationResult['details'] = {}
  let emailResult: SendNotificationResult | null = null
  let smsResult: SendNotificationResult | null = null

  if (needsEmail && sendEmail) {
    const result = await sendEmail()
    emailResult = normalizeResult(result)
    if (!emailResult.success) {
      details.email = emailResult.error
    }
  } else if (needsEmail && !sendEmail) {
    details.email = 'Kanał email nie jest dostępny w tym miejscu'
  }

  if (needsSms && sendSms) {
    const result = await sendSms()
    smsResult = normalizeResult(result)
    if (!smsResult.success) {
      details.sms = smsResult.error
    }
  } else if (needsSms && !sendSms) {
    details.sms = 'Kanał SMS nie jest dostępny w tym miejscu (brak numeru telefonu lub implementacji)'
  }

  const successParts: boolean[] = []

  if (needsEmail) {
    successParts.push(!!emailResult?.success)
  }
  if (needsSms) {
    successParts.push(!!smsResult?.success)
  }

  const overallSuccess = successParts.length === 0 ? false : successParts.some(Boolean)
  const anyFailures = successParts.some((p) => p === false)
  const firstError = emailResult?.error || smsResult?.error || undefined

  return {
    success: overallSuccess,
    error: anyFailures ? firstError : undefined,
    details: Object.keys(details).length > 0 ? details : undefined,
  }
}

