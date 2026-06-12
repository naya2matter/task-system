import { useEffect } from "react"
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useUsersStore } from "@/app/users/stores/usersStore"
import type { UserProjectStatus } from "@/services/usersService"

// ─── Props ────────────────────────────────────────────────────────────────────
type UserProjectsProps = {
  /** The user id whose projects should be loaded */
  userId: string
}

// ─── Status helpers ───────────────────────────────────────────────────────────
// Map raw API status strings to human-readable labels
const STATUS_LABEL: Record<string, string> = {
  pending:     "Pending",
  in_progress: "In Progress",
  done:        "Done",
  rated:       "Rated",
}

// Map status to shadcn Badge variant for colour coding
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending:     "outline",
  in_progress: "secondary",
  done:        "default",
  rated:       "default",
}

// Tailwind dot colour per status (shown beside the label on small screens)
const STATUS_DOT: Record<string, string> = {
  pending:     "bg-muted-foreground",
  in_progress: "bg-yellow-500",
  done:        "bg-primary",
  rated:       "bg-purple-500",
}

function StatusBadge({ status }: { status: UserProjectStatus }) {
  const key = String(status).toLowerCase()
  return (
    <Badge variant={STATUS_VARIANT[key] ?? "outline"} className="whitespace-nowrap">
      <span className={`mr-1.5 inline-block size-2 rounded-full ${STATUS_DOT[key] ?? "bg-muted-foreground"}`} />
      {STATUS_LABEL[key] ?? status}
    </Badge>
  )
}

// Simple inline progress bar (no separate component needed)
function ProgressBar({ value }: { value: number | string }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      {/* Track */}
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        {/* Fill */}
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function UserProjects({ userId }: UserProjectsProps) {
  // Pull only the slices we need directly from the store.
  // Using the store directly (not useUsers) avoids triggering the
  // fetchUsers() side-effect that lives in the useUsers hook.
  const {
    userProjects,
    userProjectsPagination,
    userProjectsLoading,
    userProjectsError,
    fetchUserProjects,
  } = useUsersStore()

  // Fetch page 1 whenever the userId changes
  useEffect(() => {
    fetchUserProjects(userId, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Handler to navigate to a different page
  const goToPage = (page: number) => fetchUserProjects(userId, page)

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (userProjectsLoading && !userProjects) {
    return (
      <div className="space-y-2">
        {/* Section heading skeleton */}
        <Skeleton className="h-4 w-32" />
        {/* Table row skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    )
  }

  // ── Error state (ignore cancelled requests) ──────────────────────────────
  if (userProjectsError && !userProjects) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <AlertCircle className="size-7 text-destructive" />
        <p className="text-sm text-destructive">{userProjectsError}</p>
        {/* Retry button fetches page 1 again */}
        <Button variant="outline" size="sm" onClick={() => fetchUserProjects(userId, 1)}>
          Retry
        </Button>
      </div>
    )
  }

  // ── Empty state — hide section entirely (same pattern as task assignments) ─
  if (userProjects && userProjects.length === 0) return null

  if (!userProjects) return null

  const pagination = userProjectsPagination

  return (
    <div className="space-y-3">
      {/* ── Section heading ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Projects as Stakeholder
        </h4>
        {/* Show total count when available */}
        {pagination && (
          <Badge variant="secondary" className="text-xs">
            {pagination.total}
          </Badge>
        )}
      </div>

      {/* ── Inline error banner (shown when a page-change fails) ────────── */}
      {userProjectsError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{userProjectsError}</p>
        </div>
      )}

      {/* ── Cards List ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {userProjects.map((project) => (
          <div
            key={project.id}
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-semibold text-sm leading-none">{project.name}</p>
                {project.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <StatusBadge status={project.status} />
              </div>
            </div>
            <div className="mt-1">
              <ProgressBar value={project.progress_percentage} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {/* Only render if there are multiple pages */}
      {pagination && pagination.last_page > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {/* Range label e.g. "1–10 of 23" */}
          <span>
            {pagination.from}–{pagination.to} of {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={pagination.current_page <= 1 || userProjectsLoading}
              onClick={() => goToPage(pagination.current_page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-1">
              {pagination.current_page} / {pagination.last_page}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={pagination.current_page >= pagination.last_page || userProjectsLoading}
              onClick={() => goToPage(pagination.current_page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
