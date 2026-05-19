import { useEffect, useRef, useCallback } from "react"
import { useTasksStore } from "../store/taskStore"
import type { TaskListParams } from "../types"

/**
 * useTasks — fetches the task list whenever the serialized params change.
 *
 * The caller passes the current filter/pagination values; the hook
 * re-fetches automatically when any of them change.
 *
 * Returns: tasks, pagination, loading, error, refetch, clearError
 */
export function useTasks(params: TaskListParams = {}) {
  const tasks = useTasksStore((s) => s.tasks)
  const pagination = useTasksStore((s) => s.pagination)
  const loading = useTasksStore((s) => s.loading)
  const error = useTasksStore((s) => s.error)
  const fetchTasks = useTasksStore((s) => s.fetchTasks)
  const clearError = useTasksStore((s) => s.clearError)

  // Stringify params so we can compare cheaply without deep-equal
  const paramsKey = JSON.stringify(params)
  const lastKey = useRef<string>("")

  const refetch = useCallback(() => fetchTasks(params), [fetchTasks, params])
  const clearAppError = useCallback(() => clearError(), [clearError])

  useEffect(() => {
    if (paramsKey !== lastKey.current) {
      lastKey.current = paramsKey
      fetchTasks(params)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey])

  return {
    tasks,
    pagination,
    loading,
    error,
    /** Re-fetch with the same params (e.g. after a mutation) */
    refetch,
    clearError: clearAppError,
  }
}
