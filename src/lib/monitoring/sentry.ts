import * as Sentry from '@sentry/nextjs'
import type { PostgrestError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { serializePostgrestError } from './sentry-shared'

export type SentryUserContext = {
  id: string
  email?: string
  role?: string
}

export function setSentryUser(user: SentryUserContext | null) {
  if (!user) {
    Sentry.setUser(null)
    return
  }
  Sentry.setUser({
    id: user.id,
    email: user.email,
  })
  if (user.role) {
    Sentry.setTag('user.role', user.role)
  }
}

export function setSentryActionContext(params: {
  correlationId?: string
  route?: string
  action?: string
}) {
  if (params.correlationId) {
    Sentry.setTag('correlationId', params.correlationId)
  }
  if (params.route) {
    Sentry.setTag('route', params.route)
  }
  if (params.action) {
    Sentry.setTag('action', params.action)
  }
}

export async function setSentryUserFromSession(): Promise<SentryUserContext | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email, full_name')
      .eq('id', user.id)
      .single()

    const context: SentryUserContext = {
      id: user.id,
      email: profile?.email ?? user.email ?? undefined,
      role: profile?.role ?? undefined,
    }
    setSentryUser(context)
    return context
  } catch {
    return null
  }
}

export function captureServerException(
  error: unknown,
  context?: {
    correlationId?: string
    route?: string
    action?: string
    supabaseError?: PostgrestError | null
  }
) {
  if (context) {
    setSentryActionContext(context)
  }

  const serialized = serializePostgrestError(context?.supabaseError ?? null)
  if (serialized?.code) {
    Sentry.setTag('supabase.code', serialized.code)
  }

  if (error instanceof Error) {
    Sentry.captureException(error, {
      extra: {
        supabase_error: serialized,
      },
    })
    return
  }

  Sentry.captureMessage(String(error), {
    level: 'error',
    extra: {
      supabase_error: serialized,
    },
  })
}
