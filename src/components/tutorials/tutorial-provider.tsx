'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { toast } from 'sonner'

import type { UserRole } from '@/lib/types/database.types'
import {
  completeOnboarding,
  getOnboardingProgress,
  getTourDemoTutorPath,
  resetOnboardingForRestart,
  saveOnboardingStep,
  skipOnboarding,
} from '@/lib/actions/onboarding'
import { ADMIN_GUIDED_TOURS, type AdminGuidedTourKey } from '@/lib/tutorials/admin-guided-tours'
import { setupAdvanceGate } from '@/lib/tutorials/tutorial-advance-gate'
import { DRIVER_BASE_CONFIG } from '@/lib/tutorials/driver-config'
import { formatTutorialDescription } from '@/lib/tutorials/format-description'
import { getOnboardingStepsForRole } from '@/lib/tutorials/get-steps-for-role'
import {
  ONBOARDING_STORAGE_PREFIX,
  type OnboardingProgress,
  type StartTourOptions,
  type TutorialContextValue,
  type TutorialStep,
} from '@/lib/tutorials/types'
import { canSkipRouteNavigation, getNavigationTargetPath } from '@/lib/tutorials/tutorial-navigation'
import { canAdvanceFromStep } from '@/lib/tutorials/tutorial-path'
import {
  isLayoutTourSelector,
  revealNavTarget,
  waitForElement,
  waitForStepPath,
} from '@/lib/tutorials/wait-for-element'

const TutorialContext = React.createContext<TutorialContextValue | null>(null)

function storageKey(userId: string) {
  return `${ONBOARDING_STORAGE_PREFIX}${userId}`
}

function readLocalStep(userId: string): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { step?: number }
    return typeof parsed.step === 'number' ? parsed.step : null
  } catch {
    return null
  }
}

function writeLocalStep(userId: string, step: number) {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey(userId), JSON.stringify({ step, updatedAt: Date.now() }))
}

function clearLocalStep(userId: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(storageKey(userId))
}

async function resolveElement(selector: string): Promise<string | Element> {
  if (isLayoutTourSelector(selector)) {
    revealNavTarget(selector)
  }
  const found = await waitForElement(selector, 2000)
  if (found) return found
  const fallback = await waitForElement('[data-tour="page-main"]', 800)
  if (fallback) return fallback
  return 'body'
}

export function TutorialProvider({
  children,
  userId,
  role,
  initialProgress,
}: {
  children: React.ReactNode
  userId: string
  role: UserRole
  initialProgress: OnboardingProgress
}) {
  const router = useRouter()
  const defaultSteps = React.useMemo(() => getOnboardingStepsForRole(role), [role])

  const [progress, setProgress] = React.useState(initialProgress)
  const [isRunning, setIsRunning] = React.useState(false)

  const driverRef = React.useRef<Driver | null>(null)
  const stepIndexRef = React.useRef(0)
  const isTransitioningRef = React.useRef(false)
  const standaloneTourRef = React.useRef(false)
  const tourStepsRef = React.useRef<TutorialStep[]>(defaultSteps)
  const demoTutorPathRef = React.useRef<string | null>(null)
  const advanceGateCleanupRef = React.useRef<(() => void) | null>(null)
  const suppressDestroyEndRef = React.useRef(false)

  const clearAdvanceGate = React.useCallback(() => {
    advanceGateCleanupRef.current?.()
    advanceGateCleanupRef.current = null
  }, [])

  React.useEffect(() => {
    if (!isRunning) {
      tourStepsRef.current = defaultSteps
      demoTutorPathRef.current = null
    }
  }, [defaultSteps, isRunning])

  const destroyDriver = React.useCallback(() => {
    clearAdvanceGate()
    suppressDestroyEndRef.current = true
    if (driverRef.current?.isActive()) {
      driverRef.current.destroy()
    }
    driverRef.current = null
    suppressDestroyEndRef.current = false
  }, [clearAdvanceGate])

  const refreshProgress = React.useCallback(async () => {
    const next = await getOnboardingProgress()
    setProgress(next)
  }, [])

  const persistStep = React.useCallback(
    async (stepIndex: number) => {
      writeLocalStep(userId, stepIndex)
      await saveOnboardingStep(stepIndex)
      setProgress((prev) => ({ ...prev, step: stepIndex }))
    },
    [userId]
  )

  const endStandaloneTour = React.useCallback(() => {
    clearAdvanceGate()
    setIsRunning(false)
    isTransitioningRef.current = false
    standaloneTourRef.current = false
    demoTutorPathRef.current = null
    tourStepsRef.current = defaultSteps
  }, [clearAdvanceGate, defaultSteps])

  const prefetchStepRoute = React.useCallback(
    (index: number, steps: TutorialStep[]) => {
      const next = steps[index]
      if (next?.path) router.prefetch(next.path)
    },
    [router]
  )

  const showStep = React.useCallback(
    async (index: number, options?: { continuing?: boolean }) => {
      const steps = tourStepsRef.current
      if (index < 0 || index >= steps.length) return
      if (!options?.continuing && isTransitioningRef.current) return

      isTransitioningRef.current = true
      stepIndexRef.current = index

      const step: TutorialStep = steps[index]
      prefetchStepRoute(index + 1, steps)

      const currentPath = window.location.pathname
      const demoTutorPath = demoTutorPathRef.current
      const skipNav = canSkipRouteNavigation(step, currentPath, demoTutorPath)
      const navTarget = getNavigationTargetPath(step, currentPath, demoTutorPath)

      if (!skipNav && navTarget) {
        router.push(navTarget)
        await waitForStepPath(step, demoTutorPath)
      }

      const element = await resolveElement(step.element)
      clearAdvanceGate()
      destroyDriver()

      const isStandalone = standaloneTourRef.current
      const isLast = index === steps.length - 1
      const isFirst = index === 0
      const progressLabel = `${index + 1} z ${steps.length}`

      const goToStep = async (targetIndex: number) => {
        await showStep(targetIndex, { continuing: true })
      }

      const driverObj = driver({
        ...DRIVER_BASE_CONFIG,
        showProgress: true,
        progressText: `{{current}} z {{total}}`,
        steps: [
          {
            element,
            popover: {
              title: step.title,
              description: formatTutorialDescription(step.description),
              side: step.side ?? 'bottom',
              showButtons: ['previous', 'next', 'close'],
              progressText: progressLabel,
              showProgress: true,
              doneBtnText: isLast ? 'Zakończ' : 'Dalej',
              onNextClick: (_el, _s, { driver: d }) => {
                if (!canAdvanceFromStep(step, window.location.pathname)) return

                if (isLast) {
                  d.destroy()
                  void (async () => {
                    if (!isStandalone) {
                      await completeOnboarding(index)
                      clearLocalStep(userId)
                      setProgress({ completed: true, skipped: false, step: index })
                    }
                    endStandaloneTour()
                  })()
                  return
                }
                void (async () => {
                  if (!isStandalone) {
                    void persistStep(index)
                  }
                  await showStep(index + 1, { continuing: true })
                })()
              },
              onPrevClick: (_el, _s, { driver: d }) => {
                if (isFirst) return
                void (async () => {
                  await goToStep(index - 1)
                })()
              },
              onCloseClick: (_el, _s, { driver: d }) => {
                d.destroy()
                void (async () => {
                  if (!isStandalone) {
                    await persistStep(index)
                  }
                  endStandaloneTour()
                })()
              },
              onPopoverRender: (popover, { driver: d }) => {
                const handleAdvanceAllowed = () => {
                  if (!canAdvanceFromStep(step, window.location.pathname)) return
                  if (isLast) return

                  isTransitioningRef.current = true
                  clearAdvanceGate()
                  suppressDestroyEndRef.current = true
                  d.destroy()
                  suppressDestroyEndRef.current = false
                  void (async () => {
                    if (!isStandalone) {
                      void persistStep(index)
                    }
                    await showStep(index + 1, { continuing: true })
                  })()
                }

                advanceGateCleanupRef.current = setupAdvanceGate(
                  popover,
                  step,
                  step.advanceRequires ? handleAdvanceAllowed : undefined
                )

                if (isStandalone) {
                  if (steps.length === 1) {
                    const prevBtn = popover.footerButtons.querySelector('.driver-popover-prev-btn')
                    if (prevBtn instanceof HTMLElement) {
                      prevBtn.style.display = 'none'
                    }
                  }
                  return
                }
                if (popover.footerButtons.querySelector('[data-tour-skip]')) return
                const skipBtn = document.createElement('button')
                skipBtn.type = 'button'
                skipBtn.setAttribute('data-tour-skip', 'true')
                skipBtn.className =
                  'text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline mr-auto'
                skipBtn.textContent = 'Pominij tour'
                skipBtn.onclick = () => {
                  d.destroy()
                  void (async () => {
                    await skipOnboarding()
                    clearLocalStep(userId)
                    setProgress((prev) => ({ ...prev, skipped: true }))
                    endStandaloneTour()
                  })()
                }
                popover.footerButtons.prepend(skipBtn)
              },
            },
          },
        ],
        onDestroyed: () => {
          if (suppressDestroyEndRef.current || isTransitioningRef.current) return
          endStandaloneTour()
        },
      })

      driverRef.current = driverObj
      driverObj.drive()
      isTransitioningRef.current = false
    },
    [clearAdvanceGate, destroyDriver, endStandaloneTour, persistStep, prefetchStepRoute, router, userId]
  )

  const startTour = React.useCallback(
    async (options?: StartTourOptions) => {
      if (role !== 'admin' && role !== 'tutor') return

      const isGuidedTour = Boolean(options?.guidedTourKey)
      const isSingleModule = options?.singleModule ?? false
      const isStandalone = isSingleModule || isGuidedTour
      standaloneTourRef.current = isStandalone

      if (options?.guidedTourKey) {
        const tourKey = options.guidedTourKey as AdminGuidedTourKey
        const tour = ADMIN_GUIDED_TOURS[tourKey]
        if (!tour) {
          toast.error('Nie znaleziono poradnika')
          standaloneTourRef.current = false
          return
        }

        const demoPath = await getTourDemoTutorPath()
        if (!demoPath) {
          toast.error('Brak tutorów w systemie — dodaj tutora, aby uruchomić ten poradnik.')
          standaloneTourRef.current = false
          return
        }

        demoTutorPathRef.current = demoPath
        tourStepsRef.current = tour.buildSteps(demoPath)
      } else {
        demoTutorPathRef.current = null
        tourStepsRef.current = defaultSteps
      }

      if (options?.restart && !isStandalone) {
        await resetOnboardingForRestart()
        clearLocalStep(userId)
        setProgress({ completed: false, skipped: false, step: 0 })
      }

      const steps = tourStepsRef.current
      const localStep = readLocalStep(userId)
      let startIndex = options?.fromStep ?? 0

      if (isStandalone && options?.fromStep !== undefined) {
        startIndex = options.fromStep
      } else if (options?.fromStep === undefined && !options?.restart && !isGuidedTour) {
        if (progress.completed || progress.skipped) {
          startIndex = 0
        } else {
          const resumeFrom = Math.max(progress.step, localStep ?? -1)
          startIndex = Math.min(resumeFrom + 1, steps.length - 1)
        }
      }

      setIsRunning(true)
      await showStep(startIndex)
    },
    [
      defaultSteps,
      progress.completed,
      progress.skipped,
      progress.step,
      role,
      showStep,
      userId,
    ]
  )

  const skipTour = React.useCallback(async () => {
    destroyDriver()
    await skipOnboarding()
    clearLocalStep(userId)
    setProgress((prev) => ({ ...prev, skipped: true }))
    endStandaloneTour()
  }, [destroyDriver, endStandaloneTour, userId])

  React.useEffect(() => {
    return () => destroyDriver()
  }, [destroyDriver])

  const value = React.useMemo<TutorialContextValue>(
    () => ({
      role,
      userId,
      progress,
      isRunning,
      startTour,
      skipTour,
      refreshProgress,
    }),
    [isRunning, progress, refreshProgress, role, skipTour, startTour, userId]
  )

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>
}

export function useTutorial() {
  const ctx = React.useContext(TutorialContext)
  if (!ctx) {
    throw new Error('useTutorial must be used within TutorialProvider')
  }
  return ctx
}

export function useTutorialOptional() {
  return React.useContext(TutorialContext)
}
