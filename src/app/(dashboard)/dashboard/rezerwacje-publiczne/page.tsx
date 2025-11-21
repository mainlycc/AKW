import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { PublicBookingsTable } from './public-bookings-table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, Mail, Clock, AlertCircle } from 'lucide-react'

export default async function PublicBookingsPage() {
  const profile = await getUserProfile()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const { data: rawData } = await supabase
    .from('public_booking_requests')
    .select(`
      id,
      tutor_id,
      student_id,
      assignment_id,
      booked_slot_id,
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
      <div>
        <h1 className="text-3xl font-semibold">Publiczne rezerwacje</h1>
        <p className="text-muted-foreground">
          Zarządzaj zgłoszeniami wysłanymi przez formularz publiczny. Zatwierdzenie aktywuje przypisanie i blokuje slot.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Tabela rezerwacji */}
        <Card>
          <CardHeader>
            <CardTitle>Lista zgłoszeń</CardTitle>
            <CardDescription>
              Potwierdź lub anuluj rezerwacje wysłane przez gości. Status <strong>Pending</strong> oznacza oczekiwanie na decyzję.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PublicBookingsTable bookings={data} />
          </CardContent>
        </Card>

        {/* Instrukcja procesu rezerwacji */}
        <Card className="lg:sticky lg:top-4 lg:h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Proces rezerwacji</CardTitle>
            <CardDescription>
              Instrukcja krok po kroku z opisem emaili
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Krok 1 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  1
                </div>
                <h4 className="text-sm font-semibold">Wypełnienie formularza</h4>
              </div>
              <p className="text-xs text-muted-foreground ml-8">
                Wybór przedmiotu, poziomu, terminu i wprowadzenie danych ucznia.
              </p>
            </div>

            <Separator />

            {/* Krok 2 - Pierwszy mail */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  2
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-semibold">Pierwszy email</h4>
                </div>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Otrzymywany natychmiast po wysłaniu formularza.
                </p>
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-md space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold min-w-[60px]">Status:</span>
                    <span className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3 text-amber-600" />
                      <span className="text-amber-700 font-medium">Oczekuje na potwierdzenie</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Zawiera szczegóły rezerwacji i informację o oczekiwaniu na weryfikację przez administratora.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Krok 3 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  3
                </div>
                <h4 className="text-sm font-semibold">Weryfikacja przez admina</h4>
              </div>
              <p className="text-xs text-muted-foreground ml-8">
                Administrator sprawdza dostępność i zatwierdza rezerwację w tym panelu.
              </p>
            </div>

            <Separator />

            {/* Krok 4 - Drugi mail */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  4
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <h4 className="text-sm font-semibold">Drugi email</h4>
                </div>
              </div>
              <div className="ml-8 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Otrzymywany po zatwierdzeniu rezerwacji przez administratora.
                </p>
                <div className="p-2 bg-green-50 border border-green-200 rounded-md space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold min-w-[60px]">Status:</span>
                    <span className="flex items-center gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      <span className="text-green-700 font-medium">Potwierdzona i zaakceptowana</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Potwierdza, że rezerwacja jest oficjalnie zatwierdzona i slot został zablokowany.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Podsumowanie */}
            <div className="space-y-2 pt-2">
              <h4 className="text-sm font-semibold">Podsumowanie</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <Mail className="h-3 w-3 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Email 1:</p>
                    <p className="text-muted-foreground">Potwierdzenie otrzymania - Status: &apos;Oczekuje&apos;</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Email 2:</p>
                    <p className="text-muted-foreground">Finalne potwierdzenie - Status: &apos;Potwierdzona&apos;</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


