'use client'

import { usePathname } from 'next/navigation'

type PageMeta = { title: string; description?: string }

const pageMeta: Record<string, PageMeta> = {
  '/dashboard': { title: 'Dashboard' },
  '/dashboard/profil': { title: 'Profil' },
  '/dashboard/kalendarz': { title: 'Grafik' },
  '/dashboard/uczniowie': { title: 'Uczniowie' },
  '/dashboard/tutorzy': { title: 'Tutorzy' },
  '/dashboard/przedmioty': { title: 'Przedmioty' },
  '/dashboard/przypisania': { title: 'Przypisania' },
  '/dashboard/dostepnosc-tutorow': { title: 'Dostępność tutorów' },
  '/dashboard/sesje': { title: 'Sesje korepetycji' },
  '/dashboard/kalendarz-lekcji': { title: 'Kalendarz lekcji' },
  '/dashboard/rezerwacje-publiczne': { title: 'Publiczne rezerwacje' },
  '/dashboard/historia': { title: 'Historia sesji' },
  '/dashboard/raporty': { title: 'Raporty godzin' },
  '/dashboard/moje-raporty': {
    title: 'Moje raporty',
    description: 'Miesięczne podsumowanie godzin i kwot do rozliczenia.',
  },
  '/dashboard/moje-raporty/nowy': { title: 'Utwórz raport miesięczny' },
  '/dashboard/moje-deklaracje': {
    title: 'Moje deklaracje',
    description: 'Lista zaplanowanych zajęć na dany okres czasu.',
  },
  '/dashboard/moje-deklaracje/nowa': { title: 'Utwórz deklarację miesięczną' },
  '/dashboard/deklaracje-tutorow': { title: 'Deklaracje tutorów' },
  '/dashboard/rozliczenia-deklaracji': { title: 'Rozliczenia deklaracji' },
  '/dashboard/raporty-tutorow': { title: 'Raporty tutorów' },
  '/dashboard/billing': { title: 'Rozliczenia miesięczne' },
  '/dashboard/billing-from-reports': { title: 'Rozliczenia z raportów' },
  '/dashboard/payments': { title: 'Historia płatności' },
  '/dashboard/payments/new': { title: 'Dodaj płatność' },
  '/dashboard/powiadomienia': { title: 'Powiadomienia' },
  '/dashboard/zaproszenia': { title: 'Zaproszenia' },
  '/dashboard/regulamin': { title: 'Regulamin' },
}

export function PageHeader() {
  const pathname = usePathname()
  
  // Sprawdź czy to dynamiczna ścieżka
  if (pathname.startsWith('/dashboard/tutorzy/') && pathname !== '/dashboard/tutorzy') {
    return (
      <div className="flex flex-col leading-tight">
        <h1 className="text-xl font-semibold">Szczegóły tutora</h1>
      </div>
    )
  }
  
  if (pathname.startsWith('/dashboard/moje-raporty/') && pathname !== '/dashboard/moje-raporty' && pathname !== '/dashboard/moje-raporty/nowy') {
    return (
      <div className="flex flex-col leading-tight">
        <h1 className="text-xl font-semibold">Edytuj raport miesięczny</h1>
      </div>
    )
  }
  
  if (pathname.startsWith('/dashboard/moje-deklaracje/') && pathname !== '/dashboard/moje-deklaracje' && pathname !== '/dashboard/moje-deklaracje/nowa') {
    return (
      <div className="flex flex-col leading-tight">
        <h1 className="text-xl font-semibold">Edytuj deklarację miesięczną</h1>
      </div>
    )
  }
  
  const meta = pageMeta[pathname] || { title: 'Dashboard' }

  return (
    <div className="flex flex-col leading-tight">
      <h1 className="text-xl font-semibold">{meta.title}</h1>
      {meta.description ? (
        <p className="text-xs sm:text-sm text-muted-foreground">{meta.description}</p>
      ) : null}
    </div>
  )
}

