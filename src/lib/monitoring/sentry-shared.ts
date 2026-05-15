import type { PostgrestError } from '@supabase/supabase-js'
import { SupabaseClient } from '@supabase/supabase-js'
import { supabaseIntegration } from '@supabase/sentry-js-integration'
import type { BrowserOptions } from '@sentry/nextjs'
import type * as Sentry from '@sentry/nextjs'

type SentryErrorEvent = Parameters<NonNullable<BrowserOptions['beforeSend']>>[0]

const SENSITIVE_KEYS = ['password', 'phone', 'email', 'pesel', 'token', 'secret', 'authorization']

export function getSupabaseRestPrefix(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url ? `${url}/rest` : ''
}

export function isSupabaseRestUrl(url: string): boolean {
  const prefix = getSupabaseRestPrefix()
  return prefix ? url.startsWith(prefix) : false
}

export function createSupabaseSentryIntegration(SentryNamespace: typeof Sentry) {
  return supabaseIntegration(SupabaseClient, SentryNamespace, {
    tracing: true,
    breadcrumbs: true,
    errors: true,
    sanitizeBody: (_table, key) => {
      const lower = key.toLowerCase()
      if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
        return '[Filtered]'
      }
      return undefined
    },
  })
}

export function scrubSentryEvent(event: SentryErrorEvent): SentryErrorEvent {
  if (!event.request?.headers) return event

  const headers = { ...event.request.headers }
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'cookie' || key.toLowerCase() === 'authorization') {
      headers[key] = '[Filtered]'
    }
  }
  event.request = { ...event.request, headers }
  return event
}

export function getSentryBaseOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN
  return {
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    enabled: Boolean(dsn),
    debug: process.env.NODE_ENV === 'development',
    beforeSend(event: SentryErrorEvent) {
      return scrubSentryEvent(event)
    },
  }
}

export function serializePostgrestError(error: PostgrestError | null | undefined) {
  if (!error) return null
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  }
}
