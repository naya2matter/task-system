import { useNavigate } from "react-router"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, Calendar, CheckCircle2, Plus } from "lucide-react"
import type { WorkspaceTodo, TodoStatus } from "../types"
import { TODO_STATUS_LABELS } from "../types"

// Returns badge class names based on the todo status
function statusClassName(status: TodoStatus): string {
  switch (status) {
    case "pending":
      return "border-muted-foreground/30 text-muted-foreground"
    case "inprogress":
      return "border-primary/40 text-primary bg-primary/10"
    case "completed":
      return "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
  }
}

type Props = {
  // Top-level todos with nested subtodos from the API
  todos: WorkspaceTodo[]
  workspaceId: number
  onDelete: (todo: WorkspaceTodo) => void
}

export function WorkspaceTodosTable({ todos, workspaceId, onDelete }: Props) {
  const navigate = useNavigate()

  // Empty state — prompt user to create their first todo
  if (todos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">No todos in this workspace yet.</p>
        <Button
          variant="outline"
          onClick={() => navigate(`/workspaces/${workspaceId}/todos/create`)}
        >
          <Plus className="size-4" />
          Create your first todo
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Iterate over top-level todos (API returns them with subtodos nested) */}
          {todos.map((todo) => (
            <>
              {/* Parent todo row */}
              <TableRow
                key={todo.id}
                className={`group cursor-pointer ${todo.status === "completed" ? "opacity-60" : ""}`}
                onClick={() => navigate(`/workspaces/${workspaceId}/todos/${todo.id}`)}
              >
                <TableCell>
                  <span className={`font-semibold ${todo.status === "completed" ? "line-through" : ""}`}>
                    {todo.title}
                  </span>
                </TableCell>
                <TableCell>
                  {todo.due_date ? (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      {todo.status === "completed" ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                      ) : (
                        <Calendar className="size-3.5" />
                      )}
                      {new Date(todo.due_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">No date</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={statusClassName(todo.status)}>
                    {TODO_STATUS_LABELS[todo.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/workspaces/${workspaceId}/todos/${todo.id}`)}>
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/workspaces/${workspaceId}/todos/${todo.id}/edit`)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(todo)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>

              {/* Subtask rows — indented under the parent */}
              {todo.subtodos?.map((sub) => (
                <>
                <TableRow
                  key={sub.id}
                  className="cursor-pointer bg-muted/30 hover:bg-muted/50"
                  onClick={() => navigate(`/workspaces/${workspaceId}/todos/${sub.id}`)}
                >
                  <TableCell>
                    <div className="flex flex-col gap-0.5 pl-6">
                      <span className={`text-sm font-medium text-muted-foreground ${sub.status === "completed" ? "line-through" : ""}`}>
                        {sub.title}
                      </span>
                      <span className="text-[0.65rem] text-muted-foreground/60 italic">
                        Subtask of {todo.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {sub.due_date ? (
                      <span className="text-xs text-muted-foreground/80">
                        {new Date(sub.due_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`text-[0.6rem] ${statusClassName(sub.status)}`}>
                      {TODO_STATUS_LABELS[sub.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/workspaces/${workspaceId}/todos/${sub.id}`)}>
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/workspaces/${workspaceId}/todos/${sub.id}/edit`)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(sub)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>

                {/* Sub-subtask rows — doubly indented */}
                {sub.subtodos?.map((subsub) => (
                  <TableRow
                    key={subsub.id}
                    className="cursor-pointer bg-muted/50 hover:bg-muted/70"
                    onClick={() => navigate(`/workspaces/${workspaceId}/todos/${subsub.id}`)}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5 pl-12">
                        <span className={`text-xs font-medium text-muted-foreground/80 ${subsub.status === "completed" ? "line-through" : ""}`}>
                          {subsub.title}
                        </span>
                        <span className="text-[0.6rem] text-muted-foreground/50 italic">
                          Subtask of {sub.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {subsub.due_date ? (
                        <span className="text-xs text-muted-foreground/60">
                          {new Date(subsub.due_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-[0.55rem] ${statusClassName(subsub.status)}`}>
                        {TODO_STATUS_LABELS[subsub.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-6">
                            <MoreVertical className="size-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/workspaces/${workspaceId}/todos/${subsub.id}`)}>
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/workspaces/${workspaceId}/todos/${subsub.id}/edit`)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(subsub)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                </>
              ))}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
