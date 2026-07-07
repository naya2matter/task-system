// Hook for updating a task's status via POST /tasks/{id}/status.
// Used to let assigned developers mark their tasks complete (status = "done").
// Exposes updating / updateError aliased from the shared submitting / submitError store state.

import { useTasksStore } from "../store/taskStore"
import type { Task, TaskStatus } from "../types"

export function useUpdateTaskStatus() {
  const updateTaskStatus = useTasksStore((s) => s.updateTaskStatus)
  // Reuse the shared submitting / submitError slices — only one mutation runs at a time
  const updating = useTasksStore((s) => s.submitting)
  const updateError = useTasksStore((s) => s.submitError)
  const clearUpdateError = useTasksStore((s) => s.clearSubmitError)

  return {
    /** Call with the task ID and new status; returns the updated task or null on error */
    updateTaskStatus: (id: number, status: TaskStatus): Promise<Task | null> =>
      updateTaskStatus(id, status),
    updating,
    updateError,
    clearUpdateError,
  }
}
