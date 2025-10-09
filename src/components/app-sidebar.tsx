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

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const adminNavItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
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
      title: "Sesje",
      url: "/dashboard/sesje",
      icon: IconCalendar,
    },
    {
      title: "Raporty",
      url: "/dashboard/raporty",
      icon: IconFileReport,
    },
  ]

  const tutorNavItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
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
  ]

  const navItems = user.role === 'admin' ? adminNavItems : tutorNavItems

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
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
