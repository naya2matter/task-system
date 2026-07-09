import * as React from "react"
import { Link } from "react-router"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { NavCollapsible } from "@/components/nav-collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ListTodo,
  HelpCircle,
  Ticket,
  Star,
  Clock,
  Shield,
  LayoutGrid,
} from "lucide-react"
import { usePermissions } from "@/hooks/usePermissions";
import taskSystemLogo from "@/assets/image.png"
const data = {
  user: {
    name: "Admin",
    email: "admin@system.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Users",
      url: "/users",
      icon: Users,
      
    },
    {
      title: "Projects",
      url: "/projects",
      icon: FolderKanban,
    },
    {
      title: "Tasks",
      url: "/tasks",
      icon: ListTodo,
    },
    {
      title: "Help Requests",
      url: "/help-requests",
      icon: HelpCircle,
    },
    {
      title: "Tickets",
      url: "/tickets",
      icon: Ticket,
    },
    {
      title: "Roles",
      url: "/roles",
      icon: Shield,
    },
    {
      title: "Workspaces",
      url: "/workspaces",
      icon: LayoutGrid,
    },
  ],
  navCollapsible: [
    {
      title: "Ratings",
      icon: Star,
      items: [
        { title: "Configurations", url: "/ratings/configurations" },
        { title: "Ratings", url: "/ratings" },
        { title: "Final Ratings", url: "/ratings/final-ratings" },
        { title: "Weighted Ratings (SOS)", url: "/ratings/weighted-ratings" },
      ],
    },
    {
      title: "Clocking",
      icon: Clock,
      items: [
        { title: "Clocking IN/OUT", url: "/clocking/in-out" },
        { title: "Clocking Records", url: "/clocking/records" },
        { title: "Clocking Sessions", url: "/clocking/sessions" },
      ],
    },
  ],
  
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { hasRole, hasPermission } = usePermissions();
  const isAdmin = hasRole("admin");
  const { isMobile, setOpenMobile } = useSidebar();

  // On mobile the sidebar is an off-canvas drawer — close it after navigating.
  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }

  const navMainItems = data.navMain.filter((item) => {
    if (item.url === "/users") return isAdmin || hasPermission("view users")
    if (item.url === "/roles") return isAdmin || hasPermission("view roles")
    return true
  })

  // Filter collateral nav items based on permissions
  const navCollapsibleItems = data.navCollapsible
    .map((section) => {
      if (section.title === "Ratings") {
        return {
          ...section,
          items: section.items.filter((item) => {
            if (item.url === "/ratings/configurations") {
              return isAdmin || hasPermission("view rating configs")
            }
            if (item.url === "/ratings") {
              // Requires EITHER create task ratings OR create stakeholder ratings
              return isAdmin || hasPermission("create task ratings") || hasPermission("create stakeholder ratings")
            }
            if (item.url === "/ratings/final-ratings") {
              return isAdmin || hasPermission("calculate final ratings")
            }
            if (item.url === "/ratings/weighted-ratings") {
              return isAdmin || hasPermission("calculate final ratings")
            }
            return true
          }),
        }
      }
      if (section.title === "Clocking") {
        return {
          ...section,
          items: section.items.filter((item) => {
            if (item.url === "/clocking/sessions") {
              return isAdmin || hasPermission("view all clocking sessions")
            }
            return true
          }),
        }
      }
      return section
    })
    .filter((section) => section.items.length > 0)

  return (
    <Sidebar
      collapsible="icon"
      className="shrink-0 overflow-hidden border-r border-border/20 bg-white/80 text-sidebar-foreground shadow-sm backdrop-blur-xl transition-[width] duration-300 ease-in-out dark:border-white/10 dark:bg-black/40"
      {...props}
    >
      {/* Header: Logo + Project Title */}
      <SidebarHeader className="border-b border-white/10 px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Task System"
              className="h-auto p-0 hover:bg-transparent group/brand"
            >
              <Link to="/" aria-label="Task System" onClick={handleNavigate} className="flex  flex-col items-center gap-1 rounded-xl p-1 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!gap-0 group-data-[collapsible=icon]:justify-center  group-data-[collapsible=icon]:flex-row">
                <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/80 p-1 ring-1 ring-white/10 shadow-sm transition-all duration-200 h-11 w-11 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:!p-0.5  group-data-[collapsible=icon]:!mx-auto">
                  <img src={taskSystemLogo} alt="Task System" className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col transition-all duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:pointer-events-none">
                  <span className="text-sm font-semibold text-sidebar-foreground">Task System</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Navigation Content */}
      <SidebarContent className="px-2 py-4">
        <NavMain items={navMainItems} />
        <NavCollapsible items={navCollapsibleItems} />
      </SidebarContent>

      {/* Account Section + Logout Footer */}
      <SidebarFooter className="border-t border-white/10 px-3 py-3">
        <NavUser  />
      </SidebarFooter>
    </Sidebar>
  )
}
