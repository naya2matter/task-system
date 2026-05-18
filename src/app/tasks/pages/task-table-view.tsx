import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TruncatedText } from "@/components/ui/truncated-text"
import { MoreHorizontal, Star, Pencil, Trash2, Eye, CheckSquare } from "lucide-react"
// Use the API-aligned Task type (not the mock from data.ts)
import type { Task } from "@/app/tasks/types"

type TaskTableViewProps = {
  tasks: Task[]
  /** Navigate to the task detail page */
  onSelect: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onRate: (task: Task) => void
  canEdit: boolean
  canDelete: boolean
  canRate: boolean
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

// Status display labels matching the API enum values
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

// â”€â”€â”€ Rating Column
// Shows the latest_final_rating (0â€“100) from GET /tasks/{taskId}/ratings.
// The task's latest_final_rating field already contains the most recent final score.
function RatingBadge({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs text-muted-foreground">-</span>

  // Pick a colour based on the score (green â‰¥ 75, yellow â‰¥ 50, red < 50)
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

// â”€â”€â”€ Subtasks Progress Column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Visualises subtask completion from the task.subtasks embedded array
// (the same data that GET /tasks/{taskId}/subtasks returns per task).
// Shows a compact progress bar + fraction count so the column stays narrow.
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

  // Colour the bar based on completion: green = done, blue = in-progress
  const barColor =
    completed === total
      ? "bg-green-500"
      : completed > 0
        ? "bg-primary"
        : "bg-muted-foreground/30"

  return (
    <div className="flex flex-col gap-1 min-w-15">
      {/* Fraction label */}
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
      {/* Mini progress bar */}
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function TaskTableView({ tasks, onSelect, onEdit, onDelete, onRate, canEdit, canDelete, canRate }: TaskTableViewProps) {
  return (
    <div className="w-full">
      <Table scrollable={false} className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            {/* Always visible */}
            <TableHead className="min-w-40">Task</TableHead>
            <TableHead>Status</TableHead>

            {/* Hidden on xs, visible from sm up */}
            <TableHead className="hidden sm:table-cell">Priority</TableHead>

            {/* Hidden on xs+sm, visible from md up */}
            <TableHead className="hidden md:table-cell">Assignees</TableHead>

            {/* Hidden below lg */}
            <TableHead className="hidden lg:table-cell">Project</TableHead>

            {/* Rating column â€” always visible; data from task.latest_final_rating
                (sourced from GET /tasks/{taskId}/ratings aggregation on the backend) */}
            <TableHead>Rating</TableHead>

            {/* Hidden on xs, visible from sm up */}
            <TableHead className="hidden sm:table-cell">Due Date</TableHead>

            {/* Subtasks column â€” always visible; data from task.subtasks array
                (mirrors what GET /tasks/{taskId}/subtasks returns for each task) */}
            <TableHead>
              <span className="flex items-center gap-1">
                <CheckSquare className="size-3 text-muted-foreground" />
                Subtasks
              </span>
            </TableHead>

            {/* Actions â€” always visible */}
            <TableHead className="text-right w-10">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            // Subtask completion data already embedded in the task response
            const completedSubtasks = task.subtasks.filter((s) => s.is_complete).length
            const totalSubtasks = task.subtasks.length

            // Project name resolved from section â†’ project relationship
            const projectName = task.section?.project?.name ?? "-"

            return (
              <TableRow key={task.id} className="group">
                {/*  Task name + ID  */}
                <TableCell className="py-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      className="font-medium text-foreground text-sm hover:text-primary hover:underline underline-offset-2 transition-colors text-left"
                      onClick={() => onSelect(task)}
                    >
                      <TruncatedText
                        value={task.name}
                        className="max-w-42.5 sm:max-w-60 lg:max-w-80"
                      />
                    </button>
                    <span className="text-xs text-muted-foreground font-mono">#{task.id}</span>
                  </div>
                </TableCell>

                {/*  Status badge  */}
                <TableCell className="py-3">
                  <Badge variant={statusVariant[task.status] ?? "outline"} className="whitespace-nowrap text-xs">
                    {statusLabel[task.status] ?? task.status}
                  </Badge>
                </TableCell>

                {/*  Priority badge â€” hidden on mobile  */}
                <TableCell className="hidden sm:table-cell py-3">
                  <Badge variant={priorityVariant[task.priority] ?? "outline"} className="capitalize text-xs">
                    {task.priority}
                  </Badge>
                </TableCell>

                {/*  Stacked avatars â€” hidden on mobile/tablet  */}
                <TableCell className="hidden md:table-cell py-3">
                  <div className="flex -space-x-2">
                    {task.assigned_users.slice(0, 3).map((user) => (
                      <Avatar key={user.id} className="size-7 border-2 border-card">
                        <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} />
                        <AvatarFallback className="text-[9px]">
                          {getInitials(user.name)}
                        </AvatarFallback>
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
                </TableCell>

                {/*  Project badge â€” hidden below lg  */}
                <TableCell className="hidden lg:table-cell py-3">
                  <div className="max-w-45 overflow-hidden">
                    <Badge variant="secondary" className="text-xs block text-left">
                      <TruncatedText
                        value={projectName}
                        className="max-w-30 xl:max-w-42.5"
                      />
                    </Badge>
                  </div>
                </TableCell>

                {/*  Rating â€” from task.latest_final_rating
                      (reflects the aggregated value from GET /tasks/{taskId}/ratings)  */}
                <TableCell className="py-3">
                  <RatingBadge rating={task.latest_final_rating} />
                </TableCell>

                {/*  Due date â€” hidden on mobile  */}
                <TableCell className="hidden sm:table-cell text-muted-foreground py-3 text-xs font-mono whitespace-nowrap">
                  {task.due_date}
                </TableCell>

                {/*  Subtasks progress bar
                      Data comes from task.subtasks (same data as GET /tasks/{taskId}/subtasks)  */}
                <TableCell className="py-3">
                  <SubtasksProgress completed={completedSubtasks} total={totalSubtasks} />
                </TableCell>

                {/*  Actions dropdown  */}
                <TableCell className="text-right py-3">
                  {(canEdit || canDelete || canRate) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelect(task)}>
                        <Eye className="size-4" />
                        View Details
                      </DropdownMenuItem>
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
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

