import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { AppFooter } from "@/components/app-footer"
import { Card } from "@/components/ui/card"
import { getUserProfile, getUser } from "@/lib/actions/auth"
import { getUnreadCount } from "@/lib/notifications/queries"
import { redirect } from "next/navigation"
import { SentryUserProvider } from "@/components/sentry-user-provider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Najpierw sprawdź czy użytkownik jest zalogowany (szybkie sprawdzenie)
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  // Potem pobierz profil (może być null, ale użytkownik jest zalogowany)
  let profile
  try {
    profile = await getUserProfile()
  } catch (error) {
    console.error('[DashboardLayout] Error fetching user profile:', error)
    // Jeśli błąd, ale użytkownik jest zalogowany, użyj podstawowych danych
    profile = null
  }

  // Jeśli profil nie istnieje, użyj podstawowych danych z user
  const userData = {
    name: profile?.full_name || user.email?.split('@')[0] || 'Użytkownik',
    email: profile?.email || user.email || '',
    role: profile?.role || 'tutor',
  }

  let initialUnreadCount = 0
  try {
    initialUnreadCount = await getUnreadCount()
  } catch (error) {
    console.error('[DashboardLayout] Error fetching unread notifications:', error)
  }

  return (
    <SidebarProvider>
      <SentryUserProvider userId={user.id} email={userData.email} role={userData.role} />
      <AppSidebar user={userData} />
      <SidebarInset className="flex flex-col min-h-screen">
        <Card className="m-2 sm:m-4 flex flex-1 flex-col overflow-hidden py-0">
          <SiteHeader initialUnreadCount={initialUnreadCount} />
          <div className="flex flex-1 flex-col gap-4 p-2 sm:p-4 pt-2 sm:pt-4">
            {children}
          </div>
        </Card>
        <AppFooter />
      </SidebarInset>
    </SidebarProvider>
  )
}


