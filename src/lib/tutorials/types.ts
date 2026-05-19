import type { UserRole } from '@/lib/types/database.types'

export type TutorialPopoverSide = 'top' | 'bottom' | 'left' | 'right'

export type TutorialStep = {
  path: string
  /** CSS selector, e.g. [data-tour="dashboard-stats"] */
  element: string
  title: string
  description: string
  side?: TutorialPopoverSide
}

export type OnboardingProgress = {
  completed: boolean
  skipped: boolean
  step: number
}

export type TutorialContextValue = {
  role: UserRole
  userId: string
  progress: OnboardingProgress
  isRunning: boolean
  startTour: (options?: { fromStep?: number; restart?: boolean }) => Promise<void>
  skipTour: () => Promise<void>
  refreshProgress: () => Promise<void>
}

export const ONBOARDING_STORAGE_PREFIX = 'aw_onboarding_'
