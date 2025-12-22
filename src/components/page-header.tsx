'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/profil': 'Profil',
  '/dashboard/kalendarz': 'Grafik',
  '/dashboard/uczniowie': 'Uczniowie',
  '/dashboard/tutorzy': 'Tutorzy',
  '/dashboard/przedmioty': 'Przedmioty',
  '/dashboard/przypisania': 'Przypisania',
  '/dashboard/dostepnosc-tutorow': 'Dostępność tutorów',
  '/dashboard/sesje': 'Sesje korepetycji',
  '/dashboard/kalendarz-lekcji': 'Kalendarz lekcji',
  '/dashboard/rezerwacje-publiczne': 'Publiczne rezerwacje',
  '/dashboard/historia': 'Historia sesji',
  '/dashboard/raporty': 'Raporty godzin',
  '/dashboard/moje-raporty': 'Moje raporty',
  '/dashboard/moje-deklaracje': 'Moje deklaracje',
  '/dashboard/moje-deklaracje/nowa': 'Utwórz deklarację miesięczną',
  '/dashboard/deklaracje-tutorow': 'Deklaracje tutorów',
  '/dashboard/rozliczenia-deklaracji': 'Rozliczenia deklaracji',
  '/dashboard/raporty-tutorow': 'Raporty tutorów',
  '/dashboard/billing': 'Rozliczenia miesięczne',
  '/dashboard/billing-from-reports': 'Rozliczenia z raportów',
  '/dashboard/payments': 'Historia płatności',
  '/dashboard/payments/new': 'Dodaj płatność',
  '/dashboard/powiadomienia': 'Powiadomienia',
  '/dashboard/zaproszenia': 'Zaproszenia',
}

export function PageHeader() {
  const pathname = usePathname()
  
  // Sprawdź czy to dynamiczna ścieżka
  if (pathname.startsWith('/dashboard/tutorzy/') && pathname !== '/dashboard/tutorzy') {
    return <h1 className="text-xl font-semibold">Szczegóły tutora</h1>
  }
  
  if (pathname.startsWith('/dashboard/moje-deklaracje/') && pathname !== '/dashboard/moje-deklaracje' && pathname !== '/dashboard/moje-deklaracje/nowa') {
    return <h1 className="text-xl font-semibold">Edytuj deklarację miesięczną</h1>
  }
  
  const title = pageTitles[pathname] || 'Dashboard'

  return (
    <h1 className="text-xl font-semibold">{title}</h1>
  )
}

