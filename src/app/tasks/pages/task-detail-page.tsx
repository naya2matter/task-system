// Task Detail Page
// Displays the full details of a single task loaded from GET /tasks/{id}.
// Accessed via the /tasks/:id route â€” a proper page, not a sheet.
//
// NEW sections added (each have their own loading / error / pagination state):
//   â€¢ Subtasks   â€” GET /tasks/{taskId}/subtasks
//   â€¢ Help Requests â€” GET /tasks/{taskId}/help-requests
//   â€¢ Ratings    â€” GET /tasks/{taskId}/ratings

import { useMemo } from "react"
import { useEffect, useState, useCallback } from "react"
import { AxiosError, isCancel } from "axios"
import { useNavigate, useParams, Link } from "react-router"
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Star,
  Users,
  Weight,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTask } from "@/app/tasks/hooks/useTask"
import { useUpdateTaskStatus } from "@/app/tasks/hooks/useUpdateTaskStatus"
import { useTasksStore } from "@/app/tasks/store/taskStore"
import { taskService } from "@/app/tasks/services/taskService"
import { usePermissions } from "@/hooks/usePermissions"
import { useAuthStore } from "@/app/(auth)/stores/authStore"
import type {
  Task,
  TaskStatus,
  TaskHelpRequest,
  TaskRatingRecord,
  HelpRequestRatingValue,
  TaskPagination,
} from "@/app/tasks/types"
import { helpRequestRatingLabel } from "@/app/tasks/types"
import type { ApiValidationError } from "@/types"
import { TaskCommentsSection } from "@/app/tasks/components/task-comments-section"
import { TaskSubtasksSection } from "@/app/tasks/components/task-subtasks-section"
import { HtmlContent } from "@/components/ui/html-content"

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/** Extracts a readable error message from Axios errors, ignoring cancel errors. */
function extractError(err: unknown, fallback: string): string | null {
  // Ignore axios cancelled requests â€” don't show an error in the UI
  if (isCancel(err)) return null
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiValidationError | undefined
    if (data?.errors) {
      const first = Object.values(data.errors)[0]
      if (first?.[0]) return first[0]
    }
    return data?.message ?? fallback
  }
  return fallback
}

// Status display labels matching the API enum values
const statusLabel: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  rated: "Rated",
}

// Tailwind classes for the status badge
const statusClass: Record<string, string> = {
  pending: "border-yellow-400/50 text-yellow-600 bg-yellow-50 dark:bg-yellow-400/10 dark:text-yellow-400",
  in_progress: "border-blue-400/50 text-blue-600 bg-blue-50 dark:bg-blue-400/10 dark:text-blue-400",
  done: "border-green-400/50 text-green-600 bg-green-50 dark:bg-green-400/10 dark:text-green-400",
  rated: "border-primary/50 text-primary bg-primary/10",
}

const priorityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "outline",
  low: "secondary",
}

// â”€â”€â”€ Loading Skeleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TaskDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Area */}
      <Card className="border-border/70">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3 w-full">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-8 w-2/3 max-w-lg" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Skeleton className="h-24 rounded-lg w-full" />
            <Skeleton className="h-24 rounded-lg w-full" />
            <Skeleton className="h-24 rounded-lg w-full" />
            <Skeleton className="h-24 rounded-lg w-full" />
          </div>
          <Separator />
          <div>
            <Skeleton className="h-4 w-24 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[80%]" />
              <Skeleton className="h-4 w-[40%]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignees Card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-14 w-[180px] rounded-xl" />
            <Skeleton className="h-14 w-[180px] rounded-xl" />
            <Skeleton className="h-14 w-[180px] rounded-xl" />
          </div>
        </CardContent>
      </Card>
      
      {/* Sections placeholders */}
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}

// â”€â”€â”€ Section-level error banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Shown inside a sub-section card when a secondary fetch fails.

function SectionError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// â”€â”€â”€ Simple pagination controls for sub-sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SectionPagination({
  pagination,
  onPageChange,
}: {
  pagination: TaskPagination
  onPageChange: (page: number) => void
}) {
  if (pagination.last_page <= 1) return null

  return (
    <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-3">
      <span className="text-xs text-muted-foreground">
        {pagination.from ?? 0}â€“{pagination.to ?? 0} of {pagination.total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pagination.current_page <= 1}
          onClick={() => onPageChange(pagination.current_page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground px-1">
          {pagination.current_page} / {pagination.last_page}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pagination.current_page >= pagination.last_page}
          onClick={() => onPageChange(pagination.current_page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// â”€â”€â”€ Help Requests Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fetches from GET /tasks/{taskId}/help-requests (paginated).
// Displays as a responsive table: description, requester, helper, status, rating.

// Status derived from is_completed / is_claimed flags
function helpRequestStatus(req: TaskHelpRequest): {
  label: string
  variant: "default" | "secondary" | "outline" | "destructive"
} {
  if (req.is_completed) return { label: "Completed", variant: "secondary" }
  if (req.is_claimed) return { label: "Claimed", variant: "default" }
  return { label: "Open", variant: "outline" }
}

function HelpRequestsSection({ taskId }: { taskId: number }) {
  const [requests, setRequests] = useState<TaskHelpRequest[]>([])
  const [pagination, setPagination] = useState<TaskPagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Fetch help requests for the current page
  const fetchRequests = useCallback(
    (p: number) => {
      let mounted = true
      setLoading(true)
      setError(null)

      taskService
        .getHelpRequestsByTask(taskId, p)
        .then((res) => {
          if (!mounted) return
          setRequests(res.data)
          setPagination(res.pagination)
        })
        .catch((err: unknown) => {
          if (!mounted) return
          const msg = extractError(err, "Failed to load help requests.")
          if (msg) setError(msg)
        })
        .finally(() => {
          if (mounted) setLoading(false)
        })

      return () => {
        mounted = false
      }
    },
    [taskId],
  )

  useEffect(() => {
    fetchRequests(page)
  }, [fetchRequests, page])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle className="size-4 text-muted-foreground" />
          Help Requests
          {pagination && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {pagination.total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {/* Error banner */}
        {!loading && error && <SectionError message={error} />}

        {/* Empty state */}
        {!loading && !error && requests.length === 0 && (
          <p className="text-sm text-muted-foreground">No help requests found for this task.</p>
        )}

        {/* Responsive table â€” some columns hidden on small screens */}
        {!loading && !error && requests.length > 0 && (
          <>
            <div className="overflow-hidden rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Description is always visible */}
                    <TableHead className="min-w-[140px]">Description</TableHead>
                    {/* Requester hidden on xs */}
                    <TableHead className="hidden sm:table-cell">Requester</TableHead>
                    {/* Helper hidden below md */}
                    <TableHead className="hidden md:table-cell">Helper</TableHead>
                    {/* Status always visible */}
                    <TableHead>Status</TableHead>
                    {/* Rating category hidden on xs */}
                    <TableHead className="hidden sm:table-cell">Rating</TableHead>
                    {/* Date hidden below lg */}
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => {
                    const status = helpRequestStatus(req)
                    return (
                      <TableRow key={req.id}>
                        {/* Description â€” truncated to avoid overflow */}
                        <TableCell className="py-2.5">
                          <p className="text-sm line-clamp-2 max-w-xs">{req.description}</p>
                          {/* Show ID + requester on mobile where columns are hidden */}
                          <span className="text-[11px] text-muted-foreground font-mono">
                            #{req.id}
                          </span>
                        </TableCell>

                        {/* Requester avatar + name */}
                        <TableCell className="hidden sm:table-cell py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6">
                              <AvatarImage
                                src={req.requester.avatar_url ?? undefined}
                                alt={req.requester.name}
                              />
                              <AvatarFallback className="text-[9px]">
                                {getInitials(req.requester.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium truncate max-w-[100px]">
                              {req.requester.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Helper avatar + name (or "â€”" when unclaimed) */}
                        <TableCell className="hidden md:table-cell py-2.5">
                          {req.helper ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="size-6">
                                <AvatarImage
                                  src={req.helper.avatar_url ?? undefined}
                                  alt={req.helper.name}
                                />
                                <AvatarFallback className="text-[9px]">
                                  {getInitials(req.helper.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium truncate max-w-[100px]">
                                {req.helper.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>

                        {/* Status badge */}
                        <TableCell className="py-2.5">
                          <Badge variant={status.variant} className="text-xs whitespace-nowrap">
                            {status.label}
                          </Badge>
                        </TableCell>

                        {/* Rating category â€” null when not yet rated */}
                        <TableCell className="hidden sm:table-cell py-2.5">
                          {req.rating ? (
                            <span className="text-xs text-muted-foreground">
                              {helpRequestRatingLabel[req.rating as HelpRequestRatingValue] ?? req.rating}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">â€”</span>
                          )}
                        </TableCell>

                        {/* Creation date */}
                        <TableCell className="hidden lg:table-cell py-2.5 text-xs text-muted-foreground font-mono">
                          {new Date(req.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination && (
              <SectionPagination pagination={pagination} onPageChange={(p) => setPage(p)} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// â”€â”€â”€ Ratings Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fetches from GET /tasks/{taskId}/ratings (paginated).
// Displays as a responsive table: rater avatar, final score, rating fields, date.

function RatingsSection({ taskId }: { taskId: number }) {
  const [ratings, setRatings] = useState<TaskRatingRecord[]>([])
  const [pagination, setPagination] = useState<TaskPagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Fetch ratings for the current page
  const fetchRatings = useCallback(
    (p: number) => {
      let mounted = true
      setLoading(true)
      setError(null)

      taskService
        .getRatingsByTask(taskId, p)
        .then((res) => {
          if (!mounted) return
          setRatings(res.data)
          setPagination(res.pagination)
        })
        .catch((err: unknown) => {
          if (!mounted) return
          const msg = extractError(err, "Failed to load ratings.")
          if (msg) setError(msg)
        })
        .finally(() => {
          if (mounted) setLoading(false)
        })

      return () => {
        mounted = false
      }
    },
    [taskId],
  )

  useEffect(() => {
    fetchRatings(page)
  }, [fetchRatings, page])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="size-4 text-muted-foreground" />
          Ratings
          {pagination && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {pagination.total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {/* Error banner */}
        {!loading && error && <SectionError message={error} />}

        {/* Empty state */}
        {!loading && !error && ratings.length === 0 && (
          <p className="text-sm text-muted-foreground">No ratings submitted for this task yet.</p>
        )}

        {/* Responsive table */}
        {!loading && !error && ratings.length > 0 && (
          <>
            <div className="overflow-hidden rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Rater always visible */}
                    <TableHead>Rater</TableHead>
                    {/* Final score always visible â€” this is the key metric */}
                    <TableHead>Score</TableHead>
                    {/* Individual rating fields hidden on small screens */}
                    <TableHead className="hidden md:table-cell">Fields</TableHead>
                    {/* Date hidden on small screens */}
                    <TableHead className="hidden sm:table-cell">Rated On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ratings.map((rating) => {
                    const finalScore = Number(rating.final_rating)
                    // Colour the score: green â‰¥ 75, yellow â‰¥ 50, red < 50
                    const scoreColor =
                      finalScore >= 75
                        ? "text-green-600 dark:text-green-400"
                        : finalScore >= 50
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-red-500"
                    return (
                      <TableRow key={rating.id}>
                        {/* Rater avatar + name */}
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarImage
                                src={rating.rater.avatar_url ?? undefined}
                                alt={rating.rater.name}
                              />
                              <AvatarFallback className="text-[9px]">
                                {getInitials(rating.rater.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold">{rating.rater.name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {rating.rater.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Final score with colour coding */}
                        <TableCell className="py-2.5">
                          <span className={`text-sm font-bold ${scoreColor}`}>
                            {finalScore.toFixed(1)}
                            <span className="text-[10px] text-muted-foreground font-normal ml-0.5">
                              /100
                            </span>
                          </span>
                        </TableCell>

                        {/* Individual rating field values â€” shown as a compact tag cloud */}
                        <TableCell className="hidden md:table-cell py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(rating.rating_data).map(([field, value]) => (
                              <span
                                key={field}
                                className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                <span className="font-medium capitalize">
                                  {field.replace(/_/g, " ")}:
                                </span>
                                <span>{value}</span>
                              </span>
                            ))}
                          </div>
                        </TableCell>

                        {/* Rated at date */}
                        <TableCell className="hidden sm:table-cell py-2.5 text-xs text-muted-foreground font-mono">
                          {rating.rated_at
                            ? new Date(rating.rated_at).toLocaleDateString()
                            : new Date(rating.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination && (
              <SectionPagination pagination={pagination} onPageChange={(p) => setPage(p)} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()

  const { hasPermission } = usePermissions()
  const canEdit   = hasPermission("edit tasks")
  const canRate   = hasPermission("create task ratings")
  // Current user id — used to detect whether this task is assigned to the developer
  const currentUserId = useAuthStore((s) => s.user?.id) ?? null

  // Parse the route param to a number; null if invalid
  const taskId = useMemo(() => {
    const parsed = Number(params.id)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [params.id])

  // Fetch the task from the API via Zustand store
  const { task, loading, error } = useTask(taskId)

  // Status-change support: assigned developers can update status (except "rated").
  const { updateTaskStatus, updating } = useUpdateTaskStatus()
  const refetchTask = useTasksStore((s) => s.fetchTask)

  async function handleStatusChange(status: TaskStatus) {
    if (!taskId) return
    const updated = await updateTaskStatus(taskId, status)
    if (updated) refetchTask(taskId)
  }

  // Secondary fetch: assignment-focused payload from GET /tasks/{id}/with-assignments.
  // Runs after base details are loaded so the page remains usable even if this call fails.
  const [assignmentTask, setAssignmentTask] = useState<Task | null>(null)
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId || loading || error) return

    let mounted = true
    setAssignmentsLoading(true)
    setAssignmentsError(null)

    taskService
      .getByIdWithAssignments(taskId)
      .then((response) => {
        if (mounted) setAssignmentTask(response)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        const msg = extractError(err, "Failed to load assignment details.")
        if (msg) setAssignmentsError(msg)
      })
      .finally(() => {
        if (mounted) setAssignmentsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [taskId, loading, error])

  // Prefer assignment task payload so pivot percentages are present.
  // Fall back to the base task response when the secondary fetch hasn't resolved yet.
  const assignedUsers = Array.isArray(assignmentTask?.assigned_users)
    ? assignmentTask.assigned_users
    : Array.isArray(task?.assigned_users)
      ? task.assigned_users
      : []

  // An assignee can change the task status to any non-"rated" value.
  // "rated" is set by the rating system and cannot be changed by the user.
  const isAssignee =
    currentUserId != null && assignedUsers.some((u) => u.id === currentUserId)
  const canChangeStatus = !!task && isAssignee && task.status !== "rated"

  // Subtask quick summary from the base task response (used only for the header stat tile)
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : []
  const completedSubtasks = subtasks.filter((s) => s.is_complete).length
  const totalSubtasks = subtasks.length
  const subtaskProgress = totalSubtasks > 0
    ? Math.round((completedSubtasks / totalSubtasks) * 100)
    : 0

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-6xl mx-auto w-full">
      {/* â”€â”€ Page header with back navigation â”€â”€ */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Task Details</h2>
          <p className="text-sm text-muted-foreground">
            Complete information for this task from the API
          </p>
        </div>
      </div>

      {/* â”€â”€ Loading skeleton â”€â”€ */}
      {loading && <TaskDetailSkeleton />}

      {/* â”€â”€ Top-level error state â”€â”€ */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <AlertCircle className="size-8 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground mt-1">
              The task could not be loaded. It may not exist or you may not have access.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/tasks")}>
            Return to tasks
          </Button>
        </div>
      )}

      {/* â”€â”€ Main content â€” only when task is loaded â”€â”€ */}
      {!loading && !error && task && (
        <div className="space-y-6">
          {/* â”€â”€ Task header card â”€â”€ */}
          <Card className="border-border/70">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                {/* Status + priority badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={statusClass[task.status] ?? ""}>
                    {statusLabel[task.status] ?? task.status}
                  </Badge>
                  <Badge variant={priorityVariant[task.priority] ?? "outline"} className="capitalize">
                    {task.priority} Priority
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">#{task.id}</span>
                </div>

                {/* Task name */}
                <h1 className="text-2xl font-bold leading-tight">{task.name}</h1>

                {/* Project â†’ section breadcrumb */}
                {task.section?.project && (
                  <p className="text-sm text-muted-foreground">
                    <Link
                      to={`/projects/${task.section.project.id}`}
                      className="hover:underline hover:text-foreground transition-colors"
                    >
                      {task.section.project.name}
                    </Link>
                    {" / "}
                    <span>{task.section.name}</span>
                  </p>
                )}
              </div>

              {/* Action buttons — Status changer (assignees), Edit (edit tasks) and Rate (rating permissions) */}
              {(canEdit || canRate || canChangeStatus) && (
                <div className="flex flex-wrap gap-2 shrink-0 items-center">
                  {canChangeStatus && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Status:</span>
                      <Select
                        value={task.status}
                        onValueChange={(v) => handleStatusChange(v as TaskStatus)}
                        disabled={updating}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["pending", "in_progress", "done"] as TaskStatus[]).map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {statusLabel[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`/tasks/${task.id}/edit`, {
                          state: {
                            editTask: task,
                            returnTo: `/tasks/${task.id}`,
                          },
                        })
                      }
                    >
                      <Pencil className="size-3.5" />
                      Edit Task
                    </Button>
                  )}
                  {canRate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/tasks/${task.id}/rate`)}
                    >
                      <Star className="size-3.5" />
                      Rate
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              {/* â”€â”€ Quick-stat tiles â”€â”€ */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="size-3" /> Due Date
                  </p>
                  <p className="text-sm font-semibold">{task.due_date}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                    <Weight className="size-3" /> Weight
                  </p>
                  <p className="text-sm font-semibold">{task.weight}</p>
                </div>
                {/* Rating tile â€” value from task.latest_final_rating (aggregated by GET /tasks/{taskId}/ratings) */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                    <Star className="size-3" /> Rating
                  </p>
                  {task.latest_final_rating !== null ? (
                    <p className="text-sm font-semibold">
                      {Number(task.latest_final_rating).toFixed(1)}
                      <span className="text-muted-foreground font-normal"> / 100</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not rated</p>
                  )}
                </div>
                {/* Subtask summary tile â€” from task.subtasks (same data as GET /tasks/{taskId}/subtasks) */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Subtasks
                  </p>
                  <p className="text-sm font-semibold">
                    {completedSubtasks}/{totalSubtasks}
                    {totalSubtasks > 0 && (
                      <span className="text-muted-foreground font-normal ml-1">
                        ({subtaskProgress}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* â”€â”€ Description â”€â”€ */}
              {task.description ? (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Description</h3>
                    <HtmlContent
                      html={task.description}
                      className="text-sm text-muted-foreground leading-relaxed"
                    />
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* â”€â”€ Assignees card â”€â”€ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                Assignees
                <Badge variant="secondary" className="ml-auto">
                  {assignedUsers.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Assignment workload is fetched separately â€” show loading hint */}
              {assignmentsLoading && (
                <p className="text-xs text-muted-foreground mb-3">
                  Loading assignment workload dataâ€¦
                </p>
              )}

              {/* Assignment secondary fetch error */}
              {assignmentsError && (
                <div className="mb-3">
                  <SectionError message={assignmentsError} />
                </div>
              )}

              {assignedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users assigned to this task.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {assignedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border/50 p-3 min-w-[180px]"
                    >
                      <Avatar className="size-9">
                        <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold leading-tight">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                        {/* Allocation percentage from the pivot table */}
                        {user.pivot?.percentage !== undefined && (
                          <span className="text-xs font-medium text-primary">
                            {user.pivot.percentage}% allocated
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* -- Subtasks section -- TaskSubtasksSection handles CRUD + permissions internally -- */}
          {taskId && <TaskSubtasksSection mode="edit" taskId={taskId} />}

          {/* â”€â”€ Help Requests section â€” fetches GET /tasks/{taskId}/help-requests â”€â”€ */}
          {taskId && <HelpRequestsSection taskId={taskId} />}

          {/* â”€â”€ Ratings section â€” fetches GET /tasks/{taskId}/ratings â”€â”€ */}
          {taskId && <RatingsSection taskId={taskId} />}

          {/* â”€â”€ Comments section â”€â”€ */}
          {/* Displays and manages task comments (GET /tasks/{id} includes comments) */}
          <TaskCommentsSection
            taskId={task.id}
            initialComments={Array.isArray(task.comments) ? task.comments : []}
          />

          {/* â”€â”€ Timestamps footer â”€â”€ */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground pb-6">
            <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
            <span>Updated: {new Date(task.updated_at).toLocaleDateString()}</span>
            {task.completed_at && (
              <span>Completed: {new Date(task.completed_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
