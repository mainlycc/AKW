import crypto from 'crypto'

export interface PayUConfig {
  posId: string
  clientId: string
  clientSecret: string
  md5Key: string
  apiUrl: string
}

export interface CreateOrderRequest {
  customerIp: string
  description: string
  currencyCode: string
  totalAmount: string // w groszach, np. "15000" dla 150.00 PLN
  extOrderId: string
  buyer?: {
    email: string
    firstName?: string
    lastName?: string
    phone?: string
    language?: string
  }
  products: Array<{
    name: string
    unitPrice: string
    quantity: string
  }>
  continueUrl?: string
  notifyUrl?: string
}

export interface PayUOrderResponse {
  status: string // "SUCCESS" zgodnie z PayU GPO Europe API v2
  paymentId: string
  redirectUrl?: string
  message?: string
}

export interface PayUOrderStatus {
  orders: Array<{
    orderId: string
    extOrderId: string
    orderCreateDate: string
    notifyUrl: string
    customerIp: string
    merchantPosId: string
    description: string
    currencyCode: string
    totalAmount: string
    status: string // PENDING, WAITING_FOR_CONFIRMATION, COMPLETED, CANCELED
    products: Array<{
      name: string
      unitPrice: string
      quantity: string
    }>
    buyer?: {
      email: string
      phone?: string
      firstName?: string
      lastName?: string
    }
    payMethod?: {
      type: string // PBL, CARD_TOKEN, etc.
      value?: string
    }
  }>
  status: {
    statusCode: string
  }
}

export interface PayUNotification {
  order: {
    orderId: string
    extOrderId: string
    orderCreateDate: string
    notifyUrl: string
    customerIp: string
    merchantPosId: string
    description: string
    currencyCode: string
    totalAmount: string
    status: string
    products: Array<{
      name: string
      unitPrice: string
      quantity: string
    }>
  }
  localReceiptDateTime?: string
  properties?: Array<{
    name: string
    value: string
  }>
}

export class PayUClient {
  private config: PayUConfig
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor(config: PayUConfig) {
    this.config = config
  }

  /**
   * Get OAuth2 access token (cached with auto-refresh)
   * PayU REST API v2.1 (sandbox) - POST /pl/standard/user/oauth/authorize
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    // PayU OAuth endpoint - POST /pl/standard/user/oauth/authorize
    const authUrl = 'https://secure.snd.payu.com/pl/standard/user/oauth/authorize'
    console.log('PayU OAuth: Requesting token from:', authUrl)
    console.log('PayU OAuth: Using clientId:', this.config.clientId)
    
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(this.config.clientId)}&client_secret=${encodeURIComponent(this.config.clientSecret)}`,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PayU OAuth error response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        body: errorText.slice(0, 500),
      })
      throw new Error(`PayU OAuth error: ${response.status} ${response.statusText} - ${errorText.slice(0, 300)}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const errorText = await response.text()
      console.error('PayU OAuth: Expected JSON but got:', contentType, errorText.slice(0, 500))
      throw new Error(`PayU OAuth: Expected JSON but got ${contentType}. Response: ${errorText.slice(0, 300)}`)
    }

    const data = await response.json()

    // PayU REST API v2.1 zwraca access_token (JSON)
    // Dla bezpieczeństwa obsługujemy też inne możliwe nazwy (gdyby PayU zmieniło format)
    const token = data.access_token || data.token || data.accessToken
    if (!token) {
      console.error('PayU OAuth: Response missing token:', data)
      throw new Error('PayU OAuth response missing token')
    }

    const expiresIn = data.expires_in || data.expiresIn || 3600
    console.log('PayU OAuth: Token obtained successfully, expires in:', expiresIn)

    // Cache token
    this.accessToken = token
    this.tokenExpiresAt = Date.now() + (expiresIn - 300) * 1000

    return token
  }

  /**
   * Verify signature from PayU notifications
   * Algorithm: MD5(body + MD5_KEY)
   */
  verifySignature(body: string, signature: string): boolean {
    try {
      const data = body + this.config.md5Key
      const hash = crypto.createHash('md5').update(data).digest('hex')
      
      // Signature format: "sender=checkout;algorithm=MD5;signature=hash"
      const parts = signature.split(';')
      const signatureHash = parts.find(p => p.startsWith('signature='))?.split('=')[1]
      
      if (!signatureHash) {
        console.error('PayU signature format invalid:', signature)
        return false
      }

      return hash === signatureHash
    } catch (error) {
      console.error('Error verifying PayU signature:', error)
      return false
    }
  }

  /**
   * Create order in PayU
   * PayU REST API v2.1 - POST /api/v2_1/orders
   */
  async createOrder(request: CreateOrderRequest): Promise<PayUOrderResponse> {
    const token = await this.getAccessToken()

    // PayU REST API v2.1 wymaga merchantPosId jako string i totalAmount jako string (w groszach)
    const requestBody = {
      merchantPosId: this.config.posId, // STRING
      customerIp: request.customerIp,
      description: request.description,
      currencyCode: request.currencyCode,
      totalAmount: request.totalAmount, // STRING w groszach
      extOrderId: request.extOrderId,
      buyer: request.buyer ? {
        email: request.buyer.email,
        firstName: request.buyer.firstName,
        lastName: request.buyer.lastName,
        phone: request.buyer.phone,
        language: request.buyer.language || 'pl',
      } : undefined,
      products: request.products,
      continueUrl: request.continueUrl,
      notifyUrl: request.notifyUrl,
    }

    const ordersUrl = 'https://secure.snd.payu.com/api/v2_1/orders'
    console.log('PayU: Creating order at:', ordersUrl)
    console.log('PayU: Using merchantPosId:', this.config.posId)
    console.log('PayU: Request body:', JSON.stringify(requestBody, null, 2))
    console.log('PayU: Token (first 20 chars):', token.substring(0, 20) + '...')

    const response = await fetch(ordersUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
      redirect: 'manual', // Nie podążaj za redirectem - PayU zwraca 302
    })

    console.log('PayU: Response status:', response.status, response.statusText)
    console.log('PayU: Response content-type:', response.headers.get('content-type'))
    console.log('PayU: Response Location header:', response.headers.get('location'))

    // PayU REST API v2.1 zwraca 302 redirect na stronę płatności
    if (response.status === 302 || response.status === 301) {
      const redirectUrl = response.headers.get('location')
      if (!redirectUrl) {
        throw new Error('PayU zwrócił redirect bez Location header')
      }
      
      console.log('PayU: Redirect detected, redirectUrl:', redirectUrl)
      
      // Próbujemy odczytać orderId z body (może być puste lub JSON)
      let orderId = request.extOrderId
      try {
        const text = await response.text()
        if (text && text.trim()) {
          const data = JSON.parse(text)
          if (data.orderId) {
            orderId = data.orderId
            console.log('PayU: Got orderId from response body:', orderId)
          }
        }
      } catch {
        // Body puste lub nie-JSON - używamy extOrderId
        console.log('PayU: No orderId in body, using extOrderId:', orderId)
      }
      
      return {
        status: 'SUCCESS',
        paymentId: orderId,
        redirectUrl,
      }
    }

    // Obsługa błędów (4xx, 5xx)
    if (!response.ok) {
      const errorText = await response.text()
      let errorDetails = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = JSON.stringify(errorJson, null, 2)
      } catch {
        // errorText is not JSON, use as is
      }
      throw new Error(`PayU API error: ${response.status} ${response.statusText} - ${errorDetails}`)
    }

    // Fallback: obsługa odpowiedzi 200 z JSON (alternatywny format odpowiedzi)
    const responseText = await response.text()
    console.log('PayU: Full response length:', responseText.length)
    console.log('PayU: Response first 1000 chars:', responseText.slice(0, 1000))
    
    // Check if response is HTML (nie powinno się zdarzyć z redirect: 'manual')
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      const errorMatch = responseText.match(/<title>(.*?)<\/title>/i) || 
                        responseText.match(/<h1[^>]*>(.*?)<\/h1>/i) ||
                        responseText.match(/error[^>]*>(.*?)</i)
      const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error'
      
      console.error('PayU: HTML response detected, possible error:', errorMsg)
      throw new Error(
        `PayU returned HTML instead of JSON (status ${response.status}). ` +
        `This usually means authentication/authorization error or invalid endpoint. ` +
        `Error from HTML: ${errorMsg}. ` +
        `Full response (first 500 chars): ${responseText.slice(0, 500)}`
      )
    }
    
    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      throw new Error(
        `PayU payment response is not valid JSON (status ${response.status}): ` +
        responseText.slice(0, 500)
      )
    }

    // PayU REST API v2.1 zwraca {status: {statusCode}, redirectUri, orderId, extOrderId}
    if (data.status?.statusCode !== 'SUCCESS') {
      throw new Error(
        `PayU order creation failed: ${data.status?.statusCode} - ${JSON.stringify(data, null, 2)}`
      )
    }

    return {
      status: data.status.statusCode,
      paymentId: data.orderId,
      redirectUrl: data.redirectUri,
      message: data.status.statusDesc,
    }
  }

  /**
   * Get order status from PayU
   * PayU REST API v2.1 - GET /api/v2_1/orders/{orderId}
   */
  async getOrderStatus(orderId: string): Promise<PayUOrderStatus> {
    const token = await this.getAccessToken()

    const response = await fetch(`${this.config.apiUrl}/api/v2_1/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`PayU API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data
  }

  /**
   * Cancel order in PayU
   */
  async cancelOrder(orderId: string): Promise<void> {
    const token = await this.getAccessToken()

    const response = await fetch(`${this.config.apiUrl}/api/v2_1/orders/${orderId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`PayU API error: ${response.status} ${response.statusText} - ${errorText}`)
    }
  }
}

/**
 * Create PayU client instance from environment variables
 */
export function createPayUClient(): PayUClient {
  const posId = process.env.PAYU_POS_ID
  const clientId = process.env.PAYU_CLIENT_ID
  const clientSecret = process.env.PAYU_CLIENT_SECRET
  const md5Key = process.env.PAYU_MD5_KEY
  // Domyślnie sandbox PayU (zgodnie z Twoją notatką): https://secure.snd.payu.com
  // Produkcję ustawiasz przez PAYU_API_URL=https://secure.payu.com
  const apiUrl = process.env.PAYU_API_URL || 'https://secure.snd.payu.com'

  if (!posId) {
    throw new Error('PAYU_POS_ID is not set in environment variables')
  }

  if (!clientId) {
    throw new Error('PAYU_CLIENT_ID is not set in environment variables')
  }

  if (!clientSecret) {
    throw new Error('PAYU_CLIENT_SECRET is not set in environment variables')
  }

  if (!md5Key) {
    throw new Error('PAYU_MD5_KEY is not set in environment variables')
  }

  return new PayUClient({
    posId,
    clientId,
    clientSecret,
    md5Key,
    apiUrl,
  })
}
