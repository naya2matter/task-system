import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Trash2, Star, Calendar, CheckSquare, Eye, CheckCircle2 } from "lucide-react"
import { useTilt } from "@/hooks/use-tilt"
// Use the API-aligned Task type (not the mock from data.ts)
import type { Task } from "@/app/tasks/types"

type TaskCardProps = {
  task: Task
  /** Navigate to the task detail page */
  onSelect: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onRate: (task: Task) => void
  /** Mark the task complete (status → done); shown to assigned developers */
  onMarkComplete: (task: Task) => void
  canEdit: boolean
  canDelete: boolean
  canRate: boolean
  /** Logged-in user's id — used to detect tasks assigned to the current developer */
  currentUserId: number | null
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

// ─── Rating Column (Matches Table View)
function RatingBadge({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs text-muted-foreground">-</span>

  const colorClass =
    rating >= 75
      ? "text-green-600 dark:text-green-400"
      : rating >= 50
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-500"

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${colorClass}`}>
      <Star className="size-3 fill-current" />
      {Number(rating).toFixed(1)}
    </span>
  )
}

// ─── Subtasks Progress (Matches Table View)
function SubtasksProgress({
  completed,
  total,
}: {
  completed: number
  total: number
}) {
  if (total === 0) {
    return <span className="text-xs text-muted-foreground">-</span>
  }

  const pct = Math.round((completed / total) * 100)

  const barColor =
    completed === total
      ? "bg-green-500"
      : completed > 0
        ? "bg-primary"
        : "bg-muted-foreground/30"

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckSquare className="size-3" />
          Subtasks
        </span>
        <span
          className={`text-xs font-semibold ${
            completed === total
              ? "text-green-600 dark:text-green-400"
              : completed > 0
                ? "text-primary"
                : "text-muted-foreground"
          }`}
        >
          {completed}/{total}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function TaskCard({ task, onSelect, onEdit, onDelete, onRate, onMarkComplete, canEdit, canDelete, canRate, currentUserId }: TaskCardProps) {
  const { ref, style } = useTilt<HTMLDivElement>({ maxTilt: 5, scale: 1.015 })

  // Count completed subtasks using the API field is_complete
  const completedSubtasks = task.subtasks.filter((s) => s.is_complete).length
  const totalSubtasks = task.subtasks.length

  // Resolve project name from the nested section.project relationship
  const projectName = task.section?.project?.name ?? "-"

  // A developer can mark a task complete when it's assigned to them and it isn't
  // already done or rated.
  const isAssignee =
    currentUserId != null && task.assigned_users.some((u) => u.id === currentUserId)
  const canComplete = isAssignee && task.status !== "done" && task.status !== "rated"

  return (
    <Card ref={ref} style={style} className="flex flex-col group">
      <CardContent className="flex flex-col gap-4 pt-4 px-4 flex-1">
        {/* Header: Status + Priority + Actions */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariant[task.status] ?? "outline"} className="text-[10px] whitespace-nowrap">
              {statusLabel[task.status] ?? task.status}
            </Badge>
            <Badge variant={priorityVariant[task.priority] ?? "outline"} className="text-[10px] capitalize">
              {task.priority}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
          {/* Quick "mark complete" — shown to assignees on unfinished tasks */}
          {canComplete && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-green-600 hover:text-green-700 hover:bg-green-500/10 dark:text-green-400"
              title="Mark complete"
              aria-label="Mark complete"
              onClick={() => onMarkComplete(task)}
            >
              <CheckCircle2 className="size-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSelect(task)}>
                <Eye className="size-4" />
                View Details
              </DropdownMenuItem>
              {canComplete && (
                <DropdownMenuItem onClick={() => onMarkComplete(task)}>
                  <CheckCircle2 className="size-4" />
                  Mark Complete
                </DropdownMenuItem>
              )}
              {canRate && (
                <DropdownMenuItem onClick={() => onRate(task)}>
                  <Star className="size-4" />
                  Rate
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {/* Title + Project */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            className="text-lg font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors text-left leading-tight line-clamp-2"
            onClick={() => onSelect(task)}
          >
            {task.name}
          </button>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground font-mono">#{task.id}</span>
            <Badge variant="secondary" className="text-[10px] max-w-[120px] truncate">
              {projectName}
            </Badge>
          </div>
        </div>

        {/* Subtasks Progress */}
        <div className="py-1">
          <SubtasksProgress completed={completedSubtasks} total={totalSubtasks} />
        </div>

        {/* Members + Date + Rating */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="flex flex-col gap-2">
            <div className="flex -space-x-2">
              {task.assigned_users.slice(0, 3).map((user) => (
                <Avatar key={user.id} className="size-7 border-2 border-card">
                  <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} />
                  <AvatarFallback className="text-[9px]">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
              ))}
              {task.assigned_users.length > 3 && (
                <div className="size-7 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                  +{task.assigned_users.length - 3}
                </div>
              )}
              {task.assigned_users.length === 0 && (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </div>
            {task.due_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono whitespace-nowrap">
                <Calendar className="size-3" />
                {task.due_date}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
             <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Rating</span>
                <RatingBadge rating={task.latest_final_rating} />
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
