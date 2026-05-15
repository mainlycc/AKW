'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
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
import { markAsRead, markAllAsRead } from '@/lib/actions/notifications'
import type { Notification } from '@/lib/notifications/types'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 60_000
const SUMMARY_LIMIT = 10

interface NotificationBellProps {
  initialUnreadCount: number
}

export function NotificationBell({ initialUnreadCount }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [hasLoadedSummary, setHasLoadedSummary] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { unreadCount: number }
      setUnreadCount(data.unreadCount)
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }, [])

  const fetchSummary = useCallback(async () => {
    setIsLoadingSummary(true)
    try {
      const res = await fetch(`/api/notifications/summary?limit=${SUMMARY_LIMIT}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        notifications: Notification[]
        unreadCount: number
      }
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
      setHasLoadedSummary(true)
    } catch (error) {
      console.error('Error loading notifications summary:', error)
    } finally {
      setIsLoadingSummary(false)
    }
  }, [])

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState !== 'visible') return
      void fetchUnreadCount()
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchUnreadCount()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchUnreadCount])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open && !hasLoadedSummary) {
      void fetchSummary()
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    startTransition(async () => {
      try {
        await markAsRead(notificationId)
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
          )
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    })
  }

  const handleMarkAllAsRead = async () => {
    startTransition(async () => {
      try {
        await markAllAsRead()
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
        )
        setUnreadCount(0)
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
    }
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} ${minutes === 1 ? 'minutę' : 'minut'} temu`
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} ${hours === 1 ? 'godzinę' : 'godzin'} temu`
    }
    return format(date, 'd MMM yyyy, HH:mm', { locale: pl })
  }

  const getNotificationLink = (notification: Notification): string => {
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
      case 'support_incident':
        return '/dashboard/kalendarz'
      default:
        return '/dashboard/powiadomienia'
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
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
          {isLoadingSummary ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Ładowanie...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {hasLoadedSummary ? 'Brak powiadomień' : 'Otwórz, aby zobaczyć powiadomienia'}
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
                      void handleMarkAsRead(notification.id)
                    }
                    setIsOpen(false)
                  }}
                >
                  <Link href={link} className="w-full">
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{notification.title}</p>
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
