'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { AppFooter } from '@/components/app-footer'

export default function PublicBookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/logoAW.png"
              alt="Akademia Wiedzy"
              width={80}
              height={32}
              className="h-auto w-auto"
              priority
            />
          </Link>
          <h1 className="text-2xl font-semibold sm:text-3xl">Zarezerwuj korepetycje</h1>
          <nav>
            <Button asChild>
              <Link href="/login">Zaloguj się</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <AppFooter />
    </div>
  )
}


