import { PageHeader } from "@/components/page-header"
import { NotificationBell } from "@/components/notification-bell"
import { HelpButton } from "@/components/tutorials/help-button"

interface SiteHeaderProps {
  initialUnreadCount: number
}

export function SiteHeader({ initialUnreadCount }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex shrink-0 flex-col gap-4 border-b bg-background transition-[width,height] ease-linear">
      <div className="flex min-h-16 py-3 items-center gap-1 sm:gap-2 px-2 sm:px-4">
        <PageHeader />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <HelpButton />
          <NotificationBell initialUnreadCount={initialUnreadCount} />
        </div>
      </div>
    </header>
  )
}
