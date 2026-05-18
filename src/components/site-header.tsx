import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { useAuthStore } from "@/app/(auth)/stores/authStore"
import { AppBreadcrumbs } from "@/components/app-breadcrumbs"

export function SiteHeader() {
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const user = useAuthStore((s) => s.user)

  const name = user?.name ?? ""
  const email = user?.email ?? ""
  const avatar = user?.avatar_url ?? ""
  const initials = name
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

        {/* User Info - Collapsible */}
        <Separator orientation="vertical" className="h-6" />

        <Collapsible open={isAccountOpen} onOpenChange={setIsAccountOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity rounded-md p-1">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 transition-transform duration-200" style={{
              transform: isAccountOpen ? 'rotate(180deg)' : 'rotate(0deg)'
            }} />
          </CollapsibleTrigger>
          <CollapsibleContent className="absolute right-4 top-full z-50 mt-2 min-w-max rounded-lg border border-white/10 bg-black/70 p-2 shadow-lg backdrop-blur-xl lg:right-6">
            <Link
              to="/account"
              onClick={() => setIsAccountOpen(false)}
              className="block px-4 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              Your Account
            </Link>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </header>
  )
}
