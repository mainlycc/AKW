import crypto from 'crypto'

export interface PaynowConfig {
  apiKey: string
  signatureKey: string
  apiUrl: string
}

export interface CreatePaymentRequest {
  amount: number
  currency: string
  externalId: string
  description: string
  buyer?: {
    email: string
    firstName?: string
    lastName?: string
    phone?: string
  }
  continueUrl?: string
  notificationUrl?: string
}

export interface PaynowPaymentResponse {
  paymentId: string
  status: string
  redirectUrl: string
}

export interface PaynowNotification {
  paymentId: string
  externalId: string
  status: string
  modifiedAt: string
}

export class PaynowClient {
  private config: PaynowConfig

  constructor(config: PaynowConfig) {
    this.config = config
  }

  /**
   * Calculate HMAC SHA256 signature for Paynow requests
   * Based on Paynow documentation: https://docs.paynow.pl/pl/docs/v3/integration
   */
  private calculateSignature(
    headers: Record<string, string>,
    parameters: Record<string, string> = {},
    body: string = ''
  ): string {
    // Sort headers alphabetically
    const sortedHeaders = Object.keys(headers)
      .sort()
      .reduce((acc, key) => {
        acc[key] = headers[key]
        return acc
      }, {} as Record<string, string>)

    // Sort parameters alphabetically
    const sortedParameters = Object.keys(parameters)
      .sort()
      .reduce((acc, key) => {
        acc[key] = parameters[key]
        return acc
      }, {} as Record<string, string>)

    // Prepare data package - body should be a JSON string representation
    const dataPackage = {
      headers: sortedHeaders,
      parameters: sortedParameters,
      body: body, // Body is already a JSON string
    }

    // Convert to JSON string
    // Paynow expects: tabs as \t, newlines as \n (UNIX) or \r\n (Windows)
    // Quotes should be escaped in the body content itself
    const dataString = JSON.stringify(dataPackage)

    // Calculate HMAC SHA256
    const hmac = crypto.createHmac('sha256', this.config.signatureKey)
    hmac.update(dataString)
    const signature = hmac.digest('base64')

    return signature
  }

  /**
   * Verify signature from Paynow notifications
   */
  verifySignature(data: string, signature: string): boolean {
    try {
      const hmac = crypto.createHmac('sha256', this.config.signatureKey)
      hmac.update(data)
      const calculatedSignature = hmac.digest('base64')
      return calculatedSignature === signature
    } catch (error) {
      console.error('Error verifying Paynow signature:', error)
      return false
    }
  }

  /**
   * Generate unique Idempotency-Key
   */
  private generateIdempotencyKey(): string {
    return crypto.randomUUID()
  }

  /**
   * Create payment in Paynow
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaynowPaymentResponse> {
    const idempotencyKey = this.generateIdempotencyKey()

    // Prepare request body
    const body = {
      amount: request.amount.toString(),
      currency: request.currency,
      externalId: request.externalId,
      description: request.description,
      ...(request.buyer && { buyer: request.buyer }),
      ...(request.continueUrl && { continueUrl: request.continueUrl }),
      ...(request.notificationUrl && { notificationUrl: request.notificationUrl }),
    }

    const bodyString = JSON.stringify(body)

    // Prepare headers
    const headers: Record<string, string> = {
      'Api-Key': this.config.apiKey,
      'Idempotency-Key': idempotencyKey,
    }

    // Calculate signature
    const signature = this.calculateSignature(headers, {}, bodyString)

    // Make request
    const response = await fetch(`${this.config.apiUrl}/v3/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.config.apiKey,
        'Idempotency-Key': idempotencyKey,
        'Signature': signature,
      },
      body: bodyString,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Paynow API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    return {
      paymentId: data.paymentId,
      status: data.status,
      redirectUrl: data.redirectUrl,
    }
  }

  /**
   * Get payment status from Paynow
   */
  async getPaymentStatus(paymentId: string): Promise<PaynowNotification> {
    const idempotencyKey = this.generateIdempotencyKey()

    // Prepare headers
    const headers: Record<string, string> = {
      'Api-Key': this.config.apiKey,
      'Idempotency-Key': idempotencyKey,
    }

    // Calculate signature (no body for GET request)
    const signature = this.calculateSignature(headers, {}, '')

    // Make request
    const response = await fetch(`${this.config.apiUrl}/v3/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Api-Key': this.config.apiKey,
        'Idempotency-Key': idempotencyKey,
        'Signature': signature,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Paynow API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    return {
      paymentId: data.paymentId,
      externalId: data.externalId,
      status: data.status,
      modifiedAt: data.modifiedAt,
    }
  }
}

/**
 * Create Paynow client instance from environment variables
 */
export function createPaynowClient(): PaynowClient {
  const apiKey = process.env.PAYNOW_API_KEY
  const signatureKey = process.env.PAYNOW_SIGNATURE_KEY
  const apiUrl = process.env.PAYNOW_API_URL || 'https://api.sandbox.paynow.pl'

  if (!apiKey) {
    throw new Error('PAYNOW_API_KEY is not set in environment variables')
  }

  if (!signatureKey) {
    throw new Error('PAYNOW_SIGNATURE_KEY is not set in environment variables')
  }

  return new PaynowClient({
    apiKey,
    signatureKey,
    apiUrl,
  })
}

