export interface SmsClient {
  sendSms(params: { to: string; body: string }): Promise<{ success: boolean; error?: string }>
}

/**
 * Prosta, wymienialna warstwa klienta SMS.
 *
 * Na razie działa w trybie "mock":
 *  - jeśli nie ma pełnej konfiguracji Twilio w env, tylko loguje SMS-y do konsoli
 *  - dzięki temu można bezpiecznie testować logikę bez realnych wysyłek
 */
class TwilioSmsClient implements SmsClient {
  private readonly accountSid: string | undefined
  private readonly authToken: string | undefined
  private readonly fromNumber: string | undefined

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID
    // Fallback na częstą literówkę w env: WILIO_AUTH_TOKEN
    this.authToken = process.env.TWILIO_AUTH_TOKEN ?? process.env.WILIO_AUTH_TOKEN
    this.fromNumber = process.env.TWILIO_FROM_NUMBER
  }

  private get isConfigured() {
    return !!(this.accountSid && this.authToken && this.fromNumber)
  }

  async sendSms(params: { to: string; body: string }): Promise<{ success: boolean; error?: string }> {
    const { to, body } = params

    if (!to) {
      return { success: false, error: 'Brak numeru telefonu odbiorcy' }
    }

    // Tryb mock – brak konfiguracji Twilio
    if (!this.isConfigured) {
      console.log('[SMS MOCK] Wysyłanie SMS (konfiguracja Twilio nie ustawiona)', {
        to,
        body,
      })
      return { success: true }
    }

    try {
      // Lazy import klienta Twilio, żeby nie psuć bundla, jeśli paczka nie jest zainstalowana
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
      const twilio: any = require('twilio')
      const client = twilio(this.accountSid, this.authToken)

      const result = await client.messages.create({
        from: this.fromNumber,
        to,
        body,
      })

      console.log('[SMS] SMS wysłany przez Twilio', {
        to,
        sid: result.sid,
      })

      return { success: true }
    } catch (error: any) {
      console.error('[SMS] Błąd podczas wysyłania SMS przez Twilio:', error)
      
      // Parsuj błąd Twilio - może mieć strukturę z code, message, status
      let errorMessage = 'Nieoczekiwany błąd podczas wysyłania SMS'
      
      if (error) {
        if (error.message) {
          errorMessage = error.message
        } else if (typeof error === 'string') {
          errorMessage = error
        }
        
        // Sprawdź czy to błąd autentykacji
        if (error.status === 401 || error.code === 20003 || errorMessage.toLowerCase().includes('authenticate')) {
          errorMessage = 'Błąd autentykacji Twilio. Sprawdź czy zmienne środowiskowe TWILIO_ACCOUNT_SID i TWILIO_AUTH_TOKEN są prawidłowe.'
        } else if (error.code === 21211) {
          errorMessage = 'Nieprawidłowy numer telefonu odbiorcy'
        } else if (error.code === 21610) {
          errorMessage = 'Nieprawidłowy numer telefonu nadawcy (TWILIO_FROM_NUMBER)'
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}

let cachedClient: SmsClient | null = null

export function getSmsClient(): SmsClient {
  if (!cachedClient) {
    cachedClient = new TwilioSmsClient()
  }
  return cachedClient
}

