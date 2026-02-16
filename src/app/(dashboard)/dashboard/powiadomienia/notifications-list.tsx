'use client'

import { useState, useTransition, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import Link from 'next/link'
import { IconCheck, IconChecks, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { getNotifications, getNotificationsCount, markAsRead, markAllAsRead, deleteAllNotifications, type Notification } from '@/lib/actions/notifications'
import { cn } from '@/lib/utils'

interface NotificationsListProps {
  initialNotifications: Notification[]
  initialTotalCount: number
  itemsPerPage: number
}

export function NotificationsList({ 
  initialNotifications, 
  initialTotalCount,
  itemsPerPage 
}: NotificationsListProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  useEffect(() => {
    const loadNotifications = async () => {
      setIsLoading(true)
      try {
        const offset = (currentPage - 1) * itemsPerPage
        const [newNotifications, newTotalCount] = await Promise.all([
          getNotifications(itemsPerPage, offset),
          getNotificationsCount(),
        ])
        setNotifications(newNotifications)
        setTotalCount(newTotalCount)
      } catch (error) {
        console.error('Error loading notifications:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (currentPage !== 1) {
      loadNotifications()
    }
  }, [currentPage, itemsPerPage])

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
        // Aktualizuj liczbę nieprzeczytanych
        const newTotalCount = await getNotificationsCount()
        setTotalCount(newTotalCount)
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
        // Aktualizuj liczbę nieprzeczytanych
        const newTotalCount = await getNotificationsCount()
        setTotalCount(newTotalCount)
      } catch (error) {
        console.error('Error marking all as read:', error)
      }
    })
  }

  const handleDeleteAll = async () => {
    startTransition(async () => {
      try {
        await deleteAllNotifications()
        setNotifications([])
        setTotalCount(0)
        setCurrentPage(1)
      } catch (error) {
        console.error('Error deleting all notifications:', error)
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
      case 'report_reminder':
        return '/dashboard/raporty-tutorow'
      case 'report_approved':
      case 'report_paid':
        return '/dashboard/moje-raporty'
      case 'session_created':
      case 'session_confirmation_required':
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
      report_reminder: 'Raport',
      session_created: 'Sesja',
      session_confirmation_required: 'Sesja',
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0 && (
            <>
              {unreadCount} {unreadCount === 1 ? 'nieprzeczytane powiadomienie' : 'nieprzeczytanych powiadomień'}
            </>
          )}
          {unreadCount === 0 && totalCount > 0 && (
            <>Wszystkie powiadomienia zostały przeczytane</>
          )}
        </p>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isPending}
            >
              <IconChecks className="mr-2 h-4 w-4" />
              Oznacz wszystkie jako przeczytane
            </Button>
          )}
          {totalCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isPending}
              className="text-destructive hover:text-destructive"
            >
              <IconTrash className="mr-2 h-4 w-4" />
              Wyczyść wszystkie
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Wyczyść wszystkie powiadomienia"
        description="Czy na pewno chcesz usunąć wszystkie powiadomienia? Ta operacja jest nieodwracalna."
        onConfirm={handleDeleteAll}
        confirmText="Usuń wszystkie"
        cancelText="Anuluj"
        variant="destructive"
      />

      <div className="space-y-2">
        {isLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                Ładowanie powiadomień...
              </p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => {
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
          })
        )}
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (currentPage > 1) {
                    setCurrentPage(currentPage - 1)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }
                }}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>

            {(() => {
              const pages: (number | 'ellipsis')[] = []
              
              if (totalPages <= 7) {
                // Jeśli jest mało stron, pokaż wszystkie
                for (let i = 1; i <= totalPages; i++) {
                  pages.push(i)
                }
              } else {
                // Zawsze pokaż pierwszą stronę
                pages.push(1)
                
                if (currentPage <= 3) {
                  // Jeśli jesteśmy na początku
                  pages.push(2, 3, 4, 'ellipsis', totalPages)
                } else if (currentPage >= totalPages - 2) {
                  // Jeśli jesteśmy na końcu
                  pages.push('ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
                } else {
                  // Jeśli jesteśmy w środku
                  pages.push('ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages)
                }
              }
              
              return pages.map((page, index) => {
                if (page === 'ellipsis') {
                  return (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )
                }
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(page)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              })
            })()}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (currentPage < totalPages) {
                    setCurrentPage(currentPage + 1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}

