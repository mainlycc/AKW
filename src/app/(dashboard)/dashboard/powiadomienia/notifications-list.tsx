'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import Link from 'next/link'
import { IconCheck, IconChecks } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { markAsRead, markAllAsRead, type Notification } from '@/lib/actions/notifications'
import { cn } from '@/lib/utils'

interface NotificationsListProps {
  initialNotifications: Notification[]
}

export function NotificationsList({ initialNotifications }: NotificationsListProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [isPending, startTransition] = useTransition()

  const unreadCount = notifications.filter(n => !n.read_at).length

  const handleMarkAsRead = async (notificationId: string) => {
    startTransition(async () => {
      try {
        await markAsRead(notificationId)
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
          )
        )
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    })
  }

  const handleMarkAllAsRead = async () => {
    startTransition(async () => {
      try {
        await markAllAsRead()
        setNotifications(prev =>
          prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
        )
      } catch (error) {
        console.error('Error marking all as read:', error)
      }
    })
  }

  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, 'd MMMM yyyy, HH:mm', { locale: pl })
  }

  const getNotificationLink = (notification: Notification): string => {
    const metadata = notification.metadata || {}
    
    switch (notification.type) {
      case 'public_booking_created':
      case 'public_booking_confirmed':
      case 'public_booking_cancelled':
        return '/dashboard/rezerwacje-publiczne'
      case 'assignment_created':
      case 'assignment_status_changed':
        return '/dashboard/przypisania'
      case 'report_submitted':
        return '/dashboard/raporty-tutorow'
      case 'report_approved':
      case 'report_paid':
        return '/dashboard/moje-raporty'
      case 'session_created':
        return '/dashboard/sesje'
      default:
        return '/dashboard/powiadomienia'
    }
  }

  const getNotificationTypeLabel = (type: Notification['type']): string => {
    const labels: Record<Notification['type'], string> = {
      public_booking_created: 'Rezerwacja',
      public_booking_confirmed: 'Rezerwacja',
      public_booking_cancelled: 'Rezerwacja',
      assignment_created: 'Przypisanie',
      assignment_status_changed: 'Przypisanie',
      report_submitted: 'Raport',
      report_approved: 'Raport',
      report_paid: 'Raport',
      session_created: 'Sesja',
    }
    return labels[type] || 'Powiadomienie'
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            Brak powiadomień
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {unreadCount} {unreadCount === 1 ? 'nieprzeczytane powiadomienie' : 'nieprzeczytanych powiadomień'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isPending}
          >
            <IconChecks className="mr-2 h-4 w-4" />
            Oznacz wszystkie jako przeczytane
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((notification) => {
          const isUnread = !notification.read_at
          const link = getNotificationLink(notification)

          return (
            <Card
              key={notification.id}
              className={cn(
                'transition-colors',
                isUnread && 'border-primary/50 bg-muted/30'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={link}
                    className="flex-1 min-w-0"
                    onClick={() => {
                      if (isUnread) {
                        handleMarkAsRead(notification.id)
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {getNotificationTypeLabel(notification.type)}
                          </Badge>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <h3 className="font-semibold text-sm mb-1">
                          {notification.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatNotificationTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                  {isUnread && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleMarkAsRead(notification.id)}
                      disabled={isPending}
                      title="Oznacz jako przeczytane"
                    >
                      <IconCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

