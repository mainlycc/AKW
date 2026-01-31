import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { createPayUOrderForBooking } from '@/lib/actions/payu'

async function BookingErrorContent({ bookingId }: { bookingId: string | null }) {
  if (!bookingId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Błąd płatności</CardTitle>
          <CardDescription>
            Wystąpił problem podczas przetwarzania płatności. Twoja rezerwacja oczekuje na płatność.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Płatność nie została zakończona</span>
          </div>
          <div className="text-muted-foreground">
            <p>Twoja rezerwacja została utworzona, ale płatność nie została zakończona.</p>
            <p className="mt-2">Możesz spróbować ponownie później lub skontaktować się z nami.</p>
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

  const supabase = await createClient()
  
  const { data: booking } = await supabase
    .from('public_booking_requests')
    .select('id, status, student_first_name, student_last_name, contact_email, request_date, start_time')
    .eq('id', bookingId)
    .single()

  if (!booking) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Błąd płatności</CardTitle>
          <CardDescription>
            Wystąpił problem podczas przetwarzania płatności.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Płatność nie została zakończona</span>
          </div>
          <div className="pt-4">
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

  const isConfirmed = booking.status === 'confirmed'
  const formattedDate = new Date(booking.request_date).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeRange = booking.start_time ? `${booking.start_time.substring(0, 5)}` : ''

  // If booking is already confirmed, show success message
  if (isConfirmed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rezerwacja już potwierdzona</CardTitle>
          <CardDescription>
            Twoja rezerwacja została już potwierdzona.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="pt-4">
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Błąd płatności</CardTitle>
        <CardDescription>
          Wystąpił problem podczas przetwarzania płatności. Twoja rezerwacja oczekuje na płatność.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Płatność nie została zakończona</span>
        </div>

        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
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
            <li>
              <strong>Status:</strong> Oczekuje na płatność
            </li>
          </ul>
        </div>

        <div className="text-muted-foreground">
          <p>Twoja rezerwacja została utworzona, ale płatność nie została zakończona.</p>
          <p className="mt-2">Możesz spróbować ponownie lub skontaktować się z nami.</p>
        </div>

        <div className="pt-4 space-y-2">
          <Link href={`/public/rezerwacje/platnosc/${bookingId}`}>
            <Button className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Spróbuj ponownie
            </Button>
          </Link>
          <Link href="/public/rezerwacje">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Powrót do rezerwacji
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function PaymentErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>
}) {
  const params = await searchParams
  const bookingId = params?.bookingId || null

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Suspense fallback={
        <Card>
          <CardContent className="py-8">
            <div className="text-center">Ładowanie...</div>
          </CardContent>
        </Card>
      }>
        <BookingErrorContent bookingId={bookingId} />
      </Suspense>
    </div>
  )
}
