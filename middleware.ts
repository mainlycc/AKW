import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

function redirectPreservingSupabaseCookies(
  supabaseResponse: NextResponse,
  url: URL
): NextResponse {
  const redirectResponse = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value)
  })
  return redirectResponse
}

export async function middleware(request: NextRequest) {
  // Logowanie requestów dla debugowania (opcjonalne)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Middleware] ${request.method} ${request.nextUrl.pathname}`, {
      userAgent: request.headers.get('user-agent')?.substring(0, 50),
      origin: request.headers.get('origin'),
    })
  }

  const { supabaseResponse, user } = await updateSession(request)

  // PKCE: Supabase zwraca ?code= na redirect_to — jeśli to jest tylko Site URL (/), przenieś na reset hasła
  if (request.nextUrl.pathname === '/') {
    const code = request.nextUrl.searchParams.get('code')
    if (code) {
      const url = request.nextUrl.clone()
      url.pathname = '/reset-password'
      return redirectPreservingSupabaseCookies(supabaseResponse, url)
    }
    const type = request.nextUrl.searchParams.get('type')
    if (type === 'recovery' || request.nextUrl.searchParams.has('token_hash')) {
      const url = request.nextUrl.clone()
      url.pathname = '/reset-password'
      return redirectPreservingSupabaseCookies(supabaseResponse, url)
    }
  }

  // Sprawdź czy użytkownik próbuje uzyskać dostęp do chronionej strony
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isRegisterPage = request.nextUrl.pathname.startsWith('/register')
  const isForgotPassword = request.nextUrl.pathname.startsWith('/forgot-password')
  const isResetPassword = request.nextUrl.pathname.startsWith('/reset-password')
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')

  // Jeśli użytkownik nie jest zalogowany i próbuje dostać się do dashboardu
  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Jeśli użytkownik jest zalogowany i próbuje dostać się do strony logowania lub rejestracji
  // (ale nie do stron resetowania hasła, które mogą wymagać zalogowanej sesji)
  if (user && (isAuthPage || isRegisterPage) && !isForgotPassword && !isResetPassword) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

