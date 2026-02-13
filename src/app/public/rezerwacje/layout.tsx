import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function PublicBookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold">
            Akademia Wiedzy
          </Link>
          <nav className="flex items-center gap-4">
            <Button asChild>
              <Link href="/login">Zaloguj</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}


