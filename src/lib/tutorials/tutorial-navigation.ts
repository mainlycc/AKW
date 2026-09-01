import type { TutorialStep } from './types'
import { elementExists, isLayoutTourSelector } from './wait-for-element'
import { canAdvanceFromStep, resolveStepPath, stepMatchesPath } from './tutorial-path'

/** Czy można pokazać krok bez router.push (element już w layoutcie lub na właściwej stronie). */
export function canSkipRouteNavigation(
  step: TutorialStep,
  currentPath: string,
  demoTutorPath?: string | null
): boolean {
  if (stepMatchesPath(step, currentPath)) return true
  if (!isLayoutTourSelector(step.element)) return false
  return elementExists(step.element)
}

export function getNavigationTargetPath(
  step: TutorialStep,
  currentPath: string,
  demoTutorPath?: string | null
): string | null {
  const targetPath = resolveStepPath(step, demoTutorPath, currentPath)
  if (stepMatchesPath(step, currentPath)) return null
  // Nie przekierowuj na demo — user musi sam przejść (advanceRequires)
  if (step.advanceRequires && !canAdvanceFromStep(step, currentPath)) return null
  return targetPath
}
