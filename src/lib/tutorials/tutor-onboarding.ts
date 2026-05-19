import type { TutorialStep } from './types'
import { navTourSelector } from './nav-tour-ids'

export const TUTOR_ONBOARDING_STEPS: TutorialStep[] = [
  {
    path: '/dashboard/profil',
    element: '[data-tour="profile-subjects"]',
    title: 'Pierwszy krok po założeniu konta',
    description:
      'Zanim cokolwiek innego zrobisz w systemie: wybierz przedmiot i poziom, których uczysz. Kliknij „Dodaj przedmiot”, ustaw parę (np. Matematyka + szkoła średnia, rozszerzenie) i zapisz przyciskiem na dole formularza. Bez tego nie dodasz ucznia, nie zarezerwujesz slotu w grafiku ani nie zaplanujesz lekcji.',
    side: 'top',
  },
  {
    path: '/dashboard',
    element: '[data-tour="nav-dashboard"]',
    title: 'Twój panel startowy',
    description:
      'Gdy masz już wybrane przedmioty i poziomy, codziennie zaczynaj od dashboardu: sprawdź najbliższą lekcję i listę aktywnych uczniów. Dane kontaktowe (imię, telefon, bio) możesz uzupełnić w każdej chwili w „Mój profil”.',
    side: 'bottom',
  },
  {
    path: '/dashboard/uczniowie',
    element: navTourSelector('/dashboard/uczniowie'),
    title: 'Moi uczniowie',
    description:
      'Lista uczniów przypisanych tylko do Ciebie. Możesz dodać ucznia, wysłać wiadomość grupową i otworzyć szczegóły z notatkami oraz historią lekcji.',
    side: 'right',
  },
  {
    path: '/dashboard/kalendarz',
    element: navTourSelector('/dashboard/kalendarz'),
    title: 'Mój grafik',
    description:
      'Ustaw tygodniową dostępność (tryb edycji), zapisz szablon, a potem w trybie podglądu rezerwuj stałe terminy dla uczniów na wolnych slotach.',
    side: 'right',
  },
  {
    path: '/dashboard/kalendarz-lekcji',
    element: navTourSelector('/dashboard/kalendarz-lekcji'),
    title: 'Kalendarz lekcji',
    description:
      'Konkretne sesje w miesiącu. Po zajęciach oznacz przeszłe lekcje jako Odbyta lub Anulowana — to wpływa na raport miesięczny i rozliczenia.',
    side: 'right',
  },
  {
    path: '/dashboard/moje-deklaracje',
    element: navTourSelector('/dashboard/moje-deklaracje'),
    title: 'Plan miesiąca',
    description:
      'Na początku miesiąca złóż plan przyszłych lekcji. Użyj „Wygeneruj z grafiku”, aby uzupełnić terminy z rezerwacji tygodniowych.',
    side: 'right',
  },
  {
    path: '/dashboard/moje-raporty',
    element: '[data-tour="notifications-bell"]',
    title: 'Raport miesięczny i powiadomienia',
    description:
      'Na koniec miesiąca złóż zestawienie zrealizowanych godzin (możesz wypełnić automatycznie z kalendarza). Przypomnienia o planie i raporcie pojawią się pod dzwonkiem powiadomień w nagłówku.',
    side: 'bottom',
  },
]
