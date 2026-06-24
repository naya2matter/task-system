// TaskSubtasksSection
// Self-contained card section for full subtask CRUD within the task form.
//
// EDIT mode (taskId is provided — task already exists in the DB):
//   • Lists subtasks via GET /tasks/{taskId}/subtasks  (paginated, per_page=10)
//   • Add subtask  → POST /subtasks
//   • View detail  → GET /subtasks/{id}  (opens a dialog with the full subtask data)
//   • Edit subtask → PUT /subtasks/{id}  (inline form replaces the row)
//   • Delete subtask → DELETE /subtasks/{id}  (requires confirmation dialog first)
//   • Toggle completion → POST /subtasks/{id}/toggle
//
// CREATE mode (no taskId yet — parent task hasn't been saved):
//   • Pure local state — no API calls (task_id is unknown until parent is saved)
//   • Add / edit / remove subtask inputs (name, description, due_date, priority)
//   • Exposes the list via the `onChange` callback so the parent can POST them
//     individually after the task is created.
//   • A notice banner reminds the user subtasks are saved with the task.

import { useState, useEffect, useCallback, useRef } from "react"
import { AxiosError, isCancel } from "axios"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  Hash,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Check,
  Info,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/ui/date-input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { HtmlContent } from "@/components/ui/html-content"
import { HtmlEditor } from "@/components/ui/html-editor"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { taskService } from "@/app/tasks/services/taskService"
import type { Subtask, TaskPriority, TaskPagination } from "@/app/tasks/types"
import type { ApiValidationError } from "@/types"
import { normalizeHtmlForSubmit } from "@/lib/html"
import showToast from "@/lib/toast"
import { usePermissions } from "@/hooks/usePermissions"

// ─── Local Types ─────────────────────────────────────────────────

/**
 * Represents a subtask entry in CREATE mode.
 * Uses a client-side `key` for stable list rendering (no real ID yet).
 * The parent task-form passes these to POST /subtasks after task creation.
 */
export interface LocalSubtaskInput {
  key: number        // client-side temp identifier
  name: string
  description: string
  due_date: string   // YYYY-MM-DD
  priority: TaskPriority
}

// ─── Props ────────────────────────────────────────────────────────

interface TaskSubtasksSectionProps {
  /** "edit" = API-backed CRUD; "create" = local state only */
  mode: "create" | "edit"
  /** Required in edit mode — the ID of the already-saved parent task */
  taskId?: number
  /**
   * CREATE mode only: current list of local subtasks.
   * The parent passes this down and the component calls `onChange` on every
   * mutation so the parent always has the latest list.
   */
  localSubtasks?: LocalSubtaskInput[]
  /**
   * CREATE mode only: called whenever the local list changes.
   * The parent (task-form) stores this and POSTs each entry after task creation.
   */
  onChange?: (subtasks: LocalSubtaskInput[]) => void
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Extracts a user-readable error message out of an Axios error. Ignores cancels. */
function extractError(err: unknown, fallback: string): string | null {
  if (isCancel(err)) return null  // ignore canceled requests
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

/** Tailwind classes for priority badges. */
const priorityClass: Record<TaskPriority, string> = {
  critical: "border-red-400/50 bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  high: "border-orange-400/50 bg-orange-50 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400",
  medium: "border-yellow-400/50 bg-yellow-50 text-yellow-600 dark:bg-yellow-400/10 dark:text-yellow-400",
  low: "border-muted-foreground/20 bg-muted text-muted-foreground",
}

/** All priority options for selectors. */
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "critical"]

/** Formats an ISO date string into a locale-readable date. */
function fmtDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// ─── Inline Error Banner ──────────────────────────────────────────

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
      <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}

// ─── Pagination Controls ──────────────────────────────────────────
// Shown at the bottom of the edit-mode table when there is more than one page.

function SectionPagination({
  pagination,
  onPageChange,
}: {
  pagination: TaskPagination
  onPageChange: (p: number) => void
}) {
  if (pagination.last_page <= 1) return null
  return (
    <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-2">
      <span className="text-xs text-muted-foreground">
        {pagination.from ?? 0}–{pagination.to ?? 0} of {pagination.total}
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

// ─── Subtask Detail Dialog ────────────────────────────────────────
// Loads GET /subtasks/{id} and displays all fields in a responsive detail layout.

function SubtaskDetailDialog({
  subtaskId,
  open,
  onOpenChange,
  onToggle,
}: {
  subtaskId: number | null
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Called with the updated subtask after POST /subtasks/{id}/toggle so the
   *  parent list can reflect the new is_complete state without a full refetch. */
  onToggle: (updated: Subtask) => void
}) {
  const [subtask, setSubtask] = useState<Subtask | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  // Fetch whenever the dialog opens with a valid subtaskId
  useEffect(() => {
    if (!open || subtaskId === null) return
    let mounted = true
    setLoading(true)
    setError(null)
    setSubtask(null)
    setToggleError(null)

    // GET /subtasks/{id} — load the full subtask record from the API
    taskService
      .getSubtaskById(subtaskId)
      .then((data) => { if (mounted) setSubtask(data) })
      .catch((err: unknown) => {
        if (!mounted) return
        const msg = extractError(err, "Failed to load subtask details.")
        if (msg) setError(msg)
      })
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [subtaskId, open])

  // POST /subtasks/{id}/toggle — flips is_complete and updates local + parent state
  async function handleDialogToggle() {
    if (!subtask || toggling) return
    setToggling(true)
    setToggleError(null)

    // Optimistic update in the dialog for immediate feedback
    const previous = subtask.is_complete
    setSubtask((s) => s ? { ...s, is_complete: !previous } : s)
    try {
      const updated = await taskService.toggleSubtask(subtask.id)
      setSubtask(updated)
      onToggle(updated)
    } catch (err: unknown) {
      if (isCancel(err)) return
      // Revert on error
      setSubtask((s) => s ? { ...s, is_complete: previous } : s)
      const msg = extractError(err, "Failed to toggle subtask.")
      if (msg) {
        setToggleError(msg)
        showToast("error", msg)
      }
    } finally {
      setToggling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,52rem)] max-h-[86vh] p-0 overflow-hidden gap-0">
        <DialogHeader className="border-b border-border/60 bg-linear-to-r from-muted/70 via-background to-muted/30 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4 text-muted-foreground" />
            Subtask Details
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(86vh-72px)] overflow-y-auto px-6 py-5 space-y-4">

          {/* Loading skeleton while GET /subtasks/{id} is in-flight */}
          {loading && (
            <div className="space-y-4 py-1">
              <Skeleton className="h-14 w-full rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          )}

          {/* Error state shown when the fetch fails */}
          {!loading && error && <InlineError message={error} />}

          {/* Toggle error (only shown if the toggle call fails inside this dialog) */}
          {toggleError && <InlineError message={toggleError} />}

          {/* Response data displayed in a responsive detail layout */}
          {!loading && !error && subtask && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Subtask Name</p>
                    <h3 className="text-lg font-semibold leading-snug">{subtask.name}</h3>
                  </div>

                  <Button
                    type="button"
                    variant={subtask.is_complete ? "secondary" : "default"}
                    size="sm"
                    onClick={handleDialogToggle}
                    disabled={toggling}
                    aria-pressed={subtask.is_complete}
                    title={subtask.is_complete ? "Mark incomplete" : "Mark complete"}
                    className="h-8 text-xs gap-1.5 shrink-0"
                  >
                    {toggling
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : subtask.is_complete
                      ? <Circle className="size-3.5" />
                      : <CheckCircle2 className="size-3.5" />
                    }
                    {subtask.is_complete ? "Mark Incomplete" : "Mark Complete"}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={subtask.is_complete ? "default" : "secondary"} className="gap-1.5">
                    {subtask.is_complete ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
                    {subtask.is_complete ? "Complete" : "Incomplete"}
                  </Badge>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${priorityClass[subtask.priority]}`}>
                    <Flag className="size-3" />
                    {subtask.priority}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/80 px-2 py-0.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3" />
                    Due {fmtDate(subtask.due_date)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Description</p>
                  <HtmlContent
                    html={subtask.description}
                    className="text-sm leading-relaxed text-foreground/90"
                    emptyFallback={<span className="italic text-muted-foreground">No description provided.</span>}
                  />
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Identifiers</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Hash className="size-3" /> Subtask ID</span>
                      <span className="font-mono text-xs">{subtask.id}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Hash className="size-3" /> Task ID</span>
                      <span className="font-mono text-xs">{subtask.task_id}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Timeline</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock3 className="size-3" /> Created</span>
                      <span>{fmtDate(subtask.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock3 className="size-3" /> Updated</span>
                      <span>{fmtDate(subtask.updated_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Current Status</p>
                  {subtask.is_complete ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs text-green-700 dark:text-green-400">
                      <CheckCircle2 className="size-3.5" /> Done and closed
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground">
                      <Circle className="size-3.5" /> Pending action
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Subtask Add / Edit Form ──────────────────────────────────────
// Shared form for both "add new" and "edit existing" subtasks.
// Edit mode adds an extra "Mark complete" checkbox (is_complete field).
// Create mode never shows that checkbox because a new subtask is always incomplete.

interface SubtaskFormProps {
  /** Initial field values — empty strings for "add" mode */
  initialName?: string
  initialDescription?: string
  initialDueDate?: string
  initialPriority?: TaskPriority
  /**
   * Initial value for the is_complete checkbox.
   * Only rendered when showComplete=true (edit mode).
   */
  initialIsComplete?: boolean
  /**
   * When true, a "Mark complete" checkbox is shown so the user can flip
   * is_complete inside the edit form (PUT /subtasks/{id}) rather than only
   * through the toggle button on the row.
   */
  showComplete?: boolean
  /** True while the API call is in-flight */
  loading: boolean
  /** Per-field validation errors */
  fieldErrors: Record<string, string>
  /** API-level error message shown below the form */
  apiError: string | null
  onSave: (values: { name: string; description: string; due_date: string; priority: TaskPriority; is_complete: boolean }) => void
  onCancel: () => void
  saveLabel?: string
}

function SubtaskForm({
  initialName = "",
  initialDescription = "",
  initialDueDate = "",
  initialPriority = "medium",
  initialIsComplete = false,
  showComplete = false,
  loading,
  fieldErrors,
  apiError,
  onSave,
  onCancel,
  saveLabel = "Save",
}: SubtaskFormProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [dueDate, setDueDate] = useState(initialDueDate)
  const [priority, setPriority] = useState<TaskPriority>(initialPriority)
  // is_complete is only used in edit mode; defaults to the current server value
  const [isComplete, setIsComplete] = useState(initialIsComplete)

  // Focus the name input when the form mounts
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => { nameRef.current?.focus() }, [])

  function handleSave() {
    onSave({ name, description, due_date: dueDate, priority, is_complete: isComplete })
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      {apiError && <InlineError message={apiError} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name — required */}
        <div className="sm:col-span-2 space-y-1">
          <Label htmlFor="sub-name" className="text-xs">Name *</Label>
          <Input
            id="sub-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Write unit tests"
            className="h-9 text-sm"
            disabled={loading}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave() } }}
          />
          {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
        </div>

        {/* Due Date — required */}
        <div className="space-y-1">
          <Label htmlFor="sub-due" className="text-xs">Due Date *</Label>
          <DateInput
            id="sub-due"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-9 text-sm"
            disabled={loading}
          />
          {fieldErrors.due_date && <p className="text-xs text-destructive">{fieldErrors.due_date}</p>}
        </div>

        {/* Priority — required */}
        <div className="space-y-1">
          <Label className="text-xs">Priority *</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as TaskPriority)}
            disabled={loading}
          >
            <SelectTrigger className="h-9 text-sm w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description — optional, full width */}
        <div className="sm:col-span-2 space-y-1">
          <Label htmlFor="sub-desc" className="text-xs">
            Description <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="overflow-hidden rounded-xl border border-border/40 bg-muted/20 ring-1 ring-border/20 transition-all focus-within:ring-primary">
            <HtmlEditor
              id="sub-desc"
              value={description}
              onChange={setDescription}
              placeholder="Brief description of what needs to be done..."
              disabled={loading}
              minHeightClassName="min-h-24"
            />
          </div>
        </div>

        {/* is_complete checkbox — only shown in edit mode (showComplete=true) */}
        {showComplete && (
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input
                type="checkbox"
                checked={isComplete}
                onChange={(e) => setIsComplete(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border border-input accent-primary"
              />
              Mark as complete
            </label>
          </div>
        )}
      </div>

      {/* Form action buttons */}
      <div className="flex items-center gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          <X className="size-3.5 mr-1" /> Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Check className="size-3.5 mr-1" />}
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────

export function TaskSubtasksSection({
  mode,
  taskId,
  localSubtasks = [],
  onChange,
}: TaskSubtasksSectionProps) {

  const { hasPermission } = usePermissions()
  const canViewSubtasks   = hasPermission("view subtasks")
  const canCreateSubtasks = hasPermission("create subtasks")
  const canEditSubtasks   = hasPermission("edit subtasks")
  const canDeleteSubtasks = hasPermission("delete subtasks")

  // If the user cannot view subtasks, render nothing
  if (!canViewSubtasks) return null

  // ── EDIT MODE state ───────────────────────────────────────────
  // Subtask list fetched from the API (edit mode only)
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [pagination, setPagination] = useState<TaskPagination | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // ── Add form state (shared across both modes) ─────────────────
  // isAdding = true when the "Add Subtask" form is expanded
  const [isAdding, setIsAdding] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addFieldErrors, setAddFieldErrors] = useState<Record<string, string>>({})

  // ── Inline edit state (edit mode only, one row at a time) ─────
  // editingId = the subtask.id currently being edited; null = no row in edit mode
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({})

  // ── Edit state for CREATE mode (editing a local entry) ────────
  // editingKey = the LocalSubtaskInput.key being edited in create mode
  const [editingKey, setEditingKey] = useState<number | null>(null)

  // ── View dialog state (edit mode only) ───────────────────────
  // viewId = subtask ID passed to SubtaskDetailDialog for GET /subtasks/{id}
  const [viewId, setViewId] = useState<number | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  // ── Delete confirmation state ─────────────────────────────────
  // deleteTarget (edit mode) or deleteKey (create mode) identifies what to delete
  const [deleteTarget, setDeleteTarget] = useState<Subtask | null>(null)
  const [deleteKey, setDeleteKey] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Toggle state (edit mode only) ────────────────────────────
  // togglingIds tracks which subtask IDs are currently mid-toggle request
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set())

  // ── EDIT mode: fetch subtasks from GET /tasks/{taskId}/subtasks ──

  const fetchSubtasks = useCallback(
    (p: number) => {
      // Guard: only run in edit mode with a known taskId
      if (mode !== "edit" || !taskId) return
      let mounted = true
      setListLoading(true)
      setListError(null)

      taskService
        .getSubtasksByTask(taskId, p)
        .then((res) => {
          if (!mounted) return
          setSubtasks(res.data)
          setPagination(res.pagination)
        })
        .catch((err: unknown) => {
          if (!mounted) return
          // extractError returns null for canceled requests — ignore those
          const msg = extractError(err, "Failed to load subtasks.")
          if (msg) setListError(msg)
        })
        .finally(() => { if (mounted) setListLoading(false) })

      return () => { mounted = false }
    },
    [mode, taskId],
  )

  // Load first page on mount (edit mode only)
  useEffect(() => {
    if (mode === "edit") fetchSubtasks(1)
  }, [mode, fetchSubtasks])

  // Reload when page changes (edit mode only)
  useEffect(() => {
    if (mode === "edit" && page > 1) fetchSubtasks(page)
  }, [page, mode, fetchSubtasks])

  // ── EDIT mode: Add subtask → POST /subtasks ───────────────────

  function validateSubtaskForm(
    values: { name: string; description: string; due_date: string; priority: TaskPriority },
    setErrors: (e: Record<string, string>) => void,
  ): boolean {
    const errs: Record<string, string> = {}
    if (!values.name.trim()) errs.name = "Name is required."
    if (!values.due_date) errs.due_date = "Due date is required."
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // is_complete is passed through from the form signature but ignored for new subtasks
  // (a freshly created subtask is always incomplete per the API schema)
  async function handleAdd(values: { name: string; description: string; due_date: string; priority: TaskPriority; is_complete: boolean }) {
    if (mode === "edit") {
      // Validate locally before hitting the API
      if (!validateSubtaskForm(values, setAddFieldErrors)) return
      if (!taskId) return

      setAddLoading(true)
      setAddError(null)
      try {
        // POST /subtasks — creates the subtask and returns the created record
        const created = await taskService.createSubtask({
          name: values.name.trim(),
          description: normalizeHtmlForSubmit(values.description),
          due_date: values.due_date,
          priority: values.priority,
          task_id: taskId,
        })
        // Prepend the new subtask and close the form
        setSubtasks((prev) => [created, ...prev])
        setIsAdding(false)
        setAddFieldErrors({})
        // Update pagination total so the header count stays accurate
        setPagination((prev) => prev ? { ...prev, total: prev.total + 1 } : prev)
      } catch (err: unknown) {
        const msg = extractError(err, "Failed to create subtask.")
        if (msg) setAddError(msg)
      } finally {
        setAddLoading(false)
      }
    } else {
      // CREATE mode — validate and push to local list; no API call
      if (!validateSubtaskForm(values, setAddFieldErrors)) return
      const newEntry: LocalSubtaskInput = {
        key: Date.now(),
        name: values.name.trim(),
        description: normalizeHtmlForSubmit(values.description) ?? "",
        due_date: values.due_date,
        priority: values.priority,
      }
      const next = [...localSubtasks, newEntry]
      onChange?.(next)
      setIsAdding(false)
      setAddFieldErrors({})
    }
  }

  // ── EDIT mode: Edit subtask → PUT /subtasks/{id} ──────────────

  async function handleEditSave(
    subtaskId: number,
    // is_complete comes from the "Mark as complete" checkbox in the edit form
    values: { name: string; description: string; due_date: string; priority: TaskPriority; is_complete: boolean },
  ) {
    if (!validateSubtaskForm(values, setEditFieldErrors)) return

    setEditLoading(true)
    setEditError(null)
    try {
      // PUT /subtasks/{id} — sends all editable fields including is_complete
      const updated = await taskService.updateSubtask(subtaskId, {
        name: values.name.trim(),
        description: normalizeHtmlForSubmit(values.description),
        due_date: values.due_date,
        priority: values.priority,
        is_complete: values.is_complete,
      })
      // Replace the matching subtask in the local list
      setSubtasks((prev) => prev.map((s) => (s.id === subtaskId ? updated : s)))
      setEditingId(null)
      setEditFieldErrors({})
    } catch (err: unknown) {
      const msg = extractError(err, "Failed to update subtask.")
      if (msg) setEditError(msg)
    } finally {
      setEditLoading(false)
    }
  }

  // ── CREATE mode: Update a local entry ────────────────────────

  // is_complete is accepted by the form signature but local subtasks don't track it
  // (they haven't been saved yet, so completion isn't meaningful until after POST)
  function handleLocalEdit(
    key: number,
    values: { name: string; description: string; due_date: string; priority: TaskPriority; is_complete: boolean },
  ) {
    if (!validateSubtaskForm(values, setEditFieldErrors)) return
    const next = localSubtasks.map((s) =>
      s.key === key
        ? {
            ...s,
            name: values.name.trim(),
            description: normalizeHtmlForSubmit(values.description) ?? "",
            due_date: values.due_date,
            priority: values.priority,
          }
        : s,
    )
    onChange?.(next)
    setEditingKey(null)
    setEditFieldErrors({})
  }

  // ── EDIT mode: Delete subtask → DELETE /subtasks/{id} ─────────

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      // DELETE /subtasks/{id} — permanently removes the subtask
      await taskService.deleteSubtask(deleteTarget.id)
      setSubtasks((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
      // Decrease pagination total so header count stays accurate
      setPagination((prev) => prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev)
    } catch (err: unknown) {
      const msg = extractError(err, "Failed to delete subtask.")
      if (msg) setDeleteError(msg)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── CREATE mode: Remove a local entry ────────────────────────

  function handleLocalDelete(key: number) {
    const next = localSubtasks.filter((s) => s.key !== key)
    onChange?.(next)
    setDeleteKey(null)
  }

  // ── EDIT mode: Toggle completion → POST /subtasks/{id}/toggle ──

  async function handleToggle(subtask: Subtask) {
    // Prevent double-toggle while a request is in-flight
    if (togglingIds.has(subtask.id)) return

    // Optimistic UI: flip the completion state immediately for snappy UX
    const previous = subtask.is_complete
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, is_complete: !previous } : s)))
    setTogglingIds((prev) => new Set(prev).add(subtask.id))
    try {
      // POST /subtasks/{id}/toggle — flips is_complete and returns updated subtask
      const updated = await taskService.toggleSubtask(subtask.id)
      // Ensure we sync to server truth
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? updated : s)))
    } catch (err: unknown) {
      // Revert optimistic update on error (unless it was a cancel)
      if (isCancel(err)) return
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, is_complete: previous } : s)))
      const msg = extractError(err, "Failed to toggle subtask.")
      showToast("error", msg || "Failed to toggle subtask")
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(subtask.id)
        return next
      })
    }
  }

  // ── Derived counts ────────────────────────────────────────────

  // For edit mode: use pagination.total for the count in the header
  const editModeTotal = pagination?.total ?? subtasks.length
  // For create mode: just count the local list
  const createModeTotal = localSubtasks.length
  // Displayed in the card header
  const displayCount = mode === "edit" ? editModeTotal : createModeTotal

  // Completed subtasks count — used for the progress bar (edit mode only)
  const completedCount = subtasks.filter((s) => s.is_complete).length
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0

  // ─── Render ────────────────────────────────────────────────────
  return (
    <>
      <Card>
        {/* ── Card Header ── */}
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />
            <span>Subtasks</span>

            {/* Count badge */}
            <Badge variant="secondary" className="text-xs">{displayCount}</Badge>

            {/* Progress bar — edit mode only, shown when there are subtasks */}
            {mode === "edit" && subtasks.length > 0 && (
              <div className="flex items-center gap-2 ml-2">
                <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden hidden sm:block">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{completedCount}/{subtasks.length}</span>
              </div>
            )}

            {/* Refresh button — edit mode only */}
            {mode === "edit" && (
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => fetchSubtasks(page)}
                  disabled={listLoading}
                  aria-label="Refresh subtasks"
                >
                  <RefreshCw className={`size-3.5 ${listLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            )}

            {/* Add button — only for users with create subtasks permission */}
            {!isAdding && canCreateSubtasks && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setIsAdding(true); setAddError(null); setAddFieldErrors({}) }}
                className={mode === "edit" ? "" : "ml-auto"}
              >
                <Plus className="size-3.5 mr-1" />
                Add Subtask
              </Button>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* ── CREATE mode notice ── */}
          {mode === "create" && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-400/30 bg-blue-50/50 dark:bg-blue-400/5 p-3 text-xs text-blue-700 dark:text-blue-400">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              <span>Subtasks listed here will be saved to the API <strong>after</strong> the task is created.</span>
            </div>
          )}

          {/* ── List error banner (edit mode) ── */}
          {mode === "edit" && listError && <InlineError message={listError} />}

          {/* ── Add form (both modes) ── */}
          {isAdding && (
            <SubtaskForm
              loading={addLoading}
              fieldErrors={addFieldErrors}
              apiError={addError}
              onSave={handleAdd}
              onCancel={() => { setIsAdding(false); setAddFieldErrors({}); setAddError(null) }}
              saveLabel="Add Subtask"
            />
          )}

          {/* ── EDIT MODE: Loading skeletons ── */}
          {mode === "edit" && listLoading && subtasks.length === 0 && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          )}

          {/* ── EDIT MODE: Empty state ── */}
          {mode === "edit" && !listLoading && !listError && subtasks.length === 0 && !isAdding && (
            <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-xl">
              <CheckCircle2 className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No subtasks yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Subtask" to break this task into steps.</p>
            </div>
          )}

          {/* ── EDIT MODE: Subtask table ── */}
          {mode === "edit" && subtasks.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Done column */}
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    {/* Description hidden on small screens */}
                    <TableHead className="text-xs hidden md:table-cell">Description</TableHead>
                    <TableHead className="text-xs">Priority</TableHead>
                    {/* Due date hidden on small screens */}
                    <TableHead className="text-xs hidden sm:table-cell">Due Date</TableHead>
                    {/* Actions column */}
                    <TableHead className="w-28 text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subtasks.map((subtask) => {
                    const isEditing = editingId === subtask.id
                    const isToggling = togglingIds.has(subtask.id)

                    // ── Inline edit row ──
                    if (isEditing) {
                      return (
                        <TableRow key={subtask.id} className="bg-muted/30">
                          <TableCell colSpan={6} className="p-3">
                            {/* Edit form — showComplete=true adds the is_complete checkbox */}
                            <SubtaskForm
                              initialName={subtask.name}
                              initialDescription={subtask.description ?? ""}
                              initialDueDate={subtask.due_date}
                              initialPriority={subtask.priority}
                              initialIsComplete={subtask.is_complete}
                              showComplete={true}
                              loading={editLoading}
                              fieldErrors={editFieldErrors}
                              apiError={editError}
                              onSave={(values) => handleEditSave(subtask.id, values)}
                              onCancel={() => { setEditingId(null); setEditFieldErrors({}); setEditError(null) }}
                              saveLabel="Update"
                            />
                          </TableCell>
                        </TableRow>
                      )
                    }

                    // ── Normal data row ──
                    return (
                      <TableRow
                        key={subtask.id}
                        className={subtask.is_complete ? "opacity-60" : undefined}
                      >
                        {/* Toggle completion button */}
                        <TableCell className="pr-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleToggle(subtask)}
                            disabled={isToggling}
                            aria-label={subtask.is_complete ? "Mark incomplete" : "Mark complete"}
                            aria-pressed={subtask.is_complete}
                            title={subtask.is_complete ? "Mark incomplete" : "Mark complete"}
                          >
                            {isToggling
                              ? <Loader2 className="size-3.5 animate-spin" />
                              : subtask.is_complete
                              ? <CheckCircle2 className="size-3.5 text-green-500 transition-transform duration-150" />
                              : <Circle className="size-3.5 text-muted-foreground transition-transform duration-150" />
                            }
                          </Button>
                        </TableCell>

                        {/* Name — strikethrough when complete */}
                        <TableCell>
                          <span className={`text-sm font-medium ${subtask.is_complete ? "line-through text-muted-foreground" : ""}`}>
                            {subtask.name}
                          </span>
                        </TableCell>

                        {/* Description — truncated, hidden on mobile */}
                        <TableCell className="hidden md:table-cell">
                          <HtmlContent
                            html={subtask.description}
                            className="text-xs text-muted-foreground line-clamp-1 max-w-48"
                            emptyFallback={<span className="italic text-xs text-muted-foreground">—</span>}
                          />
                        </TableCell>

                        {/* Priority badge */}
                        <TableCell>
                          <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border capitalize ${priorityClass[subtask.priority]}`}>
                            {subtask.priority}
                          </span>
                        </TableCell>

                        {/* Due date — hidden on mobile */}
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground font-mono">
                            {subtask.due_date}
                          </span>
                        </TableCell>

                        {/* Action buttons: View, Edit, Delete */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View — opens SubtaskDetailDialog with GET /subtasks/{id} */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => { setViewId(subtask.id); setViewOpen(true) }}
                              aria-label="View subtask details"
                              title="View details"
                            >
                              <Eye className="size-3.5" />
                            </Button>

                            {/* Edit — only for users with edit subtasks permission */}
                            {canEditSubtasks && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => {
                                setEditingId(subtask.id)
                                setEditError(null)
                                setEditFieldErrors({})
                                // Close add form if open
                                setIsAdding(false)
                              }}
                              aria-label="Edit subtask"
                              title="Edit"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            )}

                            {/* Delete — only for users with delete subtasks permission */}
                            {canDeleteSubtasks && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => { setDeleteTarget(subtask); setDeleteError(null) }}
                              className="text-destructive hover:bg-destructive/10"
                              aria-label="Delete subtask"
                              title="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── EDIT MODE: Loading overlay when refreshing with existing data ── */}
          {mode === "edit" && listLoading && subtasks.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Refreshing…
            </div>
          )}

          {/* ── EDIT MODE: Pagination ── */}
          {mode === "edit" && pagination && (
            <SectionPagination
              pagination={pagination}
              onPageChange={(p) => setPage(p)}
            />
          )}

          {/* ── CREATE MODE: Local subtask list ── */}
          {mode === "create" && localSubtasks.length === 0 && !isAdding && (
            <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-xl">
              <CheckCircle2 className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No subtasks added yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Break this task into smaller steps.</p>
            </div>
          )}

          {mode === "create" && localSubtasks.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Description</TableHead>
                    <TableHead className="text-xs">Priority</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Due Date</TableHead>
                    <TableHead className="w-20 text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localSubtasks.map((sub) => {
                    // ── Inline edit row for local entry ──
                    if (editingKey === sub.key) {
                      return (
                        <TableRow key={sub.key} className="bg-muted/30">
                          <TableCell colSpan={5} className="p-3">
                            <SubtaskForm
                              initialName={sub.name}
                              initialDescription={sub.description}
                              initialDueDate={sub.due_date}
                              initialPriority={sub.priority}
                              loading={false}
                              fieldErrors={editFieldErrors}
                              apiError={null}
                              onSave={(values) => handleLocalEdit(sub.key, values)}
                              onCancel={() => { setEditingKey(null); setEditFieldErrors({}) }}
                              saveLabel="Update"
                            />
                          </TableCell>
                        </TableRow>
                      )
                    }

                    // ── Normal local row ──
                    return (
                      <TableRow key={sub.key}>
                        <TableCell>
                          <span className="text-sm font-medium">{sub.name}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <HtmlContent
                            html={sub.description}
                            className="text-xs text-muted-foreground line-clamp-1 max-w-48"
                            emptyFallback={<span className="italic text-xs text-muted-foreground">—</span>}
                          />
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border capitalize ${priorityClass[sub.priority]}`}>
                            {sub.priority}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground font-mono">{sub.due_date || "—"}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Edit local entry — only for users with edit subtasks permission */}
                            {canEditSubtasks && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => { setEditingKey(sub.key); setEditFieldErrors({}) }}
                              aria-label="Edit subtask"
                              title="Edit"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            )}
                            {/* Remove local entry — only for users with delete subtasks permission */}
                            {canDeleteSubtasks && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setDeleteKey(sub.key)}
                              className="text-destructive hover:bg-destructive/10"
                              aria-label="Remove subtask"
                              title="Remove"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

        </CardContent>
      </Card>

      {/* ── EDIT MODE: Subtask Detail Dialog (GET /subtasks/{id}) ──
           onToggle receives the updated subtask from POST /subtasks/{id}/toggle
           and updates the local list so the table row reflects the new state. */}
      <SubtaskDetailDialog
        subtaskId={viewId}
        open={viewOpen}
        onOpenChange={(v) => {
          setViewOpen(v)
          if (!v) setViewId(null)
        }}
        onToggle={(updated) =>
          setSubtasks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        }
      />

      {/* ── EDIT MODE: Delete Confirmation Dialog ── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) { setDeleteTarget(null); setDeleteError(null) } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subtask</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Error shown inside the dialog if DELETE fails */}
          {deleteError && (
            <InlineError message={deleteError} />
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="size-3.5 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── CREATE MODE: Remove Confirmation Dialog ── */}
      <AlertDialog
        open={deleteKey !== null}
        onOpenChange={(v) => { if (!v) setDeleteKey(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Subtask</AlertDialogTitle>
            <AlertDialogDescription>
              Remove{" "}
              <span className="font-semibold text-foreground">
                {localSubtasks.find((s) => s.key === deleteKey)?.name}
              </span>{" "}
              from the list? It has not been saved yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => { if (deleteKey !== null) handleLocalDelete(deleteKey) }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
