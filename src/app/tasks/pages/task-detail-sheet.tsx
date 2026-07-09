import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HtmlContent } from "@/components/ui/html-content"
import { Pencil, Star, CheckCircle2, Circle } from "lucide-react"
import { useAuthStore } from "@/app/(auth)/stores/authStore"
import { useUpdateTaskStatus } from "@/app/tasks/hooks/useUpdateTaskStatus"
// Use the API-aligned Task type (not the mock from data.ts)
import type { Task, TaskStatus } from "@/app/tasks/types"

type TaskDetailSheetProps = {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (task: Task) => void
  onRate?: (task: Task) => void
  /** Called with the updated task after a status change so the parent can refresh its list */
  onStatusChanged?: (updated: Task) => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

// Status labels and variants aligned with the API enum values
const statusLabel: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  rated: "Rated",
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  in_progress: "default",
  done: "secondary",
  rated: "secondary",
}

const priorityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "outline",
  low: "secondary",
}

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onEdit,
  onRate,
  onStatusChanged,
}: TaskDetailSheetProps) {
  const currentUserId = useAuthStore((s) => s.user?.id) ?? null
  const { updateTaskStatus, updating } = useUpdateTaskStatus()

  if (!task) return null

  const isAssignee =
    currentUserId != null && task.assigned_users.some((u) => u.id === currentUserId)
  const canChangeStatus = isAssignee && task.status !== "rated"

  async function handleStatusChange(status: TaskStatus) {
    const updated = await updateTaskStatus(task!.id, status)
    if (updated) onStatusChanged?.(updated)
  }

  // Count completed subtasks using the API field is_complete
  const completedSubtasks = task.subtasks.filter((s) => s.is_complete).length
  const totalSubtasks = task.subtasks.length
  const progress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0
  // Resolve display names from relationships
  const projectName = task.section?.project?.name ?? "—"
  const sectionName = task.section?.name ?? "—"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="data-[side=right]:sm:max-w-full overflow-y-auto themed-scrollbar">
        <SheetHeader className="gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={priorityVariant[task.priority] ?? "outline"} className="capitalize">
              {task.priority} Priority
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">#{task.id}</span>
            <Badge variant="secondary">{projectName}</Badge>
          </div>
          <SheetTitle className="text-2xl">{task.name}</SheetTitle>
          <SheetDescription className="sr-only">Task details for {task.name}</SheetDescription>
        </SheetHeader>

        <div className="px-8 pb-10 space-y-8">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Status
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full shrink-0 ${
                    task.status === "in_progress"
                      ? "bg-primary animate-pulse"
                      : task.status === "done" || task.status === "rated"
                        ? "bg-green-500"
                        : "bg-muted-foreground"
                  }`}
                />
                <Badge variant={statusVariant[task.status] ?? "outline"}>
                  {statusLabel[task.status] ?? task.status}
                </Badge>
              </div>
              {/* Assignees can change status to any non-rated value */}
              {canChangeStatus && (
                <div className="mt-2">
                  <Select
                    value={task.status}
                    onValueChange={(v) => handleStatusChange(v as TaskStatus)}
                    disabled={updating}
                  >
                    <SelectTrigger className="h-7 w-full text-xs">
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
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Due Date
              </p>
              <p className="text-sm font-medium">{task.due_date}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Weight
              </p>
              <p className="text-sm font-medium">{task.weight}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Section
              </p>
              <p className="text-sm font-medium">{sectionName}</p>
            </div>
          </div>

          {/* Assignees */}
          <section>
            <h4 className="text-sm font-semibold mb-3">Assignees</h4>
            <div className="flex flex-wrap gap-3">
              {task.assigned_users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 rounded-full bg-muted/50 pr-3 pl-1 py-1"
                >
                  <Avatar className="size-6">
                    <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{user.name}</span>
                  {/* Show the assignment percentage if available */}
                  {user.pivot?.percentage !== undefined && (
                    <span className="text-xs text-muted-foreground">{user.pivot.percentage}%</span>
                  )}
                </div>
              ))}
              {task.assigned_users.length === 0 && (
                <p className="text-sm text-muted-foreground">No assignees</p>
              )}
            </div>
          </section>

          <Separator />

          {/* Description */}
          <section>
            <h4 className="text-sm font-semibold mb-3">Description</h4>
            <HtmlContent
              html={task.description}
              className="text-sm text-muted-foreground leading-relaxed"
              emptyFallback={<p className="text-sm text-muted-foreground">No description</p>}
            />
          </section>

          <Separator />

          {/* Subtasks */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Subtasks Progress</h4>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            {totalSubtasks > 0 && (
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            <div className="space-y-2">
              {task.subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    subtask.is_complete
                      ? "bg-muted/30"
                      : "bg-muted/50 border-l-2 border-primary"
                  }`}
                >
                  {subtask.is_complete ? (
                    <CheckCircle2 className="size-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={`text-sm ${
                      subtask.is_complete
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    }`}
                  >
                    {subtask.name}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Latest final rating (0–100 score from the API) */}
          {task.latest_final_rating !== null && (
            <>
              <Separator />
              <section>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Star className="size-5 fill-primary text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Latest Rating
                      </p>
                      <p className="text-sm font-bold">
                        {task.latest_final_rating >= 80
                          ? "Excellent"
                          : task.latest_final_rating >= 60
                            ? "Good"
                            : task.latest_final_rating >= 40
                              ? "Fair"
                              : "Needs Improvement"}
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    {task.latest_final_rating.toFixed(1)}
                    <span className="text-xs text-muted-foreground font-normal ml-1">/ 100</span>
                  </span>
                </div>
              </section>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-3">
            {onRate && (
              <Button variant="outline" size="lg" className="flex-1" onClick={() => onRate(task)}>
                <Star className="size-4" />
                Rate Task
              </Button>
            )}
            {onEdit && (
              <Button variant="secondary" size="lg" className="flex-1" onClick={() => onEdit(task)}>
                <Pencil className="size-4" />
                Edit Task
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
