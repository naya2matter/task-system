import { Link, useLocation } from "react-router"
import type { LucideIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
}) {
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  // On mobile the sidebar is an off-canvas drawer — close it after navigating.
  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = location.pathname === item.url
            return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton 
                asChild 
                isActive={isActive}
                tooltip={item.title}
                className={`group relative w-full overflow-hidden rounded-xl border border-transparent transition-all duration-200 ease-out ${
                    isActive
                      ? "bg-sidebar-primary/20 text-sidebar-foreground shadow-md shadow-red-950/30"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:border-sidebar-border/40"
                  }`}
              >
                <Link
                  to={item.url}
                  aria-label={item.title}
                  onClick={handleNavigate}
                  className="relative flex items-center gap-2 group-data-[collapsible=icon]:!gap-0 group-data-[collapsible=icon]:justify-center"
                >
                  {/* Smooth left border indicator for active state */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-sidebar-primary rounded-r-sm" />
                  )}
                  <item.icon className="size-4" />
                  <span className="transition-all duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:pointer-events-none">
                    {item.title}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
