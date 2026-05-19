import { useState, useEffect } from "react"
import { isCancel, AxiosError } from "axios"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Loader2, AlertCircle, Star, CheckCircle2, Users, Settings2 } from "lucide-react"
// API Task type (snake_case fields matching the backend response)
import type { Task, TaskRatingRecord } from "@/app/tasks/types"
// Rating config type from the configurations module
import type { ApiRatingConfig } from "@/app/ratings/configurations/types"
// Service for fetching/creating/updating ratings
import { taskService } from "@/app/tasks/services/taskService"
// Service for fetching active rating configs by type
import { ratingConfigService } from "@/app/ratings/configurations/services/ratingConfigService"
// Auth store to identify the current user for edit-mode detection
import { useAuthStore } from "@/app/(auth)/stores/authStore"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extract a user-friendly message from an Axios or unknown error */
function extractMsg(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { errors?: Record<string, string[]>; message?: string } | undefined
    if (data?.errors) return Object.values(data.errors).flat().join(". ")
    if (data?.message) return data.message
  }
  return fallback
}

/** Returns up to 2 uppercase initials from a name */
function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

/** Formats an ISO date string to a short readable form */
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return iso
  }
}

// ── Component props ────────────────────────────────────────────────────────

type TaskRatingFormProps = {
  task: Task
  /** Called after a successful submit; parent should navigate away */
  onSubmit: () => void
  /** Called when the back/cancel button is clicked */
  onCancel: () => void
}

// ── TaskRatingForm ─────────────────────────────────────────────────────────

export function TaskRatingForm({ task, onSubmit, onCancel }: TaskRatingFormProps) {
  const currentUser = useAuthStore((s) => s.user)
  const [assignedUsers, setAssignedUsers] = useState(task.assigned_users ?? [])
  const [assignedUsersLoading, setAssignedUsersLoading] = useState(false)

  // ── Rating config state ──────────────────────────────────────────
  // Loaded from GET /rating-configs/type/task_rating/active
  const [configs, setConfigs] = useState<ApiRatingConfig[]>([])
  const [configsLoading, setConfigsLoading] = useState(true)
  const [configsError, setConfigsError] = useState<string | null>(null)

  // Which config tab is currently selected (by config ID)
  const [activeConfigId, setActiveConfigId] = useState<number | null>(null)

  // ── Prior ratings state ──────────────────────────────────────────
  // Loaded from GET /tasks/{taskId}/ratings
  const [priorRatings, setPriorRatings] = useState<TaskRatingRecord[]>([])
  const [ratingsLoading, setRatingsLoading] = useState(true)

  // If the current user already rated this task, store the rating ID for the PUT request
  const [existingRatingId, setExistingRatingId] = useState<number | null>(null)

  // ── Score state ──────────────────────────────────────────────────
  // Map of { configId: { fieldName: score } }; keyed per config so tabs are independent
  const [scores, setScores] = useState<Record<number, Record<string, number>>>({})

  // ── Submit state ─────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Effect 0: Load task assignments (some task payloads omit relations) ───
  useEffect(() => {
    let cancelled = false
    setAssignedUsers(task.assigned_users ?? [])
    setAssignedUsersLoading(true)

    taskService.getByIdWithAssignments(task.id)
      .then((loadedTask) => {
        if (!cancelled) {
          setAssignedUsers(loadedTask.assigned_users ?? [])
        }
      })
      .catch(() => {
        // Keep the users from the incoming task payload when this fetch fails.
      })
      .finally(() => {
        if (!cancelled) setAssignedUsersLoading(false)
      })

    return () => { cancelled = true }
  }, [task.id, task.assigned_users])

  // ── Effect 1: Load active task_rating configs ────────────────────
  useEffect(() => {
    let cancelled = false
    setConfigsLoading(true)
    setConfigsError(null)

    ratingConfigService.getActiveByType("task_rating")
      .then(({ configs: loaded }) => {
        if (cancelled) return
        setConfigs(loaded)
        if (loaded.length > 0) {
          // Select the first config by default
          setActiveConfigId(loaded[0].id)
          // Initialize scores to 0 for every field of every config
          const initial: Record<number, Record<string, number>> = {}
          for (const c of loaded) {
            initial[c.id] = {}
            for (const field of c.config_data.fields ?? []) {
              initial[c.id][field.name] = 0
            }
          }
          setScores(initial)
        }
      })
      .catch((err) => {
        // Ignore request cancellations (e.g. rapid navigation)
        if (!isCancel(err) && !cancelled) {
          setConfigsError(extractMsg(err, "Failed to load rating configurations."))
        }
      })
      .finally(() => { if (!cancelled) setConfigsLoading(false) })

    return () => { cancelled = true }
  }, [])

  // ── Effect 2: Load prior ratings for this task ───────────────────
  useEffect(() => {
    let cancelled = false
    setRatingsLoading(true)

    taskService.getRatingsByTask(task.id)
      .then((res) => {
        if (cancelled) return
        setPriorRatings(res.data)
        // Check if the current user has already submitted a rating
        if (currentUser) {
          const mine = res.data.find((r) => r.rater_id === currentUser.id)
          if (mine) {
            setExistingRatingId(mine.id)
            // Pre-fill scores from the existing rating_data into the first config
            // (we use the first available config since the tab selection is already set)
            setScores((prev) => {
              const firstId = Object.keys(prev)[0]
              if (!firstId) return prev
              return { ...prev, [Number(firstId)]: mine.rating_data }
            })
          }
        }
      })
      .catch(() => {
        // Silently ignore prior-ratings load errors; the form still works without them
      })
      .finally(() => { if (!cancelled) setRatingsLoading(false) })

    return () => { cancelled = true }
  }, [task.id, currentUser])

  // ── Derived values for the active config ────────────────────────
  const currentConfig = configs.find((c) => c.id === activeConfigId)
  const currentFields = currentConfig?.config_data.fields ?? []
  const currentScores = activeConfigId !== null ? (scores[activeConfigId] ?? {}) : {}

  // Sum of scores / max possible score → percentage display
  const totalPoints = Object.values(currentScores).reduce((sum, v) => sum + v, 0)
  const maxPoints = currentFields.reduce((sum, f) => sum + f.max_value, 0)
  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0

  // ── Handlers ────────────────────────────────────────────────────

  /** Update a single field's score within the active config */
  function handleScoreChange(fieldName: string, value: number) {
    if (activeConfigId === null) return
    setScores((prev) => ({
      ...prev,
      [activeConfigId]: { ...prev[activeConfigId], [fieldName]: value },
    }))
  }

  /** Submit the rating via POST (create) or PUT (update) */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentConfig || activeConfigId === null) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      if (existingRatingId !== null) {
        // User already rated → update the existing record via PUT /task-ratings/{id}
        await taskService.updateTaskRating(existingRatingId, {
          rating_config_id: currentConfig.id,
          rating_data: currentScores,
        })
      } else {
        // First-time rating → create a new record via POST /task-ratings
        await taskService.createTaskRating({
          task_id: task.id,
          rating_config_id: currentConfig.id,
          rating_data: currentScores,
        })
      }
      // Success — let the parent page handle navigation
      onSubmit()
    } catch (err) {
      if (!isCancel(err)) {
        setSubmitError(extractMsg(err, "Failed to submit rating. Please try again."))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state for configs ────────────────────────────────────
  if (configsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  // ── Error state for configs ──────────────────────────────────────
  if (configsError) {
    return (
      <div className="flex w-full justify-center p-4 md:p-8">
        <div className="w-full max-w-6xl">
          <Button variant="ghost" size="icon-lg" onClick={onCancel} className="mb-4">
            <ArrowLeft />
          </Button>
          <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span className="text-sm">{configsError}</span>
          </div>
        </div>
      </div>
    )
  }

  // ── No active configs ────────────────────────────────────────────
  if (configs.length === 0) {
    return (
      <div className="flex w-full justify-center p-4 md:p-8">
        <div className="w-full max-w-6xl">
          <Button variant="ghost" size="icon-lg" onClick={onCancel} className="mb-4">
            <ArrowLeft />
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="font-medium">No active rating configurations</p>
              <p className="text-sm text-muted-foreground">
                Please create and activate a <strong>task_rating</strong> config first.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────
  return (
    <div className="flex w-full justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl space-y-8">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-lg" onClick={onCancel}>
            <ArrowLeft />
          </Button>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
              Rate Task — {task.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {existingRatingId
                ? "Update your previous rating for this task."
                : "Evaluate this task using the criteria below."}
            </p>
          </div>
          {/* Task weight shown as a contextual stat */}
          <div className="hidden md:flex items-center gap-3 bg-muted/50 p-4 rounded-xl shrink-0">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Weight
              </span>
              <span className="text-2xl font-bold text-primary">{task.weight}</span>
            </div>
          </div>
        </div>

        {/* ── 2-Column Layout ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── Left: Rating Form ──────────────────────────────── */}
          <div className="lg:col-span-8 space-y-6">

            {/* Config selector — compact row that scales to any number of configs */}
            <div className="rounded-2xl border border-border/20 bg-muted/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <Settings2 className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-0.5">
                    Rating Configuration
                  </p>
                  {currentConfig?.description ? (
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      {currentConfig.description}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {configs.length} config{configs.length !== 1 ? "s" : ""} available
                    </p>
                  )}
                </div>
              </div>

              <Select
                value={activeConfigId !== null ? String(activeConfigId) : ""}
                onValueChange={(v) => setActiveConfigId(Number(v))}
              >
                <SelectTrigger className="w-full sm:w-56 h-9 rounded-xl border-border/30 bg-background/60 text-sm font-semibold shrink-0">
                  <SelectValue placeholder="Select a config…" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((config) => (
                    <SelectItem key={config.id} value={String(config.id)}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-6 md:p-8 space-y-8">
                <h3 className="text-xl font-bold tracking-tight border-l-4 border-primary pl-4">
                  {currentConfig?.name}
                  {currentConfig?.description && (
                    <span className="block text-xs font-normal text-muted-foreground mt-1">
                      {currentConfig.description}
                    </span>
                  )}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Submit error displayed inline above the action buttons */}
                  {submitError && (
                    <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                      <AlertCircle className="size-4 mt-0.5 shrink-0" />
                      <span className="text-sm">{submitError}</span>
                    </div>
                  )}

                  {/* Criteria sliders — one per field in the active config */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                    {currentFields.map((field) => (
                      <div key={field.id} className="space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">{field.name}</Label>
                            {field.description && (
                              <p className="text-xs text-muted-foreground">{field.description}</p>
                            )}
                          </div>
                          <span className="text-lg font-bold text-primary">
                            {currentScores[field.name] ?? 0}
                            <span className="text-xs text-muted-foreground ml-1">
                              /{field.max_value}
                            </span>
                          </span>
                        </div>
                        {/* Range slider capped at field.max_value */}
                        <input
                          type="range"
                          min={0}
                          max={field.max_value}
                          value={currentScores[field.name] ?? 0}
                          onChange={(e) => handleScoreChange(field.name, Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Total score summary + submit button */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                        Cumulative Score
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold tracking-tight">{percentage}%</span>
                        <span className="text-muted-foreground text-sm">
                          {totalPoints} / {maxPoints} pts
                        </span>
                      </div>
                    </div>
                    <Button type="submit" size="lg" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Submitting...
                        </>
                      ) : existingRatingId ? (
                        <>
                          <CheckCircle2 className="size-4" />
                          Update Rating
                        </>
                      ) : (
                        <>
                          <Star className="size-4" />
                          Submit Rating
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ── Right: Previous Ratings Sidebar ───────────────── */}
          <aside className="lg:col-span-4 space-y-6">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="w-4 h-px bg-primary" />
              Assigned Users
            </h4>

            {assignedUsersLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!assignedUsersLoading && assignedUsers.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No users assigned to this task</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {assignedUsers.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} />
                          <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          <Users className="mr-1 size-3" />
                          {user.pivot?.percentage ?? 0}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="w-4 h-px bg-primary" />
              Previous Ratings
            </h4>

            {/* Loading indicator while prior ratings are being fetched */}
            {ratingsLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty state when no prior ratings exist */}
            {!ratingsLoading && priorRatings.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No previous ratings</p>
                </CardContent>
              </Card>
            )}

            {/* List of prior rating cards — each shows rater, score, and date */}
            {!ratingsLoading && priorRatings.map((rating) => (
              <Card
                key={rating.id}
                className={rating.rater_id === currentUser?.id ? "border-primary/40 bg-primary/5" : ""}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Rater info row */}
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarImage src={rating.rater.avatar_url ?? undefined} alt={rating.rater.name} />
                      <AvatarFallback className="text-[9px]">{getInitials(rating.rater.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{rating.rater.name}</p>
                      {rating.rated_at && (
                        <p className="text-[10px] text-muted-foreground">{formatDate(rating.rated_at)}</p>
                      )}
                    </div>
                    {/* Final rating score badge */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-bold">
                        {Number(rating.final_rating).toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Field-level breakdown from rating_data */}
                  {Object.entries(rating.rating_data).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(rating.rating_data).map(([field, score]) => (
                        <div key={field} className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground truncate mr-2">{field}</span>
                          <span className="font-semibold shrink-0">{score}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Badge to highlight the current user's own rating */}
                  {rating.rater_id === currentUser?.id && (
                    <Badge variant="secondary" className="text-[10px] w-full justify-center">
                      Your Rating
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Contextual insight card about the task's weight */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Quality Insights</Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Weight <span className="font-bold text-foreground">{task.weight}</span> puts this
                  task in the{" "}
                  <span className="font-bold text-primary">
                    Top {task.weight > 70 ? "5%" : task.weight > 50 ? "20%" : "50%"}
                  </span>{" "}
                  of critical deliverables for{" "}
                  {task.section?.project?.name
                    ? <span className="font-medium">{task.section.project.name}</span>
                    : "this project"}.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}

