import { redirect } from 'next/navigation'
import { createPayUOrderForBooking } from '@/lib/actions/payu'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params

  // Verify booking exists and is not confirmed
  const supabase = await createClient()
  const { data: booking } = await supabase
    .from('public_booking_requests')
    .select('id, status')
    .eq('id', bookingId)
    .single()

  if (!booking) {
    redirect('/public/rezerwacje/platnosc/bled?bookingId=' + bookingId)
  }

  if (booking.status === 'confirmed') {
    redirect('/public/rezerwacje/platnosc/sukces?bookingId=' + bookingId)
  }

  // Create PayU order
  const paymentResult = await createPayUOrderForBooking(bookingId)

  if (!paymentResult.success || !paymentResult.redirectUrl) {
    redirect('/public/rezerwacje/platnosc/bled?bookingId=' + bookingId)
  }

  // Redirect to PayU
  redirect(paymentResult.redirectUrl)
}
