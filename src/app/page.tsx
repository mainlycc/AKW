import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { IconCalendar } from '@tabler/icons-react'
import { AppFooter } from '@/components/app-footer'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 items-center justify-center bg-background px-4 text-center">
        <div className="flex flex-col items-center gap-6 max-w-xl">
          <div className="space-y-4">
            <div className="flex justify-center">
              <Image
                src="/logoAW.png"
                alt="Akademia Wiedzy"
                width={300}
                height={150}
                className="h-auto w-auto"
                priority
              />
            </div>
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
        </div>
      </div>
      <AppFooter />
    </div>
  )
}
