'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/profil': 'Profil',
  '/dashboard/uczniowie': 'Uczniowie',
  '/dashboard/rodzice': 'Rodzice',
  '/dashboard/tutorzy': 'Tutorzy',
  '/dashboard/przedmioty': 'Przedmioty',
  '/dashboard/przypisania': 'Przypisania',
  '/dashboard/sesje': 'Sesje korepetycji',
  '/dashboard/historia': 'Historia sesji',
  '/dashboard/raporty': 'Raporty godzin',
  '/dashboard/moje-raporty': 'Moje raporty',
  '/dashboard/raporty-tutorow': 'Raporty tutorów',
}

export function PageHeader() {
  const pathname = usePathname()
  const title = pageTitles[pathname] || 'Dashboard'

  return (
    <h1 className="text-xl font-semibold">{title}</h1>
  )
}

