'use client'

import { usePathname } from 'next/navigation'
import { LABELS } from '@/lib/labels/reports-declarations'

type PageMeta = { title: string; description?: string }

const pageMeta: Record<string, PageMeta> = {
  '/dashboard': {
    title: 'Dashboard',
    description: 'Szybki podgląd najważniejszych informacji i najbliższych zajęć.',
  },
  '/dashboard/profil': {
    title: LABELS.myProfile,
    description: 'Twoje dane, ustawienia konta i informacje potrzebne do pracy w systemie.',
  },
  '/dashboard/kalendarz': {
    title: LABELS.mySchedule,
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
    title: LABELS.clientSubmissions,
    description: 'Obsługa wniosków o rezerwację z publicznego formularza dla rodziców i uczniów.',
  },
  '/dashboard/historia': {
    title: 'Historia sesji',
    description: 'Archiwum odbytych zajęć – sprawdź daty, czasy trwania i szczegóły.',
  },
  '/dashboard/raporty': {
    title: LABELS.completedLessons,
    description: 'Zestawienia godzin z zajęć – przydatne do kontroli i rozliczeń.',
  },
  '/dashboard/moje-raporty': {
    title: LABELS.monthlyReport,
    description: 'Miesięczne podsumowanie godzin i kwot do rozliczenia.',
  },
  '/dashboard/moje-raporty/nowy': {
    title: LABELS.createMonthlyCompletedLessons,
    description: 'Dodaj zrealizowane lekcje za wybrany miesiąc na podstawie swoich zajęć.',
  },
  '/dashboard/moje-deklaracje': {
    title: LABELS.monthlyPlan,
    description: 'Plan planowanych zajęć na przyszły miesiąc – pomaga ustalić dostępność i harmonogram.',
  },
  '/dashboard/moje-deklaracje/nowa': {
    title: LABELS.createMonthlyNextMonthPlan,
    description: 'Zaplanuj terminy na przyszły miesiąc – ułatwia organizację pracy.',
  },
  '/dashboard/deklaracje-tutorow': {
    title: LABELS.tutorPlans,
    description: 'Przegląd planów tutorów na przyszły miesiąc – kontrola harmonogramu.',
  },
  '/dashboard/rozliczenia-deklaracji': {
    title: LABELS.planSettlements,
    description: 'Należności od uczniów wyliczone na podstawie zatwierdzonych planów – podsumowania i statusy.',
  },
  '/dashboard/rozliczenia-tutorow': {
    title: 'Rozliczenia tutorów',
    description: 'Lista zrealizowanych lekcji do wypłaty – zaznacz i oznacz jako wypłacone.',
  },
  '/dashboard/raporty-tutorow': {
    title: LABELS.tutorReports,
    description: 'Przegląd i kontrola miesięcznych raportów godzin składanych przez tutorów.',
  },
  '/dashboard/billing': {
    title: 'Rozliczenia miesięczne',
    description: 'Zestawienia do rozliczeń – kwoty, statusy i podsumowania.',
  },
  '/dashboard/billing-from-reports': {
    title: LABELS.lessonReceivables,
    description: 'Należności od uczniów wyliczone na podstawie zatwierdzonych raportów tutorów.',
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
  '/dashboard/stawki': {
    title: 'Stawki',
    description: 'Domyślne stawki godzinowe dla uczniów i tutorów w systemie.',
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
        <h1 className="text-xl font-semibold">{LABELS.editMonthlyCompletedLessons}</h1>
      </div>
    )
  }
  
  if (pathname.startsWith('/dashboard/moje-deklaracje/') && pathname !== '/dashboard/moje-deklaracje' && pathname !== '/dashboard/moje-deklaracje/nowa') {
    return (
      <div className="flex flex-col leading-tight">
        <h1 className="text-xl font-semibold">{LABELS.editMonthlyNextMonthPlan}</h1>
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

