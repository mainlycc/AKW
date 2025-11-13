import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { IconCalendar } from '@tabler/icons-react'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="space-y-4 max-w-xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Akademia Wiedzy
        </h1>
        <p className="text-muted-foreground">
          Zaloguj się, aby zarządzać zajęciami, lub zarezerwuj wolny termin u tutora jako gość.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild size="lg">
          <Link href="/login">Przejdź do panelu</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/public/rezerwacje" className="flex items-center gap-2">
            <IconCalendar className="h-5 w-5" />
            Zarezerwuj termin
          </Link>
        </Button>
      </div>
    </main>
  )
}
