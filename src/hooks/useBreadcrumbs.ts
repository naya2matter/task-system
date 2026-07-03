import { useMemo } from "react"
import { useLocation } from "react-router"
import { useProjectsStore } from "@/app/projects/store/projectStore"
import { useTasksStore } from "@/app/tasks/store/taskStore"
import { useHelpRequestsStore } from "@/app/help-requests/store/helpRequestStore"
import { useWorkspaceStore } from "@/app/workspaces/store/workspaceStore"
import { useTicketsStore } from "@/app/tickets/store/ticketStore"
import { useRatingConfigStore } from "@/app/ratings/configurations/store/ratingConfigStore"
import { useUsersStore } from "@/app/users/stores/usersStore"

export interface BreadcrumbItem {
  label: string
  /** When undefined, the item is the current page and is not linkable */
  href?: string
}

/**
 * Derives a breadcrumb trail from the current URL and live store data.
 * The last item in the array is always the current page (no href).
 */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const { pathname, state: routeState } = useLocation()

  const selectedProject = useProjectsStore((s) => s.selectedProject)
  const selectedTask = useTasksStore((s) => s.selectedTask)
  const selectedRequest = useHelpRequestsStore((s) => s.selectedRequest)
  const selectedWorkspace = useWorkspaceStore((s) => s.selectedWorkspace)
  const selectedTodo = useWorkspaceStore((s) => s.selectedTodo)
  const selectedTicket = useTicketsStore((s) => s.selectedTicket)
  const selectedRatingConfig = useRatingConfigStore((s) => s.selectedConfig)
  const selectedUser = useUsersStore((s) => s.selectedUser)

  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length === 0) return [{ label: "Dashboard" }]

    const singularMap: Record<string, string> = {
      projects: "Project",
      tasks: "Task",
      "help-requests": "Help Request",
      configurations: "Configuration",
      users: "User",
      roles: "Role",
      tickets: "Ticket",
      workspaces: "Workspace",
      todos: "Todo",
    }

    const items: BreadcrumbItem[] = []

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const isLast = i === segments.length - 1
      const prev = segments[i - 1]

      // Top-level resources
      if (i === 0) {
        switch (seg) {
          case "":
            items.push({ label: "Dashboard" })
            break
          case "account":
            items.push({ label: "Account" })
            break
          case "users":
            items.push({ label: "Users", href: isLast ? undefined : "/users" })
            break
          case "projects":
            items.push({ label: "Projects", href: isLast ? undefined : "/projects" })
            break
          case "tasks":
            items.push({ label: "Tasks", href: isLast ? undefined : "/tasks" })
            break
          case "help-requests":
            items.push({ label: "Help Requests", href: isLast ? undefined : "/help-requests" })
            break
          case "ratings":
            items.push({ label: "Ratings", href: isLast ? undefined : "/ratings" })
            break
          case "clocking":
            items.push({ label: "Clocking", href: isLast ? undefined : "/clocking/in-out" })
            break
          case "roles":
            items.push({ label: "Roles", href: isLast ? undefined : "/roles" })
            break
          case "tickets":
            items.push({ label: "Tickets", href: isLast ? undefined : "/tickets" })
            break
          case "workspaces":
            items.push({ label: "Workspaces", href: isLast ? undefined : "/workspaces" })
            break
          default:
            // Generic top-level label
            items.push({ label: seg.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) })
        }

        continue
      }

      // Actions: create/new
      if (seg === "create" || seg === "new") {
        const parent = segments[i - 1]
        const singular = singularMap[parent] ?? parent.replace(/-/g, " ")
        const label = parent === "configurations" && seg === "new" ? "New Configuration" : `Create ${singular}`
        items.push({ label })
        break
      }

      // Action: edit
      if (seg === "edit") {
        items.push({ label: "Edit" })
        break
      }

      // Users/:id — no standalone detail page exists (viewing a user is a
      // sheet over the list), so this segment is never a link.
      if (prev === "users") {
        const userId = seg
        const stateUser = (routeState as { editUser?: { id: string; name: string } } | null)?.editUser
        const name =
          selectedUser && selectedUser.id?.toString() === userId
            ? selectedUser.name
            : stateUser && stateUser.id?.toString() === userId
              ? stateUser.name
              : `User #${userId}`
        items.push({ label: name })
        continue
      }

      // Projects/:id
      if (prev === "projects") {
        const projectId = seg
        const name =
          selectedProject && selectedProject.id?.toString() === projectId
            ? selectedProject.name
            : `Project #${projectId}`
        const href = `/projects/${projectId}`
        items.push({ label: name, href: isLast ? undefined : href })
        continue
      }

      // Tasks/:id
      if (prev === "tasks") {
        const taskId = seg
        const name =
          selectedTask && selectedTask.id?.toString() === taskId
            ? selectedTask.name
            : `Task #${taskId}`
        const href = `/tasks/${taskId}`
        items.push({ label: name, href: isLast ? undefined : href })
        continue
      }

      // HelpRequests/:id
      if (prev === "help-requests") {
        const reqId = seg
        const title =
          selectedRequest && selectedRequest.id?.toString() === reqId
            ? selectedRequest.task?.name ?? `Help Request #${reqId}`
            : `Help Request #${reqId}`
        const href = `/help-requests/${reqId}`
        items.push({ label: title, href: isLast ? undefined : href })
        continue
      }

      // Workspaces/:id
      if (prev === "workspaces") {
        const wsId = seg
        const name =
          selectedWorkspace && selectedWorkspace.id?.toString() === wsId
            ? selectedWorkspace.name
            : `Workspace #${wsId}`
        const href = `/workspaces/${wsId}`
        items.push({ label: name, href: isLast ? undefined : href })
        continue
      }

      // Tickets/:id — detail breadcrumb should be clickable when editing
      if (prev === "tickets") {
        const ticketId = seg
        const stateTicket = (routeState as { editTicket?: { id: number; title: string } } | null)?.editTicket
        const title =
          selectedTicket && selectedTicket.id?.toString() === ticketId
            ? selectedTicket.title
            : stateTicket && stateTicket.id?.toString() === ticketId
              ? stateTicket.title
              : `Ticket #${ticketId}`
        const href = segments[i + 1] === "edit" ? `/tickets/${ticketId}` : undefined
        items.push({ label: title, href: isLast ? undefined : href })
        continue
      }

      // todos segment — the todo list lives on the workspace detail page,
      // not at /workspaces/:id/todos, so link back to workspace detail
      if (seg === "todos") {
        const workspaceId = segments[1]
        const href = `/workspaces/${workspaceId}`
        items.push({ label: "Todos", href: isLast ? undefined : href })
        continue
      }

      // Todos/:todoId
      if (prev === "todos") {
        const todoId = seg
        const title =
          selectedTodo && selectedTodo.id?.toString() === todoId
            ? selectedTodo.title
            : `Todo #${todoId}`
        items.push({ label: title })
        continue
      }

      // Ratings -> configurations -> :id
      if (prev === "configurations" && segments[i - 2] === "ratings") {
        const cfgId = seg
        const name =
          selectedRatingConfig && selectedRatingConfig.id?.toString() === cfgId
            ? selectedRatingConfig.name
            : `Configuration ${cfgId}`
        const href = `/ratings/configurations/${cfgId}`
        items.push({ label: name, href: isLast ? undefined : href })
        continue
      }

      // Special labels
      if (seg === "kanban" || seg === "kanban-board") {
        items.push({ label: "Kanban Board" })
        continue
      }

      // Generic fallback: create a readable label and a link to the accumulated path
      const display = seg.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())
      const href = `/${segments.slice(0, i + 1).join("/")}`
      items.push({ label: display, href: isLast ? undefined : href })
    }

    return items.length ? items : [{ label: "Dashboard" }]
  }, [
    pathname,
    routeState,
    selectedProject,
    selectedTask,
    selectedRequest,
    selectedWorkspace,
    selectedTodo,
    selectedTicket,
    selectedRatingConfig,
    selectedUser,
  ])
}
