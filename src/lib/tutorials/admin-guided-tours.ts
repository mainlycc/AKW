import type { TutorialStep } from './types'

export const ENROLL_STUDENT_TOUR_KEY = 'enroll-student'

export function buildEnrollStudentTourSteps(tutorDetailPath: string): TutorialStep[] {
  return [
    {
      path: '/dashboard/tutorzy',
      element: '[data-tour="tutors-table"]',
      title: 'Lista tutorów',
      description:
        'W menu przejdź do **Tutorzy**. Na liście widzisz konta tutorów ze statystykami. **Kliknij wiersz** z imieniem i nazwiskiem, aby otworzyć panel konkretnego tutora.',
      side: 'bottom',
      advanceRequires: { pathPrefix: '/dashboard/tutorzy/' },
      advanceHint: 'Kliknij tutora na liście — przycisk „Dalej” odblokuje się po wejściu w jego panel.',
    },
    {
      path: tutorDetailPath,
      pathPrefix: '/dashboard/tutorzy/',
      element: '[data-tour="tutor-detail-header"]',
      title: 'Panel tutora',
      description:
        'Szczegóły wybranego tutora: dane kontaktowe, stawka i **przypisane przedmioty z poziomami**. Tutor musi mieć przedmioty w profilu — bez nich nie zapiszesz ucznia. Poniżej grafiku zobaczysz listę uczniów już przypisanych do tego tutora.',
      side: 'bottom',
    },
    {
      path: tutorDetailPath,
      pathPrefix: '/dashboard/tutorzy/',
      element: '[data-tour="tutor-availability"]',
      title: 'Grafik dostępności',
      description:
        'Sekcja **Dostępność w tygodniu** pokazuje, kiedy tutor może prowadzić lekcje. **Zielone** komórki to wolne sloty, **fioletowe** to zajęte (rezerwacja). Kliknij **zielony slot**, aby zapisać ucznia na zajęcia w tym terminie.',
      side: 'top',
    },
    {
      path: tutorDetailPath,
      pathPrefix: '/dashboard/tutorzy/',
      element: '[data-tour="tutor-reservation-guide"]',
      title: 'Formularz rezerwacji',
      description:
        'Po kliknięciu slotu otworzy się dialog. Wybierz **istniejącego ucznia** (już przypisanego do tutora) albo **nowy uczeń** (imię, nazwisko, e-mail rodzica). Ustaw **przedmiot i poziom** zgodne z ofertą tutora. Zaznacz rezerwację **cykliczną** (stały termin co tydzień) lub jednorazową. Kliknij **Zarezerwuj** — system utworzy przypisanie i zarezerwuje slot. W kolejnym oknie możesz wysłać rodzicowi **link PayU** do opłaty oraz powiadomienia do tutora.',
      side: 'top',
    },
    {
      path: '/dashboard/payments',
      element: '[data-tour="payments-history"]',
      title: 'Opłacona należność',
      description:
        'Gdy rodzic opłaci rezerwację przez PayU, wpłata pojawi się tutaj w **historii płatności** jako opłacona należność. Zobaczysz kwotę, ucznia, datę i metodę (online). Wpisy z rezerwacji są zapisywane automatycznie — możesz je przeglądać, filtrować i eksportować do CSV.',
      side: 'top',
    },
  ]
}

export const ADMIN_GUIDED_TOURS = {
  [ENROLL_STUDENT_TOUR_KEY]: {
    title: 'Zapis ucznia na zajęcia',
    buildSteps: buildEnrollStudentTourSteps,
  },
} as const

export type AdminGuidedTourKey = keyof typeof ADMIN_GUIDED_TOURS
