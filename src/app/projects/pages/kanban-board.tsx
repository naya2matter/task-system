import { useState, useCallback, memo } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router"
import { isCancel } from "axios"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/usePermissions"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, Calendar, CheckSquare, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { KanbanData, KanbanTask, KanbanSectionData } from "../types"
import { projectService } from "../services/projectService"
import { taskService } from "@/app/tasks/services/taskService"
import { useDeleteTask } from "@/app/tasks/hooks/useDeleteTask"
import { ConfirmDeleteTaskDialog } from "@/app/tasks/pages/confirm-delete-task-dialog"
import type { Task } from "@/app/tasks/types"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  MeasuringStrategy,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// ── Helper types for internal board state ─────────────────────────

/** A column in the board (one per status per section) */
type BoardColumn = {
  id: string
  status: string
  title: string
  color: string
  tasks: KanbanTask[]
}

/** A visual section grouping columns */
type BoardSection = {
  id: string
  title: string
  columns: BoardColumn[]
}

// ── Props for the board ───────────────────────────────────────────

type KanbanBoardProps = {
  kanban: KanbanData
  onBack: () => void
}

// ── Helpers ───────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/** Map status keys to display labels and colors */
const statusConfig: Record<string, { title: string; color: string }> = {
  pending:     { title: "Pending",     color: "bg-amber-500/50" },
  in_progress: { title: "In Progress", color: "bg-blue-500/50" },
  done:        { title: "Done",        color: "bg-emerald-500/50" },
  rated:       { title: "Rated",       color: "bg-fuchsia-500/50" },
}

/** Map priority to badge style */
const priorityConfig: Record<string, { label: string; className: string }> = {
  critical: { label: "Critical",      className: "bg-red-600/10 text-red-400" },
  high:     { label: "High Priority", className: "bg-destructive/10 text-destructive" },
  medium:   { label: "Med Priority",  className: "bg-blue-500/10 text-blue-400" },
  low:      { label: "Low Priority",  className: "bg-green-500/10 text-green-400" },
}

/** Build the internal board sections from the API response */
function buildBoardSections(sections: KanbanSectionData[]): BoardSection[] {
  return sections.map((s) => {
    const statuses = ["pending", "in_progress", "done", "rated"] as const

    const columns: BoardColumn[] = statuses.map((status) => {
      const config = statusConfig[status]
      return {
        // Unique id combining section + status so columns don't collide across sections
        id: `col-${s.section.id}-${status}`,
        status,
        title: config.title,
        color: config.color,
        tasks: s.tasks_by_status[status] ?? [],
      }
    })

    return {
      id: `section-${s.section.id}`,
      title: s.section.name,
      columns,
    }
  })
}

/** Format a date string like "2025-12-31" to a short label */
function formatDueLabel(dateStr: string | null): string {
  if (!dateStr) return "No date"
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── Sortable Task Card ────────────────────────────────────────────

// Memoized so re-renders only occur when the task data changes,
// not on every pointer move during a sibling card's drag.
const SortableTaskCard = memo(function SortableTaskCard({
  task,
  onEditTask,
  onDeleteTask,
  isDeleting,
}: {
  task: KanbanTask
  onEditTask?: (task: KanbanTask) => void
  onDeleteTask?: (task: KanbanTask) => void
  isDeleting?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(task.id) })

  const style: React.CSSProperties = {
    // CSS.Translate (not CSS.Transform) omits the scale components dnd-kit
    // occasionally injects, which would otherwise shift the card away from
    // the grab point when picking up from the left edge.
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="w-full touch-none select-none"
      aria-label={`Task: ${task.name}. Press Space or Enter to drag.`}
      role="listitem"
    >
      {/* When dragging, keep the same element in the DOM (preserving layout
          height for dnd-kit measurement) but hide it visually so only the
          DragOverlay card is visible — no duplicate ghost. */}
      <div className={isDragging ? "invisible" : undefined}>
        <TaskCardInner
          task={task}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  )
})

/** Renders the visual content of a task card — memoized for performance. */
const TaskCardInner = memo(function TaskCardInner({
  task,
  isOverlay = false,
  onEditTask,
  onDeleteTask,
  isDeleting = false,
}: {
  task: KanbanTask
  isOverlay?: boolean
  onEditTask?: (task: KanbanTask) => void
  onDeleteTask?: (task: KanbanTask) => void
  isDeleting?: boolean
}) {
  const config = priorityConfig[task.priority] ?? priorityConfig.medium
  const isHighPriority = task.priority === "high" || task.priority === "critical"
  const subtasksDone = task.subtasks.filter((st) => st.is_complete).length
  const subtasksTotal = task.subtasks.length
  const assignee = task.assigned_users[0]

  return (
    <Card
      className={cn(
        "w-full p-4 border-l-2",
        "transition-colors duration-150",
        "hover:bg-card/80 hover:shadow-md",
        isHighPriority
          ? "border-l-destructive/50 hover:border-l-destructive"
          : "border-l-primary/40 hover:border-l-primary",
      )}
      // Overlay styles are applied via inline style (not Tailwind scale classes)
      // so the Card's intrinsic size remains exactly `activeTaskWidth` — the
      // same rect dnd-kit measured on drag start. This prevents any visual
      // offset between the cursor grab point and the floating card position.
      style={isOverlay ? {
        cursor: "grabbing",
        transform: "scale(1.025) rotate(0.4deg)",
        transformOrigin: "top left",
        boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px hsl(var(--primary) / 0.4)",
        background: "hsl(var(--card) / 0.97)",
        backdropFilter: "blur(12px)",
        willChange: "transform",
      } : {
        cursor: "grab",
      }}
    >
      {/* Priority badge + subtask counter */}
      <div className="flex items-start justify-between mb-2">
        <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider", config.className)}>
          {config.label}
        </span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {subtasksTotal > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="text-[10px] font-medium">
                {subtasksDone} / {subtasksTotal}
              </span>
              <CheckSquare className="size-3" />
            </div>
          )}
          {!isOverlay && onDeleteTask && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                {onEditTask && (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      onEditTask(task)
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Edit Task
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isDeleting}
                  onSelect={(e) => {
                    e.preventDefault()
                    onDeleteTask(task)
                  }}
                >
                  {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  {isDeleting ? "Deleting..." : "Delete Task"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Task name */}
      <h4 className="text-sm font-semibold text-foreground leading-tight mb-4">
        {task.name}
      </h4>

      {/* Due date + assignee avatar */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary/80">
          <Calendar className="size-3" />
          {formatDueLabel(task.due_date)}
        </div>
        {assignee && (
          <Avatar className="size-6">
            <AvatarImage src={assignee.avatar_url ?? undefined} alt={assignee.name} />
            <AvatarFallback className="text-[8px]">{getInitials(assignee.name)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </Card>
  )
})

// ── Kanban Column ─────────────────────────────────────────────────

/** Renders a single status column with a droppable area */
function KanbanColumnView({
  column,
  isOver,
  onEditTask,
  onDeleteTask,
  deletingTaskId,
}: {
  column: BoardColumn
  isOver?: boolean
  onEditTask?: (task: KanbanTask) => void
  onDeleteTask?: (task: KanbanTask) => void
  deletingTaskId: number | null
}) {
  const { setNodeRef: setDroppableRef, isOver: isDroppableOver } = useDroppable({ id: column.id })

  const showOver = Boolean(isOver || isDroppableOver)

  return (
    <div
      ref={setDroppableRef}
      className={cn(
        "flex flex-col min-w-[280px] max-w-[320px] w-full bg-card/50 rounded-xl border transition-all duration-200",
        showOver ? "ring-2 ring-primary border-primary/50 shadow-lg bg-card/80 scale-[1.01]" : "border-border/50",
      )}
    >
      {/* Column header */}
      <div className="p-4 flex items-center justify-between shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", column.color)} />
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {column.title}{" "}
            <span className="opacity-50">({column.tasks.length})</span>
          </h3>
        </div>
      </div>

      {/* Task cards */}
      <SortableContext items={column.tasks.map((t) => String(t.id))} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {column.tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              isDeleting={deletingTaskId === task.id}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Board ─────────────────────────────────────────────────────────

/** Main Kanban board — renders sections and status columns from API data */
export function KanbanBoard({ kanban, onBack }: KanbanBoardProps) {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canEdit   = hasPermission("edit tasks")
  const canDelete = hasPermission("delete tasks")
  const [sections, setSections] = useState<BoardSection[]>(() =>
    buildBoardSections(kanban.sections),
  )
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null)
  const [activeTaskWidth, setActiveTaskWidth] = useState<number | null>(null)
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)

  const { deleteTask: deleteTaskById, deleting } = useDeleteTask()

  const sensors = useSensors(
    // PointerSensor: 4px activation distance prevents accidental drags on click.
    // Covers mouse, touch, and pen input uniformly — no separate MouseSensor /
    // TouchSensor needed, which previously diverged in grab-point calculation.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // KeyboardSensor: enables accessible drag-and-drop via keyboard.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Find the task being dragged across all sections/columns
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const draggedWidth = event.active.rect.current.initial?.width
    setActiveTaskWidth(typeof draggedWidth === "number" ? draggedWidth : null)

    const taskId = String(event.active.id)
    for (const section of sections) {
      for (const col of section.columns) {
        const found = col.tasks.find((t) => String(t.id) === taskId)
        if (found) {
          setActiveTask(found)
          return
        }
      }
    }
  }, [sections])

  // Track which column the dragged item is hovering over
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined
    if (!overId) {
      setHoveredColumn(null)
      return
    }

    // Check if overId is a column
    for (const section of sections) {
      if (section.columns.find((c) => c.id === overId)) {
        setHoveredColumn(overId)
        return
      }
    }

    // Otherwise find the parent column of the task being hovered
    for (const section of sections) {
      for (const col of section.columns) {
        if (col.tasks.some((t) => String(t.id) === overId)) {
          setHoveredColumn(col.id)
          return
        }
      }
    }

    setHoveredColumn(null)
  }, [sections])

  // Move the task to the target column/position when dropped
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null)
    setActiveTaskWidth(null)
    setHoveredColumn(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    setSections((prev) => {
      // Locate the source task
      let srcSi = -1, srcCi = -1, srcTi = -1
      for (let si = 0; si < prev.length; si++) {
        for (let ci = 0; ci < prev[si].columns.length; ci++) {
          const ti = prev[si].columns[ci].tasks.findIndex((t) => String(t.id) === activeId)
          if (ti !== -1) { srcSi = si; srcCi = ci; srcTi = ti; break }
        }
        if (srcSi !== -1) break
      }
      if (srcSi === -1) return prev

      // Locate the destination — check columns first, then tasks
      let dstSi = -1, dstCi = -1, dstTi = -1

      for (let si = 0; si < prev.length; si++) {
        const ci = prev[si].columns.findIndex((c) => c.id === overId)
        if (ci !== -1) {
          dstSi = si; dstCi = ci; dstTi = prev[si].columns[ci].tasks.length; break
        }
      }

      if (dstCi === -1) {
        for (let si = 0; si < prev.length; si++) {
          for (let ci = 0; ci < prev[si].columns.length; ci++) {
            const ti = prev[si].columns[ci].tasks.findIndex((t) => String(t.id) === overId)
            if (ti !== -1) { dstSi = si; dstCi = ci; dstTi = ti; break }
          }
          if (dstCi !== -1) break
        }
      }

      if (dstCi === -1 || dstSi === -1) return prev

      const srcCol = prev[srcSi].columns[srcCi]
      const dstCol = prev[dstSi].columns[dstCi]
      const task = srcCol.tasks[srcTi]

      // Fire API calls for what actually changed
      // Column id format: "col-{sectionId}-{status}"
      const srcSectionId = Number(srcCol.id.split("-")[1])
      const dstSectionId = Number(dstCol.id.split("-")[1])
      const statusChanged = srcCol.status !== dstCol.status
      const sectionChanged = srcSectionId !== dstSectionId

      if (sectionChanged) {
        projectService.moveTaskSection(task.id, dstSectionId).catch(() => {
          // Errors are silent for now; the optimistic update stays
        })
      }
      if (statusChanged) {
        projectService.moveTaskStatus(
          task.id,
          dstCol.status as KanbanTask["status"],
        ).catch(() => {})
      }

      // Clone sections and move the task
      const next = prev.map((s) => ({
        ...s,
        columns: s.columns.map((c) => ({ ...c, tasks: [...c.tasks] })),
      }))

      const [moved] = next[srcSi].columns[srcCi].tasks.splice(srcTi, 1)
      // Update the task's status/section_id in the moved copy
      next[dstSi].columns[dstCi].tasks.splice(dstTi, 0, {
        ...moved,
        status: dstCol.status as KanbanTask["status"],
        section_id: dstSectionId,
      })
      return next
    })
  }, [])

  const handleEditTask = useCallback(async (task: KanbanTask) => {
    try {
      const fullTask = await taskService.getById(task.id)
      navigate(`/tasks/${fullTask.id}/edit`, {
        state: {
          editTask: fullTask,
          returnTo: `/projects/${kanban.project.id}/kanban-board`,
        },
      })
    } catch (err) {
      if (!isCancel(err)) {
        toast.error("Failed to load task details.")
      }
    }
  }, [kanban.project.id, navigate])

  const handleDeleteTaskClick = useCallback((task: KanbanTask) => {
    setDeleteTarget(task as unknown as Task)
    setDeleteDialogOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return

    setDeletingTaskId(deleteTarget.id)
    const success = await deleteTaskById(deleteTarget.id)
    if (success) {
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          columns: section.columns.map((column) => ({
            ...column,
            tasks: column.tasks.filter((task) => task.id !== deleteTarget.id),
          })),
        })),
      )

      setActiveTask((prev) => (prev?.id === deleteTarget.id ? null : prev))
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
    setDeletingTaskId(null)
  }, [deleteTarget, deleteTaskById])

  // Collect all unique assigned users to show in the members bar
  const allMembers = (() => {
    const seen = new Map<number, { id: number; name: string; avatar_url?: string | null }>()
    for (const s of kanban.sections) {
      for (const tasks of Object.values(s.tasks_by_status)) {
        for (const t of tasks) {
          for (const u of t.assigned_users) {
            if (!seen.has(u.id)) seen.set(u.id, u)
          }
        }
      }
    }
    return [...seen.values()]
  })()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <Button variant="ghost" size="icon-lg" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{kanban.project.name}</h2>
            <Badge variant="secondary" className="uppercase tracking-wider">Kanban</Badge>
          </div>
          <span className="text-xs text-primary font-bold uppercase tracking-widest">
            {kanban.project.status?.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Members bar */}
      {allMembers.length > 0 && (
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex -space-x-2">
            {allMembers.slice(0, 4).map((m) => (
              <Avatar key={m.id} className="size-8 border-2 border-background">
                <AvatarImage src={m.avatar_url ?? undefined} alt={m.name} />
                <AvatarFallback className="text-[10px]">{getInitials(m.name)}</AvatarFallback>
              </Avatar>
            ))}
            {allMembers.length > 4 && (
              <div className="size-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                +{allMembers.length - 4}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{allMembers.length} members</span>
        </div>
      )}

      {/* Empty state when project has no sections */}
      {sections.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground text-sm">No sections found for this project.</p>
        </div>
      )}

      {/* Board with drag-and-drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pb-4 min-h-0">
          {sections.map((section) => (
            <section key={section.id} className="space-y-4">
              {/* Section title */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </h3>
              </div>

              {/* Status columns — horizontal scroll with smooth behavior.
                  Each column is fixed-width (w-72) so layout never shifts
                  during drag, and flex-shrink-0 prevents columns from
                  collapsing on smaller screens. */}
              <div className="flex gap-3 overflow-x-auto pb-3 pt-2 px-1 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]">
                {section.columns.map((col) => (
                  <KanbanColumnView
                    key={col.id}
                    column={col}
                    isOver={hoveredColumn === col.id}
                    onEditTask={canEdit ? handleEditTask : undefined}
                    onDeleteTask={canDelete ? handleDeleteTaskClick : undefined}
                    deletingTaskId={deletingTaskId}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/*
          DragOverlay — the key rules for correct cursor alignment:

          1. adjustScale={false} — do NOT let dnd-kit rescale the overlay;
             any visual scale must be applied only to content inside, not the
             wrapper that dnd-kit measures for positioning.

          2. The wrapper div must contain ONLY the card — no labels, no extra
             padding, no elements that push the card away from the top edge.
             Previously a "Drop into: X" label sat above the card, shifting it
             ~20px down from where dnd-kit expected it, causing the visible
             disconnect when grabbing from the left side.

          3. Width is read from the actual card rect on drag start so the
             overlay is dimensionally identical to the original card.
        */}
        {typeof document !== "undefined" && createPortal(
          <DragOverlay
            adjustScale={false}
            zIndex={100}
            dropAnimation={{
              duration: 200,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {activeTask && (
              <div
                className="pointer-events-none"
                style={{
                  width: activeTaskWidth ?? 288,
                }}
              >
                <TaskCardInner task={activeTask} isOverlay />
              </div>
            )}
          </DragOverlay>,
          document.body,
        )}

        <ConfirmDeleteTaskDialog
          task={deleteTarget}
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (!deleting) setDeleteDialogOpen(open)
          }}
          onConfirm={handleConfirmDelete}
        />
      </DndContext>
    </div>
  )
}
