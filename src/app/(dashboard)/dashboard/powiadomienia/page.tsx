import { getUserProfile } from '@/lib/actions/auth'
import { getNotifications, getNotificationsCount } from '@/lib/actions/notifications'
import { NotificationsList } from './notifications-list'

const ITEMS_PER_PAGE = 10

export default async function NotificationsPage() {
  const profile = await getUserProfile()

  if (!profile) {
    return null
  }

  const [notifications, totalCount] = await Promise.all([
    getNotifications(ITEMS_PER_PAGE, 0),
    getNotificationsCount(),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Zarządzaj swoimi powiadomieniami
          </p>
        </div>
      </div>

      <NotificationsList 
        initialNotifications={notifications} 
        initialTotalCount={totalCount}
        itemsPerPage={ITEMS_PER_PAGE}
      />
    </div>
  )
}

