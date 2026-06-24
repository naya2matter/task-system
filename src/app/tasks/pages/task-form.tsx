// Task Form — used for both Create and Edit modes.
// Create mode → POST /tasks → POST /tasks/{id}/status → POST /tasks/{id}/assign-users
//              → POST /subtasks for each local subtask (all after the main task save).
// Edit mode   → PUT /tasks/{id}, TaskAssignmentPanel handles assignment CRUD inline,
//              TaskSubtasksSection handles subtask CRUD inline via dedicated endpoints.
//
// Assignment rows are collected locally in create mode and submitted in a single
// bulk request after the task is saved — no per-user round trips.
// Subtasks in create mode are also collected locally and POSTed individually after
// the task exists (they require a task_id).

import { useState, useEffect } from "react"
import { AxiosError, isCancel } from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/ui/date-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { AlertCircle, ArrowLeft, Loader2, Plus, X } from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { HtmlEditor } from "@/components/ui/html-editor"
import { normalizeHtmlForSubmit } from "@/lib/html"

// Store actions for creating / updating tasks
import { useCreateTask } from "@/app/tasks/hooks/useCreateTask"
import { useUpdateTask } from "@/app/tasks/hooks/useUpdateTask"
import { taskService } from "@/app/tasks/services/taskService"

// Project and section services to populate the selectors
import { projectService } from "@/app/projects/services/projectService"
import { sectionService } from "@/app/projects/sections/section-service"
import type { Project } from "@/app/projects/types"
import type { Section } from "@/app/projects/sections/types"

// API-aligned Task type (from types/index.ts, not the mock data.ts)
import type { Task, TaskPriority, TaskStatus } from "@/app/tasks/types"
import type { ApiValidationError } from "@/types"

// Assignment panel — manages add/remove/bulk-assign for a task
import { TaskAssignmentPanel } from "@/app/tasks/pages/task-assignment-panel"
// All-users hook — populates the user selector in the create-mode assignment builder
import { useAllUsers } from "@/app/tasks/hooks/useAllUsers"
// Subtasks section — full CRUD (edit mode: API-backed; create mode: local state)
import { TaskSubtasksSection } from "@/app/tasks/components/task-subtasks-section"
import type { LocalSubtaskInput } from "@/app/tasks/components/task-subtasks-section"
import { usePermissions } from "@/hooks/usePermissions"

// ─── Types ────────────────────────────────────────────────────────

type TaskFormProps = {
  mode: "create" | "edit"
  /** Populated in edit mode with the task loaded from GET /tasks/{id} */
  initialData?: Task | null
  /**
   * Pre-select a project in create mode (e.g. when opened from a section card).
   * Ignored in edit mode — initialData.section.project_id is used instead.
   */
  defaultProjectId?: number
  /**
   * Pre-select a section in create mode (e.g. when opened from a section card).
   * Ignored in edit mode — initialData.section_id is used instead.
   */
  defaultSectionId?: number
  /** Called after a successful API response — caller navigates away */
  onSubmit: () => void
  onCancel: () => void
}

// ─── Constants ────────────────────────────────────────────────────

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "rated", label: "Rated" },
]

const priorityOptions: TaskPriority[] = ["low", "medium", "high", "critical"]

// Pull a readable message from Axios errors returned by the status endpoint.
function extractStatusError(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiValidationError | undefined
    if (data?.errors) return Object.values(data.errors).flat().join(". ")
    if (data?.message) return data.message
  }
  return "Failed to update task status."
}

// Flattens nested values so the status response can be rendered in a compact table.
// Response table utilities removed (no longer used)

// ─── Local types ─────────────────────────────────────────────────
// One row in the create-mode assignment builder — local state only, not sent
// to the API until the task is saved.
type AssignmentRow = { key: number; userId: string; percentage: string }

// ─── Component ────────────────────────────────────────────────────

export function TaskForm({ mode, initialData, defaultProjectId, defaultSectionId, onSubmit, onCancel }: TaskFormProps) {
  // ── Mutation hooks ─────────────────────────────────────────────
  const { createTask, submitting: creating, submitError: createError, clearSubmitError: clearCreateError } = useCreateTask()
  const { updateTask, submitting: updating, submitError: updateError, clearSubmitError: clearUpdateError } = useUpdateTask()

  const { hasPermission } = usePermissions()
  // Assignment UI is only rendered for users who can edit tasks
  const canManageAssignments = hasPermission("edit tasks")

  // Combine submitting / error from whichever hook applies to the current mode
  const submitting = mode === "create" ? creating : updating
  const submitError = mode === "create" ? createError : updateError

  // ── Projects & Sections data for the selectors ─────────────────
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [sections, setSections] = useState<Section[]>([])
  const [sectionsLoading, setSectionsLoading] = useState(false)

  // ── Form field state (initialised from initialData in edit mode) ─
  const [name, setName] = useState(initialData?.name ?? "")
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [status, setStatus] = useState<TaskStatus>(initialData?.status ?? "pending")
  const [priority, setPriority] = useState<TaskPriority>(initialData?.priority ?? "medium")
  const [weight, setWeight] = useState<number>(initialData?.weight ?? 1)
  const [dueDate, setDueDate] = useState(initialData?.due_date ?? "")

  // Project is derived from the section relationship; pre-select in edit mode.
  // In create mode, fall back to defaultProjectId when provided (e.g. from a section card).
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    initialData?.section?.project_id ?? defaultProjectId ?? null
  )
  // Section to assign the task to; pre-select from edit data or default in create mode.
  const [sectionId, setSectionId] = useState<number | null>(
    initialData?.section_id ?? defaultSectionId ?? null
  )

  // Subtasks — create mode collects these locally; after the task is saved each
  // entry is POSTed individually via POST /subtasks (task_id becomes known then).
  // Edit mode subtask CRUD is handled entirely inside TaskSubtasksSection.
  const [localSubtasks, setLocalSubtasks] = useState<LocalSubtaskInput[]>([])

  // Client-side validation error messages shown below each field
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Status mutation state (POST /tasks/{id}/status) with UI-only error handling.
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  // All users for the assignment picker — loaded once, used in create mode
  const { users: allUsers, loading: usersLoading } = useAllUsers()

  // Assignment rows for create mode — collected locally, then submitted in one
  // bulk POST /tasks/{id}/assign-users after the task is created.
  const [assignmentRows, setAssignmentRows] = useState<AssignmentRow[]>([])

  // Live total across all rows — drives the UI badge and the ≤ 100% validation.
  const totalPercentage = assignmentRows.reduce((sum, r) => {
    const p = parseFloat(r.percentage)
    return sum + (isNaN(p) ? 0 : p)
  }, 0)

  // ── Fetch projects once on mount ───────────────────────────────
  useEffect(() => {
    setProjectsLoading(true)
    projectService
      .getAll()
      .then((data) => setProjects(data))
      .catch(() => {}) // API client interceptor already shows a toast on error
      .finally(() => setProjectsLoading(false))
  }, [])

  // ── Fetch sections whenever the selected project changes ───────
  useEffect(() => {
    if (selectedProjectId === null) {
      setSections([])
      return
    }
    setSectionsLoading(true)
    sectionService
      .getByProject(selectedProjectId)
      .then((data) => setSections(data))
      .catch(() => {})
      .finally(() => setSectionsLoading(false))
  }, [selectedProjectId])

  // ── Clear submit errors when the form unmounts ─────────────────
  useEffect(() => {
    return () => {
      clearCreateError()
      clearUpdateError()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Client-side validation ─────────────────────────────────────
  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = "Task name is required."
    if (!dueDate) next.due_date = "Due date is required."
    if (!sectionId) next.section_id = "Section is required."
    if (weight < 1) next.weight = "Weight must be at least 1."
    // Enforce the 100% ceiling before hitting the API
    if (mode === "create" && totalPercentage > 100) {
      next.assignments = `Total allocation is ${totalPercentage.toFixed(1)}% — must not exceed 100%.`
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Submit — calls create or update depending on mode ──────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    // clear any previous status error before attempting submit
    setStatusError(null)

    let success = false
    const normalizedDescription = normalizeHtmlForSubmit(description)

    if (mode === "create") {
      // POST /tasks
      const result = await createTask({
        name: name.trim(),
        description: normalizedDescription,
        weight,
        due_date: dueDate,
        priority,
        section_id: sectionId!,
      })
      if (result) {
        // Apply status using the dedicated endpoint immediately after creation.
        const statusUpdated = await submitStatusChange(result.id)
        if (statusUpdated) {
          // Collect only fully-filled rows and submit all assignments in one
          // request — eliminates the per-user round-trip lag.
          const validAssignments = assignmentRows.filter(
            (r) => r.userId && r.percentage && !isNaN(parseFloat(r.percentage))
          )
          if (validAssignments.length > 0) {
            try {
              await taskService.assignUsers(result.id, {
                assignments: validAssignments.map((r) => ({
                  user_id: Number(r.userId),
                  percentage: parseFloat(r.percentage),
                })),
              })
            } catch (err) {
              // Task was created — API client shows a toast for the assignment
              // error. We still navigate so the user can edit from the list.
              if (isCancel(err)) return
            }
          }

          // POST /subtasks for each locally-added subtask (create mode only).
          // These are posted sequentially after the task and assignments are saved.
          // Errors are non-fatal — the task was created; subtasks can be added later.
          for (const sub of localSubtasks) {
            try {
              await taskService.createSubtask({
                name: sub.name,
                description: sub.description || null,
                due_date: sub.due_date,
                priority: sub.priority,
                task_id: result.id,
              })
            } catch (err) {
              if (isCancel(err)) return
              // Individual subtask failures are silently swallowed here;
              // the API client interceptor already shows an error toast.
            }
          }

          success = true
        }
      }
    } else if (initialData) {
      // PUT /tasks/{id}
      const result = await updateTask(initialData.id, {
        name: name.trim(),
        description: normalizedDescription,
        weight,
        due_date: dueDate,
        priority,
        section_id: sectionId!,
      })
      if (result) {
        // Keep status updates on the dedicated endpoint to match backend contract.
        const statusUpdated = await submitStatusChange(initialData.id)
        success = statusUpdated
      }
    }

    // On success navigate back to the list (caller will refetch)
    if (success) onSubmit()
  }

  // Shared status mutation handler used by both create and edit actions.
  async function submitStatusChange(taskId: number) {
    setStatusSubmitting(true)
    setStatusError(null)
    try {
      await taskService.updateStatus(taskId, { status })
      return true
    } catch (err) {
      // Skip canceled requests; only show actionable errors in the UI.
      if (!isCancel(err)) {
        setStatusError(extractStatusError(err))
      }
      return false
    } finally {
      setStatusSubmitting(false)
    }
  }

  // ── Assignment row helpers (create mode only) ──────────────────

  // Append a blank row to the builder list
  function addAssignmentRow() {
    setAssignmentRows((prev) => [...prev, { key: Date.now(), userId: "", percentage: "" }])
  }

  // Remove a specific row by its local key
  function removeAssignmentRow(key: number) {
    setAssignmentRows((prev) => prev.filter((r) => r.key !== key))
  }

  // Update one field of a row; clears the over-100% error when percentage changes
  function updateAssignmentRow(key: number, field: "userId" | "percentage", value: string) {
    setAssignmentRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    )
    if (field === "percentage") {
      setFieldErrors((prev) => ({ ...prev, assignments: "" }))
    }
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex w-full justify-center p-4 md:p-8">
      <Card className="w-full max-w-4xl">
        <CardContent className="p-6 md:p-8">

          {/* Page header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon-lg" onClick={onCancel} disabled={submitting}>
              <ArrowLeft />
            </Button>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                  {mode === "create" ? "Create Task" : "Edit Task"}
                </h2>
                <Badge variant="secondary" className="uppercase tracking-wider">
                  {mode}
                </Badge>
              </div>
              <p className="text-sm md:text-lg text-muted-foreground max-w-2xl">
                {mode === "create"
                  ? "Create a task with subtasks and user assignments."
                  : `Update details for ${initialData?.name ?? "this task"}.`}
              </p>
            </div>
          </div>

          {/* API-level submit error banner (e.g. 422 validation or 500) */}
          {submitError && !submitting && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 mb-6 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {statusError && !statusSubmitting && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 mb-6 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">

            {/* ── Task Details section ── */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold uppercase tracking-widest text-muted-foreground">
                Task Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Task Name — spans full width */}
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="name">Task Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Implement darkroom shader"
                    className="h-12 text-sm"
                  />
                  {fieldErrors.name && (
                    <p className="text-sm text-destructive">{fieldErrors.name}</p>
                  )}
                </div>

                {/* Project — picking a project populates the Section dropdown */}
                <div className="space-y-2">
                  <Label>Project *</Label>
                  <SearchableSelect
                    value={selectedProjectId?.toString() ?? ""}
                    onValueChange={(v) => {
                      setSelectedProjectId(Number(v))
                      setSectionId(null)
                    }}
                    options={projects.map((p) => ({ value: p.id.toString(), label: p.name }))}
                    placeholder="Select Project"
                    loading={projectsLoading}
                  />
                </div>

                {/* Section — populated after a project is selected */}
                <div className="space-y-2">
                  <Label>Section *</Label>
                  <SearchableSelect
                    value={sectionId?.toString() ?? ""}
                    onValueChange={(v) => setSectionId(Number(v))}
                    options={sections.map((s) => ({ value: s.id.toString(), label: s.name }))}
                    placeholder={
                      !selectedProjectId ? "Select a project first" : "Select Section"
                    }
                    loading={sectionsLoading}
                    disabled={!selectedProjectId}
                  />
                  {fieldErrors.section_id && (
                    <p className="text-sm text-destructive">{fieldErrors.section_id}</p>
                  )}
                </div>

                {/* Weight — integer, must be ≥ 1 */}
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight *</Label>
                  <Input
                    id="weight"
                    type="number"
                    min={1}
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="h-12 text-sm"
                  />
                  {fieldErrors.weight && (
                    <p className="text-sm text-destructive">{fieldErrors.weight}</p>
                  )}
                </div>

                {/* Due Date — YYYY-MM-DD (RFC 3339 full-date) */}
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date *</Label>
                  <DateInput
                    id="due_date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-12 text-sm"
                  />
                  {fieldErrors.due_date && (
                    <p className="text-sm text-destructive">{fieldErrors.due_date}</p>
                  )}
                </div>

                {/* Status — only shown during edit; POST /tasks does not accept status */}
                <div className="space-y-2">
                  <Label>Status *</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as TaskStatus)}
                  >
                    <SelectTrigger className="w-full h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Saved through POST /tasks/{"{id}"}/status after the main task save succeeds.
                  </p>
                </div>

                {/* Priority toggle — spans full width in create, half-width in edit */}
                <div className={`${mode === "edit" ? "" : "md:col-span-2"} space-y-2`}>
                  <Label>Priority *</Label>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={priority}
                    onValueChange={(v) => {
                      if (v) setPriority(v as TaskPriority)
                    }}
                    className="justify-start"
                  >
                    {priorityOptions.map((p) => (
                      <ToggleGroupItem key={p} value={p} className="capitalize">
                        {p}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>

                {/* Description — optional, full width */}
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-baseline gap-2">
                    <Label htmlFor="description">Description</Label>
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border/40 bg-muted/20 ring-1 ring-border/20 transition-all focus-within:ring-primary">
                    <HtmlEditor
                      id="description"
                      value={description}
                      onChange={setDescription}
                      placeholder="Briefly describe the task objectives..."
                      minHeightClassName="min-h-36"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supports rich text formatting — bold, lists, links, and more.
                  </p>
                </div>

                {/* User Assignments —
                    Create mode: rows collected locally, one bulk POST on save.
                    Edit mode:   TaskAssignmentPanel handles all CRUD inline.
                    Only rendered for users with "edit tasks" permission. */}
                {canManageAssignments && (
                <div className="md:col-span-2 space-y-3">
                  {mode === "edit" && initialData?.id ? (
                    /* Existing task — full assignment CRUD via the panel */
                    <TaskAssignmentPanel taskId={initialData.id} mode="edit" />
                  ) : (
                    /* Create mode — build the list locally before submitting */
                    <>
                      {/* Label + live total badge */}
                      <div className="flex items-center justify-between">
                        <Label>User Assignments</Label>
                        {assignmentRows.length > 0 && (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                              totalPercentage > 100
                                ? "border-destructive/50 bg-destructive/10 text-destructive"
                                : "border-green-400/50 bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-400"
                            }`}
                          >
                            {totalPercentage.toFixed(1)}% / 100%
                          </span>
                        )}
                      </div>

                      {/* Over-100% validation error */}
                      {fieldErrors.assignments && (
                        <p className="text-sm text-destructive">{fieldErrors.assignments}</p>
                      )}

                      {totalPercentage >= 100 && (
                        <p className="text-xs text-muted-foreground">Total allocation is 100% — cannot add more users.</p>
                      )}

                      {/* Rows */}
                      {assignmentRows.length > 0 && (
                        <div className="space-y-2">
                          {assignmentRows.map((row) => (
                            <div
                              key={row.key}
                              className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                            >
                              {/* User picker */}
                              <SearchableSelect
                                value={row.userId}
                                onValueChange={(v) => updateAssignmentRow(row.key, "userId", v)}
                                options={allUsers.map((u) => ({ value: u.id.toString(), label: u.name }))}
                                placeholder="Select user"
                                loading={usersLoading}
                                className="flex-1"
                              />

                              <div className="flex gap-2 w-full sm:w-auto">
                                {/* Percentage — live total updates as user types */}
                                <Input
                                  type="number"
                                  min={0.01}
                                  max={100}
                                  step={0.01}
                                  placeholder="% e.g. 50"
                                  value={row.percentage}
                                  onChange={(e) =>
                                    updateAssignmentRow(row.key, "percentage", e.target.value)
                                  }
                                  className="w-full sm:w-28 h-10 text-sm"
                                />
                                {/* Remove this row */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => removeAssignmentRow(row.key)}
                                  className="text-destructive hover:bg-destructive/10 shrink-0"
                                  aria-label="Remove row"
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add a new row */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addAssignmentRow}
                        disabled={usersLoading || totalPercentage >= 100}
                      >
                        <Plus className="size-3.5" />
                        {usersLoading ? "Loading users…" : "Add User"}
                      </Button>
                    </>
                  )}
                </div>
                )}

              </div>
            </section>

            <Separator />

            {/* ── Subtasks section ──
                Edit mode: TaskSubtasksSection fetches from GET /tasks/{taskId}/subtasks
                           and provides full inline CRUD (add, view, edit, delete, toggle).
                Create mode: purely local state; each entry is POSTed via POST /subtasks
                             individually after the parent task is successfully created. */}
            <section>
              <TaskSubtasksSection
                mode={mode}
                taskId={mode === "edit" ? initialData?.id : undefined}
                localSubtasks={localSubtasks}
                onChange={setLocalSubtasks}
              />
            </section>

            <Separator />

            {/* ── Form actions ── */}
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={onCancel}
                disabled={submitting || statusSubmitting}
              >
                Discard
              </Button>
              <Button type="submit" size="lg" disabled={submitting || statusSubmitting}>
                {(submitting || statusSubmitting) && <Loader2 className="size-4 animate-spin mr-2" />}
                {mode === "create" ? "Create Task" : "Save Changes"}
              </Button>
            </div>

          </form>

        </CardContent>
      </Card>
    </div>
  )
}
