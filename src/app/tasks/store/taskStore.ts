import { create } from "zustand"
import { isCancel, AxiosError } from "axios"
import { taskService } from "../services/taskService"
import type { Task, TaskListParams, TaskPagination, CreateTaskPayload, UpdateTaskPayload, TaskStatus } from "../types"
import type { ApiValidationError } from "@/types"

// Pulls a user-friendly error message out of an Axios error response
function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiValidationError | undefined
    if (data?.errors) return Object.values(data.errors).flat().join(". ")
    if (data?.message) return data.message
  }
  return fallback
}

// ─── State ────────────────────────────────────────────────────────

interface TasksState {
  // List slice: holds the current page of tasks
  tasks: Task[]
  pagination: TaskPagination | null
  loading: boolean
  error: string | null
  /** The params used for the last fetch (used to re-fetch after mutations) */
  lastParams: TaskListParams

  // Detail slice: holds a single loaded task
  selectedTask: Task | null
  selectedLoading: boolean
  selectedError: string | null

  // Mutation slice: tracks in-flight create / update / delete calls
  submitting: boolean
  submitError: string | null
}

// ─── Actions ──────────────────────────────────────────────────────

interface TasksActions {
  /** Fetch the task list with the given filters + pagination */
  fetchTasks: (params?: TaskListParams) => Promise<void>
  /** Fetch a single task by its ID */
  fetchTask: (id: number) => Promise<void>
  /** POST /tasks — create a new task; returns the created task or null on error */
  createTask: (payload: CreateTaskPayload) => Promise<Task | null>
  /** PUT /tasks/{id} — update a task; returns updated task or null on error */
  updateTask: (id: number, payload: UpdateTaskPayload) => Promise<Task | null>
  /** POST /tasks/{id}/status — update only the task status; returns updated task or null */
  updateTaskStatus: (id: number, status: TaskStatus) => Promise<Task | null>
  /** DELETE /tasks/{id} — delete a task; returns true on success */
  deleteTask: (id: number) => Promise<boolean>
  clearError: () => void
  clearSelectedError: () => void
  clearSelectedTask: () => void
  clearSubmitError: () => void
}

type TasksStore = TasksState & TasksActions

// ─── Store ────────────────────────────────────────────────────────

export const useTasksStore = create<TasksStore>()((set, _get) => ({
  // Initial list state
  tasks: [],
  pagination: null,
  loading: false,
  error: null,
  lastParams: {},

  // Initial detail state
  selectedTask: null,
  selectedLoading: false,
  selectedError: null,

  // Initial mutation state
  submitting: false,
  submitError: null,

  fetchTasks: async (params: TaskListParams = {}) => {
    set({ loading: true, error: null, lastParams: params })
    try {
      const response = await taskService.getAll(params)
      set({ tasks: response.data, pagination: response.pagination })
    } catch (err) {
      if (!isCancel(err)) {
        set({ error: extractErrorMessage(err, "Failed to load tasks.") })
      }
    } finally {
      set({ loading: false })
    }
  },

  fetchTask: async (id: number) => {
    set({ selectedLoading: true, selectedError: null, selectedTask: null })
    try {
      const task = await taskService.getById(id)
      set({ selectedTask: task })
    } catch (err) {
      if (!isCancel(err)) {
        set({ selectedError: extractErrorMessage(err, "Failed to load task details.") })
      }
    } finally {
      set({ selectedLoading: false })
    }
  },

  // POST /tasks — create a new task
  createTask: async (payload: CreateTaskPayload) => {
    set({ submitting: true, submitError: null })
    try {
      const task = await taskService.create(payload)
      return task
    } catch (err) {
      if (!isCancel(err)) {
        set({ submitError: extractErrorMessage(err, "Failed to create task.") })
      }
      return null
    } finally {
      set({ submitting: false })
    }
  },

  // PUT /tasks/{id} — update an existing task
  updateTask: async (id: number, payload: UpdateTaskPayload) => {
    set({ submitting: true, submitError: null })
    try {
      const task = await taskService.update(id, payload)
      return task
    } catch (err) {
      if (!isCancel(err)) {
        set({ submitError: extractErrorMessage(err, "Failed to update task.") })
      }
      return null
    } finally {
      set({ submitting: false })
    }
  },

  // POST /tasks/{id}/status — update only the status (e.g. mark a task done)
  updateTaskStatus: async (id: number, status: TaskStatus) => {
    set({ submitting: true, submitError: null })
    try {
      const task = await taskService.updateStatus(id, { status })
      return task
    } catch (err) {
      if (!isCancel(err)) {
        set({ submitError: extractErrorMessage(err, "Failed to update task status.") })
      }
      return null
    } finally {
      set({ submitting: false })
    }
  },

  // DELETE /tasks/{id} — remove a task permanently
  deleteTask: async (id: number) => {
    set({ submitting: true, submitError: null })
    try {
      await taskService.delete(id)
      return true
    } catch (err) {
      if (!isCancel(err)) {
        set({ submitError: extractErrorMessage(err, "Failed to delete task.") })
      }
      return false
    } finally {
      set({ submitting: false })
    }
  },

  clearError: () => set({ error: null }),
  clearSelectedError: () => set({ selectedError: null }),
  clearSelectedTask: () => set({ selectedTask: null, selectedError: null }),
  clearSubmitError: () => set({ submitError: null }),
}))
