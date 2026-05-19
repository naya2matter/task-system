import { useState, useEffect, useCallback } from "react"
import { useNavigate, useSearchParams, useLocation, useParams } from "react-router"
import { useTask } from "@/app/tasks/hooks/useTask"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DateInput } from "@/components/ui/date-input"
import {
  AlertCircle,
  Plus,
  Search,
  LayoutList,
  LayoutGrid,
  ChevronDown,
  X,
  Users,
} from "lucide-react"
import { Pagination } from "@/components/pagination"
import { PaginationInfo } from "@/components/pagination-info"
// Hook that fetches tasks from GET /tasks with all filter + pagination params
import { useTasks } from "@/app/tasks/hooks/useTasks"
// Hook that wraps DELETE /tasks/{id}
import { useDeleteTask } from "@/app/tasks/hooks/useDeleteTask"
// Hook that fetches all users once — used to populate the assignees filter
import { useAllUsers } from "@/app/tasks/hooks/useAllUsers"
import { TaskTableView } from "@/app/tasks/pages/task-table-view"
import { TaskGridView } from "@/app/tasks/pages/task-grid-view"
import { TaskTableSkeleton, TaskGridSkeleton } from "@/app/tasks/pages/task-skeletons"
import { ConfirmDeleteTaskDialog } from "@/app/tasks/pages/confirm-delete-task-dialog"
import { TaskForm } from "@/app/tasks/pages/task-form"
import { TaskRatingForm } from "@/app/tasks/pages/task-rating-form"
import { usePermissions } from "@/hooks/usePermissions"
// Use the API-aligned Task type
import type { Task, TaskStatus, TaskPriority } from "@/app/tasks/types"

type ViewMode = "table" | "grid"
type PageView = "list" | "form" | "rating"

// Shape passed via React Router location.state when navigating from a
// section card (project details page) to open the task form directly.
interface TaskFormLocationState {
  /** Whether to open the form in create or edit mode */
  openForm: "create" | "edit"
  /** Pre-select this section in create mode */
  defaultSectionId?: number
  /** Pre-select this project in create mode */
  defaultProjectId?: number
  /** Full Task object to edit (already fetched by the caller) */
  editTask?: Task
  /** URL to navigate to after the form is submitted or cancelled */
  returnTo?: string
}

// Status options that match the API enum values (plus "all" for no filter)
const statusOptions: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "rated", label: "Rated" },
]

// Priority options that match the API enum values (plus "all" for no filter)


// Debounce delay for the search input to avoid a request on every keystroke
const SEARCH_DEBOUNCE_MS = 400

// Helper: get two initials from a full name (e.g. "John Doe" → "JD")
function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function TasksPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: urlId } = useParams<{ id?: string }>()

  // Determine if we are on a sub-route (/tasks/create, /tasks/:id/edit, /tasks/:id/rate)
  const isCreateRoute = location.pathname.endsWith("/create")
  const isEditRoute   = !!urlId && location.pathname.endsWith("/edit")
  const isRateRoute   = !!urlId && location.pathname.endsWith("/rate")
  const taskIdFromUrl = urlId ? parseInt(urlId, 10) : null

  const { hasPermission } = usePermissions()
  const canCreate = hasPermission("create tasks")
  const canEdit   = hasPermission("edit tasks")
  const canDelete = hasPermission("delete tasks")
  const canRate   = hasPermission("create task ratings")
  const [searchParams] = useSearchParams()

  // ── View + UI state ──────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>("table")
  const [pageView, setPageView] = useState<PageView>(() => {
    if (isCreateRoute || isEditRoute) return "form"
    if (isRateRoute) return "rating"
    return "list"
  })
  const [formMode, setFormMode] = useState<"create" | "edit">(() =>
    isEditRoute ? "edit" : "create"
  )

  // ── Filter state (local) — all of these are forwarded to GET /tasks ──────
  const [search, setSearch] = useState("")
  // Debounced version of search — only sent to the API after the user stops typing
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all")
  // Date range filter — strings in YYYY-MM-DD format as required by the API
  const [dueFrom, setDueFrom] = useState("")
  const [dueTo, setDueTo] = useState("")
  // Assignee IDs — sent to the API as assignees[] (multi-value filter)
  const [assigneeIds, setAssigneeIds] = useState<number[]>([])
  // Current page for server-side pagination
  const [currentPage, setCurrentPage] = useState(1)

  // ── Selected task state ──────────────────────────────────────────
  // The task currently being edited (null = create mode).
  // Seed from navigation state so the form is available instantly.
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    () => (location.state as TaskFormLocationState | null)?.editTask ?? null
  )
  // Default section/project ids pre-populated when opening create from a section card
  const [defaultSectionId] = useState<number | undefined>(
    () => (location.state as TaskFormLocationState | null)?.defaultSectionId
  )
  const [defaultProjectId] = useState<number | undefined>(
    () => (location.state as TaskFormLocationState | null)?.defaultProjectId
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTask, setDeleteTask] = useState<Task | null>(null)
  const [ratingTask, setRatingTask] = useState<Task | null>(() =>
    (location.state as { ratingTask?: Task } | null)?.ratingTask ?? null
  )

  // Fetch the task from the API when navigating directly to /tasks/:id/edit or /tasks/:id/rate.
  // This also populates selectedTask in the store so the breadcrumb shows the task name.
  const { task: urlTask } = useTask((isEditRoute || isRateRoute) ? taskIdFromUrl : null)

  // Once the task loads (direct-URL access), hydrate local state if not already seeded
  useEffect(() => {
    if (!urlTask) return
    if (isEditRoute && !selectedTask) setSelectedTask(urlTask)
    if (isRateRoute && !ratingTask) setRatingTask(urlTask)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTask])

  useEffect(() => {
    if (isCreateRoute || isEditRoute) {
      setPageView("form")
      setFormMode(isEditRoute ? "edit" : "create")
    } else if (isRateRoute) {
      setPageView("rating")
      setFormMode("create")
    } else {
      setPageView("list")
    }
  }, [isCreateRoute, isEditRoute, isRateRoute])

  // Hook for DELETE /tasks/{id}
  const { deleteTask: deleteTaskById, deleting } = useDeleteTask()

  // Fetch all users once for the assignees filter dropdown
  const { users: allUsers } = useAllUsers()

  // Debounce the search input so the API is called after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1) // reset to page 1 on a new search term
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // Handle the ?rate= query param (deep-link to rating view for a specific task)
  useEffect(() => {
    const rateParam = searchParams.get("rate")
    if (rateParam) {
      setPageView("rating")
    }
  }, [searchParams])

  // Clear location.state after consuming it so back-navigation doesn't re-trigger forms
  useEffect(() => {
    if (location.state) {
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build the params object sent to GET /tasks.
  // The useTasks hook re-fetches automatically whenever any value here changes.
  const taskParams = {
    page: currentPage,
    per_page: 15,
    // Only include search when it has a value (prevents empty string param)
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    // "all" means no filter, so omit the param
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(priorityFilter !== "all" ? { priority: priorityFilter } : {}),
    // Date range — omit when empty
    ...(dueFrom ? { due_from: dueFrom } : {}),
    ...(dueTo ? { due_to: dueTo } : {}),
    // Assignees — only include when at least one is selected
    ...(assigneeIds.length ? { assignees: assigneeIds } : {}),
  }

  const { tasks, pagination, loading, error, refetch } = useTasks(taskParams)

  // Count how many non-search filters are active (for the "clear all" button)
  const activeFilterCount = [
    statusFilter !== "all",
    priorityFilter !== "all",
    !!dueFrom,
    !!dueTo,
    assigneeIds.length > 0,
  ].filter(Boolean).length

  // Clear every filter back to its default value and reset to page 1
  function clearAllFilters() {
    setStatusFilter("all")
    setPriorityFilter("all")
    setDueFrom("")
    setDueTo("")
    setAssigneeIds([])
    setCurrentPage(1)
  }

  // ── Handlers ─────────────────────────────────────────────────────

  function handleCreate() {
    navigate("/tasks/create")
  }

  function handleEdit(task: Task) {
    navigate(`/tasks/${task.id}/edit`, { state: { editTask: task } })
  }

  function handleDelete(task: Task) {
    setDeleteTask(task)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!deleteTask) return
    const success = await deleteTaskById(deleteTask.id)
    if (success) {
      setDeleteDialogOpen(false)
      setDeleteTask(null)
      refetch() // re-fetch list so the deleted task disappears
    }
  }

  // Navigate to the dedicated task detail page
  function handleSelect(task: Task) {
    navigate(`/tasks/${task.id}`)
  }

  function handleRate(task: Task) {
    navigate(`/tasks/${task.id}/rate`, { state: { ratingTask: task } })
  }

  function handleFormCancel() {
    const returnTo = (location.state as TaskFormLocationState | null)?.returnTo
    navigate(returnTo ?? "/tasks")
  }

  function handleRatingCancel() {
    navigate("/tasks")
  }

  // Reset to page 1 whenever a filter select changes
  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value as TaskStatus | "all")
    setCurrentPage(1)
  }, [])

  

  // Toggle a single user in/out of the assignee filter
  function toggleAssignee(userId: number) {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
    setCurrentPage(1)
  }

  // ── Sub-views (form + rating) ────────────────────────────────────

  if (pageView === "form") {
    // Retrieve the returnTo URL from location.state (set by section card navigation).
    // After a successful save we navigate back to the originating project page;
    // if there's no returnTo we stay on the tasks list and refetch.
    const returnTo = (location.state as TaskFormLocationState | null)?.returnTo

    return (
      <TaskForm
        mode={formMode}
        initialData={selectedTask}
        defaultSectionId={defaultSectionId}
        defaultProjectId={defaultProjectId}
        onSubmit={() => {
          refetch()
          navigate(returnTo ?? "/tasks")
        }}
        onCancel={handleFormCancel}
      />
    )
  }

  if (pageView === "rating" && ratingTask) {
    return (
      <TaskRatingForm
        task={ratingTask}
        onSubmit={() => {
          navigate("/tasks")
        }}
        onCancel={handleRatingCancel}
      />
    )
  }

  // ── Main list view ────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">

        {/* ── Page header: title, count badge, add button ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
              {/* Total count from the pagination metadata returned by the API */}
              {pagination && (
                <Badge variant="secondary" className="uppercase tracking-wider">
                  {pagination.total} Tasks
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Curating and managing workflow excellence across all enterprise verticals.
            </p>
          </div>
          {canCreate && (
            <Button
              className="transition-all hover:shadow-md hover:shadow-primary/25"
              size="lg"
              onClick={handleCreate}
            >
              <Plus />
              Add New Task
            </Button>
          )}
        </div>

        {/* ── Controls row 1: search + view toggle ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search input — debounced before hitting the API */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tasks or descriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-10 text-sm"
            />
          </div>

          {/* Table / Grid view toggle */}
          <ToggleGroup
            type="single"
            variant="outline"
            value={view}
            onValueChange={(v) => {
              if (v) setView(v as ViewMode)
            }}
          >
            <ToggleGroupItem value="table" aria-label="Table view">
              <LayoutList className="size-3.5" />
              <span className="hidden sm:inline">Table</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* ── Controls row 2: all quick-filters ── */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Status filter — maps directly to the API status enum */}
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority filter — sent to the API as the `priority` query param */}
          {/* <Select value={priorityFilter} onValueChange={handlePriorityChange}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select> */}

          {/* Due-from date filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">From</span>
            <DateInput
              className="w-36 h-9 text-sm"
              value={dueFrom}
              max={dueTo || undefined}   // prevent "from" being after "to"
              onChange={(e) => {
                setDueFrom(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          {/* Due-to date — sent to the API as `due_to` (YYYY-MM-DD) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">To</span>
            <DateInput
              className="w-36 h-9 text-sm"
              value={dueTo}
              min={dueFrom || undefined}  // prevent "to" being before "from"
              onChange={(e) => {
                setDueTo(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          {/* Assignees multi-select — sent to the API as assignees[] */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 text-sm font-normal">
                <Users className="size-3.5 text-muted-foreground" />
                {assigneeIds.length === 0
                  ? "Assignees"
                  : `${assigneeIds.length} selected`}
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
              {allUsers.length === 0 ? (
                // Shown while users are still loading or none exist
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  No users available
                </div>
              ) : (
                allUsers.map((user) => (
                  <DropdownMenuCheckboxItem
                    key={user.id}
                    checked={assigneeIds.includes(user.id)}
                    onCheckedChange={() => toggleAssignee(user.id)}
                    className="gap-2"
                  >
                    {/* Small avatar + name for each user in the list */}
                    <Avatar className="size-5">
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{user.name}</span>
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear all filters button — only visible when at least one filter is active */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              onClick={clearAllFilters}
            >
              <X className="size-3.5" />
              Clear filters
              <Badge variant="secondary" className="size-4 p-0 flex items-center justify-center text-[10px]">
                {activeFilterCount}
              </Badge>
            </Button>
          )}
        </div>

        {/* ── Loading indicator ── */}
        {loading && (
          view === "table" ? <TaskTableSkeleton /> : <TaskGridSkeleton />
        )}

        {/* ── Error state — cancelled requests are ignored in the store ── */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <AlertCircle className="size-6 text-destructive" />
            <p className="font-medium text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              Try again
            </Button>
          </div>
        )}

        {/* ── Empty state — no results for the current filters ── */}
        {!loading && !error && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-base font-semibold text-muted-foreground">No tasks found</p>
            <p className="text-sm text-muted-foreground">
              {debouncedSearch || activeFilterCount > 0
                ? "Try adjusting your filters or search term."
                : "Create a new task to get started."}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        )}

        {/* ── Task list in table or grid view ── */}
        {!loading && !error && tasks.length > 0 && (
          <>
            {view === "table" ? (
              <TaskTableView
                canEdit={canEdit}
                canDelete={canDelete}
                canRate={canRate}
                tasks={tasks}
                onSelect={handleSelect}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRate={handleRate}
              />
            ) : (
              <TaskGridView
                canEdit={canEdit}
                canDelete={canDelete}
                canRate={canRate}
                tasks={tasks}
                onSelect={handleSelect}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRate={handleRate}
              />
            )}

            {/* Server-side pagination — uses current_page and last_page from the API */}
            {pagination && pagination.last_page > 1 && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PaginationInfo
                  startItem={pagination.from ?? 0}
                  endItem={pagination.to ?? 0}
                  totalItems={pagination.total}
                  label="tasks"
                />
                <Pagination
                  currentPage={pagination.current_page}
                  totalPages={pagination.last_page}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm Delete Dialog — onConfirm calls DELETE /tasks/{id} then re-fetches */}
      <ConfirmDeleteTaskDialog
        task={deleteTask}
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          // Block closing the dialog while deletion is in flight
          if (!deleting) setDeleteDialogOpen(open)
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}

