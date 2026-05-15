import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/notifications/api-auth'
import { getNotifications, getNotificationsCount } from '@/lib/notifications/queries'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser()
  if (auth.errorResponse) return auth.errorResponse

  const searchParams = request.nextUrl.searchParams
  const pageParam = searchParams.get('page')
  const limitParam = searchParams.get('limit')

  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 100) : 10
  const page = pageParam ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1
  const offset = (page - 1) * limit

  try {
    const [notifications, totalCount] = await Promise.all([
      getNotifications(limit, offset),
      getNotificationsCount(),
    ])
    return NextResponse.json({ notifications, totalCount, page, limit })
  } catch (error) {
    console.error('[GET /api/notifications]', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}
