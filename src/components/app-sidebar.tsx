"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  IconBook,
  IconCalendar,
  IconDashboard,
  IconFileReport,
  IconSchool,
  IconUsers,
  IconUserPlus,
  IconUserCircle,
  IconReceipt,
  IconClockDollar,
  IconMailPlus,
  IconCalendarTime,
  IconCalendarCheck,
  IconCalendarPlus,
  IconBell,
  IconHistory,
  IconCurrency,
  type Icon,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { LABELS } from "@/lib/labels/reports-declarations"
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
          title: "Kalendarz lekcji",
          url: "/dashboard/kalendarz-lekcji",
          icon: IconCalendarTime,
        },
        {
          title: "Publiczne rezerwacje",
          url: "/dashboard/rezerwacje-publiczne",
          icon: IconCalendarPlus,
        },
      ],
    },
    {
      title: "Rozliczenia & Płatności",
      items: [
        {
          title: LABELS.completedLessonsTutors,
          url: "/dashboard/raporty-tutorow",
          icon: IconClockDollar,
        },
        {
          title: "Rozliczenia tutorów",
          url: "/dashboard/rozliczenia-tutorow",
          icon: IconClockDollar,
        },
        {
          title: LABELS.settlementsFromCompletedLessons,
          url: "/dashboard/billing-from-reports",
          icon: IconReceipt,
        },
        {
          title: LABELS.nextMonthPlansTutors,
          url: "/dashboard/deklaracje-tutorow",
          icon: IconFileReport,
        },
        {
          title: LABELS.settlementsFromNextMonthPlan,
          url: "/dashboard/rozliczenia-deklaracji",
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
        {
          title: "Stawki",
          url: "/dashboard/stawki",
          icon: IconCurrency,
        },
      ],
    },
  ]

  const tutorProfileItem: NavItem = {
    title: "Profil",
    url: "/dashboard/profil",
    icon: IconUserCircle,
  }

  const tutorNavGroups: NavGroup[] = [
    {
      title: "Uczniowie",
      items: [
        {
          title: "Moi uczniowie",
          url: "/dashboard/uczniowie",
          icon: IconUsers,
        },
      ],
    },
    {
      title: "Lekcje",
      items: [
        {
          title: "Dostępność tygodniowa",
          url: "/dashboard/kalendarz",
          icon: IconCalendar,
        },
        {
          title: "Kalendarz lekcji",
          url: "/dashboard/kalendarz-lekcji",
          icon: IconCalendarCheck,
        },
      ],
    },
    {
      title: "Rozliczenia",
      items: [
        {
          title: LABELS.nextMonthPlan,
          url: "/dashboard/moje-deklaracje",
          icon: IconFileReport,
        },
        {
          title: LABELS.completedLessons,
          url: "/dashboard/moje-raporty",
          icon: IconReceipt,
        },
      ],
    },
    {
      title: "Archiwum",
      items: [
        {
          title: "Historia sesji",
          url: "/dashboard/historia",
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

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="p-3">
        <Link href="/dashboard" className="flex items-center justify-center w-full">
          <Image
            src="/logoAW.png"
            alt="Akademia Wiedzy"
            width={140}
            height={56}
            className="h-auto w-full max-w-[140px] object-contain"
            priority
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {user.role === 'admin' ? (
          <NavMain dashboardItem={dashboardItem} groups={adminNavGroups} />
        ) : (
          <NavMain
            dashboardItem={dashboardItem}
            groups={tutorNavGroups}
            bottomItem={tutorProfileItem}
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
