import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  syncPublicBookingPaymentAfterRedirect,
  syncAdminReservationPaymentAfterRedirect,
} from '@/lib/actions/payu'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Mail, ArrowLeft } from 'lucide-react'

function GenericSuccessCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Płatność zakończona pomyślnie</CardTitle>
        <CardDescription>
          Twoja płatność została przetworzona. Sprawdź swoją skrzynkę email — wysłaliśmy potwierdzenie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Płatność została zakończona pomyślnie</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>Email potwierdzający został wysłany na Twój adres email</span>
        </div>
        <div className="pt-4">
          <Link href="/public/rezerwacje">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Powrót do rezerwacji
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

async function PaymentSuccessContent({
  bookingId,
  adminExtOrderId,
}: {
  bookingId: string | null
  adminExtOrderId: string | null
}) {
  if (adminExtOrderId) {
    await syncAdminReservationPaymentAfterRedirect(adminExtOrderId)
    return <GenericSuccessCard />
  }

  if (!bookingId) {
    return <GenericSuccessCard />
  }

  await syncPublicBookingPaymentAfterRedirect(bookingId)

  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('public_booking_requests')
    .select('id, status, student_first_name, student_last_name, contact_email, request_date, start_time')
    .eq('id', bookingId)
    .single()

  if (!booking) {
    return <GenericSuccessCard />
  }

  const isConfirmed = booking.status === 'confirmed'
  const formattedDate = new Date(booking.request_date).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeRange = booking.start_time ? `${booking.start_time.substring(0, 5)}` : ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>Płatność zakończona pomyślnie!</CardTitle>
        <CardDescription>
          Twoja rezerwacja {isConfirmed ? 'została potwierdzona' : 'jest w trakcie przetwarzania'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Płatność została zakończona pomyślnie</span>
        </div>

        {isConfirmed && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
            <h3 className="font-semibold mb-2">Szczegóły rezerwacji:</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <strong>Uczeń:</strong> {booking.student_first_name} {booking.student_last_name}
              </li>
              <li>
                <strong>Data:</strong> {formattedDate}
              </li>
              {timeRange && (
                <li>
                  <strong>Godzina:</strong> {timeRange}
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>
            Email potwierdzający został wysłany na adres: <strong>{booking.contact_email}</strong>
          </span>
        </div>

        <div className="pt-4 space-y-2">
          <Link href="/public/rezerwacje">
            <Button className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Powrót do rezerwacji
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string; adminExtOrderId?: string }>
}) {
  const params = await searchParams
  const bookingId = params?.bookingId || null
  const adminExtOrderId = params?.adminExtOrderId || null

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Suspense
        fallback={
          <Card>
            <CardContent className="py-8">
              <div className="text-center">Ładowanie...</div>
            </CardContent>
          </Card>
        }
      >
        <PaymentSuccessContent bookingId={bookingId} adminExtOrderId={adminExtOrderId} />
      </Suspense>
    </div>
  )
}
