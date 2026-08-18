export interface SendSmsParams {
  to: string
  body: string
  /** Domyślnie true (SMS FULL z polskimi znakami, max 70 znaków na część). */
  utf?: boolean
}

export interface SmsClient {
  sendSms(params: SendSmsParams): Promise<{ success: boolean; error?: string }>
}

const SERWERSMS_API_URL = 'https://api2.serwersms.pl/messages/send_sms.json'

interface SerwerSmsItem {
  id?: string
  phone?: string
  status?: string
  error_message?: string
  error_code?: number
}

interface SerwerSmsResponse {
  success?: boolean
  queued?: number
  unsent?: number
  items?: SerwerSmsItem[]
  error?: {
    code?: number
    type?: string
    message?: string
  }
}

/**
 * Normalizuje numer do formatu międzynarodowego (+48...).
 * SerwerSMS koryguje numery PL, ale wcześniejsza normalizacja zmniejsza błędy.
 */
export function normalizePhoneNumber(phone: string): string {
  let normalized = phone.trim().replace(/[\s\-().]/g, '')

  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`
  } else if (normalized.startsWith('+')) {
    // już w formacie międzynarodowym
  } else if (normalized.startsWith('48') && normalized.length >= 11) {
    normalized = `+${normalized}`
  } else if (/^\d{9}$/.test(normalized)) {
    normalized = `+48${normalized}`
  } else if (/^\d{11}$/.test(normalized) && normalized.startsWith('48')) {
    normalized = `+${normalized}`
  }

  return normalized
}

/**
 * Warstwa klienta SMS — SerwerSMS HTTPS API v2.
 * Gdy brak SERWERSMS_API_TOKEN, działa w trybie mock (log do konsoli).
 */
class SerwerSmsClient implements SmsClient {
  private readonly apiToken: string | undefined
  private readonly sender: string | undefined

  constructor() {
    this.apiToken = process.env.SERWERSMS_API_TOKEN
    this.sender = process.env.SERWERSMS_SENDER
  }

  private get isConfigured() {
    return !!this.apiToken
  }

  async sendSms(params: SendSmsParams): Promise<{ success: boolean; error?: string }> {
    const { body, utf = true } = params
    const to = normalizePhoneNumber(params.to)

    if (!to) {
      return { success: false, error: 'Brak numeru telefonu odbiorcy' }
    }

    if (!body?.trim()) {
      return { success: false, error: 'Treść wiadomości jest pusta' }
    }

    if (!this.isConfigured) {
      console.log('[SMS MOCK] Wysyłanie SMS (konfiguracja SerwerSMS nie ustawiona)', {
        to,
        body,
        sender: this.sender,
      })
      return { success: true }
    }

    try {
      const formData = new URLSearchParams()
      formData.set('phone', to)
      formData.set('text', body)
      formData.set('utf', utf ? 'true' : 'false')
      formData.set('details', 'true')

      if (this.sender) {
        formData.set('sender', this.sender)
      }

      const response = await fetch(SERWERSMS_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(30_000),
      })

      const data = (await response.json()) as SerwerSmsResponse

      if (!response.ok) {
        const message =
          data.error?.message ?? `Błąd HTTP ${response.status} podczas wysyłania SMS`
        console.error('[SMS] Błąd SerwerSMS (HTTP):', { status: response.status, data })
        return { success: false, error: message }
      }

      if (data.error) {
        console.error('[SMS] Błąd SerwerSMS:', data.error)
        return { success: false, error: data.error.message ?? 'Błąd wysyłki SMS' }
      }

      const item = data.items?.find(
        (i) => i.phone === to || normalizePhoneNumber(i.phone ?? '') === to
      ) ?? data.items?.[0]

      if (item?.status === 'unsent') {
        const errorMessage = item.error_message ?? 'Nie udało się wysłać SMS na podany numer'
        console.error('[SMS] Wiadomość niewysłana:', item)
        return { success: false, error: errorMessage }
      }

      if (data.success && (data.queued ?? 0) > 0) {
        console.log('[SMS] SMS wysłany przez SerwerSMS', {
          to,
          id: item?.id,
          queued: data.queued,
        })
        return { success: true }
      }

      if ((data.unsent ?? 0) > 0 && !data.queued) {
        return {
          success: false,
          error: item?.error_message ?? 'Nie udało się zakolejkować wiadomości SMS',
        }
      }

      return { success: false, error: 'Nieoczekiwana odpowiedź z API SerwerSMS' }
    } catch (error: unknown) {
      console.error('[SMS] Błąd podczas wysyłania SMS przez SerwerSMS:', error)

      let errorMessage = 'Nieoczekiwany błąd podczas wysyłania SMS'

      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          errorMessage = 'Przekroczono limit czasu połączenia z SerwerSMS'
        } else {
          errorMessage = error.message
        }
      }

      return { success: false, error: errorMessage }
    }
  }
}

let cachedClient: SmsClient | null = null

export function getSmsClient(): SmsClient {
  if (!cachedClient) {
    cachedClient = new SerwerSmsClient()
  }
  return cachedClient
}
