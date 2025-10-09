import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  // Sprawdź czy użytkownik próbuje uzyskać dostęp do chronionej strony
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')

  // Jeśli użytkownik nie jest zalogowany i próbuje dostać się do dashboardu
  if (!user && isDashboard) {
    return Response.redirect(new URL('/login', request.url))
  }

  // Jeśli użytkownik jest zalogowany i próbuje dostać się do strony logowania
  if (user && isAuthPage) {
    return Response.redirect(new URL('/dashboard', request.url))
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

