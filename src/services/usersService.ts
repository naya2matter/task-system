import type { AxiosRequestConfig } from "axios"
import { apiClient } from "@/services/api"
import type { User as ApiUser, Role, Permission } from "@/types"
import type { User, UserStatus } from "@/app/users/data"
// Re-use the help-request types already defined in the help-requests module
// so we don't duplicate the shape in two places.
import type { HelpRequest, HelpRequestPagination } from "@/app/help-requests/types"
// Re-use the ticket type from the tickets module for user-ticket endpoints.
import type { ApiTicket } from "@/app/tickets/types"

// ─── Pagination metadata returned by GET /users ───────────────────────────────
export interface UsersPaginationMeta {
  current_page: number
  total: number
  per_page: number
  last_page: number
  from: number | null
  to: number | null
}

// ─── Project (user as stakeholder) ────────────────────────────────────────────
// Shape returned by GET /users/{id}/projects  — each item in data[].
export type UserProjectStatus = "pending" | "in_progress" | "done" | "rated" | (string & {})

export interface UserProject {
  id: number
  name: string
  description: string | null
  status: UserProjectStatus
  progress_percentage: number | string
  stakeholder_will_rate: boolean
  created_at: string
  updated_at: string
}

// ─── Task assignment ───────────────────────────────────────────────────────────
// Shape returned by GET /users/{id}/task-assignments — each item in data[].
export type TaskPriority = "low" | "medium" | "high" | "critical" | (string & {})
export type TaskStatus   = "pending" | "in_progress" | "done" | "rated" | (string & {})

export interface UserTaskAssignment {
  id: number
  name: string
  description: string | null
  weight: number
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  section_id: number
  project_id: number
  completed_at: string | null
  created_at: string
  updated_at: string
  /** Eager-loaded section with its parent project */
  section: {
    id: number
    name: string
    project_id: number
    project: {
      id: number
      name: string
      status: string
      progress_percentage: number | string
    }
  } | null
  /** Assignment percentage for this user on this task */
  pivot: {
    percentage: number
  }
}

// ─── Roles & Permissions response from GET /users/{id}/roles-and-permissions ──
export interface UserRolesAndPermissions {
  user: ApiUser
  roles: Role[]
  direct_permissions: Permission[]
  all_permissions: Permission[]
}

// Raw shape of the GET /users response body
interface UsersRawResponse {
  success: boolean
  data: ApiUser[]
  pagination: UsersPaginationMeta
  message: string
}

// ─── Payload types for create / update ────────────────────────────────────────

/** Body sent to POST /users */
export interface CreateUserPayload {
  name: string
  email: string
  password: string
}

/** Body sent to PUT /users/{id} — password is optional */
export interface UpdateUserPayload {
  name?: string
  email?: string
  password?: string | null
}

// ─── Single-user API response shape ──────────────────────────────────────────
interface SingleUserResponse {
  success: boolean
  data: ApiUser
  message: string
}

// ─── Roles-and-permissions API response shape ────────────────────────────────
interface RolesAndPermissionsResponse {
  success: boolean
  data: UserRolesAndPermissions
  message: string
}

// ─── Mapper: ApiUser (backend) → User (UI) ────────────────────────────────────
// Normalizes backend field names to the UI-facing User type.
function mapApiUserToUiUser(apiUser: ApiUser): User {
  return {
    id: String(apiUser.id),
    name: apiUser.name,
    email: apiUser.email,

    // Use the first assigned role's name; fall back when a user has no roles
    role: apiUser.roles[0]?.name ?? "—",

    // Backend has no status field; default every user to "active"
    status: "active" as UserStatus,

    // Null means no picture — UI renders initials instead
    avatarUrl: apiUser.avatar_url ?? null,

    // Format ISO date to human-readable "Oct 12, 2023"
    createdAt: new Date(apiUser.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }
}

// ─── Service object ───────────────────────────────────────────────────────────
export const usersService = {
  /**
   * GET /users — paginated list of users.
   */
  getAll: async (
    page = 1,
  ): Promise<{ users: User[]; pagination: UsersPaginationMeta }> => {
    const raw = (await apiClient.get<never>("/users", {
      params: { page },
    })) as unknown as UsersRawResponse

    return {
      users: raw.data.map(mapApiUserToUiUser),
      pagination: raw.pagination,
    }
  },

  /**
   * GET /users/{id} — fetch a single user's details.
   */
  getById: async (userId: string): Promise<User> => {
    const raw = (await apiClient.get<never>(
      `/users/${userId}`,
    )) as unknown as SingleUserResponse
    return mapApiUserToUiUser(raw.data)
  },

  /**
   * POST /users — create a new user.
   * Returns the created user mapped to the UI type.
   */
  create: async (payload: CreateUserPayload): Promise<User> => {
    const raw = (await apiClient.post<never>("/users", payload, {
      toast: { success: "User created successfully" },
    } as AxiosRequestConfig)) as unknown as SingleUserResponse
    return mapApiUserToUiUser(raw.data)
  },

  /**
   * PUT /users/{id} — update an existing user.
   * Returns the updated user mapped to the UI type.
   */
  update: async (userId: string, payload: UpdateUserPayload): Promise<User> => {
    const raw = (await apiClient.put<never>(
      `/users/${userId}`,
      payload,
      { toast: { success: "User updated successfully" } } as AxiosRequestConfig,
    )) as unknown as SingleUserResponse
    return mapApiUserToUiUser(raw.data)
  },

  /**
   * DELETE /users/{id} — permanently remove a user.
   */
  delete: async (userId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}`, {
      toast: { success: "User deleted successfully" },
    } as never)
  },

  // ─── Roles & Permissions ──────────────────────────────────────────────────

  /**
   * GET /users/{id}/roles-and-permissions — fetch a user's roles & permissions.
   */
  getRolesAndPermissions: async (userId: string): Promise<UserRolesAndPermissions> => {
    const raw = (await apiClient.get<never>(
      `/users/${userId}/roles-and-permissions`,
    )) as unknown as RolesAndPermissionsResponse
    return raw.data
  },

  /**
   * POST /users/{id}/sync-roles — sync only the user's roles.
   */
  syncRoles: async (userId: string, roles: string[]): Promise<void> => {
    await apiClient.post(`/users/${userId}/sync-roles`, { roles }, {
      toast: { success: "User roles synced successfully" },
    } as never)
  },

  /**
   * POST /users/{id}/sync-permissions — sync only the user's direct permissions.
   */
  syncPermissions: async (userId: string, permissions: string[]): Promise<void> => {
    await apiClient.post(`/users/${userId}/sync-permissions`, { permissions }, {
      toast: { success: "User permissions synced successfully" },
    } as never)
  },

  /**
   * POST /users/{id}/sync-roles-and-permissions — sync both roles and permissions.
   */
  syncRolesAndPermissions: async (
    userId: string,
    roles: string[],
    permissions: string[],
  ): Promise<void> => {
    await apiClient.post(
      `/users/${userId}/sync-roles-and-permissions`,
      { roles, permissions },
      { toast: { success: "User roles and permissions synced successfully" } } as never,
    )
  },

  // ─── Projects (user as stakeholder) ─────────────────────────────────────────

  /**
   * GET /users/{id}/projects — paginated list of projects where the user is stakeholder.
   */
  getUserProjects: async (
    userId: string,
    page = 1,
  ): Promise<{ projects: UserProject[]; pagination: UsersPaginationMeta }> => {
    // Raw response has { success, data: Project[], pagination, message }
    const raw = (await apiClient.get<never>(`/users/${userId}/projects`, {
      params: { page },
    })) as unknown as {
      success: boolean
      data: UserProject[]
      pagination: UsersPaginationMeta
      message: string
    }
    return { projects: raw.data, pagination: raw.pagination }
  },

  // ─── Task assignments ────────────────────────────────────────────────────────

  /**
   * GET /users/{id}/task-assignments — full list of tasks assigned to this user.
   * Returns a plain collection (not paginated) with section.project eager-loaded.
   */
  getUserTaskAssignments: async (userId: string): Promise<UserTaskAssignment[]> => {
    // Raw response has { success, data: Task[], message }
    const raw = (await apiClient.get<never>(`/users/${userId}/task-assignments`)) as unknown as {
      success: boolean
      data: UserTaskAssignment[]
      message: string
    }
    return raw.data
  },

  // ─── Help requests requested by this user ────────────────────────────────────

  /**
   * GET /users/{id}/help-requests/requested
   * Paginated list of help requests where this user is the requester.
   */
  getUserRequestedHelpRequests: async (
    userId: string,
    page = 1,
  ): Promise<{ helpRequests: HelpRequest[]; pagination: HelpRequestPagination }> => {
    // Raw response: { success, data: HelpRequest[], pagination, message }
    const raw = (await apiClient.get<never>(`/users/${userId}/help-requests/requested`, {
      params: { page },
    })) as unknown as {
      success: boolean
      data: HelpRequest[]
      pagination: HelpRequestPagination
      message: string
    }
    return { helpRequests: raw.data, pagination: raw.pagination }
  },

  // ─── Help requests where this user is the assigned helper ─────────────────────

  /**
   * GET /users/{id}/help-requests/helping
   * Paginated list of help requests where this user is the assigned helper.
   */
  getUserHelperHelpRequests: async (
    userId: string,
    page = 1,
  ): Promise<{ helpRequests: HelpRequest[]; pagination: HelpRequestPagination }> => {
    // Raw response: { success, data: HelpRequest[], pagination, message }
    const raw = (await apiClient.get<never>(`/users/${userId}/help-requests/helping`, {
      params: { page },
    })) as unknown as {
      success: boolean
      data: HelpRequest[]
      pagination: HelpRequestPagination
      message: string
    }
    return { helpRequests: raw.data, pagination: raw.pagination }
  },

  // ─── Tickets submitted by this user (as requester) ────────────────────────────

  /**
   * GET /users/{id}/tickets/requested
   * Paginated list of tickets this user submitted.
   * Reuses UsersPaginationMeta since both shapes are identical.
   */
  getUserRequestedTickets: async (
    userId: string,
    page = 1,
  ): Promise<{ tickets: ApiTicket[]; pagination: UsersPaginationMeta }> => {
    // Raw response: { success, data: ApiTicket[], pagination, message }
    const raw = (await apiClient.get<never>(`/users/${userId}/tickets/requested`, {
      params: { page },
    })) as unknown as {
      success: boolean
      data: ApiTicket[]
      pagination: UsersPaginationMeta
      message: string
    }
    return { tickets: raw.data, pagination: raw.pagination }
  },

  // ─── Tickets assigned to this user ────────────────────────────────────────────

  /**
   * GET /users/{id}/tickets/assigned
   * Paginated list of tickets currently assigned to this user.
   */
  getUserAssignedTickets: async (
    userId: string,
    page = 1,
  ): Promise<{ tickets: ApiTicket[]; pagination: UsersPaginationMeta }> => {
    // Raw response: { success, data: ApiTicket[], pagination, message }
    const raw = (await apiClient.get<never>(`/users/${userId}/tickets/assigned`, {
      params: { page },
    })) as unknown as {
      success: boolean
      data: ApiTicket[]
      pagination: UsersPaginationMeta
      message: string
    }
    return { tickets: raw.data, pagination: raw.pagination }
  },
}
