import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Logowanie requestów dla debugowania (opcjonalne)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Middleware] ${request.method} ${request.nextUrl.pathname}`, {
      userAgent: request.headers.get('user-agent')?.substring(0, 50),
      origin: request.headers.get('origin'),
    })
  }

  const { supabaseResponse, user } = await updateSession(request)

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

