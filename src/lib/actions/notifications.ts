'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type NotificationType =
  | 'public_booking_created'
  | 'public_booking_confirmed'
  | 'public_booking_cancelled'
  | 'assignment_created'
  | 'assignment_status_changed'
  | 'report_submitted'
  | 'report_approved'
  | 'report_paid'
  | 'report_reminder'
  | 'session_created'
  | 'session_confirmation_required'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  read_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, unknown>
  skipRevalidate?: boolean
}

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

  // Revalidate notifications page and header (skip during render)
  if (!params.skipRevalidate) {
    revalidatePath('/dashboard/powiadomienia')
    revalidatePath('/dashboard', 'layout')
  }

  return data.id
}

/**
 * Gets notifications for the current user
 */
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

/**
 * Gets total count of notifications for the current user
 */
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

/**
 * Gets unread notifications count for the current user
 */
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
