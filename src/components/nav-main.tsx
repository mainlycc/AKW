"use client"

import * as React from "react"
import Link from "next/link"
import { type Icon, IconChevronRight } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { navTourIdFromPath } from "@/lib/tutorials/nav-tour-ids"

type NavItem = {
  title: string
  url: string
  icon?: Icon
}

type NavGroup = {
  title: string
  items: NavItem[]
}

function NavStandaloneItem({ item }: { item: NavItem }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={item.title} asChild>
              <Link href={item.url} data-tour={navTourIdFromPath(item.url)}>
                {item.icon && <item.icon />}
                <span className="font-semibold text-lg">{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function NavMain({
  dashboardItem,
  groups,
  bottomItem,
}: {
  dashboardItem?: NavItem
  groups?: NavGroup[]
  bottomItem?: NavItem
}) {
  return (
    <>
      {dashboardItem && <NavStandaloneItem item={dashboardItem} />}

      {groups?.map((group) => (
        <NavGroup key={group.title} group={group} />
      ))}

      {bottomItem && <NavStandaloneItem item={bottomItem} />}
    </>
  )
}

function NavGroup({ group }: { group: NavGroup }) {
  const [open, setOpen] = React.useState(false)

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
                  <IconChevronRight
                    className={cn(
                      "transition-transform duration-200",
                      open && "rotate-90"
                    )}
                  />
                  <span className="font-semibold text-lg">{group.title}</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {group.items.map((item) => (
                    <SidebarMenuSubItem key={item.title}>
                      <SidebarMenuSubButton asChild>
                        <Link href={item.url} data-tour={navTourIdFromPath(item.url)}>
                          {item.icon && <item.icon />}
                          <span className="text-base">{item.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
