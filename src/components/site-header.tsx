import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { PageHeader } from "@/components/page-header"
import { NotificationBell } from "@/components/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex shrink-0 flex-col gap-4 border-b bg-background transition-[width,height] ease-linear">
      <div className="flex h-16 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <PageHeader />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
