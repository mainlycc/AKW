import type { UserRole } from '@/lib/types/database.types'
import { ADMIN_ONBOARDING_STEPS } from './admin-onboarding'
import { TUTOR_ONBOARDING_STEPS } from './tutor-onboarding'
import type { TutorialStep } from './types'

export function getOnboardingStepsForRole(role: UserRole): TutorialStep[] {
  return role === 'admin' ? ADMIN_ONBOARDING_STEPS : TUTOR_ONBOARDING_STEPS
}
