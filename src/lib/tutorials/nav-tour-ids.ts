/** Maps dashboard paths to stable data-tour ids on sidebar links */
export function navTourIdFromPath(path: string): string {
  const map: Record<string, string> = {
    '/dashboard': 'nav-dashboard',
    '/dashboard/uczniowie': 'nav-uczniowie',
    '/dashboard/tutorzy': 'nav-tutorzy',
    '/dashboard/zaproszenia': 'nav-zaproszenia',
    '/dashboard/przedmioty': 'nav-przedmioty',
    '/dashboard/przypisania': 'nav-przypisania',
    '/dashboard/dostepnosc-tutorow': 'nav-dostepnosc-tutorow',
    '/dashboard/kalendarz-lekcji': 'nav-kalendarz-lekcji',
    '/dashboard/rezerwacje-publiczne': 'nav-rezerwacje-publiczne',
    '/dashboard/deklaracje-tutorow': 'nav-deklaracje-tutorow',
    '/dashboard/rozliczenia-deklaracji': 'nav-rozliczenia-deklaracji',
    '/dashboard/raporty-tutorow': 'nav-raporty-tutorow',
    '/dashboard/rozliczenia-tutorow': 'nav-rozliczenia-tutorow',
    '/dashboard/billing-from-reports': 'nav-billing-from-reports',
    '/dashboard/payments': 'nav-payments',
    '/dashboard/powiadomienia': 'nav-powiadomienia',
    '/dashboard/stawki': 'nav-stawki',
    '/dashboard/kalendarz': 'nav-kalendarz',
    '/dashboard/moje-deklaracje': 'nav-moje-deklaracje',
    '/dashboard/moje-raporty': 'nav-moje-raporty',
    '/dashboard/historia': 'nav-historia',
    '/dashboard/profil': 'nav-profil',
  }
  return map[path] ?? 'nav-dashboard'
}

export function navTourSelector(path: string): string {
  return `[data-tour="${navTourIdFromPath(path)}"]`
}
