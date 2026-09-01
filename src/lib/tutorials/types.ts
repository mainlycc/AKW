import type { UserRole } from '@/lib/types/database.types'

export type TutorialPopoverSide = 'top' | 'bottom' | 'left' | 'right'

export type TutorialAdvanceRequirement = {
  /** Dokładna ścieżka, np. /dashboard/tutorzy */
  path?: string
  /** Prefiks ścieżki, np. /dashboard/tutorzy/ (panel konkretnego tutora) */
  pathPrefix?: string
}

export type TutorialStep = {
  path: string
  /** Dopasowanie ścieżki dynamicznej, np. /dashboard/tutorzy/[id] */
  pathPrefix?: string
  /** CSS selector, e.g. [data-tour="dashboard-stats"] */
  element: string
  title: string
  description: string
  side?: TutorialPopoverSide
  /** Użytkownik musi sam przejść na stronę — „Dalej” zablokowane do czasu spełnienia warunku */
  advanceRequires?: TutorialAdvanceRequirement
  /** Podpowiedź przy zablokowanym „Dalej” */
  advanceHint?: string
}

export type OnboardingProgress = {
  completed: boolean
  skipped: boolean
  step: number
}

export type TutorialModule = {
  /** Indeks kroku w głównym tourze (pojedynczy moduł) */
  index?: number
  /** Klucz wielokrokowego poradnika */
  moduleKey?: string
  title: string
  path: string
  stepCount?: number
}

export type StartTourOptions = {
  fromStep?: number
  restart?: boolean
  /** Pokaż tylko jeden krok — bez zapisu postępu */
  singleModule?: boolean
  /** Wielokrokowy poradnik (np. zapis ucznia na zajęcia) */
  guidedTourKey?: string
}

export type TutorialContextValue = {
  role: UserRole
  userId: string
  progress: OnboardingProgress
  isRunning: boolean
  startTour: (options?: StartTourOptions) => Promise<void>
  skipTour: () => Promise<void>
  refreshProgress: () => Promise<void>
}

export const ONBOARDING_STORAGE_PREFIX = 'aw_onboarding_'
