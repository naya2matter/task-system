import { Link, useLocation } from "react-router"
import { ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function NavCollapsible({
  items,
}: {
  items: {
    title: string
    icon: LucideIcon
    items: {
      title: string
      url: string
    }[]
  }[]
}) {
  const location = useLocation()
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === "collapsed" && !isMobile

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = item.items.some(
            (sub) => location.pathname === sub.url
          )

          if (isCollapsed) {
            return (
              <SidebarMenuItem key={item.title}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      aria-label={item.title}
                      className={`relative transition-all duration-200 ease-out group-data-[collapsible=icon]:!gap-0 ${
                        isActive 
                          ? "bg-sidebar-accent/50 text-sidebar-foreground shadow-none font-normal [&_svg:not(.chevron-icon)]:text-sidebar-foreground" 
                          : "hover:bg-sidebar-accent/70"
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-sidebar-primary rounded-r-sm" />
                      )}
                      <item.icon className="size-4" />
                      <span className="sr-only">{item.title}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    side="right" 
                    align="start" 
                    sideOffset={8} 
                    className="w-56 bg-black/80 backdrop-blur-xl border-white/10 text-white shadow-2xl rounded-xl"
                  >
                    <DropdownMenuLabel className="font-semibold text-xs tracking-wider text-white/50 uppercase px-2 py-1.5">
                      {item.title}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    {item.items.map((subItem) => {
                      const isSubActive = location.pathname === subItem.url
                      return (
                        <DropdownMenuItem key={subItem.title} asChild className={`focus:bg-white/10 focus:text-white rounded-lg cursor-pointer mx-1 my-0.5 ${isSubActive ? "bg-white/10" : ""}`}>
                           <Link to={subItem.url} className="w-full flex items-center pr-2 py-1">
                             <div className={`mr-2 h-1.5 w-1.5 rounded-full flex-shrink-0 ${isSubActive ? "bg-sidebar-primary" : "bg-white/20"}`} />
                             <span className="text-sm font-medium">{subItem.title}</span>
                           </Link>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            )
          }

          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    aria-label={item.title}
                    className={`relative transition-all duration-200 ease-out group-data-[collapsible=icon]:!gap-0 ${
                      isActive 
                        ? "bg-sidebar-accent/50 text-sidebar-foreground shadow-none font-normal [&_svg:not(.chevron-icon)]:text-sidebar-foreground" 
                        : "hover:bg-sidebar-accent/70"
                    }`}
                  >
                    {/* Smooth left border indicator for active state */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-sidebar-primary rounded-r-sm" />
                    )}
                    <item.icon className="size-4" />
                    <span className="transition-all duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:pointer-events-none">
                      {item.title}
                    </span>
                    <ChevronRight className="chevron-icon ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent className={isCollapsed ? "hidden" : ""}>
                  <SidebarMenuSub>
                    {item.items.map((subItem) => {
                      const isSubActive = location.pathname === subItem.url
                      return (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isSubActive}
                          className={`transition-all duration-200 ease-out ${
                            isSubActive
                              ? "bg-sidebar-accent/50 text-sidebar-foreground [&_svg]:text-sidebar-foreground font-normal!"
                              : "hover:bg-sidebar-accent/50"
                          }`}
                        >
                          <Link to={subItem.url}>
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
