export type NotificationChannel = 'email' | 'sms' | 'both'

export interface SendNotificationResult {
  success: boolean
  /**
   * Główna wiadomość błędu (jeśli dotyczy)
   */
  error?: string
  /**
   * Dodatkowe informacje o błędach z poszczególnych kanałów
   */
  details?: {
    email?: string
    sms?: string
  }
}

