import * as Sentry from '@sentry/nextjs'
import {
  createSupabaseSentryIntegration,
  getSentryBaseOptions,
  isSupabaseRestUrl,
} from './src/lib/monitoring/sentry-shared'

Sentry.init({
  ...getSentryBaseOptions(),
  integrations: [
    createSupabaseSentryIntegration(Sentry),
    Sentry.browserTracingIntegration({
      shouldCreateSpanForRequest: (url) => !isSupabaseRestUrl(url),
    }),
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
