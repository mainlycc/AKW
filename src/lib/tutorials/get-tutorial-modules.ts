import type { UserRole } from '@/lib/types/database.types'
import { ADMIN_GUIDED_TOURS } from './admin-guided-tours'
import { getOnboardingStepsForRole } from './get-steps-for-role'
import type { TutorialModule } from './types'

export function getTutorialModulesForRole(role: UserRole): TutorialModule[] {
  const singleStepModules: TutorialModule[] = getOnboardingStepsForRole(role).map((step, index) => ({
    index,
    title: step.title,
    path: step.path,
  }))

  if (role !== 'admin') return singleStepModules

  const guidedModules: TutorialModule[] = Object.entries(ADMIN_GUIDED_TOURS).map(
    ([moduleKey, tour]) => ({
      moduleKey,
      title: tour.title,
      path: '/dashboard/tutorzy',
      stepCount: tour.buildSteps('/dashboard/tutorzy/demo').length,
    })
  )

  return [...singleStepModules, ...guidedModules]
}

export function getGuidedTourModuleCount(role: UserRole): number {
  if (role !== 'admin') return 0
  return Object.keys(ADMIN_GUIDED_TOURS).length
}
