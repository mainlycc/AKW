'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pl">
      <body>
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
          <h2>Wystąpił nieoczekiwany błąd</h2>
          <p>Problem został zgłoszony do zespołu technicznego.</p>
          <button type="button" onClick={() => reset()}>
            Spróbuj ponownie
          </button>
        </div>
      </body>
    </html>
  )
}
