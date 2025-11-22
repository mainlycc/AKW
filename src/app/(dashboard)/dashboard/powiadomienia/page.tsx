import { getUserProfile } from '@/lib/actions/auth'
import { getNotifications, markAsRead, markAllAsRead } from '@/lib/actions/notifications'
import { NotificationsList } from './notifications-list'

export default async function NotificationsPage() {
  const profile = await getUserProfile()

  if (!profile) {
    return null
  }

  const notifications = await getNotifications(100)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Zarządzaj swoimi powiadomieniami
          </p>
        </div>
      </div>

      <NotificationsList initialNotifications={notifications} />
    </div>
  )
}

