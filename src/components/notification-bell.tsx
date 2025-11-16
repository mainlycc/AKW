'use client'

import { useState, useEffect, useTransition } from 'react'
import { IconBell } from '@tabler/icons-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, type Notification } from '@/lib/actions/notifications'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const loadNotifications = async () => {
    try {
      const [notifs, count] = await Promise.all([
        getNotifications(10),
        getUnreadCount(),
      ])
      setNotifications(notifs)
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  useEffect(() => {
    loadNotifications()
    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleMarkAsRead = async (notificationId: string) => {
    startTransition(async () => {
      try {
        await markAsRead(notificationId)
        await loadNotifications()
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    })
  }

  const handleMarkAllAsRead = async () => {
    startTransition(async () => {
      try {
        await markAllAsRead()
        await loadNotifications()
      } catch (error) {
        console.error('Error marking all as read:', error)
      }
    })
  }

  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return 'przed chwilą'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} ${minutes === 1 ? 'minutę' : 'minut'} temu`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} ${hours === 1 ? 'godzinę' : 'godzin'} temu`
    } else {
      return format(date, 'd MMM yyyy, HH:mm', { locale: pl })
    }
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

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <IconBell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-2">
          <h3 className="font-semibold text-sm">Powiadomienia</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkAllAsRead}
              disabled={isPending}
            >
              Oznacz wszystkie jako przeczytane
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Brak powiadomień
            </div>
          ) : (
            notifications.map((notification) => {
              const isUnread = !notification.read_at
              const link = getNotificationLink(notification)

              return (
                <DropdownMenuItem
                  key={notification.id}
                  asChild
                  className={cn(
                    'flex flex-col items-start p-3 cursor-pointer',
                    isUnread && 'bg-muted/50'
                  )}
                  onClick={() => {
                    if (isUnread) {
                      handleMarkAsRead(notification.id)
                    }
                    setIsOpen(false)
                  }}
                >
                  <Link href={link} className="w-full">
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">
                            {notification.title}
                          </p>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatNotificationTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              )
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/powiadomienia" className="w-full text-center">
            Zobacz wszystkie powiadomienia
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

