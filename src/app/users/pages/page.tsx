import { useState, useMemo, useEffect } from "react"
import { useLocation, useNavigate, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Plus, Search, LayoutList, LayoutGrid, RefreshCw } from "lucide-react"
import { Pagination } from "@/components/pagination"
import { PaginationInfo } from "@/components/pagination-info"
import { UserTableView } from "@/app/users/pages/user-table-view"
import { UserGridView } from "@/app/users/pages/user-grid-view"
import { UserForm } from "@/app/users/pages/user-form"
import { ConfirmDeleteDialog } from "@/app/users/pages/confirm-delete-dialog"
import { useUsers } from "@/hooks/useUsers"
import { usePermissions } from "@/hooks/usePermissions"
import type { User } from "@/app/users/data"
import type { UserFormData } from "@/app/users/pages/user-form"
import { UserDetailSheet } from "./user-detail-sheet"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { usersService } from "@/services/usersService"

type ViewMode = "table" | "grid"
type PageView = "list" | "form"

// Shape passed via React Router location.state when navigating to the edit
// route from a place that already has the full user object in hand (e.g. a
// table row click) — lets the form render instantly instead of waiting on
// a GET /users/{id} round trip.
interface UserFormLocationState {
  editUser?: User
}

export default function UsersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id: urlId } = useParams<{ id?: string }>()
  const [view, setView] = useState<ViewMode>("table")
  const [search, setSearch] = useState("")

  // Read the current user's permissions once; used to conditionally show
  // page sections and action buttons throughout this page.
  const { hasPermission } = usePermissions()
  const canViewUsers   = hasPermission("view users")
  const canCreateUsers = hasPermission("create users")
  const canEditUsers   = hasPermission("edit users")
  const canDeleteUsers = hasPermission("delete users")

  // Determine if we're on a sub-route (/users/create, /users/:id/edit) —
  // these render the form instead of the list, and drive the breadcrumb.
  const isCreateRoute = location.pathname.endsWith("/create")
  const isEditRoute   = !!urlId && location.pathname.endsWith("/edit")

  // Page-level view state (list vs create/edit form), seeded from the URL
  // so a direct load of /users/create or /users/:id/edit renders correctly.
  const [pageView, setPageView] = useState<PageView>(() =>
    (isCreateRoute || isEditRoute) ? "form" : "list"
  )
  const [formMode, setFormMode] = useState<"create" | "edit">(() =>
    isEditRoute ? "edit" : "create"
  )

  // The user currently being edited (null for create). Seed from
  // navigation state so the form is available instantly when coming from
  // a row click; falls back to a fresh fetch below for direct URL loads.
  const [selectedUser, setSelectedUser] = useState<User | null>(
    () => (location.state as UserFormLocationState | null)?.editUser ?? null
  )

  // Sheet (detail panel) state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetUser, setSheetUser] = useState<User | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)

  // ── API data via useUsers hook ────────────────────────────────────────────────
  const {
    users,
    pagination,
    loading,
    error,
    submitting,
    submitError,
    fetchUsers,
    getUser,
    selectedUser: fetchedUser,
    createUser,
    updateUser,
    deleteUser: deleteUserApi,
    clearSubmitError,
  } = useUsers()

  // Keep pageView/formMode in sync with the URL (covers in-app navigation
  // between /users/create and /users/:id/edit, not just the initial load).
  useEffect(() => {
    if (isCreateRoute || isEditRoute) {
      setPageView("form")
      setFormMode(isEditRoute ? "edit" : "create")
    } else {
      setPageView("list")
    }
  }, [isCreateRoute, isEditRoute])

  // Keep selectedUser in sync with the URL. Since UsersPage stays mounted
  // across /users/create <-> /users/:id/edit navigations (same component,
  // different route), state from a previous target would otherwise leak
  // into the next view (e.g. a stale user pre-filling the create form).
  useEffect(() => {
    if (isCreateRoute) {
      setSelectedUser(null)
      return
    }
    if (isEditRoute && urlId) {
      const stateUser = (location.state as UserFormLocationState | null)?.editUser
      setSelectedUser(stateUser && stateUser.id === urlId ? stateUser : null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateRoute, isEditRoute, urlId])

  // Direct load of /users/:id/edit (fresh page load, or switching straight
  // from one edit target to another) — fetch the user by id. This also
  // populates the store's selectedUser so the breadcrumb can show the
  // user's name instead of a raw id.
  useEffect(() => {
    if (isEditRoute && urlId && !selectedUser) {
      getUser(urlId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditRoute, urlId, selectedUser])

  // Hydrate local selectedUser once the fetch above resolves.
  useEffect(() => {
    if (!fetchedUser || !urlId) return
    if (isEditRoute && fetchedUser.id === urlId && !selectedUser) setSelectedUser(fetchedUser)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedUser])

  // ── Deep-link from dashboard (TeamCarousel card click) — opens the detail sheet ───
  useEffect(() => {
    const state = location.state as { openUserId?: string } | null
    if (!state?.openUserId) return

    usersService.getById(state.openUserId).then((user) => {
      setSheetUser(user)
      setSheetOpen(true)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Client-side search filters the current page
  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    )
  }, [users, search])

  // ── Pagination helpers ───────────────────────────────────────────────────────
  const currentPage = pagination?.current_page ?? 1
  const totalPages = search ? 1 : (pagination?.last_page ?? 1)
  const totalItems = search ? filtered.length : (pagination?.total ?? 0)
  const startItem = search ? (filtered.length ? 1 : 0) : (pagination?.from ?? 0)
  const endItem = search ? filtered.length : (pagination?.to ?? 0)
  const displayedUsers = filtered

  // ── Navigation handlers ─────────────────────────────────────────────────────

  function handleCreate() {
    clearSubmitError()
    navigate("/users/create")
  }

  function handleEdit(user: User) {
    clearSubmitError()
    navigate(`/users/${user.id}/edit`, { state: { editUser: user } })
    setSheetOpen(false)
  }

  function handleDelete(user: User) {
    clearSubmitError()
    setDeleteUser(user)
    setDeleteDialogOpen(true)
  }

  // ── Real delete via API ─────────────────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!deleteUser) return
    const ok = await deleteUserApi(deleteUser.id)
    if (ok) {
      setDeleteDialogOpen(false)
      setDeleteUser(null)
    }
    // If not ok, the dialog stays open showing submitError
  }

  function handleSelect(user: User) {
    setSheetUser(user)
    setSheetOpen(true)
  }

  // ── Real create / update via API ────────────────────────────────────────────
  async function handleFormSubmit(data: UserFormData): Promise<string | null> {
    if (formMode === "create") {
      const createdUser = await createUser({
        name: data.name,
        email: data.email,
        password: data.password,
      })
      if (createdUser) return createdUser.id
    } else if (selectedUser) {
      // Update — only include password if the user typed one
      const ok = await updateUser(selectedUser.id, {
        name: data.name,
        email: data.email,
        ...(data.password ? { password: data.password } : {}),
      })
      if (ok) return selectedUser.id
    }
    return null
  }

  function handleFormCancel() {
    clearSubmitError()
    navigate("/users")
  }

  // ── Change API page ─────────────────────────────────────────────────────────
  function handlePageChange(newPage: number) {
    setSearch("")
    fetchUsers(newPage)
  }

  // ── Form view ───────────────────────────────────────────────────────────────
  // Permission gating for /users/create and /users/:id/edit is handled at
  // the router level (see App.tsx), so no in-render redirect is needed here.
  if (pageView === "form") {
    return (
      <UserForm
        mode={formMode}
        initialData={selectedUser}
        submitting={submitting}
        submitError={submitError}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        onSuccess={() => navigate("/users")}
      />
    )
  }

  return (
    // Page-level guard: only users with "view users" can see this page.
    // Everyone else is redirected to /dashboard.
    <ProtectedRoute permission="view users">
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">Users</h2>
              {/* Show total from API when not searching, otherwise show filtered count */}
              <Badge variant="secondary" className="uppercase tracking-wider">
                {loading ? "…" : `${totalItems} Users`}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Manage organizational access, roles, and security protocols.
            </p>
          </div>
          {/* Only users with "create users" permission see the Add User button */}
          {canCreateUsers && (
            <Button
              className="transition-all hover:shadow-md hover:shadow-primary/25"
              size="lg"
              onClick={handleCreate}
            >
              <Plus />
              Add User
            </Button>
          )}
        </div>

        {/* ── Error banner ────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-destructive hover:text-destructive"
              onClick={() => fetchUsers(currentPage)}
            >
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by name, email or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-10 text-sm"
              disabled={loading}
            />
          </div>

          <ToggleGroup
            type="single"
            variant="outline"
            value={view}
            onValueChange={(v) => {
              if (v) setView(v as ViewMode)
            }}
          >
            <ToggleGroupItem value="table" aria-label="Table view">
              <LayoutList className="size-3.5" />
              <span className="hidden sm:inline">Table</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* ── Content (only shown when not loading) ────────────────────────────── */}
        {!loading && !error && (
          <>
            {displayedUsers.length === 0 ? (
              // Empty state — shown when the API returned zero users or search matched nothing
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
                <Search className="size-8 opacity-40" />
                <p className="text-sm">
                  {search ? `No users matched "${search}"` : "No users found."}
                </p>
              </div>
            ) : view === "table" ? (
              // Pass permission flags so the table can hide edit/delete buttons
              // for users who don't hold the corresponding permission.
              <UserTableView
                users={displayedUsers}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSelect={handleSelect}
                canEdit={canEditUsers}
                canDelete={canDeleteUsers}
                canView={canViewUsers}
              />
            ) : (
              <UserGridView
                users={displayedUsers}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSelect={handleSelect}
                canEdit={canEditUsers}
                canDelete={canDeleteUsers}
                canView={canViewUsers}
              />
            )}

            {/* Pagination — hidden when search is active (all results shown at once) */}
            {!search && displayedUsers.length >= 15 && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PaginationInfo
                  startItem={startItem}
                  endItem={endItem}
                  totalItems={totalItems}
                  label="users"
                />
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* User Detail Sheet — pass canEdit so the sheet can hide the Edit button
          when the current user lacks "edit users" permission */}
      <UserDetailSheet
        user={sheetUser}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={canEditUsers ? handleEdit : undefined}
      />

      {/* Confirm Delete Dialog — shows loading + error from the API */}
      <ConfirmDeleteDialog
        user={deleteUser}
        open={deleteDialogOpen}
        submitting={submitting}
        submitError={submitError}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
      />
    </ProtectedRoute>
  )
}
