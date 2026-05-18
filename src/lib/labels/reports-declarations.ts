export const LABELS = {
  completedLessons: 'Zrealizowane lekcje',
  completedLessonsTutors: 'Zrealizowane lekcje tutorów',
  completedLessonsGenitive: 'zrealizowanych lekcji',
  nextMonthPlan: 'Plan na przyszły miesiąc',
  nextMonthPlans: 'Plany na przyszły miesiąc',
  nextMonthPlansTutors: 'Plany na przyszły miesiąc tutorów',
  nextMonthPlanGenitive: 'planu na przyszły miesiąc',

  settlementsFromCompletedLessons: 'Rozliczenia ze zrealizowanych lekcji',
  settlementsFromNextMonthPlan: 'Rozliczenia planu na przyszły miesiąc',

  createCompletedLessons: 'Utwórz zrealizowane lekcje',
  createNextMonthPlan: 'Utwórz plan na przyszły miesiąc',
  submitCompletedLessons: 'Złóż zrealizowane lekcje',
  submitNextMonthPlan: 'Złóż plan na przyszły miesiąc',

  createMonthlyCompletedLessons: 'Utwórz zrealizowane lekcje miesięczne',
  createMonthlyNextMonthPlan: 'Utwórz plan na przyszły miesiąc',
  editMonthlyCompletedLessons: 'Edytuj zrealizowane lekcje miesięczne',
  editMonthlyNextMonthPlan: 'Edytuj plan na przyszły miesiąc',

  backToCompletedLessonsList: 'Powrót do listy zrealizowanych lekcji',
  backToNextMonthPlanList: 'Powrót do planu na przyszły miesiąc',

  emptyCompletedLessons: 'Brak zrealizowanych lekcji. Utwórz pierwsze zrealizowane lekcje.',
  emptyNextMonthPlan: 'Brak planu na przyszły miesiąc. Utwórz pierwszy plan.',

  deleteCompletedLessonsTitle: 'Usuń zaznaczone zrealizowane lekcje?',
  deleteCompletedLessonsDescription:
    "Czy na pewno chcesz usunąć zaznaczone zrealizowane lekcje? Ta operacja nie może być cofnięta. Uwaga: można usuwać tylko pozycje w statusie 'Roboczy'.",
  deleteNextMonthPlanTitle: 'Usuń zaznaczone plany na przyszły miesiąc?',
  deleteNextMonthPlanDescription:
    "Czy na pewno chcesz usunąć zaznaczone plany? Ta operacja nie może być cofnięta. Uwaga: można usuwać tylko pozycje w statusie 'Roboczy'.",

  submittedCompletedLessons: 'Złożone zrealizowane lekcje',
  noCompletedLessonsToDisplay: 'Brak zrealizowanych lekcji do wyświetlenia',
  noNextMonthPlanToDisplay: 'Brak planów na przyszły miesiąc do wyświetlenia',

  completedLessonsDetails: 'Szczegóły zrealizowanych lekcji',
  nextMonthPlanDetails: 'Szczegóły planu na przyszły miesiąc',

  completedLessonsCount: 'Liczba zrealizowanych lekcji',
  nextMonthPlansCount: 'Plany na przyszły miesiąc',

  completedLessonsSaved: 'Zrealizowane lekcje zapisane',
  completedLessonsSubmitted: 'Zrealizowane lekcje złożone',
  nextMonthPlanSaved: 'Plan na przyszły miesiąc zapisany',
  nextMonthPlanSubmitted: 'Plan na przyszły miesiąc złożony',

  errorSavingCompletedLessons: 'Błąd podczas zapisywania zrealizowanych lekcji',
  errorSavingNextMonthPlan: 'Błąd podczas zapisywania planu na przyszły miesiąc',

  completedLessonsApproved: 'Zrealizowane lekcje zatwierdzone',
  completedLessonsPaid: 'Zrealizowane lekcje opłacone',
  completedLessonsApprovedMessage: (monthName: string, year: number, amount: string) =>
    `Twoje zrealizowane lekcje za ${monthName} ${year} zostały zatwierdzone. Kwota do wypłaty: ${amount} zł`,
  completedLessonsAutoApprovedMessage: (monthName: string, year: number, amount: string) =>
    `Twoje zrealizowane lekcje za ${monthName} ${year} zostały automatycznie zatwierdzone. Kwota do wypłaty: ${amount} zł`,
  completedLessonsPaidMessage: (monthName: string, year: number, amount: string) =>
    `Zrealizowane lekcje za ${monthName} ${year} zostały oznaczone jako opłacone. Wypłacona kwota: ${amount} zł`,

  notFoundCompletedLessons: 'Nie znaleziono zrealizowanych lekcji lub brak uprawnień',
  notFoundNextMonthPlan: 'Nie znaleziono planu na przyszły miesiąc lub brak uprawnień',
  duplicateCompletedLessons: 'Zrealizowane lekcje dla wybranego miesiąca i roku już istnieją',
  duplicateNextMonthPlan: 'Plan na przyszły miesiąc dla wybranego okresu już istnieje',

  reminderCompletedLessonsTitle: 'Przypomnienie o zrealizowanych lekcjach',
  reminderNextMonthPlanTitle: 'Przypomnienie o planie na przyszły miesiąc',
  reminderCompletedLessonsDialog: 'Wyślij przypomnienie o zrealizowanych lekcjach',
  reminderNextMonthPlanDialog: 'Wyślij przypomnienie o planie na przyszły miesiąc',

  notificationCompletedLessons: 'Zrealizowane lekcje',
  notificationNextMonthPlan: 'Plan na przyszły miesiąc',

  addLessonToNextMonthPlan: 'Dodaj nową lekcję do planu na przyszły miesiąc',

  allTutorsSubmittedCompletedLessons: (monthLabel: string, year: number) =>
    `Wszyscy tutorzy złożyli już zrealizowane lekcje za ${monthLabel} ${year}`,
  allTutorsSubmittedNextMonthPlan: 'Wszyscy tutorzy złożyli już plan na przyszły miesiąc za ten okres.',
  allTutorsSubmittedCompletedLessonsPeriod: 'Wszyscy tutorzy złożyli już zrealizowane lekcje za ten okres.',

  selectMonthForMissingNextMonthPlans:
    'Aby zobaczyć listę niezłożonych planów na przyszły miesiąc i wysyłać przypomnienia, wybierz konkretny miesiąc (nie „Wszystkie”).',

  hoursMismatchWarning:
    'Niektóre miesiące mają różne godziny w zrealizowanych lekcjach i planach na przyszły miesiąc — sprawdź',

  markedCompletedLessonsAsPaid: (count: number) =>
    `Oznaczono ${count} ${count === 1 ? 'zestawienie' : 'zestawienia'} zrealizowanych lekcji jako wypłacone`,

  fetchCompletedLessonsError: 'Błąd podczas pobierania zrealizowanych lekcji',
  fetchNextMonthPlansError: 'Błąd podczas pobierania planów na przyszły miesiąc',

  settlementsTutorsDescription:
    'Rozliczenia tutorów na podstawie zatwierdzonych zrealizowanych lekcji miesięcznych.',
  billingFromCompletedLessonsDescription:
    'Przegląd należności i płatności dla wszystkich okresów (obliczone na podstawie zrealizowanych lekcji tutorów)',
  billingFromNextMonthPlanDescription:
    'Przegląd należności i płatności dla wszystkich okresów (obliczone na podstawie zatwierdzonych planów na przyszły miesiąc)',
} as const

export function completedLessonsReminderMessage(monthName: string, year: number): string {
  return `Przypominamy o uzupełnieniu zrealizowanych lekcji za okres ${monthName} ${year}.`
}

export function nextMonthPlanReminderMessage(monthName: string, year: number): string {
  return `Przypominamy o złożeniu planu na przyszły miesiąc za okres ${monthName} ${year}.`
}

export function smsCompletedLessonsReminder(month: number, year: number): string {
  return `przypomnienie o zrealizowanych lekcjach za ${month}/${year}. Prosimy o uzupełnienie zrealizowanych lekcji w panelu tutora.`
}

export function smsNextMonthPlanReminder(month: number, year: number): string {
  return `przypomnienie o planie na przyszły miesiąc za ${month}/${year}. Prosimy o złożenie planu na przyszły miesiąc w panelu tutora.`
}
