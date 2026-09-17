'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { AppFooter } from '@/components/app-footer'

export default function PublicBookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex shrink-0 items-center">
              <Image
                src="/logoAW.png"
                alt="Akademia Wiedzy"
                width={80}
                height={32}
                className="h-8 w-auto sm:h-auto"
                priority
              />
            </Link>
            <nav className="shrink-0">
              <Button asChild size="sm" className="sm:h-9 sm:px-4 sm:text-sm">
                <Link href="/login">Zaloguj się</Link>
              </Button>
            </nav>
          </div>
          <h1 className="text-xl font-semibold leading-tight sm:text-3xl">
            Zarezerwuj korepetycje
          </h1>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
      <AppFooter />
    </div>
  )
}


