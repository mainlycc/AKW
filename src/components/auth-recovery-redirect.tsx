'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Supabase po kliknięciu w link verify często kieruje na Site URL (/) z tokenami w hash (#),
 * których middleware nie widzi — użytkownik widzi stronę główną zamiast /reset-password.
 * Przenosimy te same parametry na /reset-password.
 */
export function AuthRecoveryRedirect() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== '/') return

    const { search, hash } = window.location
    const params = new URLSearchParams(search)

    // PKCE — middleware też to obsłuży, ale na wszelki wypadek
    if (params.has('code')) {
      window.location.replace(`/reset-password${search}`)
      return
    }

    // Fragment z tokenami (typowe: #access_token=...&type=recovery)
    if (
      hash &&
      (hash.includes('access_token') ||
        hash.includes('type=recovery') ||
        hash.includes('refresh_token'))
    ) {
      window.location.replace(`/reset-password${hash}`)
      return
    }

    if (params.get('type') === 'recovery' || params.has('token_hash')) {
      window.location.replace(`/reset-password${search}`)
      return
    }
  }, [pathname])

  return null
}
