'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/actions/notifications'

const throttleMap = new Map<string, number>()
const THROTTLE_MS = 60_000

function shouldThrottle(key: string): boolean {
  const now = Date.now()
  const last = throttleMap.get(key)
  if (last && now - last < THROTTLE_MS) {
    return true
  }
  throttleMap.set(key, now)
  return false
}

export type NotifyAdminsParams = {
  title: string
  message: string
  action: string
  correlationId: string
  severity: 'error' | 'critical'
  actorUserId?: string
  route?: string
}

export async function notifyAdminsOfIncident(params: NotifyAdminsParams): Promise<void> {
  const throttleKey = `${params.action}:${params.severity}`
  if (shouldThrottle(throttleKey)) {
    return
  }

  const admin = createAdminClient()
  const { data: admins, error } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (error || !admins?.length) {
    console.error('[notifyAdminsOfIncident] Failed to fetch admins:', error)
    return
  }

  await Promise.all(
    admins.map((adminProfile) =>
      createNotification({
        userId: adminProfile.id,
        type: 'support_incident',
        title: params.title,
        message: params.message,
        metadata: {
          action: params.action,
          correlation_id: params.correlationId,
          severity: params.severity,
          actor_user_id: params.actorUserId,
          route: params.route,
        },
        skipRevalidate: false,
      })
    )
  )
}
