import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createPayUClient } from '@/lib/payu/client'
import { processPayUWebhook } from '@/lib/actions/payu'

export async function POST(req: NextRequest) {
  try {
    const md5Key = process.env.PAYU_MD5_KEY

    if (!md5Key) {
      console.error('PAYU_MD5_KEY is not set')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    // Get signature from headers
    const headersList = await headers()
    const signature = headersList.get('openpayu-signature')

    if (!signature) {
      console.error('No OpenPayu-Signature header in PayU webhook')
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      )
    }

    // Get request body as text for signature verification
    const body = await req.text()

    // Verify signature
    const payuClient = createPayUClient()
    const isValid = payuClient.verifySignature(body, signature)

    if (!isValid) {
      console.error('PayU webhook signature verification failed')
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
      console.error('Error parsing PayU webhook body:', error)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Validate notification structure
    if (!notification.order) {
      console.error('Invalid PayU notification structure - missing order:', notification)
      return NextResponse.json(
        { error: 'Invalid notification structure' },
        { status: 400 }
      )
    }

    const order = notification.order

    if (
      !order.orderId ||
      !order.extOrderId ||
      !order.status ||
      !order.totalAmount ||
      !order.currencyCode
    ) {
      console.error('Invalid PayU order structure:', order)
      return NextResponse.json(
        { error: 'Invalid order structure' },
        { status: 400 }
      )
    }

    console.log('PayU webhook received:', {
      orderId: order.orderId,
      extOrderId: order.extOrderId,
      status: order.status,
      amount: order.totalAmount,
      currency: order.currencyCode,
    })

    // Process webhook
    try {
      await processPayUWebhook({
        orderId: order.orderId,
        extOrderId: order.extOrderId,
        status: order.status,
        totalAmount: order.totalAmount,
        currencyCode: order.currencyCode,
        payMethod: order.payMethod,
        buyer: order.buyer,
      })

      // Return 200 OK
      return NextResponse.json({ received: true }, { status: 200 })
    } catch (error) {
      console.error('Error processing PayU webhook:', error)
      // Still return 200 to prevent PayU from retrying immediately
      // The error is logged and can be handled manually
      return NextResponse.json(
        { received: true, error: 'Processing failed but acknowledged' },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Unexpected error in PayU webhook:', error)
    // Return 200 to acknowledge receipt (PayU will retry if needed)
    return NextResponse.json(
      { received: true, error: 'Unexpected error' },
      { status: 200 }
    )
  }
}
