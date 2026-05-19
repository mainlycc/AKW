import type { TutorialStep } from './types'
import { navTourSelector } from './nav-tour-ids'

export const ADMIN_ONBOARDING_STEPS: TutorialStep[] = [
  {
    path: '/dashboard',
    element: '[data-tour="nav-dashboard"]',
    title: 'Panel administratora',
    description:
      'Stąd masz podgląd całego systemu: uczniowie, tutorzy, przypisania i sesje w miesiącu. W menu są dwie ścieżki rozliczeń: **z wyprzedzeniem** (plan tutora → należności od rodziców) oraz **wstecz** (raport godzin → wypłata tutora i rozliczenie ucznia). W kolejnych krokach przejdziesz przez obie.',
    side: 'bottom',
  },
  {
    path: '/dashboard/przedmioty',
    element: navTourSelector('/dashboard/przedmioty'),
    title: 'Katalog przedmiotów',
    description:
      'Skonfiguruj ofertę: dodaj przedmioty i edytuj nazwy trzech poziomów (podstawówka, średnia podstawa, rozszerzenie). To baza do zaproszeń tutorów, uczniów i wszystkich rozliczeń godzinowych.',
    side: 'right',
  },
  {
    path: '/dashboard/zaproszenia',
    element: navTourSelector('/dashboard/zaproszenia'),
    title: 'Zaproszenia tutorów',
    description:
      'Wyślij zaproszenie e-mailem lub skopiuj link rejestracyjny. Śledź statusy: oczekujące, wykorzystane, wygasłe. Nowy tutor po rejestracji wybiera przedmioty w profilu i pojawia się w zakładce Tutorzy.',
    side: 'right',
  },
  {
    path: '/dashboard/tutorzy',
    element: navTourSelector('/dashboard/tutorzy'),
    title: 'Tutorzy',
    description:
      'Lista kont tutorów ze statystykami: przypisania, godziny, sesje. Kliknij tutora, aby edytować dane, zobaczyć grafik i uczniów. Tutaj też włączasz lub wyłączasz publiczne rezerwacje dla wybranych osób.',
    side: 'right',
  },
  {
    path: '/dashboard/uczniowie',
    element: navTourSelector('/dashboard/uczniowie'),
    title: 'Uczniowie',
    description:
      'Centralny rejestr uczniów: dodawanie, rodzice, notatki, historia lekcji i płatności. Z wiersza tabeli otworzysz pełny profil. Wiadomości grupowe i scalanie duplikatów są dostępne z poziomu listy.',
    side: 'right',
  },
  {
    path: '/dashboard/kalendarz-lekcji',
    element: navTourSelector('/dashboard/kalendarz-lekcji'),
    title: 'Kalendarz lekcji',
    description:
      'Miesięczny widok wszystkich sesji w systemie — każdy tutor, każdy uczeń. Sprawdzasz statusy (zaplanowana, odbyta, anulowana) i sumę godzin. To punkt kontroli przed rozliczeniami.',
    side: 'right',
  },
  {
    path: '/dashboard/rezerwacje-publiczne',
    element: navTourSelector('/dashboard/rezerwacje-publiczne'),
    title: 'Zgłoszenia klientów',
    description:
      'Wnioski z publicznego formularza rezerwacji. Potwierdź lub anuluj — po zatwierdzeniu system powiąże ucznia ze slotem. Po prawej stronie znajdziesz instrukcję procesu i wysyłanych e-maili.',
    side: 'right',
  },
  {
    path: '/dashboard/deklaracje-tutorow',
    element: navTourSelector('/dashboard/deklaracje-tutorow'),
    title: 'Plany tutorów (rozliczenie z wyprzedzeniem)',
    description:
      'Tutorzy składają plan lekcji na przyszły miesiąc. Sprawdź złożone plany, godziny i szczegóły per uczeń. Zakładka „Brakujące plany” pozwala wysłać przypomnienia e-mail/SMS do osób, które nie złożyły planu.',
    side: 'right',
  },
  {
    path: '/dashboard/rozliczenia-deklaracji',
    element: navTourSelector('/dashboard/rozliczenia-deklaracji'),
    title: 'Rozliczenia planów',
    description:
      'Należności od uczniów/rodziców wyliczone z **zatwierdzonych planów** (płatność z góry za zaplanowane lekcje). Oznaczaj opłacone, wysyłaj przypomnienia i rejestruj wpłaty — bez czekania na raport po odbytych zajęciach.',
    side: 'right',
  },
  {
    path: '/dashboard/raporty-tutorow',
    element: navTourSelector('/dashboard/raporty-tutorow'),
    title: 'Raporty tutorów (rozliczenie wstecz)',
    description:
      'Miesięczne zestawienia godzin składane przez tutorów po zajęciach. Złożone raporty są auto-zatwierdzane przy wejściu na stronę. Eksportuj CSV, sprawdzaj kwoty i wysyłaj przypomnienia do tutorów bez raportu.',
    side: 'right',
  },
  {
    path: '/dashboard/rozliczenia-tutorow',
    element: navTourSelector('/dashboard/rozliczenia-tutorow'),
    title: 'Rozliczenia tutorów — wypłaty',
    description:
      'Lista kwot **do wypłaty** tutorom na podstawie zatwierdzonych raportów. Zaznacz pozycje i oznacz jako wypłacone, eksportuj CSV do księgowości. Status „Wypłacone” zamyka cykl rozliczenia wynagrodzenia tutora.',
    side: 'right',
  },
  {
    path: '/dashboard/billing-from-reports',
    element: navTourSelector('/dashboard/billing-from-reports'),
    title: 'Należności za lekcje',
    description:
      'Należności od uczniów za **już odbyte** lekcje (na podstawie raportów tutorów). Filtruj po okresie i statusie, wysyłaj przypomnienia, oznaczaj opłacone i generuj linki PayU. To druga strona modelu „wstecz”.',
    side: 'right',
  },
  {
    path: '/dashboard/payments',
    element: navTourSelector('/dashboard/payments'),
    title: 'Historia płatności',
    description:
      'Rejestr wszystkich wpłat: data, uczeń, rodzic, kwota, metoda (przelew, gotówka, online). Dodawaj płatności ręcznie, edytuj wpisy i eksportuj CSV. Tu trafiają wpłaty zarejestrowane też z modułów rozliczeń.',
    side: 'right',
  },
  {
    path: '/dashboard/powiadomienia',
    element: '[data-tour="notifications-bell"]',
    title: 'Powiadomienia',
    description:
      'Dzwonek w nagłówku i ta zakładka zbierają alerty: zgłoszenia klientów, raporty i plany tutorów, przypomnienia. Kliknij powiadomienie, aby przejść do właściwego modułu. Tour zakończony — w razie potrzeby uruchom go ponownie przyciskiem „Pomoc”.',
    side: 'bottom',
  },
]
