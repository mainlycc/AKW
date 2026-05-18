import type { NotificationChannel, SendNotificationResult } from '@/lib/types/notifications'

export interface BulkSendStats {
  failedNoPhone: number
  failedNoEmail: number
  failedNoContact: number
  failedOther: number
  partialNoPhone: number
}

export function createBulkSendStats(): BulkSendStats {
  return {
    failedNoPhone: 0,
    failedNoEmail: 0,
    failedNoContact: 0,
    failedOther: 0,
    partialNoPhone: 0,
  }
}

export function recordBulkSendOutcome(
  stats: BulkSendStats,
  opts: {
    success: boolean
    channel: NotificationChannel
    hasEmail: boolean
    hasPhone: boolean
    details?: SendNotificationResult['details']
  }
): void {
  const { success, channel, hasEmail, hasPhone, details } = opts

  if (!success) {
    if (channel === 'sms' && !hasPhone) {
      stats.failedNoPhone++
    } else if (channel === 'email' && !hasEmail) {
      stats.failedNoEmail++
    } else if (channel === 'both' && !hasEmail && !hasPhone) {
      stats.failedNoContact++
    } else if (!hasPhone && (channel === 'sms' || channel === 'both')) {
      stats.failedNoPhone++
    } else if (!hasEmail && (channel === 'email' || channel === 'both')) {
      stats.failedNoEmail++
    } else {
      stats.failedOther++
    }
    return
  }

  const smsSkipped =
    details?.sms?.includes('telefonu') || details?.sms?.includes('Brak numeru')
  if (smsSkipped && !hasPhone && channel === 'both') {
    stats.partialNoPhone++
  }
}

function describeFailureReasons(stats: BulkSendStats, failedTotal: number): string {
  if (stats.failedNoPhone === failedTotal) {
    return 'Powód: brak numeru telefonu.'
  }
  if (stats.failedNoEmail === failedTotal) {
    return 'Powód: brak adresu email.'
  }
  if (stats.failedNoContact === failedTotal) {
    return 'Powód: brak danych kontaktowych (email i telefon).'
  }

  const parts: string[] = []
  if (stats.failedNoPhone > 0) {
    parts.push(`${stats.failedNoPhone} bez numeru telefonu`)
  }
  if (stats.failedNoEmail > 0) {
    parts.push(`${stats.failedNoEmail} bez adresu email`)
  }
  if (stats.failedNoContact > 0) {
    parts.push(`${stats.failedNoContact} bez danych kontaktowych`)
  }
  if (stats.failedOther > 0) {
    parts.push(`${stats.failedOther} z powodu błędu wysyłki`)
  }

  return parts.length > 0 ? `Powód: ${parts.join(', ')}.` : ''
}

export function formatBulkSendResultMessage(
  sentCount: number,
  stats: BulkSendStats
): string | undefined {
  const failedTotal =
    stats.failedNoPhone +
    stats.failedNoEmail +
    stats.failedNoContact +
    stats.failedOther

  const parts: string[] = []

  if (failedTotal > 0) {
    const summary =
      sentCount > 0
        ? `Wysłano ${sentCount} wiadomości. Nie udało się: ${failedTotal}.`
        : `Nie udało się wysłać wiadomości (${failedTotal} odbiorców).`
    const reason = describeFailureReasons(stats, failedTotal)
    parts.push(reason ? `${summary} ${reason}` : summary)
  }

  if (stats.partialNoPhone > 0) {
    parts.push(
      `Email wysłany, ale SMS nie dotarł do ${stats.partialNoPhone} odbiorców (brak numeru telefonu).`
    )
  }

  return parts.length > 0 ? parts.join(' ') : undefined
}
