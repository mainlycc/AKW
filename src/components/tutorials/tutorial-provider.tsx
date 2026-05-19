'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

import type { UserRole } from '@/lib/types/database.types'
import {
  completeOnboarding,
  getOnboardingProgress,
  resetOnboardingForRestart,
  saveOnboardingStep,
  skipOnboarding,
} from '@/lib/actions/onboarding'
import { DRIVER_BASE_CONFIG } from '@/lib/tutorials/driver-config'
import { getOnboardingStepsForRole } from '@/lib/tutorials/get-steps-for-role'
import {
  ONBOARDING_STORAGE_PREFIX,
  type OnboardingProgress,
  type TutorialContextValue,
  type TutorialStep,
} from '@/lib/tutorials/types'
import { waitForElement, waitForPath } from '@/lib/tutorials/wait-for-element'

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
  const found = await waitForElement(selector)
  if (found) return found
  const fallback = await waitForElement('[data-tour="page-main"]')
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
  const pathname = usePathname()
  const steps = React.useMemo(() => getOnboardingStepsForRole(role), [role])

  const [progress, setProgress] = React.useState(initialProgress)
  const [isRunning, setIsRunning] = React.useState(false)

  const driverRef = React.useRef<Driver | null>(null)
  const stepIndexRef = React.useRef(0)
  const isTransitioningRef = React.useRef(false)

  const destroyDriver = React.useCallback(() => {
    if (driverRef.current?.isActive()) {
      driverRef.current.destroy()
    }
    driverRef.current = null
  }, [])

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

  const showStep = React.useCallback(
    async (index: number) => {
      if (index < 0 || index >= steps.length) return
      if (isTransitioningRef.current) return

      isTransitioningRef.current = true
      stepIndexRef.current = index

      const step: TutorialStep = steps[index]
      destroyDriver()

      if (pathname !== step.path) {
        router.push(step.path)
        await waitForPath(step.path)
      }

      const element = await resolveElement(step.element)
      const isLast = index === steps.length - 1
      const isFirst = index === 0

      const goToStep = async (targetIndex: number) => {
        destroyDriver()
        isTransitioningRef.current = false
        await showStep(targetIndex)
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
              description: step.description,
              side: step.side ?? 'bottom',
              showButtons: ['previous', 'next', 'close'],
              progressText: `${index + 1} z ${steps.length}`,
              showProgress: true,
              doneBtnText: isLast ? 'Zakończ' : 'Dalej',
              onNextClick: (_el, _s, { driver: d }) => {
                if (isLast) {
                  d.destroy()
                  void (async () => {
                    await completeOnboarding(index)
                    clearLocalStep(userId)
                    setProgress({ completed: true, skipped: false, step: index })
                    setIsRunning(false)
                    isTransitioningRef.current = false
                  })()
                  return
                }
                void (async () => {
                  await persistStep(index)
                  d.destroy()
                  isTransitioningRef.current = false
                  await showStep(index + 1)
                })()
              },
              onPrevClick: (_el, _s, { driver: d }) => {
                if (isFirst) return
                d.destroy()
                void goToStep(index - 1)
              },
              onCloseClick: (_el, _s, { driver: d }) => {
                d.destroy()
                void (async () => {
                  await persistStep(index)
                  setIsRunning(false)
                  isTransitioningRef.current = false
                })()
              },
              onPopoverRender: (popover, { driver: d }) => {
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
                    setIsRunning(false)
                    isTransitioningRef.current = false
                  })()
                }
                popover.footerButtons.prepend(skipBtn)
              },
            },
          },
        ],
        onDestroyed: () => {
          if (!isTransitioningRef.current) {
            setIsRunning(false)
          }
        },
      })

      driverRef.current = driverObj
      driverObj.drive()
      isTransitioningRef.current = false
    },
    [destroyDriver, pathname, persistStep, router, steps, userId]
  )

  const startTour = React.useCallback(
    async (options?: { fromStep?: number; restart?: boolean }) => {
      if (role !== 'admin' && role !== 'tutor') return

      if (options?.restart) {
        await resetOnboardingForRestart()
        clearLocalStep(userId)
        setProgress({ completed: false, skipped: false, step: 0 })
      }

      const localStep = readLocalStep(userId)
      let startIndex = options?.fromStep ?? 0

      if (options?.fromStep === undefined && !options?.restart) {
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
    [progress.completed, progress.skipped, progress.step, role, showStep, steps.length, userId]
  )

  const skipTour = React.useCallback(async () => {
    destroyDriver()
    await skipOnboarding()
    clearLocalStep(userId)
    setProgress((prev) => ({ ...prev, skipped: true }))
    setIsRunning(false)
  }, [destroyDriver, userId])

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
