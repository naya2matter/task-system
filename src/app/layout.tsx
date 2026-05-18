import { Outlet } from "react-router"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { DashboardBackground } from "@/components/dashboard-background"
import { useClockingNotifications } from "@/hooks/useClockingNotifications"

function ClockingNotificationsProvider() {
  useClockingNotifications()
  return null
}

export default function Layout() {
  return (
    <SidebarProvider
      className="h-dvh overflow-hidden"
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "72px",
          "--header-height": "4rem",
        } as React.CSSProperties
      }
    >
      <ClockingNotificationsProvider />
      <DashboardBackground />
      <AppSidebar variant="inset" />
      <SidebarInset className="flex w-full flex-1 flex-col h-full min-h-0 overflow-hidden">
        <SiteHeader />
        <div className="flex-1 overflow-y-auto min-w-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
