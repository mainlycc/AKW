import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/notifications/api-auth'
import { getNotificationsSummary } from '@/lib/notifications/queries'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser()
  if (auth.errorResponse) return auth.errorResponse

  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10

  try {
    const summary = await getNotificationsSummary(limit)
    return NextResponse.json(summary)
  } catch (error) {
    console.error('[GET /api/notifications/summary]', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}
