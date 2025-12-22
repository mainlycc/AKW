import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Sprawdź czy zmienne środowiskowe są ustawione
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Brak zmiennych środowiskowych Supabase')
    return { supabaseResponse, user: null }
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            // Pozwól Supabase zarządzać opcjami cookies - nie nadpisuj ich
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // getUser() automatycznie odświeża token jeśli jest potrzebne
    // To jest preferowana metoda w Supabase SSR
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      // Jeśli błąd, spróbuj odświeżyć sesję
      console.warn('[updateSession] Error getting user, attempting to refresh session:', userError.message)
      
      const {
        data: { session },
        error: refreshError,
      } = await supabase.auth.refreshSession()

      if (refreshError || !session?.user) {
        console.error('[updateSession] Error refreshing session:', refreshError)
        return { supabaseResponse, user: null }
      }

      return { supabaseResponse, user: session.user }
    }

    return { supabaseResponse, user }
  } catch (error) {
    console.error('Błąd w middleware Supabase:', error)
    return { supabaseResponse, user: null }
  }
}

