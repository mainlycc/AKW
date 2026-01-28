'use server'

import { createPayUClient } from '@/lib/payu/client'
import { getUserProfile } from '@/lib/actions/auth'

export interface CreateTestPaymentResult {
  success: boolean
  paymentId?: string
  redirectUrl?: string
  error?: string
}

/**
 * Tworzy testową płatność PayU
 */
export async function createTestPayment(
  amount: number,
  description: string,
  buyerEmail: string,
  buyerFirstName: string,
  buyerLastName: string
): Promise<CreateTestPaymentResult> {
  try {
    const profile = await getUserProfile()
    if (!profile) {
      return { success: false, error: 'Brak autoryzacji' }
    }

    const payuClient = createPayUClient()

    // Generuj unikalny extOrderId
    const extOrderId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // URL powrotu i webhook
    // Normalize to avoid double slashes when NEXT_PUBLIC_APP_URL ends with "/"
    const baseUrlRaw = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const baseUrl = baseUrlRaw.replace(/\/+$/, '')
    const continueUrl = `${baseUrl}/dashboard/test-payu?success=true`
    const notifyUrl = `${baseUrl}/api/payu/webhook`

    // Konwersja kwoty na grosze (string)
    const totalAmountGrosze = Math.round(amount * 100).toString()

    // Utwórz płatność przez PayU GPO Europe API v2
    const orderResponse = await payuClient.createOrder({
      customerIp: '185.68.12.34', // Test IP dla sandbox
      description: description || `Testowa płatność - ${amount} PLN`,
      currencyCode: 'PLN',
      totalAmount: totalAmountGrosze,
      extOrderId,
      buyer: {
        email: buyerEmail,
        firstName: buyerFirstName,
        lastName: buyerLastName,
        language: 'pl',
      },
      products: [
        {
          name: description || `Testowa płatność - ${amount} PLN`,
          unitPrice: totalAmountGrosze,
          quantity: '1',
        },
      ],
      continueUrl,
      notifyUrl,
    })

    if (orderResponse.status !== 'SUCCESS' || !orderResponse.redirectUrl) {
      return {
        success: false,
        error: `PayU zwrócił status: ${orderResponse.status}`,
      }
    }

    return {
      success: true,
      paymentId: orderResponse.paymentId,
      redirectUrl: orderResponse.redirectUrl,
    }
  } catch (error) {
    console.error('Error creating test payment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nieznany błąd',
    }
  }
}
