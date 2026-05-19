// SectionCard — renders a single section inside the project details page.
//
// Responsibilities:
//   • Display section name / description and its section-level Edit / Delete actions
//   • Load the section's tasks (with assignment data) via useSectionTasks
//   • Expose Create / Edit / Delete / View operations on tasks
//       - Create → navigates to /tasks with location.state that tells TasksPage
//             to open the form in create mode pre-seeded with this section
//       - Edit   → fetches the full Task object, then navigates to /tasks with
//             the task in location.state so TasksPage opens in edit mode
//       - Delete → opens ConfirmDeleteTaskDialog, then calls DELETE /tasks/{id}
//       - View   → navigates to /tasks/{id} (existing task detail page)
//   • returnTo: /projects/{project_id} is passed so cancel/submit go back here

import { useState } from "react"
import { useNavigate } from "react-router"
import { isCancel } from "axios"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Section-level hooks and components
import { useSectionTasks } from "./hooks/useSectionTasks"
import { TaskList } from "./TaskList"
import { SectionActions } from "./SectionActions"

// Task-level hooks, service, and components reused from the tasks feature
import { useDeleteTask } from "@/app/tasks/hooks/useDeleteTask"
import { taskService } from "@/app/tasks/services/taskService"
import { ConfirmDeleteTaskDialog } from "@/app/tasks/pages/confirm-delete-task-dialog"

import type { Section, SectionTask } from "./types"
import type { Task } from "@/app/tasks/types"

// ─── Props ───────────────────────────────────────────────────────────────────

type SectionCardProps = {
  section: Section
  /** Called when the user chooses to edit this section's metadata */
  onEdit: (section: Section) => void
  /** Called when the user confirms deleting this section */
  onDelete: (section: Section) => void
  /** True while a section-level mutation (create/update/delete section) is in flight */
  submitting?: boolean
  canEdit?: boolean
  canDelete?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SectionCard({ section, onEdit, onDelete, submitting, canEdit = false, canDelete = false }: SectionCardProps) {
  const navigate = useNavigate()

  // Fetch this section's tasks from the tasks-with-assignments endpoint.
  // `refetch` is called after every task mutation to keep the list in sync.
  const { tasks, loading: tasksLoading, error: tasksError, refetch } = useSectionTasks(section.id)

  // ID of the task currently being fetched for editing — drives the loading
  // indicator shown on the Edit button in the task row.
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null)

  // ── Delete dialog state ──────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  // Cast to Task | null — ConfirmDeleteTaskDialog only reads task.name / task.id
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)

  // Delete hook from the tasks feature — wraps DELETE /tasks/{id}
  const { deleteTask } = useDeleteTask()

  // ── Return path ───────────────────────────────────────────────────────────
  // Passed as location.state.returnTo so TasksPage navigates back here after
  // the form is submitted or cancelled.
  const returnTo = `/projects/${section.project_id}`

  // ── Handlers ─────────────────────────────────────────────────────────────

  /**
   * Open the create-task form on the tasks page, pre-seeded with this section
   * and project so the selectors don't need manual selection.
   * Uses React Router location.state — no query params, no sheet.
   */
  function handleAddTask() {
    navigate(`/tasks/create`, {
      state: {
        defaultSectionId: section.id,
        defaultProjectId: section.project_id,
        returnTo,
      },
    })
  }

  /**
   * Fetch the full Task object from GET /tasks/{id}, then navigate to the
   * tasks page with the task in location.state so it opens the edit form.
   * SectionTask doesn't include all fields required by TaskForm (subtasks,
   * section.project, assignment pivot), so a round-trip is necessary.
   */
  async function handleEditTask(taskId: number) {
    setEditLoadingId(taskId)
    try {
      const fullTask = await taskService.getById(taskId)
      navigate(`/tasks/${taskId}/edit`, {
        state: {
          editTask: fullTask,
          returnTo,
        },
      })
    } catch (err) {
      // Never surface cancel errors — only show genuine load failures
      if (!isCancel(err)) {
        toast.error("Failed to load task details.")
      }
    } finally {
      setEditLoadingId(null)
    }
  }

  /** Store the target and open the delete confirmation dialog */
  function handleDeleteTaskClick(task: SectionTask) {
    setDeleteTarget(task as unknown as Task)
    setDeleteDialogOpen(true)
  }

  /** Confirmed delete — calls DELETE /tasks/{id}, then refreshes the list */
  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const ok = await deleteTask(deleteTarget.id)
    if (ok) {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      // Reload the task list to reflect the deletion
      refetch()
    }
  }

  /** Navigate to the existing task detail page at /tasks/:id */
  function handleViewTask(taskId: number) {
    navigate(`/tasks/${taskId}`)
  }

  /** Navigate to the task rating page */
  function handleRateTask(taskId: number) {
    navigate(`/ratings/tasks/${taskId}/rate`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Card>
        {/* Section header: name, description, and section-level actions */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">{section.name}</CardTitle>
              {section.description && (
                <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
              )}
            </div>
            {/* Edit / Delete section actions (not task actions) */}
            <SectionActions
              section={section}
              onEdit={onEdit}
              onDelete={onDelete}
              submitting={submitting}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        </CardHeader>

        {/* Task table with CRUD callbacks wired */}
        <CardContent>
          <TaskList
            tasks={tasks}
            loading={tasksLoading}
            error={tasksError}
            editLoadingId={editLoadingId}
            onAddTask={handleAddTask}
            onEdit={handleEditTask}
            onDelete={handleDeleteTaskClick}
            onView={handleViewTask}
            onRate={handleRateTask}
          />
        </CardContent>
      </Card>

      {/* ── Task delete confirmation dialog ───────────────────────────────────
          Reuses the same dialog from the main tasks page.                      */}
      <ConfirmDeleteTaskDialog
        task={deleteTarget}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}


