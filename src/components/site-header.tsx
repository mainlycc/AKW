import { PageHeader } from "@/components/page-header"
import { NotificationBell } from "@/components/notification-bell"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex shrink-0 flex-col gap-4 border-b bg-background transition-[width,height] ease-linear">
      <div className="flex h-16 items-center gap-1 sm:gap-2 px-2 sm:px-4">
        <PageHeader />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
