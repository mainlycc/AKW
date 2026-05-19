import type { TutorialStep } from './types'
import { elementExists, isLayoutTourSelector } from './wait-for-element'

/** Czy można pokazać krok bez router.push (element już w layoutcie). */
export function canSkipRouteNavigation(step: TutorialStep, currentPath: string): boolean {
  if (currentPath === step.path) return true
  if (!isLayoutTourSelector(step.element)) return false
  return elementExists(step.element)
}
