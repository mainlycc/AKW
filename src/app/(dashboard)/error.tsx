'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
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
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-semibold">Coś poszło nie tak</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Wystąpił błąd w panelu. Zespół został powiadomiony — możesz spróbować ponownie.
      </p>
      <Button onClick={() => reset()}>Spróbuj ponownie</Button>
    </div>
  )
}
