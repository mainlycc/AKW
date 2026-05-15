import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/notifications/api-auth'
import { getUnreadCount } from '@/lib/notifications/queries'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.errorResponse) return auth.errorResponse

  try {
    const unreadCount = await getUnreadCount()
    return NextResponse.json({ unreadCount })
  } catch (error) {
    console.error('[GET /api/notifications/unread-count]', error)
    return NextResponse.json({ error: 'Failed to fetch unread count' }, { status: 500 })
  }
}
