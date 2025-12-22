import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createPaynowClient } from '@/lib/paynow/client'
import { processPaynowWebhook } from '@/lib/actions/paynow'

export async function POST(req: NextRequest) {
  try {
    const signatureKey = process.env.PAYNOW_SIGNATURE_KEY

    if (!signatureKey) {
      console.error('PAYNOW_SIGNATURE_KEY is not set')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    // Get signature from headers
    const headersList = await headers()
    const signature = headersList.get('signature')

    if (!signature) {
      console.error('No signature header in Paynow webhook')
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      )
    }

    // Get request body as text for signature verification
    const body = await req.text()

    // Verify signature
    // For notifications, Paynow sends the notification data as JSON string
    // The signature is calculated from this JSON string
    const paynowClient = createPaynowClient()
    const isValid = paynowClient.verifySignature(body, signature)

    if (!isValid) {
      console.error('Paynow webhook signature verification failed')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Parse notification
    let notification
    try {
      notification = JSON.parse(body)
    } catch (error) {
      console.error('Error parsing Paynow webhook body:', error)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Validate notification structure
    if (
      !notification.paymentId ||
      !notification.externalId ||
      !notification.status ||
      !notification.modifiedAt
    ) {
      console.error('Invalid Paynow notification structure:', notification)
      return NextResponse.json(
        { error: 'Invalid notification structure' },
        { status: 400 }
      )
    }

    // Process webhook
    try {
      await processPaynowWebhook({
        paymentId: notification.paymentId,
        externalId: notification.externalId,
        status: notification.status,
        modifiedAt: notification.modifiedAt,
      })

      // Return 200 OK or 202 Accepted (Paynow accepts both)
      return NextResponse.json({ received: true }, { status: 200 })
    } catch (error) {
      console.error('Error processing Paynow webhook:', error)
      // Still return 200 to prevent Paynow from retrying immediately
      // The error is logged and can be handled manually
      return NextResponse.json(
        { received: true, error: 'Processing failed but acknowledged' },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Unexpected error in Paynow webhook:', error)
    // Return 200 to acknowledge receipt (Paynow will retry if needed)
    return NextResponse.json(
      { received: true, error: 'Unexpected error' },
      { status: 200 }
    )
  }
}

