import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import { Link } from "react-router"
import { useAuthStore } from "@/app/(auth)/stores/authStore"
import { AppBreadcrumbs } from "@/components/app-breadcrumbs"

export function SiteHeader() {
  const user = useAuthStore((s) => s.user)

  const name = user?.name ?? ""
  const email = user?.email ?? ""
  const avatar = user?.avatar_url ?? ""
  const initials =
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"

  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) shrink-0 items-center justify-between gap-2 border-b border-border/20 bg-white/80 backdrop-blur-xl transition-[width,height] ease-linear dark:border-white/10 dark:bg-black/50">
      <div className="flex-1 min-w-0 flex items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger aria-label="Toggle sidebar" className="-ms-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex-1 min-w-0">
          <AppBreadcrumbs />
        </div>
      </div>

      {/* Right side: Theme toggle + User info */}
      <div className="shrink-0 flex items-center gap-4 px-4 lg:px-6">
        <ThemeToggle />

        <Separator orientation="vertical" className="h-6" />

        {/* Account dropdown — DropdownMenu closes on outside-click automatically */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 cursor-pointer rounded-md p-1 hover:opacity-80 transition-opacity outline-none">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col gap-0.5 text-left">
                <span className="text-sm font-medium text-foreground">{name}</span>
                <span className="text-xs text-muted-foreground">{email}</span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-40 border-white/10 bg-black/70 backdrop-blur-xl"
          >
            <DropdownMenuItem asChild>
              <Link to="/account" className="cursor-pointer">
                Your Account
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
