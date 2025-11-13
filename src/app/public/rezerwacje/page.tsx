import { listPublicSubjects } from '@/lib/actions/public-booking'
import { PublicBookingPage } from './public-booking-page'

export const metadata = {
  title: 'Rezerwacje | Akademia Wiedzy',
  description: 'Zarezerwuj termin korepetycji wybierając przedmiot i poziom.',
}

export default async function PublicBooking() {
  const subjects = await listPublicSubjects()

  return <PublicBookingPage subjects={subjects} />
}

