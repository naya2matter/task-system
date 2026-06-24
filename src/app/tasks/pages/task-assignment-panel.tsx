// TaskAssignmentPanel — manages user assignments for a task.
//
// mode="edit"  → full CRUD:
//   • Loads current assignments via GET /tasks/{id}/with-assignments
//   • Add one user  → POST /tasks/{id}/add-user
//   • Bulk replace  → POST /tasks/{id}/assign-users
//   • Remove one    → DELETE /tasks/{id}/users/{userId}
//
// mode="view"  → read-only table of current assignments (no action buttons)
//
// Rules enforced client-side:
//   • Total allocation cannot exceed 100% at any time
//   • Add-one and inline-edit validate against remaining headroom
//   • Bulk replace validates the full set before submitting
//   • Delete is instant — no confirmation dialog

import { useState, useEffect, useCallback } from "react"
import { isCancel, AxiosError } from "axios"
import {
  Loader2, Plus, Pencil, Check, X, Trash2,
  UserPlus, Users, AlertCircle, RefreshCw,
  CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { taskService } from "@/app/tasks/services/taskService"
import { useAllUsers } from "@/app/tasks/hooks/useAllUsers"
import type { AssignedUser } from "@/app/tasks/types"
import type { ApiValidationError } from "@/types"

// ─── Props ────────────────────────────────────────────────────────

type Props = {
  /** The task's numeric ID — must be a valid, already-created task */
  taskId: number
  /** edit = actions visible; view = read-only table */
  mode: "edit" | "view"
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Extract a user-readable error string from an Axios error */
function extractError(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiValidationError | undefined
    if (data?.errors) return Object.values(data.errors).flat().join(". ")
    if (data?.message) return data.message
  }
  return fallback
}

/** Two-letter initials from a full name, e.g. "John Doe" → "JD" */
function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ─── Bulk-assign row type (local only) ───────────────────────────

type BulkRow = {
  key: number
  userId: string   // "" = not chosen yet
  percentage: string
}

// ─── Allocation progress bar ──────────────────────────────────────

function AllocationBar({ value }: { value: number }) {
  const capped = Math.min(value, 100)
  const isOver = value > 100
  const isFull = Math.abs(value - 100) < 0.005   // treat 99.995–100.004 as exactly 100

  const barColor = isOver
    ? "bg-destructive"
    : isFull
    ? "bg-emerald-500"
    : value >= 80
    ? "bg-amber-500"
    : "bg-primary"

  const labelColor = isOver
    ? "text-destructive"
    : isFull
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-foreground"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          {isFull && <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />}
          {isOver && <AlertCircle className="size-3.5 text-destructive shrink-0" />}
          <span className={cn("font-mono font-bold tabular-nums", labelColor)}>
            {value.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">/ 100%</span>
        </div>
        <span
          className={cn(
            "tabular-nums",
            isOver
              ? "text-destructive font-semibold"
              : isFull
              ? "text-emerald-600 dark:text-emerald-400 font-medium"
              : "text-muted-foreground",
          )}
        >
          {isOver
            ? `${(value - 100).toFixed(1)}% over limit`
            : isFull
            ? "Fully allocated ✓"
            : `${(100 - value).toFixed(1)}% remaining`}
        </span>
      </div>

      {/* Track */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            barColor,
          )}
          style={{ width: `${capped}%` }}
        />
      </div>
    </div>
  )
}

// ─── Inline error banner ──────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
      <AlertCircle className="size-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────

export function TaskAssignmentPanel({ taskId, mode }: Props) {
  // ── Assignment list loaded from the API ───────────────────────
  const [assignments, setAssignments] = useState<AssignedUser[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ── All users for the dropdowns ───────────────────────────────
  const { users: allUsers, loading: usersLoading } = useAllUsers()

  // ── Add-one-user form ─────────────────────────────────────────
  const [addUserId, setAddUserId] = useState<string>("")
  const [addPercentage, setAddPercentage] = useState<string>("")
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // ── Remove — tracks which userId is being deleted ─────────────
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  // Confirmation dialog state for deletes
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // ── Inline edit — one row open at a time ──────────────────────
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editPercentage, setEditPercentage] = useState<string>("")
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // ── Bulk-assign form ──────────────────────────────────────────
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([])
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  // ── Fetch assignments ─────────────────────────────────────────
  const fetchAssignments = useCallback(() => {
    let cancelled = false
    setLoadingAssignments(true)
    setLoadError(null)

    taskService
      .getByIdWithAssignments(taskId)
      .then((task) => {
        if (!cancelled) setAssignments(task.assigned_users ?? [])
      })
      .catch((err: unknown) => {
        if (cancelled || isCancel(err)) return
        setLoadError(extractError(err, "Failed to load assignment data."))
      })
      .finally(() => {
        if (!cancelled) setLoadingAssignments(false)
      })

    return () => { cancelled = true }
  }, [taskId])

  useEffect(() => {
    return fetchAssignments()
  }, [fetchAssignments])

  // Seed bulk rows from saved assignments when the user opens the panel
  useEffect(() => {
    if (bulkRows.length > 0) return
    const seed =
      assignments.length > 0
        ? assignments.map((u, i) => ({
            key: Date.now() + i,
            userId: u.id.toString(),
            percentage:
              u.pivot?.percentage !== undefined ? String(u.pivot.percentage) : "",
          }))
        : [{ key: Date.now(), userId: "", percentage: "" }]
    setBulkRows(seed)
  }, [assignments, bulkRows.length])

  // ── Derived totals ────────────────────────────────────────────
  const totalAllocated = assignments.reduce(
    (sum, u) => sum + (Number(u.pivot?.percentage) || 0),
    0,
  )
  const remaining = Math.max(0, 100 - totalAllocated)
  const isFullyAllocated = totalAllocated >= 100

  const bulkTotal = bulkRows.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0)

  // ── Add one user (immediate API call) ─────────────────────────
  async function handleAddUser() {
    if (!addUserId) { setAddError("Please select a user."); return }

    const pct = parseFloat(addPercentage)
    if (!addPercentage || isNaN(pct) || pct < 0.01 || pct > 100) {
      setAddError("Percentage must be between 0.01 and 100.")
      return
    }
    if (pct > remaining + 0.005) {
      setAddError(
        `Only ${remaining.toFixed(1)}% remaining. Reduce the percentage or free up allocation first.`,
      )
      return
    }

    setAddSubmitting(true)
    setAddError(null)
    try {
      const updatedTask = await taskService.addUser(taskId, {
        user_id: Number(addUserId),
        percentage: pct,
      })
      setAssignments(updatedTask.assigned_users ?? [])
      setAddUserId("")
      setAddPercentage("")
      // Reset bulk rows so they resync with fresh assignments
      setBulkRows([])
    } catch (err: unknown) {
      if (!isCancel(err)) setAddError(extractError(err, "Failed to add user."))
    } finally {
      setAddSubmitting(false)
    }
  }

  // ── Remove one user (instant — no confirmation) ───────────────
  async function handleRemoveUser(userId: number) {
    setRemovingId(userId)
    setRemoveError(null)
    try {
      const updatedTask = await taskService.removeUser(taskId, userId)
      setAssignments(updatedTask.assigned_users ?? [])
      setBulkRows([]) // resync bulk rows after removal
    } catch (err: unknown) {
      if (!isCancel(err)) setRemoveError(extractError(err, "Failed to remove user."))
    } finally {
      setRemovingId(null)
    }
  }

  // Confirmed delete flow — called from the AlertDialog action
  async function confirmDelete() {
    if (!confirmDeleteId) return
    // close dialog immediately for snappy UX
    setConfirmOpen(false)
    try {
      await handleRemoveUser(confirmDeleteId)
    } finally {
      setConfirmDeleteId(null)
    }
  }

  // ── Inline edit ───────────────────────────────────────────────
  function startEditAssignment(user: AssignedUser) {
    setEditingUserId(user.id)
    setEditPercentage(
      user.pivot?.percentage !== undefined ? String(user.pivot.percentage) : "",
    )
    setEditError(null)
  }

  function cancelEditAssignment() {
    setEditingUserId(null)
    setEditPercentage("")
    setEditError(null)
  }

  async function handleUpdateAssignment(userId: number) {
    const pct = parseFloat(editPercentage)
    if (!editPercentage || isNaN(pct) || pct < 0.01 || pct > 100) {
      setEditError("Percentage must be between 0.01 and 100.")
      return
    }

    // Max allowed = 100 minus everyone else's current allocation
    const currentUserPct =
      assignments.find((u) => u.id === userId)?.pivot?.percentage ?? 0
    const headroom = 100 - (totalAllocated - currentUserPct)
    if (pct > headroom + 0.005) {
      setEditError(`Maximum allowed for this user is ${headroom.toFixed(1)}%.`)
      return
    }

    setEditSubmitting(true)
    setEditError(null)
    try {
      const updatedTask = await taskService.updateUserAssignment(taskId, userId, {
        percentage: pct,
      })
      setAssignments(updatedTask.assigned_users ?? [])
      setBulkRows([]) // resync
      setEditingUserId(null)
      setEditPercentage("")
    } catch (err: unknown) {
      if (!isCancel(err)) setEditError(extractError(err, "Failed to update assignment."))
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Bulk assign ───────────────────────────────────────────────
  function addBulkRow() {
    setBulkRows((prev) => [...prev, { key: Date.now(), userId: "", percentage: "" }])
  }

  function removeBulkRow(key: number) {
    setBulkRows((prev) => prev.filter((r) => r.key !== key))
    setBulkError(null)
  }

  function updateBulkRow(key: number, field: "userId" | "percentage", value: string) {
    setBulkRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    )
    setBulkError(null)
  }

  async function handleBulkAssign() {
    if (bulkRows.length === 0) {
      setBulkError("Add at least one row before submitting.")
      return
    }
    const parsed = bulkRows.map((r) => ({
      user_id: Number(r.userId),
      percentage: parseFloat(r.percentage),
    }))
    for (const p of parsed) {
      if (!p.user_id || isNaN(p.percentage) || p.percentage < 0.01 || p.percentage > 100) {
        setBulkError("Every row needs a user and a percentage between 0.01 – 100.")
        return
      }
    }
    const total = parsed.reduce((s, r) => s + r.percentage, 0)
    if (total > 100 + 0.005) {
      setBulkError(`Total is ${total.toFixed(1)}% — must not exceed 100%.`)
      return
    }
    const ids = parsed.map((p) => p.user_id)
    if (new Set(ids).size !== ids.length) {
      setBulkError("Duplicate users are not allowed.")
      return
    }

    setBulkSubmitting(true)
    setBulkError(null)
    try {
      const updatedTask = await taskService.assignUsers(taskId, { assignments: parsed })
      setAssignments(updatedTask.assigned_users ?? [])
      setBulkRows(
        updatedTask.assigned_users?.map((u, i) => ({
          key: Date.now() + i,
          userId: u.id.toString(),
          percentage:
            u.pivot?.percentage !== undefined ? String(u.pivot.percentage) : "",
        })) ?? [{ key: Date.now(), userId: "", percentage: "" }],
      )
      setBulkOpen(false)
    } catch (err: unknown) {
      if (!isCancel(err)) setBulkError(extractError(err, "Failed to assign users."))
    } finally {
      setBulkSubmitting(false)
    }
  }

  // ── Derived sets for dropdown filtering ───────────────────────
  const assignedIds = new Set(assignments.map((u) => u.id))
  const availableUsers = allUsers.filter((u) => !assignedIds.has(u.id))

  // ─────────────────────────────────────────────────────────────
  return (
    <section className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Users className="size-3.5" />
          User Assignments
          {assignments.length > 0 && (
            <Badge variant="secondary" className="font-mono text-[11px]">
              {assignments.length}
            </Badge>
          )}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={fetchAssignments}
          disabled={loadingAssignments}
          aria-label="Reload assignments"
        >
          <RefreshCw
            className={cn("size-3.5", loadingAssignments && "animate-spin")}
          />
        </Button>
      </div>

      {/* ── Allocation progress bar ────────────────────────────── */}
      <AllocationBar value={totalAllocated} />

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={(open) => {
        setConfirmOpen(open)
        if (!open) setConfirmDeleteId(null)
      }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user from task?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Are you sure you want to remove ${assignments.find((u) => u.id === confirmDeleteId)?.name ?? 'this user'} from this task? This will remove their allocation.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Loading / error states ─────────────────────────────── */}
      {loadingAssignments && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="size-3.5 animate-spin" />
          Loading assignments…
        </div>
      )}
      {loadError && !loadingAssignments && <ErrorBanner message={loadError} />}
      {removeError && <ErrorBanner message={removeError} />}

      {/* ── Assignments table ───────────────────────────────────── */}
      {!loadingAssignments && (
        assignments.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted">
            <Users className="size-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No users assigned yet.</p>
            {mode === "edit" && (
              <p className="text-xs text-muted-foreground/70">
                Use the form below to add your first assignment.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            {editError && (
              <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2">
                <ErrorBanner message={editError} />
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  {mode === "edit" && <TableHead className="w-18" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((user) => {
                  const isEditing = editingUserId === user.id
                  const isRemoving = removingId === user.id

                  return (
                    <TableRow
                      key={user.id}
                      className={cn(
                        "transition-opacity duration-200",
                        isRemoving && "opacity-40 pointer-events-none",
                      )}
                    >
                      {/* Avatar + name */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7 shrink-0">
                            <AvatarImage
                              src={user.avatar_url ?? undefined}
                              alt={user.name}
                            />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate max-w-32 sm:max-w-none">
                            {user.name}
                          </span>
                        </div>
                      </TableCell>

                      {/* Email */}
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {user.email}
                      </TableCell>

                      {/* Percentage */}
                      <TableCell className="text-right">
                        {mode === "edit" && isEditing ? (
                          <Input
                            type="number"
                            min={0.01}
                            max={100}
                            step={0.01}
                            value={editPercentage}
                            onChange={(e) => {
                              setEditPercentage(e.target.value)
                              setEditError(null)
                            }}
                            className="h-8 w-24 text-sm text-right ml-auto"
                            disabled={editSubmitting}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdateAssignment(user.id)
                              if (e.key === "Escape") cancelEditAssignment()
                            }}
                          />
                        ) : (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "font-mono tabular-nums",
                              user.pivot?.percentage !== undefined &&
                                Number(user.pivot.percentage) > 0
                                ? ""
                                : "text-muted-foreground",
                            )}
                          >
                            {user.pivot?.percentage !== undefined
                              ? `${Number(user.pivot.percentage).toFixed(1)}%`
                              : "—"}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions — edit mode only */}
                      {mode === "edit" && (
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleUpdateAssignment(user.id)}
                                disabled={editSubmitting}
                                aria-label="Save"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              >
                                {editSubmitting ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Check className="size-3.5" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={cancelEditAssignment}
                                disabled={editSubmitting}
                                aria-label="Cancel"
                                className="text-muted-foreground hover:bg-muted"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => startEditAssignment(user)}
                                disabled={editingUserId !== null || removingId !== null}
                                aria-label={`Edit ${user.name}'s allocation`}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              {/* Delete — instant, no confirmation */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                  setConfirmDeleteId(user.id)
                                  setConfirmOpen(true)
                                }}
                                disabled={isRemoving || editingUserId !== null}
                                aria-label={`Remove ${user.name}`}
                                className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                              >
                                {isRemoving ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* ── Edit-mode actions ───────────────────────────────────── */}
      {mode === "edit" && (
        <>
          <Separator />

          {/* ── Add Single User ───────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <UserPlus className="size-3.5" />
              Add User
            </p>

            {isFullyAllocated ? (
              /* Fully-allocated state — add form replaced by a status message */
              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  All 100% allocated. Remove or adjust an existing user to free up
                  allocation.
                </span>
              </div>
            ) : (
              <>
                {addError && <ErrorBanner message={addError} />}

                <div className="flex flex-col sm:flex-row gap-2">
                  <SearchableSelect
                    value={addUserId}
                    onValueChange={(v) => { setAddUserId(v); setAddError(null) }}
                    options={availableUsers.map((u) => ({ value: u.id.toString(), label: u.name }))}
                    placeholder="Select a user"
                    loading={usersLoading}
                    disabled={addSubmitting}
                    emptyMessage="All users already assigned"
                    className="flex-1"
                  />

                  <div className="relative sm:w-36">
                    <Input
                      type="number"
                      min={0.01}
                      max={remaining}
                      step={0.01}
                      placeholder={`Max ${remaining.toFixed(1)}%`}
                      value={addPercentage}
                      onChange={(e) => { setAddPercentage(e.target.value); setAddError(null) }}
                      className="h-10 text-sm pr-8 w-full"
                      disabled={addSubmitting}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddUser() }}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                      %
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddUser}
                    disabled={addSubmitting || !addUserId || !addPercentage}
                    className="shrink-0 h-10"
                  >
                    {addSubmitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    {addSubmitting ? "Adding…" : "Add"}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* ── Bulk Replace (collapsible) ─────────────────────── */}
          <div className="rounded-xl border overflow-hidden">
            <button
              type="button"
              onClick={() => setBulkOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <Users className="size-3.5 shrink-0" />
              <span>Bulk Assign / Replace All</span>
              <span className="ml-1 text-[10px] normal-case font-normal text-muted-foreground/60 hidden sm:inline">
                — replaces every current assignment
              </span>
              {bulkOpen ? (
                <ChevronUp className="size-3.5 ml-auto shrink-0" />
              ) : (
                <ChevronDown className="size-3.5 ml-auto shrink-0" />
              )}
            </button>

            {bulkOpen && (
              <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-muted/20">
                {/* Bulk allocation bar */}
                <AllocationBar value={bulkTotal} />

                {bulkError && <ErrorBanner message={bulkError} />}

                {/* Column labels */}
                <div className="grid grid-cols-[1fr_7rem_2rem] gap-2 px-0.5">
                  <Label className="text-xs text-muted-foreground">User</Label>
                  <Label className="text-xs text-muted-foreground">% Alloc.</Label>
                  <span />
                </div>

                {/* Rows */}
                {bulkRows.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1fr_7rem_2rem] gap-2 items-center"
                  >
                    <SearchableSelect
                      value={row.userId}
                      onValueChange={(v) => updateBulkRow(row.key, "userId", v)}
                      options={allUsers.map((u) => ({ value: u.id.toString(), label: u.name }))}
                      placeholder="Select user"
                      disabled={bulkSubmitting}
                    />

                    <div className="relative">
                      <Input
                        type="number"
                        min={0.01}
                        max={100}
                        step={0.01}
                        placeholder="e.g. 50"
                        value={row.percentage}
                        onChange={(e) => updateBulkRow(row.key, "percentage", e.target.value)}
                        className="h-9 text-sm pr-6"
                        disabled={bulkSubmitting}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                        %
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeBulkRow(row.key)}
                      disabled={bulkRows.length === 1 || bulkSubmitting}
                      className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                      aria-label="Remove row"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}

                {/* Footer actions */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBulkRow}
                    disabled={bulkSubmitting || bulkTotal >= 100}
                  >
                    <Plus className="size-3.5" />
                    Add Row
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleBulkAssign}
                    disabled={bulkSubmitting || bulkTotal > 100}
                  >
                    {bulkSubmitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Users className="size-3.5" />
                    )}
                    {bulkSubmitting ? "Assigning…" : "Assign All"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
