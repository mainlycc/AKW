'use client'

import { usePathname } from 'next/navigation'

type PageMeta = { title: string; description?: string }

const pageMeta: Record<string, PageMeta> = {
  '/dashboard': {
    title: 'Dashboard',
    description: 'Szybki podgląd najważniejszych informacji i najbliższych zajęć.',
  },
  '/dashboard/profil': {
    title: 'Profil',
    description: 'Twoje dane, ustawienia konta i informacje potrzebne do pracy w systemie.',
  },
  '/dashboard/kalendarz': {
    title: 'Grafik',
    description: 'Ustaw swoją dostępność – na tej podstawie planowane są zajęcia.',
  },
  '/dashboard/uczniowie': {
    title: 'Uczniowie',
    description: 'Lista Twoich uczniów oraz szczegóły współpracy i przypisań.',
  },
  '/dashboard/tutorzy': {
    title: 'Tutorzy',
    description: 'Lista tutorów w systemie – przeglądaj i zarządzaj ich danymi.',
  },
  '/dashboard/przedmioty': {
    title: 'Przedmioty',
    description: 'Zarządzaj listą przedmiotów i poziomów nauczania w systemie.',
  },
  '/dashboard/przypisania': {
    title: 'Przypisania',
    description: 'Łącz uczniów z tutorami, przedmiotami i poziomami (aktywne współprace).',
  },
  '/dashboard/dostepnosc-tutorow': {
    title: 'Dostępność tutorów',
    description: 'Podgląd grafików tutorów – sprawdź, kto i kiedy jest dostępny.',
  },
  '/dashboard/sesje': {
    title: 'Sesje korepetycji',
    description: 'Zarządzaj sesjami: dodawaj, edytuj i przeglądaj zaplanowane zajęcia.',
  },
  '/dashboard/kalendarz-lekcji': {
    title: 'Kalendarz lekcji',
    description: 'Widok kalendarza wszystkich zaplanowanych lekcji i terminów.',
  },
  '/dashboard/rezerwacje-publiczne': {
    title: 'Publiczne rezerwacje',
    description: 'Włączaj/wyłączaj możliwość rezerwacji i kontroluj zapisy z formularza publicznego.',
  },
  '/dashboard/historia': {
    title: 'Historia sesji',
    description: 'Archiwum odbytych zajęć – sprawdź daty, czasy trwania i szczegóły.',
  },
  '/dashboard/raporty': {
    title: 'Raporty godzin',
    description: 'Zestawienia godzin z zajęć – przydatne do kontroli i rozliczeń.',
  },
  '/dashboard/moje-raporty': {
    title: 'Moje raporty',
    description: 'Miesięczne podsumowanie godzin i kwot do rozliczenia.',
  },
  '/dashboard/moje-raporty/nowy': {
    title: 'Utwórz raport miesięczny',
    description: 'Dodaj raport za wybrany miesiąc na podstawie swoich zajęć.',
  },
  '/dashboard/moje-deklaracje': {
    title: 'Moje deklaracje',
    description: 'Deklaracje planowanych zajęć – pomagają ustalić dostępność i harmonogram.',
  },
  '/dashboard/moje-deklaracje/nowa': {
    title: 'Utwórz deklarację miesięczną',
    description: 'Zadeklaruj planowane terminy na miesiąc – ułatwia organizację pracy.',
  },
  '/dashboard/deklaracje-tutorow': {
    title: 'Deklaracje tutorów',
    description: 'Przegląd deklaracji tutorów – kontrola planów i dostępności.',
  },
  '/dashboard/rozliczenia-deklaracji': {
    title: 'Rozliczenia deklaracji',
    description: 'Rozliczenia na podstawie deklaracji – podsumowania i statusy.',
  },
  '/dashboard/rozliczenia-tutorow': {
    title: 'Rozliczenia tutorów',
    description: 'Lista raportów do wypłaty – zaznacz i oznacz jako wypłacone.',
  },
  '/dashboard/raporty-tutorow': {
    title: 'Raporty tutorów',
    description: 'Podgląd raportów miesięcznych tutorów oraz ich rozliczeń.',
  },
  '/dashboard/billing': {
    title: 'Rozliczenia miesięczne',
    description: 'Zestawienia do rozliczeń – kwoty, statusy i podsumowania.',
  },
  '/dashboard/billing-from-reports': {
    title: 'Rozliczenia z raportów',
    description: 'Rozliczenia wyliczane z raportów godzin – szybkie podsumowanie miesiąca.',
  },
  '/dashboard/payments': {
    title: 'Historia płatności',
    description: 'Lista płatności i ich statusów – kontrola wpłat i rozliczeń.',
  },
  '/dashboard/payments/new': {
    title: 'Dodaj płatność',
    description: 'Dodaj nową płatność (np. gdy wpłata przyszła innym kanałem).',
  },
  '/dashboard/powiadomienia': {
    title: 'Powiadomienia',
    description: 'Wiadomości z systemu: przypomnienia, informacje o zmianach i komunikaty.',
  },
  '/dashboard/zaproszenia': {
    title: 'Zaproszenia',
    description: 'Zarządzaj zaproszeniami do systemu (np. tutorzy, dostęp).',
  },
  '/dashboard/regulamin': {
    title: 'Regulamin',
    description: 'Zasady korzystania z platformy i ważne informacje organizacyjne.',
  },
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

