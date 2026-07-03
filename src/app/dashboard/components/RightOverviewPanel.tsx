import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Edit, Eye, CheckCheck, Rocket, HelpCircle, Ticket } from "lucide-react"
import EmptyState from "./EmptyState"
import { cn } from "@/lib/utils"
import { useNavigate } from "react-router"
import { useAuthStore } from "@/app/(auth)/stores/authStore"
import { useDashboardStore } from "@/app/dashboard/stores/dashboardStore"
import { usePermissions } from "@/hooks/usePermissions"
import type { EmployeeData, RecentActivity } from "@/types"

function mapActivities(activities: RecentActivity[]) {
  return activities.slice(0, 5).map((a, i) => ({
    id: i,
    text: a.title,
    project: a.project,
    time: new Date(a.timestamp).toLocaleString(),
    active: i === 0,
  }))
}

function StatCell({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("text-sm font-black leading-none tabular-nums", accent ?? "text-foreground")}>{value}</span>
      <span className="text-[10px] text-muted-foreground leading-tight text-center">{label}</span>
    </div>
  )
}

export default function RightOverviewPanel({
  variant = "aside",
  employee = null,
}: {
  variant?: "aside" | "card" | "developer"
  employee?: EmployeeData | null
}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { hasPermission } = usePermissions()
  const canViewUsers = hasPermission("view users")
  const canEditUsers = hasPermission("edit users")
  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() ?? "??"

  const o = employee?.overview ?? null
  const UPCOMING_TASKS = employee?.upcoming_tasks ?? []
  const RECENT_ACTIVITIES = employee ? mapActivities(employee.recent_activity) : []
  const employeeError = useDashboardStore((s) => s.employeeError)
  const refetchEmployee = useDashboardStore((s) => s.fetchEmployee)
  // ── Shared sidebar content ────────────────────────────────────
  const sidebarInner = (
    <div className="flex flex-col gap-5 p-5 flex-1 min-h-0">
      {/* Profile card */}
      <Card className="glass-panel border-border/20 shadow-none">
        <CardContent className={cn("p-5 flex flex-col items-center text-center gap-3", variant === "card" && "p-6")}>
          <div className="relative">
            <Avatar className={cn("size-20 ring-4 ring-primary/20", variant === "card" && "size-24")}>
              {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
              <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0.5 right-0.5 size-4 rounded-full bg-emerald-500 border-2 border-background" aria-label="Online" />
          </div>
          <div>
            <h2 className="font-heading text-base font-bold">{user?.name ?? "User"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{user?.email ?? ""}</p>
          </div>
          <div className="flex gap-2">
            {canEditUsers && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                aria-label="Edit profile"
                onClick={() => navigate(`/users/${user?.id}/edit`)}
              >
                <Edit className="size-3.5" />
              </Button>
            )}
            {canViewUsers && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                aria-label="View profile"
                onClick={() => navigate("/users", { state: { openUserId: String(user?.id) } })}
              >
                <Eye className="size-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* This week highlight */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl glass-panel border border-border/10 p-3 text-center">
          <p className="font-heading text-xl font-black text-primary leading-none tabular-nums">
            {o?.this_week.tasks_completed ?? "--"}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Tasks Done</p>
          <p className="text-[10px] text-muted-foreground">This week</p>
        </div>
        <div className="rounded-xl glass-panel border border-border/10 p-3 text-center">
          <p className="font-heading text-xl font-black text-primary leading-none tabular-nums">
            {o?.this_week.helped_colleagues ?? "--"}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Helped</p>
          <p className="text-[10px] text-muted-foreground">Colleagues</p>
        </div>
      </div>

      {/* My Tasks with full breakdown */}
      <div className="rounded-xl glass-panel border border-border/10 p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CheckCheck className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">My Tasks</p>
            <p className="font-heading text-base font-black leading-tight tabular-nums">
              {o?.assigned_tasks.total ?? "--"}
            </p>
          </div>
        </div>
        {o && (
          <div className="grid grid-cols-4 gap-1 pt-3 border-t border-border/10">
            <StatCell label="Pending" value={o.assigned_tasks.pending} />
            <StatCell label="Active" value={o.assigned_tasks.in_progress} accent="text-primary" />
            <StatCell label="Done" value={o.assigned_tasks.done} accent="text-emerald-500" />
            <StatCell label="Rated" value={o.assigned_tasks.rated} />
          </div>
        )}
      </div>

      {/* Projects with stakeholder / contributor split */}
      <div className="rounded-xl glass-panel border border-border/10 p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Rocket className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projects</p>
            <p className="font-heading text-base font-black leading-tight tabular-nums">
              {o?.projects.total ?? "--"}
            </p>
          </div>
        </div>
        {o && (
          <div className="grid grid-cols-2 gap-1 pt-3 border-t border-border/10">
            <StatCell label="Stakeholder" value={o.projects.as_stakeholder} />
            <StatCell label="Contributor" value={o.projects.as_contributor} accent="text-primary" />
          </div>
        )}
      </div>

      {/* Help Requests + Tickets side by side */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl glass-panel border border-border/10 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <HelpCircle className="size-3.5 text-primary" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Help</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Requested</span>
              <span className="font-black tabular-nums">{o?.help_requests.requested ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Helped</span>
              <span className="font-black text-emerald-500 tabular-nums">{o?.help_requests.helped_others ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Pending</span>
              <span className="font-black text-amber-500 tabular-nums">{o?.help_requests.pending ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl glass-panel border border-border/10 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Ticket className="size-3.5 text-primary" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Tickets</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Assigned</span>
              <span className="font-black tabular-nums">{o?.tickets.assigned ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Active</span>
              <span className="font-black text-primary tabular-nums">{o?.tickets.in_progress ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Done</span>
              <span className="font-black text-emerald-500 tabular-nums">{o?.tickets.completed ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-border/30" />

      {/* Upcoming Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Upcoming Tasks</h3>
          {UPCOMING_TASKS.length > 3 && (
            <span className="text-[10px] text-primary">+{UPCOMING_TASKS.length - 3} more</span>
          )}
        </div>
        {UPCOMING_TASKS.length > 0 ? (
          <div className="space-y-2">
            {UPCOMING_TASKS.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-start justify-between gap-2 p-3 rounded-lg glass-panel border border-border/10">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate leading-tight">{task.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{task.project?.name ?? "Project"}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge
                    variant={task.days_until_due <= 0 ? "destructive" : task.days_until_due <= 2 ? "secondary" : "outline"}
                    className="text-[9px] h-4 px-1.5"
                  >
                    {task.days_until_due <= 0 ? "Due" : `${task.days_until_due}d`}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(task.due_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No upcoming tasks." minHeight={96} />
        )}
      </div>

      <Separator className="bg-border/30" />

      {/* Recent Activity */}
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Recent Activity</h3>
        {employeeError ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-rose-500">Recent activity is temporarily unavailable.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => refetchEmployee()}>Retry</Button>
            </div>
          </div>
        ) : RECENT_ACTIVITIES.length > 0 ? (
          <div className="relative pl-5 space-y-4">
            <div className="absolute left-1.5 top-1.5 bottom-1.5 w-px bg-border/30" aria-hidden="true" />
            {RECENT_ACTIVITIES.map((activity) => (
              <div key={activity.id} className="relative flex flex-col gap-0.5">
                <span
                  className={cn(
                    "absolute -left-5.5 top-0.5 size-3 rounded-full border-2 border-background",
                    activity.active ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden="true"
                />
                <p className="text-xs font-semibold leading-tight">{activity.text}</p>
                <p className="text-[10px] text-muted-foreground">{activity.project} · {activity.time}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No recent activity." minHeight={120} />
        )}
      </div>
    </div>
  )

  if (variant === "aside") {
    return (
      <aside
        className="flex flex-col w-full md:w-72 lg:w-80 md:shrink-0 border-t md:border-t-0 md:border-l border-border/20 overflow-y-auto min-w-0"
        aria-label="User overview"
      >
        {sidebarInner}
      </aside>
    )
  }

  if (variant === "card") {
    return (
      <section aria-label="Employee overview" className="w-full">
        <div className="mx-auto w-full max-w-xl">
          <div className="rounded-2xl bg-background/60 border border-border/20 overflow-hidden shadow-sm">
            {sidebarInner}
          </div>
        </div>
      </section>
    )
  }

  // ── Developer variant — wide 3-col grid ──────────────────────
  return (
    <section aria-label="Employee overview" className="w-full">
      <div className="w-full p-2 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Col 1 — Profile + This Week */}
          <div className="space-y-4">
            <Card className="glass-panel border-border/20 shadow-none">
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <Avatar className="size-24 ring-4 ring-primary/20">
                    {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
                    <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-1 right-1 size-4 rounded-full bg-emerald-500 border-2 border-background" aria-label="Online" />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-bold">{user?.name ?? "User"}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{user?.email ?? ""}</p>
                </div>
                <div className="flex gap-2">
                  {canEditUsers && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full"
                      aria-label="Edit profile"
                      onClick={() => navigate(`/users/${user?.id}/edit`)}
                    >
                      <Edit className="size-3.5" />
                    </Button>
                  )}
                  {canViewUsers && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full"
                      aria-label="View profile"
                      onClick={() => navigate("/users", { state: { openUserId: String(user?.id) } })}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl glass-panel border border-border/10 p-4 text-center">
                <p className="font-heading text-2xl font-black text-primary tabular-nums">
                  {o?.this_week.tasks_completed ?? "--"}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Tasks Done</p>
                <p className="text-[10px] text-muted-foreground">This week</p>
              </div>
              <div className="rounded-xl glass-panel border border-border/10 p-4 text-center">
                <p className="font-heading text-2xl font-black text-primary tabular-nums">
                  {o?.this_week.helped_colleagues ?? "--"}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Helped</p>
                <p className="text-[10px] text-muted-foreground">Colleagues</p>
              </div>
            </div>
          </div>

          {/* Col 2 — Tasks + Projects + Help + Tickets */}
          <div className="space-y-4">
            <div className="rounded-xl glass-panel border border-border/10 p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CheckCheck className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Tasks</p>
                  <p className="font-heading text-2xl font-black tabular-nums">{o?.assigned_tasks.total ?? "--"}</p>
                </div>
              </div>
              {o && (
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/10">
                  <StatCell label="Pending" value={o.assigned_tasks.pending} />
                  <StatCell label="Active" value={o.assigned_tasks.in_progress} accent="text-primary" />
                  <StatCell label="Done" value={o.assigned_tasks.done} accent="text-emerald-500" />
                  <StatCell label="Rated" value={o.assigned_tasks.rated} />
                </div>
              )}
            </div>

            <div className="rounded-xl glass-panel border border-border/10 p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Rocket className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Projects</p>
                  <p className="font-heading text-2xl font-black tabular-nums">{o?.projects.total ?? "--"}</p>
                </div>
              </div>
              {o && (
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/10">
                  <StatCell label="Stakeholder" value={o.projects.as_stakeholder} />
                  <StatCell label="Contributor" value={o.projects.as_contributor} accent="text-primary" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl glass-panel border border-border/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <HelpCircle className="size-4 text-primary" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Help</p>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Requested</span>
                    <span className="font-black tabular-nums">{o?.help_requests.requested ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Helped</span>
                    <span className="font-black text-emerald-500 tabular-nums">{o?.help_requests.helped_others ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-black text-amber-500 tabular-nums">{o?.help_requests.pending ?? "—"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl glass-panel border border-border/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Ticket className="size-4 text-primary" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Tickets</p>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Assigned</span>
                    <span className="font-black tabular-nums">{o?.tickets.assigned ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Active</span>
                    <span className="font-black text-primary tabular-nums">{o?.tickets.in_progress ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Done</span>
                    <span className="font-black text-emerald-500 tabular-nums">{o?.tickets.completed ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Col 3 — Upcoming Tasks + Recent Activity */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Upcoming Tasks</h3>
                  {UPCOMING_TASKS.length > 3 && (
                    <span className="text-[10px] text-primary">+{UPCOMING_TASKS.length - 3} more</span>
                  )}
                </div>
                {UPCOMING_TASKS.length > 0 ? (
                  UPCOMING_TASKS.slice(0, 3).map((task) => (
                    <div key={task.id} className="flex items-start justify-between gap-2 p-3 rounded-lg glass-panel border border-border/10">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{task.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{task.project?.name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge
                          variant={task.days_until_due <= 0 ? "destructive" : task.days_until_due <= 2 ? "secondary" : "outline"}
                          className="text-[9px] h-4 px-1.5"
                        >
                          {task.days_until_due <= 0 ? "Due" : `${task.days_until_due}d`}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No upcoming tasks." minHeight={96} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-bold">Recent Activity</h3>
                {RECENT_ACTIVITIES.length > 0 ? (
                  <div className="relative pl-5 space-y-4">
                    <div className="absolute left-1.5 top-1.5 bottom-1.5 w-px bg-border/30" aria-hidden="true" />
                    {RECENT_ACTIVITIES.map((activity) => (
                      <div key={activity.id} className="relative flex flex-col gap-0.5">
                        <span
                          className={cn(
                            "absolute -left-5.5 top-0.5 size-3 rounded-full border-2 border-background",
                            activity.active ? "bg-primary" : "bg-border",
                          )}
                          aria-hidden="true"
                        />
                        <p className="text-sm font-semibold leading-tight">{activity.text}</p>
                        <p className="text-xs text-muted-foreground">{activity.project} · {activity.time}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No recent activity." minHeight={120} />
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </section>
  )
}
