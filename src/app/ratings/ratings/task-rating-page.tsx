import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router"
import { isCancel } from "axios"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
// Task type from the API-aligned types module
import type { Task } from "@/app/tasks/types"
// Service for loading task details (including user assignments)
import { taskService } from "@/app/tasks/services/taskService"
// The actual rating form component
import { TaskRatingForm } from "@/app/tasks/pages/task-rating-form"
import { TaskRatingFormSkeleton } from "./task-rating-skeleton"

/**
 * TaskRatingPage
 * ──────────────────────────────────────────────────────────────────
 * Route handler page for /ratings/tasks/:taskId/rate
 *
 * Responsibilities:
 * 1. Read the taskId from the URL params
 * 2. Fetch task details from GET /tasks/{taskId}/with-assignments
 * 3. Render loading / error states while fetching
 * 4. Pass the loaded task into <TaskRatingForm> once ready
 * 5. Navigate back to /ratings after a successful submission
 */
export default function TaskRatingPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()

  // The loaded task; null while loading or on error
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch the task when the page mounts or when taskId changes
  useEffect(() => {
    const id = Number(taskId)
    if (!taskId || isNaN(id)) {
      setError("Invalid task ID.")
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    taskService.getByIdWithAssignments(id)
      .then((t) => {
        if (!cancelled) setTask(t)
      })
      .catch((err) => {
        // Ignore cancel errors (navigation away before fetch completes)
        if (!isCancel(err) && !cancelled) {
          setError("Failed to load task. It may not exist or you may not have access.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [taskId])

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return <TaskRatingFormSkeleton />
  }

  // ── Error state ──────────────────────────────────────────────────
  if (error || !task) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 max-w-2xl mx-auto w-full">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span className="text-sm">{error ?? "Task not found."}</span>
        </div>
        {/* Allow the user to go back to the ratings list */}
        <Button variant="outline" onClick={() => navigate("/ratings")}>
          Back to Ratings
        </Button>
      </div>
    )
  }

  // ── Render form with the loaded task ────────────────────────────
  return (
    <TaskRatingForm
      task={task}
      // After successful rating submission, go back to the ratings list
      onSubmit={() => navigate("/ratings")}
      // Cancel returns to the ratings list without submitting
      onCancel={() => navigate("/ratings")}
    />
  )
}
