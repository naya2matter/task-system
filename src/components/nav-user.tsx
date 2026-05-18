import { useState } from "react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/app/(auth)/hooks/useAuth"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSidebar } from "@/components/ui/sidebar"

export function NavUser() {
  const {logout, isLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === "collapsed" && !isMobile

 

  // const initials = user?.name
  //   ? user.name
  //       .split(" ")
  //       .map((n) => n[0])
  //       .join("")
  //       .toUpperCase()
  //       .slice(0, 2)
  //   : "?"

  return (
    <div className="w-full space-y-3">
      

      {/* Logout Button + Confirm Dialog */}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Log out"
                className="w-full h-8 justify-start gap-2 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:!gap-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
              >
                <LogOut className="size-4" />
                <span className="text-sm transition-all duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:pointer-events-none">
                  Log out
                </span>
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          {isCollapsed && <TooltipContent side="right">Log out</TooltipContent>}
        </Tooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll be redirected to the login page. Any unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => logout()}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
