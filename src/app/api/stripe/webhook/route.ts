import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  const body = await req.text()
  const signature = (await headers()).get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    )
  }

  let event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook signature verification failed:', errorMessage)
    return NextResponse.json(
      { error: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    )
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as { id: string }

    // Update payment record in database
    const supabase = await createClient()

    const { error } = await supabase
      .from('payments')
      .update({
        stripe_payment_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_id', paymentIntent.id)

    if (error) {
      console.error('Error updating payment:', error)
      return NextResponse.json(
        { error: 'Failed to update payment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ received: true })
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as { id: string }
    console.error('Payment failed:', paymentIntent.id)
    // You might want to update the payment status here
    return NextResponse.json({ received: true })
  }

  // Return a response to acknowledge receipt of the event
  return NextResponse.json({ received: true })
}

