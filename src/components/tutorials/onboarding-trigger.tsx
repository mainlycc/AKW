'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTutorialOptional } from '@/components/tutorials/tutorial-provider'

/**
 * Auto-starts onboarding after first login.
 * Tutors are sent to /dashboard/profil first (subject + level selection).
 */
export function OnboardingTrigger() {
  const pathname = usePathname()
  const router = useRouter()
  const tutorial = useTutorialOptional()
  const hasTriggered = useRef(false)
  const redirecting = useRef(false)

  useEffect(() => {
    if (!tutorial || hasTriggered.current) return
    if (tutorial.isRunning) return
    if (tutorial.progress.completed || tutorial.progress.skipped) return

    const isTutor = tutorial.role === 'tutor'

    if (isTutor) {
      if (pathname === '/dashboard' && !redirecting.current) {
        redirecting.current = true
        router.replace('/dashboard/profil')
        return
      }
      if (pathname !== '/dashboard/profil') return
    } else if (pathname !== '/dashboard') {
      return
    }

    hasTriggered.current = true
    const timer = window.setTimeout(() => {
      void tutorial.startTour()
    }, 600)

    return () => window.clearTimeout(timer)
  }, [pathname, router, tutorial])

  return null
}
