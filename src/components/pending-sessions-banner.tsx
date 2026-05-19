import { getPendingPastSessionsCount } from '@/lib/actions/pending-session-confirmations'
import { PendingSessionsBannerClient } from '@/components/pending-sessions-banner-client'

interface PendingSessionsBannerProps {
  tutorId: string
}

export async function PendingSessionsBanner({ tutorId }: PendingSessionsBannerProps) {
  const count = await getPendingPastSessionsCount(tutorId)

  if (count <= 0) {
    return null
  }

  return <PendingSessionsBannerClient count={count} />
}
