'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getNotifications,
  getNotificationsCount,
  getUnreadCount,
} from '@/lib/notifications/queries'

export type { Notification, NotificationType } from '@/lib/notifications/types'
import type { NotificationType } from '@/lib/notifications/types'

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, unknown>
  skipRevalidate?: boolean
}

export { getNotifications, getNotificationsCount, getUnreadCount }

/**
 * Creates a notification for a user (uses admin client to bypass RLS)
 */
export async function createNotification(params: CreateNotificationParams): Promise<string> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('notifications')
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata || {},
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating notification:', error)
    throw error
  }

  if (!params.skipRevalidate) {
    revalidatePath('/dashboard/powiadomienia')
    revalidatePath('/dashboard', 'layout')
  }

  return data.id
}

/**
 * Marks a notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)

  if (error) {
    console.error('Error marking notification as read:', error)
    throw error
  }

  revalidatePath('/dashboard/powiadomienia')
  revalidatePath('/dashboard', 'layout')
}

/**
 * Marks all notifications as read for the current user
 */
export async function markAllAsRead(): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)

  if (error) {
    console.error('Error marking all notifications as read:', error)
    throw error
  }

  revalidatePath('/dashboard/powiadomienia')
  revalidatePath('/dashboard', 'layout')
}

/**
 * Deletes all notifications for the current user
 */
export async function deleteAllNotifications(): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .delete()

  if (error) {
    console.error('Error deleting all notifications:', error)
    throw error
  }

  revalidatePath('/dashboard/powiadomienia')
  revalidatePath('/dashboard', 'layout')
}
