import { createClient } from '@supabase/supabase-js'
import { createStorageFromOptions } from '@supabase/ssr/dist/module/cookies'
import { isBrowser } from '@supabase/ssr/dist/module/utils'

/**
 * Linki recovery z maila używają implicit grant (tokeny w #hash).
 * createBrowserClient z @supabase/ssr wymusza flowType: 'pkce', co powoduje
 * odrzucenie takiego URL ("Not a valid PKCE flow url") i brak sesji → "link wygasł".
 * Ten klient ma flowType: 'implicit' i ten sam storage (cookies) co zwykły klient SSR.
 */
export function createRecoveryClient() {
  const { storage } = createStorageFromOptions(
    { cookieEncoding: 'base64url' },
    false
  )

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
        autoRefreshToken: isBrowser(),
        detectSessionInUrl: isBrowser(),
        persistSession: true,
        storage,
      },
    }
  )
}
