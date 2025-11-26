'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/profil': 'Profil',
  '/dashboard/kalendarz': 'Grafik',
  '/dashboard/uczniowie': 'Uczniowie',
  '/dashboard/rodzice': 'Rodzice',
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
  const title = pageTitles[pathname] || 'Dashboard'

  return (
    <h1 className="text-xl font-semibold">{title}</h1>
  )
}

