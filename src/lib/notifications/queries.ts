import { createClient } from '@/lib/supabase/server'
import type { Notification } from './types'

export type { Notification, NotificationType } from './types'

export async function getNotifications(
  limit: number = 50,
  offset: number = 0
): Promise<Notification[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching notifications:', error)
    throw error
  }

  return (data || []) as Notification[]
}

export async function getNotificationsCount(): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.error('Error fetching notifications count:', error)
    throw error
  }

  return count || 0
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) {
    console.error('Error fetching unread count:', error)
    throw error
  }

  return count || 0
}

export async function getNotificationsSummary(limit: number = 10): Promise<{
  notifications: Notification[]
  unreadCount: number
}> {
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(limit, 0),
    getUnreadCount(),
  ])
  return { notifications, unreadCount }
}
