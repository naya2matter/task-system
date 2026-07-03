import { create } from "zustand"
import { isCancel, AxiosError } from "axios"
import {
  usersService,
  type UsersPaginationMeta,
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserRolesAndPermissions,
  type UserProject,
  type UserTaskAssignment,
} from "@/services/usersService"
import type { User } from "@/app/users/data"
import type { ApiValidationError } from "@/types"
// Re-use help-request types for the two new user/help-request endpoints
import type { HelpRequest, HelpRequestPagination } from "@/app/help-requests/types"
// Re-use the ticket type for the two new user/ticket endpoints
import type { ApiTicket } from "@/app/tickets/types"

// ─── Helper: extract a user-friendly error from Axios errors ──────────────────
function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status
    const data = err.response?.data as ApiValidationError | undefined

    // Field-level validation errors — join them into one readable string
    if (data?.errors) {
      return Object.values(data.errors).flat().join(". ")
    }

    // No response at all — network/timeout failure
    if (!err.response) {
      return "Network error. Please check your connection and try again."
    }

    // Framework-level failures (wrong HTTP method, server crash, expired
    // session token, ...) surface raw technical text — prefer the caller's
    // fallback over exposing that to the user.
    if (status === 405 || status === 419 || (status !== undefined && status >= 500)) {
      return fallback
    }

    // Otherwise the backend sent an app-crafted, user-facing message
    if (data?.message) return data.message
  }
  return fallback
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface UsersState {
  /** Current page of users fetched from the API */
  users: User[]
  /** Pagination metadata from the last successful fetch */
  pagination: UsersPaginationMeta | null
  /** True while fetchUsers is in-flight */
  loading: boolean
  /** Non-null when the last fetch failed (cancelled requests are ignored) */
  error: string | null
  /** True while a create / update / delete mutation is in-flight */
  submitting: boolean
  /** Non-null when the last mutation failed */
  submitError: string | null
  /** The single user loaded by getById (for the detail sheet) */
  selectedUser: User | null
  /** True while getById is loading */
  selectedLoading: boolean

  // ── Roles & Permissions state ────────────────────────────────────────────
  /** Data returned from GET /users/{id}/roles-and-permissions */
  rolesAndPermissions: UserRolesAndPermissions | null
  /** True while fetching roles-and-permissions */
  rolesPermissionsLoading: boolean
  /** Error from roles-and-permissions fetch or sync */
  rolesPermissionsError: string | null
  /** True while a sync (roles/permissions/both) is in-flight */
  syncingRolesPermissions: boolean

  // ── User Projects (stakeholder) state ────────────────────────────────────
  /** Projects where the user is stakeholder (paginated) */
  userProjects: UserProject[] | null
  /** Pagination metadata for the userProjects list */
  userProjectsPagination: UsersPaginationMeta | null
  /** True while fetching user projects */
  userProjectsLoading: boolean
  /** Error from the last userProjects fetch */
  userProjectsError: string | null

  // ── User Task Assignments state ──────────────────────────────────────────
  /** Tasks assigned to the user (full collection, not paginated) */
  userTaskAssignments: UserTaskAssignment[] | null
  /** True while fetching user task assignments */
  userTaskAssignmentsLoading: boolean
  /** Error from the last userTaskAssignments fetch */
  userTaskAssignmentsError: string | null

  // ── Help requests requested by this user ──────────────────────────────────
  /** Paginated list of help requests the user has submitted as requester */
  userRequestedHelpRequests: HelpRequest[] | null
  /** Pagination metadata for the requested help-requests list */
  userRequestedHelpRequestsPagination: HelpRequestPagination | null
  /** True while fetching requested help requests */
  userRequestedHelpRequestsLoading: boolean
  /** Error from the last requested help-requests fetch */
  userRequestedHelpRequestsError: string | null

  // ── Help requests where this user is the assigned helper ──────────────────
  /** Paginated list of help requests the user is assigned to as a helper */
  userHelperHelpRequests: HelpRequest[] | null
  /** Pagination metadata for the helper help-requests list */
  userHelperHelpRequestsPagination: HelpRequestPagination | null
  /** True while fetching helper help requests */
  userHelperHelpRequestsLoading: boolean
  /** Error from the last helper help-requests fetch */
  userHelperHelpRequestsError: string | null
  // ── Tickets submitted by this user (as requester) ──────────────────────
  /** Paginated list of tickets this user submitted */
  userRequestedTickets: ApiTicket[] | null
  /** Pagination metadata for the requested-tickets list */
  userRequestedTicketsPagination: UsersPaginationMeta | null
  /** True while fetching requested tickets */
  userRequestedTicketsLoading: boolean
  /** Error from the last requested-tickets fetch */
  userRequestedTicketsError: string | null

  // ── Tickets assigned to this user ───────────────────────────────────────
  /** Paginated list of tickets currently assigned to this user */
  userAssignedTickets: ApiTicket[] | null
  /** Pagination metadata for the assigned-tickets list */
  userAssignedTicketsPagination: UsersPaginationMeta | null
  /** True while fetching assigned tickets */
  userAssignedTicketsLoading: boolean
  /** Error from the last assigned-tickets fetch */
  userAssignedTicketsError: string | null}

// ─── Actions shape ────────────────────────────────────────────────────────────

interface UsersActions {
  /** Fetch a page of users from GET /users */
  fetchUsers: (page?: number) => Promise<void>
  /** Fetch a single user by id */
  getUser: (id: string) => Promise<void>
  /** Create a new user via POST /users — returns the created user on success */
  createUser: (payload: CreateUserPayload) => Promise<User | null>
  /** Update an existing user via PUT /users/{id} */
  updateUser: (id: string, payload: UpdateUserPayload) => Promise<boolean>
  /** Delete a user via DELETE /users/{id} */
  deleteUser: (id: string) => Promise<boolean>
  /** Clear the list-level error */
  clearError: () => void
  /** Clear the mutation-level error */
  clearSubmitError: () => void

  // ── Roles & Permissions actions ──────────────────────────────────────────
  /** Fetch roles-and-permissions for a user */
  fetchRolesAndPermissions: (userId: string) => Promise<void>
  /** Sync only the user's roles */
  syncRoles: (userId: string, roles: string[]) => Promise<boolean>
  /** Sync only the user's direct permissions */
  syncPermissions: (userId: string, permissions: string[]) => Promise<boolean>
  /** Sync both roles and permissions at once */
  syncRolesAndPermissions: (userId: string, roles: string[], permissions: string[]) => Promise<boolean>
  /** Clear roles-and-permissions error */
  clearRolesPermissionsError: () => void

  // ── User Projects actions ────────────────────────────────────────────────
  /** Fetch a page of projects where the user is stakeholder */
  fetchUserProjects: (userId: string, page?: number) => Promise<void>
  /** Reset user projects (e.g. when the selected user changes) */
  clearUserProjects: () => void

  // ── User Task Assignments actions ────────────────────────────────────────
  /** Fetch all task assignments for a user */
  fetchUserTaskAssignments: (userId: string) => Promise<void>
  /** Reset task assignments (e.g. when the selected user changes) */
  clearUserTaskAssignments: () => void

  // ── Requested help-requests actions ──────────────────────────────────────
  /** Fetch a page of help requests submitted by this user */
  fetchUserRequestedHelpRequests: (userId: string, page?: number) => Promise<void>
  /** Reset requested help requests (e.g. when the selected user changes) */
  clearUserRequestedHelpRequests: () => void

  // ── Helper help-requests actions ──────────────────────────────────────────
  /** Fetch a page of help requests where this user is the assigned helper */
  fetchUserHelperHelpRequests: (userId: string, page?: number) => Promise<void>
  /** Reset helper help requests (e.g. when the selected user changes) */
  clearUserHelperHelpRequests: () => void
  // ── Requested tickets actions ───────────────────────────────────────────────
  /** Fetch a page of tickets submitted by this user */
  fetchUserRequestedTickets: (userId: string, page?: number) => Promise<void>
  /** Reset requested tickets (e.g. when the selected user changes) */
  clearUserRequestedTickets: () => void

  // ── Assigned tickets actions ────────────────────────────────────────────────
  /** Fetch a page of tickets assigned to this user */
  fetchUserAssignedTickets: (userId: string, page?: number) => Promise<void>
  /** Reset assigned tickets (e.g. when the selected user changes) */
  clearUserAssignedTickets: () => void}

type UsersStore = UsersState & UsersActions

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUsersStore = create<UsersStore>()((set, get) => ({
  // ── initial state ──────────────────────────────────────────────────────────
  users: [],
  pagination: null,
  loading: false,
  error: null,
  submitting: false,
  submitError: null,
  selectedUser: null,
  selectedLoading: false,
  rolesAndPermissions: null,
  rolesPermissionsLoading: false,
  rolesPermissionsError: null,
  syncingRolesPermissions: false,

  // ── initial state: user projects ──────────────────────────────────────────
  userProjects: null,
  userProjectsPagination: null,
  userProjectsLoading: false,
  userProjectsError: null,

  // ── initial state: user task assignments ──────────────────────────────────
  userTaskAssignments: null,
  userTaskAssignmentsLoading: false,
  userTaskAssignmentsError: null,

  // ── initial state: requested help requests ────────────────────────────────
  userRequestedHelpRequests: null,
  userRequestedHelpRequestsPagination: null,
  userRequestedHelpRequestsLoading: false,
  userRequestedHelpRequestsError: null,

  // ── initial state: helper help requests ───────────────────────────────────
  userHelperHelpRequests: null,
  userHelperHelpRequestsPagination: null,
  userHelperHelpRequestsLoading: false,
  userHelperHelpRequestsError: null,
  // ── initial state: requested tickets ────────────────────────────────────
  userRequestedTickets: null,
  userRequestedTicketsPagination: null,
  userRequestedTicketsLoading: false,
  userRequestedTicketsError: null,

  // ── initial state: assigned tickets ──────────────────────────────────────
  userAssignedTickets: null,
  userAssignedTicketsPagination: null,
  userAssignedTicketsLoading: false,
  userAssignedTicketsError: null,
  // ── list action ────────────────────────────────────────────────────────────

  fetchUsers: async (page = 1) => {
    set({ loading: true, error: null })

    try {
      const { users, pagination } = await usersService.getAll(page)
      set({ users, pagination })
    } catch (err) {
      if (!isCancel(err)) {
        set({ error: "Failed to load users. Please check your connection and try again." })
      }
    } finally {
      set({ loading: false })
    }
  },

  // ── single-user action ─────────────────────────────────────────────────────

  getUser: async (id: string) => {
    set({ selectedLoading: true, selectedUser: null })

    try {
      const user = await usersService.getById(id)
      set({ selectedUser: user })
    } catch (err) {
      if (!isCancel(err)) {
        set({ error: "Failed to load user details." })
      }
    } finally {
      set({ selectedLoading: false })
    }
  },

  // ── create action ──────────────────────────────────────────────────────────
  // Returns true on success so the UI can navigate away from the form.

  createUser: async (payload: CreateUserPayload) => {
    set({ submitting: true, submitError: null })

    try {
      const user = await usersService.create(payload)
      // Refresh the current page so the new user appears in the list
      const currentPage = get().pagination?.current_page ?? 1
      await get().fetchUsers(currentPage)
      return user
    } catch (err) {
      if (!isCancel(err)) {
        set({ submitError: extractErrorMessage(err, "Failed to create user.") })
      }
      return null
    } finally {
      set({ submitting: false })
    }
  },

  // ── update action ──────────────────────────────────────────────────────────

  updateUser: async (id: string, payload: UpdateUserPayload) => {
    set({ submitting: true, submitError: null })

    try {
      await usersService.update(id, payload)
      const currentPage = get().pagination?.current_page ?? 1
      await get().fetchUsers(currentPage)
      return true
    } catch (err) {
      if (!isCancel(err)) {
        set({ submitError: extractErrorMessage(err, "Failed to update user.") })
      }
      return false
    } finally {
      set({ submitting: false })
    }
  },

  // ── delete action ──────────────────────────────────────────────────────────

  deleteUser: async (id: string) => {
    set({ submitting: true, submitError: null })

    try {
      await usersService.delete(id)
      const currentPage = get().pagination?.current_page ?? 1
      await get().fetchUsers(currentPage)
      return true
    } catch (err) {
      if (!isCancel(err)) {
        set({ submitError: extractErrorMessage(err, "Failed to delete user.") })
      }
      return false
    } finally {
      set({ submitting: false })
    }
  },

  clearError: () => set({ error: null }),
  clearSubmitError: () => set({ submitError: null }),
  clearRolesPermissionsError: () => set({ rolesPermissionsError: null }),

  // ── Roles & Permissions actions ────────────────────────────────────────────

  fetchRolesAndPermissions: async (userId: string) => {
    set({ rolesPermissionsLoading: true, rolesPermissionsError: null, rolesAndPermissions: null })

    try {
      const data = await usersService.getRolesAndPermissions(userId)
      set({ rolesAndPermissions: data })
    } catch (err) {
      if (!isCancel(err)) {
        set({ rolesPermissionsError: extractErrorMessage(err, "Failed to load roles and permissions.") })
      }
    } finally {
      set({ rolesPermissionsLoading: false })
    }
  },

  // Sync only roles, then refresh the data
  syncRoles: async (userId: string, roles: string[]) => {
    set({ syncingRolesPermissions: true, rolesPermissionsError: null })

    try {
      await usersService.syncRoles(userId, roles)
      // Refresh roles-and-permissions after successful sync
      await get().fetchRolesAndPermissions(userId)
      return true
    } catch (err) {
      if (!isCancel(err)) {
        set({ rolesPermissionsError: extractErrorMessage(err, "Failed to sync roles.") })
      }
      return false
    } finally {
      set({ syncingRolesPermissions: false })
    }
  },

  // Sync only permissions, then refresh the data
  syncPermissions: async (userId: string, permissions: string[]) => {
    set({ syncingRolesPermissions: true, rolesPermissionsError: null })

    try {
      await usersService.syncPermissions(userId, permissions)
      await get().fetchRolesAndPermissions(userId)
      return true
    } catch (err) {
      if (!isCancel(err)) {
        set({ rolesPermissionsError: extractErrorMessage(err, "Failed to sync permissions.") })
      }
      return false
    } finally {
      set({ syncingRolesPermissions: false })
    }
  },

  // Sync both roles and permissions at once, then refresh
  syncRolesAndPermissions: async (userId: string, roles: string[], permissions: string[]) => {
    set({ syncingRolesPermissions: true, rolesPermissionsError: null })

    try {
      await usersService.syncRolesAndPermissions(userId, roles, permissions)
      await get().fetchRolesAndPermissions(userId)
      return true
    } catch (err) {
      if (!isCancel(err)) {
        set({ rolesPermissionsError: extractErrorMessage(err, "Failed to sync roles and permissions.") })
      }
      return false
    } finally {
      set({ syncingRolesPermissions: false })
    }
  },

  // ── User Projects actions ──────────────────────────────────────────────────

  // Fetch a page of projects where this user is the stakeholder.
  // Clears previous data before each fresh fetch.
  fetchUserProjects: async (userId: string, page = 1) => {
    set({ userProjectsLoading: true, userProjectsError: null })

    try {
      const { projects, pagination } = await usersService.getUserProjects(userId, page)
      set({ userProjects: projects, userProjectsPagination: pagination })
    } catch (err) {
      if (!isCancel(err)) {
        set({ userProjectsError: extractErrorMessage(err, "Failed to load user projects.") })
      }
    } finally {
      set({ userProjectsLoading: false })
    }
  },

  // Reset user projects — call when the active user in the sheet changes
  clearUserProjects: () =>
    set({ userProjects: null, userProjectsPagination: null, userProjectsError: null }),

  // ── User Task Assignments actions ──────────────────────────────────────────

  // Fetch the full list of task assignments for this user (collection, not paginated).
  fetchUserTaskAssignments: async (userId: string) => {
    set({ userTaskAssignmentsLoading: true, userTaskAssignmentsError: null })

    try {
      const assignments = await usersService.getUserTaskAssignments(userId)
      set({ userTaskAssignments: assignments })
    } catch (err) {
      if (!isCancel(err)) {
        set({ userTaskAssignmentsError: extractErrorMessage(err, "Failed to load task assignments.") })
      }
    } finally {
      set({ userTaskAssignmentsLoading: false })
    }
  },

  // Reset task assignments — call when the active user in the sheet changes
  clearUserTaskAssignments: () =>
    set({ userTaskAssignments: null, userTaskAssignmentsError: null }),

  // ── Requested help-requests actions ────────────────────────────────────────

  // Fetch a page of help requests submitted by this user (as requester).
  fetchUserRequestedHelpRequests: async (userId: string, page = 1) => {
    set({ userRequestedHelpRequestsLoading: true, userRequestedHelpRequestsError: null })

    try {
      const { helpRequests, pagination } =
        await usersService.getUserRequestedHelpRequests(userId, page)
      set({
        userRequestedHelpRequests: helpRequests,
        userRequestedHelpRequestsPagination: pagination,
      })
    } catch (err) {
      if (!isCancel(err)) {
        set({
          userRequestedHelpRequestsError: extractErrorMessage(
            err,
            "Failed to load requested help requests.",
          ),
        })
      }
    } finally {
      set({ userRequestedHelpRequestsLoading: false })
    }
  },

  // Reset requested help requests — call when the active user in the sheet changes
  clearUserRequestedHelpRequests: () =>
    set({
      userRequestedHelpRequests: null,
      userRequestedHelpRequestsPagination: null,
      userRequestedHelpRequestsError: null,
    }),

  // ── Helper help-requests actions ────────────────────────────────────────────

  // Fetch a page of help requests where this user is the assigned helper.
  fetchUserHelperHelpRequests: async (userId: string, page = 1) => {
    set({ userHelperHelpRequestsLoading: true, userHelperHelpRequestsError: null })

    try {
      const { helpRequests, pagination } =
        await usersService.getUserHelperHelpRequests(userId, page)
      set({
        userHelperHelpRequests: helpRequests,
        userHelperHelpRequestsPagination: pagination,
      })
    } catch (err) {
      if (!isCancel(err)) {
        set({
          userHelperHelpRequestsError: extractErrorMessage(
            err,
            "Failed to load helper assignments.",
          ),
        })
      }
    } finally {
      set({ userHelperHelpRequestsLoading: false })
    }
  },

  // Reset helper help requests — call when the active user in the sheet changes
  clearUserHelperHelpRequests: () =>
    set({
      userHelperHelpRequests: null,
      userHelperHelpRequestsPagination: null,
      userHelperHelpRequestsError: null,
    }),

  // ── Requested tickets actions ──────────────────────────────────────────────

  // Fetch a page of tickets submitted by this user (as requester).
  fetchUserRequestedTickets: async (userId: string, page = 1) => {
    set({ userRequestedTicketsLoading: true, userRequestedTicketsError: null })

    try {
      const { tickets, pagination } = await usersService.getUserRequestedTickets(userId, page)
      set({ userRequestedTickets: tickets, userRequestedTicketsPagination: pagination })
    } catch (err) {
      if (!isCancel(err)) {
        set({
          userRequestedTicketsError: extractErrorMessage(err, "Failed to load requested tickets."),
        })
      }
    } finally {
      set({ userRequestedTicketsLoading: false })
    }
  },

  // Reset requested tickets — call when the active user in the sheet changes
  clearUserRequestedTickets: () =>
    set({
      userRequestedTickets: null,
      userRequestedTicketsPagination: null,
      userRequestedTicketsError: null,
    }),

  // ── Assigned tickets actions ────────────────────────────────────────────────

  // Fetch a page of tickets assigned to this user.
  fetchUserAssignedTickets: async (userId: string, page = 1) => {
    set({ userAssignedTicketsLoading: true, userAssignedTicketsError: null })

    try {
      const { tickets, pagination } = await usersService.getUserAssignedTickets(userId, page)
      set({ userAssignedTickets: tickets, userAssignedTicketsPagination: pagination })
    } catch (err) {
      if (!isCancel(err)) {
        set({
          userAssignedTicketsError: extractErrorMessage(err, "Failed to load assigned tickets."),
        })
      }
    } finally {
      set({ userAssignedTicketsLoading: false })
    }
  },

  // Reset assigned tickets — call when the active user in the sheet changes
  clearUserAssignedTickets: () =>
    set({
      userAssignedTickets: null,
      userAssignedTicketsPagination: null,
      userAssignedTicketsError: null,
    }),
}))
