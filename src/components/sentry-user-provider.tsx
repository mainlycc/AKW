'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

type SentryUserProviderProps = {
  userId: string
  email: string
  role: string
}

export function SentryUserProvider({ userId, email, role }: SentryUserProviderProps) {
  useEffect(() => {
    Sentry.setUser({ id: userId, email })
    Sentry.setTag('user.role', role)
    return () => {
      Sentry.setUser(null)
    }
  }, [userId, email, role])

  return null
}
