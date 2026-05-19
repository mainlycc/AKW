'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconAlertTriangle, IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { formatPendingSessionsMessage } from '@/lib/labels/pending-sessions'

const CALENDAR_PATH = '/dashboard/kalendarz-lekcji'

interface PendingSessionsBannerClientProps {
  count: number
}

export function PendingSessionsBannerClient({ count }: PendingSessionsBannerClientProps) {
  const pathname = usePathname()

  if (count <= 0 || pathname === CALENDAR_PATH) {
    return null
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="space-y-0.5">
            <p className="font-semibold text-sm sm:text-base">Potwierdź status lekcji</p>
            <p className="text-sm text-amber-900/90 dark:text-amber-100/90">
              {formatPendingSessionsMessage(count)} Oznacz je jako odbyte lub odwołane w kalendarzu lekcji.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-400 bg-white hover:bg-amber-100 dark:bg-amber-950 dark:hover:bg-amber-900">
          <Link href={CALENDAR_PATH}>
            Przejdź do kalendarza
            <IconChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
