import type { TutorialAdvanceRequirement, TutorialStep } from './types'

export function pathMatchesRequirement(
  requirement: TutorialAdvanceRequirement,
  currentPath: string
): boolean {
  if (requirement.path) return currentPath === requirement.path
  if (requirement.pathPrefix) {
    return (
      currentPath.startsWith(requirement.pathPrefix) &&
      currentPath.length > requirement.pathPrefix.length
    )
  }
  return true
}

export function canAdvanceFromStep(step: TutorialStep, currentPath: string): boolean {
  if (!step.advanceRequires) return true
  return pathMatchesRequirement(step.advanceRequires, currentPath)
}

export function stepMatchesPath(step: TutorialStep, currentPath: string): boolean {
  if (step.pathPrefix) {
    return currentPath.startsWith(step.pathPrefix) && currentPath.length > step.pathPrefix.length
  }
  return currentPath === step.path
}

export function resolveStepPath(
  step: TutorialStep,
  demoTutorPath?: string | null,
  currentPath?: string
): string {
  if (step.pathPrefix && currentPath && stepMatchesPath(step, currentPath)) {
    return currentPath
  }
  if (step.pathPrefix && demoTutorPath) return demoTutorPath
  return step.path
}
