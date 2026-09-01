import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncPublicBookingPaymentAfterRedirect } from '@/lib/actions/payu'
import { PublicBookingsTable } from './public-bookings-table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function PublicBookingsPage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: pendingBookings } = await admin
    .from('public_booking_requests')
    .select('id')
    .eq('status', 'pending')

  if (pendingBookings?.length) {
    await Promise.all(
      pendingBookings.map((booking) => syncPublicBookingPaymentAfterRedirect(booking.id))
    )
  }

  const { data: rawData } = await supabase
    .from('public_booking_requests')
    .select(`
      id,
      tutor_id,
      student_id,
      assignment_id,
      booked_slot_id,
      is_recurring,
      status,
      request_date,
      start_time,
      end_time,
      created_at,
      student_first_name,
      student_last_name,
      contact_email,
      contact_phone,
      notes,
      tutor:profiles!public_booking_requests_tutor_id_fkey (id, full_name),
      assignment:student_assignments (id, status),
      student:students (id, first_name, last_name),
      subject:subjects!public_booking_requests_subject_id_fkey (id, name),
      subject_level:subject_levels!public_booking_requests_subject_level_id_fkey (id, level_name)
    `)
    .order('created_at', { ascending: false })

  // Przekształć dane do oczekiwanego formatu (relacje zwracane jako tablice)
  type RawBooking = {
    id: string
    tutor_id: string
    student_id: string | null
    assignment_id: string | null
    booked_slot_id: string | null
    is_recurring: boolean
    status: 'pending' | 'confirmed' | 'cancelled'
    request_date: string
    start_time: string
    end_time: string
    created_at: string
    student_first_name: string
    student_last_name: string
    contact_email: string
    contact_phone: string | null
    notes: string | null
    tutor?: { id: string; full_name: string }[] | { id: string; full_name: string } | null
    assignment?: { id: string; status: string }[] | { id: string; status: string } | null
    student?: { id: string; first_name: string; last_name: string }[] | { id: string; first_name: string; last_name: string } | null
    subject?: { id: string; name: string }[] | { id: string; name: string } | null
    subject_level?: { id: string; level_name: string }[] | { id: string; level_name: string } | null
  }

  const data = rawData?.map((booking: RawBooking) => ({
    ...booking,
    tutor: Array.isArray(booking.tutor) ? booking.tutor[0] : booking.tutor,
    assignment: Array.isArray(booking.assignment) ? booking.assignment[0] : booking.assignment,
    student: Array.isArray(booking.student) ? booking.student[0] : booking.student,
    subject: Array.isArray(booking.subject) ? booking.subject[0] : booking.subject,
    subject_level: Array.isArray(booking.subject_level) ? booking.subject_level[0] : booking.subject_level,
  })) ?? []

  return (
    <div className="space-y-6">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Lista zgłoszeń</CardTitle>
          <CardDescription className="space-y-1">
            <span>
              Aby ręcznie potwierdzić rezerwację, zaznacz checkbox przy oczekującym zgłoszeniu i kliknij „Potwierdź”.
            </span>
            <span className="block text-muted-foreground">
              Rezerwacje opłacone przez PayU zatwierdzają się automatycznie — nie wymagają ręcznej akceptacji.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <PublicBookingsTable bookings={data} />
        </CardContent>
      </Card>
    </div>
  )
}
