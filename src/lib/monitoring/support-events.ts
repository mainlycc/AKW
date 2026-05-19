'use server'

import type { PostgrestError } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notifyAdminsOfIncident } from './notify-admins'
import { captureServerException, setSentryUserFromSession } from './sentry'
import { serializePostgrestError } from './sentry-shared'

export type SupportSeverity = 'info' | 'warning' | 'error' | 'critical'

export type LogSupportEventParams = {
  severity: SupportSeverity
  action: string
  correlationId: string
  route?: string
  request?: Record<string, unknown>
  result?: Record<string, unknown>
  supabaseError?: PostgrestError | null
  actorUserId?: string
  actorRole?: string
  client?: Record<string, unknown>
}

async function resolveActor(): Promise<{ actorUserId: string; actorRole: string } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    actorUserId: user.id,
    actorRole: profile?.role ?? 'unknown',
  }
}

export async function logSupportEvent(params: LogSupportEventParams): Promise<void> {
  try {
    await setSentryUserFromSession()

    const actor =
      params.actorUserId && params.actorRole
        ? { actorUserId: params.actorUserId, actorRole: params.actorRole }
        : await resolveActor()

    if (!actor) {
      console.warn('[logSupportEvent] No authenticated actor, skipping DB insert')
      return
    }

    const admin = createAdminClient()
    const { error: insertError } = await admin.from('support_events').insert({
      severity: params.severity,
      actor_user_id: actor.actorUserId,
      actor_role: actor.actorRole,
      action: params.action,
      route: params.route ?? null,
      correlation_id: params.correlationId,
      request: params.request ?? {},
      result: params.result ?? {},
      supabase_error: serializePostgrestError(params.supabaseError),
      client: params.client ?? {},
    })

    if (insertError) {
      console.error('[logSupportEvent] Insert failed:', insertError)
    }

    const isAlertSeverity = params.severity === 'error' || params.severity === 'critical'
    if (isAlertSeverity) {
      captureServerException(
        params.supabaseError ?? new Error(params.action),
        {
          correlationId: params.correlationId,
          route: params.route,
          action: params.action,
          supabaseError: params.supabaseError,
        }
      )

      await notifyAdminsOfIncident({
        title: `Problem: ${params.action}`,
        message: `Użytkownik (${actor.actorRole}) — ${params.route ?? 'brak trasy'}. ID korelacji: ${params.correlationId}`,
        action: params.action,
        correlationId: params.correlationId,
        severity: params.severity as 'error' | 'critical',
        actorUserId: actor.actorUserId,
        route: params.route,
      })
    }
  } catch (err) {
    console.error('[logSupportEvent] Unexpected error:', err)
  }
}

export async function logSupabaseFailure(params: {
  severity?: SupportSeverity
  action: string
  correlationId: string
  route?: string
  request?: Record<string, unknown>
  supabaseError: PostgrestError
}): Promise<void> {
  await logSupportEvent({
    severity: params.severity ?? 'error',
    action: params.action,
    correlationId: params.correlationId,
    route: params.route,
    request: params.request,
    supabaseError: params.supabaseError,
  })
}

export async function logActionFailure(params: {
  action: string
  correlationId: string
  route?: string
  request?: Record<string, unknown>
  error: unknown
  supabaseError?: PostgrestError | null
}): Promise<void> {
  const message = params.error instanceof Error ? params.error.message : String(params.error)

  await logSupportEvent({
    severity: 'error',
    action: params.action,
    correlationId: params.correlationId,
    route: params.route,
    request: params.request,
    result: { message },
    supabaseError: params.supabaseError ?? null,
  })

  captureServerException(params.error, {
    correlationId: params.correlationId,
    route: params.route,
    action: params.action,
    supabaseError: params.supabaseError,
  })
}
