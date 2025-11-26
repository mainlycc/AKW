"use client"

import * as React from "react"
import {
  IconBook,
  IconCalendar,
  IconDashboard,
  IconFileReport,
  IconSchool,
  IconUsers,
  IconUserPlus,
  IconUserCircle,
  IconUsersGroup,
  IconReceipt,
  IconClockDollar,
  IconMailPlus,
  IconCalendarTime,
  IconCalendarCheck,
  IconCalendarPlus,
  IconBell,
  IconCreditCard,
  IconHistory,
  type Icon,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string
    email: string
    role: 'admin' | 'tutor'
  }
}

type NavItem = {
  title: string
  url: string
  icon?: Icon
}

type NavGroup = {
  title: string
  items: NavItem[]
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const dashboardItem: NavItem = {
    title: "Dashboard",
    url: "/dashboard",
    icon: IconDashboard,
  }

  const adminNavGroups: NavGroup[] = [
    {
      title: "Użytkownicy",
      items: [
        {
          title: "Uczniowie",
          url: "/dashboard/uczniowie",
          icon: IconUsers,
        },
        {
          title: "Rodzice",
          url: "/dashboard/rodzice",
          icon: IconUsersGroup,
        },
        {
          title: "Tutorzy",
          url: "/dashboard/tutorzy",
          icon: IconSchool,
        },
        {
          title: "Zaproszenia",
          url: "/dashboard/zaproszenia",
          icon: IconMailPlus,
        },
      ],
    },
    {
      title: "Nauczanie",
      items: [
        {
          title: "Przedmioty",
          url: "/dashboard/przedmioty",
          icon: IconBook,
        },
        {
          title: "Przypisania",
          url: "/dashboard/przypisania",
          icon: IconUserPlus,
        },
        {
          title: "Dostępność tutorów",
          url: "/dashboard/dostepnosc-tutorow",
          icon: IconCalendarCheck,
        },
      ],
    },
    {
      title: "Lekcje",
      items: [
        {
          title: "Sesje",
          url: "/dashboard/sesje",
          icon: IconCalendar,
        },
        {
          title: "Kalendarz lekcji",
          url: "/dashboard/kalendarz-lekcji",
          icon: IconCalendarTime,
        },
        {
          title: "Publiczne rezerwacje",
          url: "/dashboard/rezerwacje-publiczne",
          icon: IconCalendarPlus,
        },
        {
          title: "Raporty sesji",
          url: "/dashboard/raporty",
          icon: IconFileReport,
        },
      ],
    },
    {
      title: "Rozliczenia & Płatności",
      items: [
        {
          title: "Raporty tutorów",
          url: "/dashboard/raporty-tutorow",
          icon: IconClockDollar,
        },
        {
          title: "Rozliczenia miesięczne",
          url: "/dashboard/billing",
          icon: IconCreditCard,
        },
        {
          title: "Rozliczenia z raportów",
          url: "/dashboard/billing-from-reports",
          icon: IconReceipt,
        },
        {
          title: "Historia płatności",
          url: "/dashboard/payments",
          icon: IconHistory,
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          title: "Powiadomienia",
          url: "/dashboard/powiadomienia",
          icon: IconBell,
        },
      ],
    },
  ]

  const tutorNavItems: NavItem[] = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Profil",
      url: "/dashboard/profil",
      icon: IconUserCircle,
    },
    {
      title: "Grafik",
      url: "/dashboard/kalendarz",
      icon: IconCalendarTime,
    },
    {
      title: "Kalendarz lekcji",
      url: "/dashboard/kalendarz-lekcji",
      icon: IconCalendarCheck,
    },
    {
      title: "Moi Uczniowie",
      url: "/dashboard/uczniowie",
      icon: IconUsers,
    },
    {
      title: "Sesje",
      url: "/dashboard/sesje",
      icon: IconCalendar,
    },
    {
      title: "Historia",
      url: "/dashboard/historia",
      icon: IconFileReport,
    },
    {
      title: "Moje raporty",
      url: "/dashboard/moje-raporty",
      icon: IconReceipt,
    },
    {
      title: "Powiadomienia",
      url: "/dashboard/powiadomienia",
      icon: IconBell,
    },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/dashboard">
                <IconSchool className="!size-5" />
                <span className="text-base font-semibold">Akademia Wiedzy</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {user.role === 'admin' ? (
          <NavMain dashboardItem={dashboardItem} groups={adminNavGroups} />
        ) : (
          <NavMain items={tutorNavItems} />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
