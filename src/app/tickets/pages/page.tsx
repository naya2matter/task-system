// ─── Tickets Page ─────────────────────────────────────────────────────────────
// Main listing page. Connects to these endpoints:
//   READ:
//   - GET /tickets                    → All Requests tab (no filter)
//   - GET /tickets/available          → Available tab
//   - GET /tickets/status/{status}    → All Requests tab with status filter active
//   - GET /tickets/type/{type}        → All Requests tab with type filter active
//   - GET /tickets/{id}               → Detail sheet (fetched on open)
//   WRITE:
//   - POST /tickets                   → Create (form view)
//   - POST /tickets/{id}              → Update (form view)
//   - POST /tickets/{id}/claim        → Claim action
//   - POST /tickets/{id}/assign/{uid} → Assign dialog
//   - POST /tickets/{id}/unassign     → Unassign action (with confirm dialog)
//   - POST /tickets/{id}/status       → Change status dialog
//   - POST /tickets/{id}/complete     → Complete action (with confirm dialog)
//   DELETE:
//   - DELETE /tickets/{id}            → Delete (with confirm dialog)
//
// UI updates happen instantly via Zustand store patches — no page refresh needed.

import { useState, useMemo, useEffect } from "react"
import { useNavigate, useLocation, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, LayoutList, LayoutGrid, AlertCircle, Ticket } from "lucide-react"
import { Pagination } from "@/components/pagination"
import { PaginationInfo } from "@/components/pagination-info"
import InlineStats from "@/components/inline-stats"
import { usePermissions } from "@/hooks/usePermissions"

// API hooks — each connects to a different read endpoint
import { useTickets } from "@/app/tickets/hooks/useTickets"
import { useAvailableTickets } from "@/app/tickets/hooks/useAvailableTickets"
import { useTicket } from "@/app/tickets/hooks/useTicket"

// Write actions from the central Zustand store
import { useTicketsStore } from "@/app/tickets/store/ticketStore"

// Page sub-components
import { TicketTableView } from "@/app/tickets/pages/ticket-table-view"
import { TicketGridView } from "@/app/tickets/pages/ticket-grid-view"
import { TicketDetailSheet } from "@/app/tickets/pages/ticket-detail-sheet"
import { ConfirmDeleteTicketDialog } from "@/app/tickets/pages/confirm-delete-ticket-dialog"
import { TicketForm } from "@/app/tickets/pages/ticket-form"
import { AssignTicketDialog } from "@/app/tickets/pages/assign-ticket-dialog"
// New dialogs for quick actions
import { ChangeStatusDialog } from "@/app/tickets/pages/change-status-dialog"
import { ConfirmActionDialog } from "@/app/tickets/pages/confirm-action-dialog"

// API-aligned types and display mapping helpers
import type { ApiTicket, ApiTicketStatus, ApiTicketType, TicketFormValues } from "@/app/tickets/types"
import {
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
} from "@/app/tickets/types"

type LayoutMode = "table" | "grid"
type PageView   = "list" | "form"

// Status options for the filter dropdown — "all" resets to GET /tickets
const statusOptions: { value: ApiTicketStatus | "all"; label: string }[] = [
  { value: "all",        label: "All Statuses" },
  { value: "open",       label: TICKET_STATUS_LABELS.open },
  { value: "in_progress", label: TICKET_STATUS_LABELS.in_progress },
  { value: "resolved",   label: TICKET_STATUS_LABELS.resolved },
]

// Type options for the filter dropdown — "all" resets to GET /tickets
const typeOptions: { value: ApiTicketType | "all"; label: string }[] = [
  { value: "all",               label: "All Types" },
  { value: "quick_fix",         label: TICKET_TYPE_LABELS.quick_fix },
  { value: "bug_investigation", label: TICKET_TYPE_LABELS.bug_investigation },
  { value: "user_support",      label: TICKET_TYPE_LABELS.user_support },
]

export default function TicketsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: urlId } = useParams<{ id?: string }>()
  const isCreateRoute = location.pathname.endsWith("/create")
  const isEditRoute = !!urlId && location.pathname.endsWith("/edit")
  const isDetailRoute = !!urlId && !location.pathname.endsWith("/edit") && !location.pathname.endsWith("/create")
  const ticketIdFromUrl = urlId ? parseInt(urlId, 10) : null

  // ── View / layout ────────────────────────────────────────────────────────────
  const [pageView, setPageView]   = useState<PageView>(() =>
    isCreateRoute || isEditRoute ? "form" : "list"
  )
  const [layout, setLayout]       = useState<LayoutMode>("table")
  const [activeTab, setActiveTab] = useState("all")

  // ── Permission checks ────────────────────────────────────────────────────────
  const { hasPermission } = usePermissions()
  const canEdit   = hasPermission("edit tickets")
  const canCreate = hasPermission("create help requests")

  // ── Search (client-side on currently-loaded page) ─────────────────────────
  const [search, setSearch] = useState("")

  // ── Server-side filters — only one active at a time ───────────────────────
  // Selecting a status clears the type and vice-versa (see handlers below)
  const [statusFilter, setStatusFilter] = useState<ApiTicketStatus | "all">("all")
  const [typeFilter,   setTypeFilter]   = useState<ApiTicketType | "all">("all")

  // ── Pagination state for each tab ─────────────────────────────────────────
  const [allPage, setAllPage]             = useState(1)
  const [availablePage, setAvailablePage] = useState(1)

  // ── Detail sheet state ────────────────────────────────────────────────────
  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [sheetTicketId, setSheetTicketId] = useState<number | null>(null)

  // ── Delete dialog state ───────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTicket,     setDeleteTicket]     = useState<ApiTicket | null>(null)

  // ── Form state ────────────────────────────────────────────────────────────
  // editTicket stores the full ticket when switching to edit mode
  const [formMode,   setFormMode]   = useState<"create" | "edit">(
    isEditRoute ? "edit" : "create"
  )
  const [editTicket, setEditTicket] = useState<ApiTicket | null>(() =>
    (location.state as { editTicket?: ApiTicket } | null)?.editTicket ?? null
  )

  const { ticket: urlTicket } = useTicket(ticketIdFromUrl)

  useEffect(() => {
    if (!urlTicket) return
    if (isEditRoute && !editTicket) {
      setEditTicket(urlTicket)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTicket])

  useEffect(() => {
    if (isCreateRoute) {
      setFormMode("create")
      setEditTicket(null)
    } else if (isEditRoute) {
      setFormMode("edit")
    } else {
      setFormMode("create")
      setEditTicket(null)
    }
  }, [isCreateRoute, isEditRoute])

  useEffect(() => {
    setPageView(isCreateRoute || isEditRoute ? "form" : "list")
  }, [isCreateRoute, isEditRoute])

  useEffect(() => {
    if (isDetailRoute && ticketIdFromUrl !== null) {
      setSheetTicketId(ticketIdFromUrl)
      setSheetOpen(true)
    } else if (!isDetailRoute) {
      setSheetOpen(false)
    }
  }, [isDetailRoute, ticketIdFromUrl])

  function handleSheetOpenChange(open: boolean) {
    if (!open && isDetailRoute) {
      navigate("/tickets")
    }
    setSheetOpen(open)
  }

  // ── Assign dialog state ───────────────────────────────────────────────────
  const [assignDialogOpen,   setAssignDialogOpen]   = useState(false)
  const [assignTarget,       setAssignTarget]       = useState<ApiTicket | null>(null)

  // ── Status change dialog state ────────────────────────────────────────────
  const [statusDialogOpen,   setStatusDialogOpen]   = useState(false)
  const [statusTarget,       setStatusTarget]       = useState<ApiTicket | null>(null)

  // ── Unassign confirm dialog state ─────────────────────────────────────────
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false)
  const [unassignTarget,     setUnassignTarget]     = useState<ApiTicket | null>(null)

  // ── Complete confirm dialog state ─────────────────────────────────────────
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [completeTarget,     setCompleteTarget]     = useState<ApiTicket | null>(null)

  // ── Write state from the store (submitting flags + errors) ───────────────
  const submitting      = useTicketsStore((s) => s.submitting)
  const submitError     = useTicketsStore((s) => s.submitError)
  const actionSubmitting = useTicketsStore((s) => s.actionSubmitting)
  const actionError     = useTicketsStore((s) => s.actionError)
  const clearSubmitError = useTicketsStore((s) => s.clearSubmitError)
  const clearActionError = useTicketsStore((s) => s.clearActionError)

  // ── Write actions from the store ──────────────────────────────────────────
  const createTicket       = useTicketsStore((s) => s.createTicket)
  const updateTicket       = useTicketsStore((s) => s.updateTicket)
  const claimTicket        = useTicketsStore((s) => s.claimTicket)
  const assignTicket       = useTicketsStore((s) => s.assignTicket)
  const unassignTicket     = useTicketsStore((s) => s.unassignTicket)
  const updateTicketStatus = useTicketsStore((s) => s.updateTicketStatus)
  const completeTicket     = useTicketsStore((s) => s.completeTicket)
  const deleteTicketAction = useTicketsStore((s) => s.deleteTicket)

  // ── API: All Requests tab ─────────────────────────────────────────────────
  // Switches between GET /tickets, GET /tickets/status/{s}, GET /tickets/type/{t}
  // depending on which filter is active.
  const allParams = {
    page:         allPage,
    per_page:     15,
    statusFilter: statusFilter !== "all" ? statusFilter : undefined,
    typeFilter:   typeFilter   !== "all" ? typeFilter   : undefined,
  }
  const { tickets, pagination, loading, error, refetch: refetchAll } = useTickets(allParams)

  // ── API: Available tab ────────────────────────────────────────────────────
  // Always calls GET /tickets/available regardless of filters
  const availableParams = { page: availablePage, per_page: 15 }
  const { availableTickets, availablePagination, availableLoading, availableError, refetch: refetchAvailable } =
    useAvailableTickets(availableParams)

  // Silently refreshes full data to update pagination totals and inline stats
  function silentBackgroundRefresh() {
    refetchAll()
    refetchAvailable()
  }

  // ── Client-side search filter applied to the current page ─────────────────
  // Only searches within the currently-loaded page results (no API search yet)
  const filteredTickets = useMemo(() => {
    if (!search.trim()) return tickets
    const q = search.toLowerCase()
    return tickets.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.requester?.name.toLowerCase().includes(q) ?? false) ||
        t.requester_name.toLowerCase().includes(q) ||
        (t.assignee?.name.toLowerCase().includes(q) ?? false) ||
        String(t.id).includes(q),
    )
  }, [search, tickets])

  const filteredAvailable = useMemo(() => {
    if (!search.trim()) return availableTickets
    const q = search.toLowerCase()
    return availableTickets.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.requester?.name.toLowerCase().includes(q) ?? false) ||
        t.requester_name.toLowerCase().includes(q),
    )
  }, [search, availableTickets])

  // ── Filter handlers ───────────────────────────────────────────────────────

  // Status filter — clears type filter so only one server filter is active
  function handleStatusFilterChange(value: string) {
    setStatusFilter(value as ApiTicketStatus | "all")
    setTypeFilter("all")
    setAllPage(1)
  }

  // Type filter — clears status filter so only one server filter is active
  function handleTypeChange(value: string) {
    setTypeFilter(value as ApiTicketType | "all")
    setStatusFilter("all")
    setAllPage(1)
  }

  // Search input reset — go back to page 1 on new query
  function handleSearchChange(value: string) {
    setSearch(value)
    setAllPage(1)
    setAvailablePage(1)
  }

  // ── Detail page navigation handlers ───────────────────────────────────────

  // Navigate to the ticket detail page
  function handleSelect(ticket: ApiTicket) {
    navigate(`/tickets/${ticket.id}`)
  }

  // ── Form navigation handlers ──────────────────────────────────────────────

  // Navigate to the form view in create mode
  function handleCreate() {
    clearSubmitError()
    navigate("/tickets/create")
  }

  // Navigate to the form view in edit mode, pre-filling with the ticket data
  function handleEdit(ticket: ApiTicket) {
    clearSubmitError()
    navigate(`/tickets/${ticket.id}/edit`, { state: { editTicket: ticket } })
  }

  // Return to list without submitting
  function handleFormCancel() {
    setEditTicket(null)
    navigate("/tickets")
  }

  // ── Form submit handler ───────────────────────────────────────────────────
  // Called by TicketForm with the collected values; dispatches to store
  async function handleFormSubmit(values: TicketFormValues) {
    if (formMode === "create") {
      const success = await createTicket(values)
      if (success) {
        setEditTicket(null)
        return true
      }
    } else if (editTicket) {
      const success = await updateTicket(editTicket.id, values)
      if (success) {
        setEditTicket(null)
        return true
      }
    }

    return false
  }

  // ── Quick action handlers ─────────────────────────────────────────────────

  // POST /tickets/{id}/claim — self-assign current user (immediate, no confirm needed)
  async function handleClaim(ticket: ApiTicket) {
    clearActionError()
    const success = await claimTicket(ticket.id)
    if (success) silentBackgroundRefresh()
  }

  // Open unassign confirmation dialog instead of acting immediately
  function handleUnassign(ticket: ApiTicket) {
    setUnassignTarget(ticket)
    setUnassignDialogOpen(true)
  }

  // POST /tickets/{id}/unassign — confirmed from the dialog
  async function handleUnassignConfirm() {
    if (!unassignTarget) return
    clearActionError()
    const success = await unassignTicket(unassignTarget.id)
    if (success) {
      setUnassignDialogOpen(false)
      setUnassignTarget(null)
      silentBackgroundRefresh()
    }
  }

  // Open the assign-to-user dialog
  function handleOpenAssignDialog(ticket: ApiTicket) {
    setAssignTarget(ticket)
    setAssignDialogOpen(true)
  }

  // POST /tickets/{id}/assign/{userId} — called from AssignTicketDialog
  async function handleAssignConfirm(ticket: ApiTicket, userId: number) {
    clearActionError()
    const success = await assignTicket(ticket.id, userId)
    if (success) {
      setAssignDialogOpen(false)
      silentBackgroundRefresh()
    }
  }

  // Open status change dialog
  function handleOpenStatusDialog(ticket: ApiTicket) {
    setStatusTarget(ticket)
    setStatusDialogOpen(true)
  }

  // POST /tickets/{id}/status — confirmed from the change-status dialog
  async function handleStatusConfirm(ticket: ApiTicket, status: ApiTicketStatus) {
    clearActionError()
    const success = await updateTicketStatus(ticket.id, status)
    if (success) {
      setStatusDialogOpen(false)
      setStatusTarget(null)
      silentBackgroundRefresh()
    }
  }

  // POST /tickets/{id}/status — called from the detail sheet inline dropdown
  async function handleStatusChange(ticket: ApiTicket, status: ApiTicketStatus) {
    clearActionError()
    const success = await updateTicketStatus(ticket.id, status)
    if (success) silentBackgroundRefresh()
  }

  // Open complete confirmation dialog
  function handleOpenCompleteDialog(ticket: ApiTicket) {
    setCompleteTarget(ticket)
    setCompleteDialogOpen(true)
  }

  // POST /tickets/{id}/complete — confirmed from the dialog
  async function handleCompleteConfirm() {
    if (!completeTarget) return
    clearActionError()
    const success = await completeTicket(completeTarget.id)
    if (success) {
      setCompleteDialogOpen(false)
      setCompleteTarget(null)
      silentBackgroundRefresh()
    }
  }

  // POST /tickets/{id}/complete — called from the detail sheet (no confirm dialog)
  async function handleComplete(ticket: ApiTicket) {
    clearActionError()
    const success = await completeTicket(ticket.id)
    if (success) silentBackgroundRefresh()
  }

  // ── Delete dialog handlers ────────────────────────────────────────────────

  // Open delete confirm dialog
  function handleDelete(ticket: ApiTicket) {
    setDeleteTicket(ticket)
    setDeleteDialogOpen(true)
  }

  // Confirm delete — calls DELETE /tickets/{id} and removes from UI instantly
  async function handleConfirmDelete() {
    if (!deleteTicket) return
    clearActionError()
    const success = await deleteTicketAction(deleteTicket.id)
    if (success) {
      setDeleteDialogOpen(false)
      setDeleteTicket(null)
      silentBackgroundRefresh()
      // Close detail sheet if the deleted ticket was being viewed
      if (sheetTicketId === deleteTicket.id) {
        setSheetOpen(false)
        setSheetTicketId(null)
      }
    }
  }

  // ── Form view ─────────────────────────────────────────────────────────────
  if (pageView === "form") {
    // Block access to the create form for users without create permissions
    if (formMode === "create" && !canCreate) {
      setPageView("list")
      return null
    }
    // Block access to the edit form for users without edit permissions
    if (formMode === "edit" && !canEdit) {
      setPageView("list")
      return null
    }
    // In edit mode, wait for ticket data before rendering the form so that
    // useState initializers in TicketForm receive the actual values on first mount.
    if (formMode === "edit" && !editTicket) {
      return (
        <div className="flex w-full justify-center p-4 md:p-8">
          <div className="w-full max-w-4xl space-y-6">
            <Skeleton className="h-16 w-72" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-36 w-full" />
            <div className="grid grid-cols-2 gap-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      )
    }
    return (
      <TicketForm
        mode={formMode}
        // Pass the full ticket for edit, null for create
        initialData={editTicket}
        onSubmit={async (values) => {
          const success = await handleFormSubmit(values)
          if (success) navigate("/tickets")
        }}
        onCancel={handleFormCancel}
        submitting={submitting}
        submitError={submitError}
      />
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">

        {/* ── Page header ────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">Tickets</h2>
              {/* Total count comes from API pagination, not client-side count */}
              {pagination && (
                <Badge variant="secondary" className="uppercase tracking-wider">
                  {pagination.total} Tickets
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Track and manage support tickets, bugs, and requests.
            </p>
          </div>
          {/* Add Ticket button — only shown when user has create permission */}
          {canCreate && (
            <Button
              className="transition-all hover:shadow-md hover:shadow-primary/25 w-full sm:w-auto"
              size="lg"
              onClick={handleCreate}
            >
              <Plus />
              Add Ticket
            </Button>
          )}
        </div>

        {/* ── Inline stats ───────────────────────────────────────────────────── */}
        <InlineStats
          items={[
            { label: "Total",     value: pagination?.total          ?? (loading          ? "..." : 0) },
            { label: "Available", value: availablePagination?.total ?? (availableLoading ? "..." : 0) },
            { label: "Open",      value: loading ? "..." : tickets.filter((t) => t.status === "open").length },
            { label: "Resolved",  value: loading ? "..." : tickets.filter((t) => t.status === "resolved").length },
          ]}
        />

        {/* ── Tabs + controls ────────────────────────────────────────────────── */}
        <Tabs
          defaultValue="all"
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col gap-4"
        >
          {/* Tab list + search/filter/view controls in one responsive row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <TabsList>
                <TabsTrigger value="all" className="flex items-center gap-2">
                  All Requests
                  {pagination && (
                    <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                      {pagination.total}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="available" className="flex items-center gap-2">
                  Available
                  {availablePagination && (
                    <Badge variant="secondary" className="px-1 py-0 text-[10px] text-primary">
                      {availablePagination.total}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Search + filters + view toggle */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search — filters the currently-loaded page client-side */}
              <div className="relative flex-1 min-w-48 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search tickets, users..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-8 h-10 text-sm"
                />
              </div>

              {/* Status filter — only visible on "all" tab; calls GET /tickets/status/{s} */}
              {activeTab === "all" && (
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-40 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Type filter — clears when status filter is selected; calls GET /tickets/type/{t} */}
              {activeTab === "all" && (
                <Select value={typeFilter} onValueChange={handleTypeChange}>
                  <SelectTrigger className="w-44 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Table / Grid view toggle */}
              <ToggleGroup
                type="single"
                variant="outline"
                value={layout}
                onValueChange={(v) => { if (v) setLayout(v as LayoutMode) }}
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
          </div>

          {/* ── All Requests tab ────────────────────────────────────────────── */}
          <TabsContent value="all" className="mt-0">
            {/* Error banner — shown for non-cancel API errors */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive mb-4">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Loading skeleton rows */}
            {loading && (
              <div className="space-y-2 mb-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-md" />
                ))}
              </div>
            )}

            {/* Table or grid content */}
            {!loading && !error && (
              <>
                {filteredTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <Ticket className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No tickets found.</p>
                  </div>
                ) : layout === "table" ? (
                  <TicketTableView
                    tickets={filteredTickets}
                    onSelect={handleSelect}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAssign={handleOpenAssignDialog}
                    onClaim={handleClaim}
                    onUnassign={handleUnassign}
                    onComplete={handleOpenCompleteDialog}
                    onStatusChange={handleOpenStatusDialog}
                  />
                ) : (
                  <TicketGridView
                    tickets={filteredTickets}
                    onSelect={handleSelect}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAssign={handleOpenAssignDialog}
                    onClaim={handleClaim}
                    onUnassign={handleUnassign}
                    onComplete={handleOpenCompleteDialog}
                    onStatusChange={handleOpenStatusDialog}
                  />
                )}

                {/* Server-side pagination from API response */}
                {pagination && pagination.last_page > 1 && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-4">
                    <PaginationInfo
                      startItem={pagination.from ?? 1}
                      endItem={pagination.to ?? filteredTickets.length}
                      totalItems={pagination.total}
                      label="tickets"
                    />
                    <Pagination
                      currentPage={pagination.current_page}
                      totalPages={pagination.last_page}
                      onPageChange={(p) => setAllPage(p)}
                    />
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Available tab ───────────────────────────────────────────────── */}
          <TabsContent value="available" className="mt-0">
            {/* Error banner for loading failure */}
            {availableError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive mb-4">
                <AlertCircle className="size-4 shrink-0" />
                <span>{availableError}</span>
              </div>
            )}

            {/* Loading skeleton */}
            {availableLoading && (
              <div className="space-y-2 mb-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-md" />
                ))}
              </div>
            )}

            {/* Available tickets content — same layout, separate data source */}
            {!availableLoading && !availableError && (
              <>
                {filteredAvailable.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <Ticket className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No available tickets found.
                    </p>
                  </div>
                ) : layout === "table" ? (
                  <TicketTableView
                    tickets={filteredAvailable}
                    onSelect={handleSelect}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAssign={handleOpenAssignDialog}
                    onClaim={handleClaim}
                    onUnassign={handleUnassign}
                    onComplete={handleOpenCompleteDialog}
                    onStatusChange={handleOpenStatusDialog}
                  />
                ) : (
                  <TicketGridView
                    tickets={filteredAvailable}
                    onSelect={handleSelect}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAssign={handleOpenAssignDialog}
                    onClaim={handleClaim}
                    onUnassign={handleUnassign}
                    onComplete={handleOpenCompleteDialog}
                    onStatusChange={handleOpenStatusDialog}
                  />
                )}

                {/* Available tab pagination — separate state from the All tab */}
                {availablePagination && availablePagination.last_page > 1 && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-4">
                    <PaginationInfo
                      startItem={availablePagination.from ?? 1}
                      endItem={availablePagination.to ?? filteredAvailable.length}
                      totalItems={availablePagination.total}
                      label="available tickets"
                    />
                    <Pagination
                      currentPage={availablePagination.current_page}
                      totalPages={availablePagination.last_page}
                      onPageChange={(p) => setAvailablePage(p)}
                    />
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Detail Sheet ────────────────────────────────────────────────────── */}
      {/* Receives only the ticket ID; sheet fetches GET /tickets/{id} internally */}
      <TicketDetailSheet
        ticketId={sheetTicketId}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onEdit={handleEdit}
        onClaim={handleClaim}
        onUnclaim={(t) => handleUnassign(t)}
        onAssign={handleOpenAssignDialog}
        onStatusChange={handleStatusChange}
        onComplete={handleComplete}
        onDelete={handleDelete}
        actionSubmitting={actionSubmitting}
        actionError={actionError}
      />

      {/* ── Delete Confirm Dialog ────────────────────────────────────────────── */}
      <ConfirmDeleteTicketDialog
        ticket={deleteTicket}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
      />

      {/* ── Assign To User Dialog ────────────────────────────────────────────── */}
      <AssignTicketDialog
        ticket={assignTarget}
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        onAssign={handleAssignConfirm}
        submitting={actionSubmitting}
        error={actionError}
      />

      {/* ── Change Status Dialog ─────────────────────────────────────────────── */}
      <ChangeStatusDialog
        ticket={statusTarget}
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        onConfirm={handleStatusConfirm}
        submitting={actionSubmitting}
        error={actionError}
      />

      {/* ── Unassign Confirm Dialog ──────────────────────────────────────────── */}
      <ConfirmActionDialog
        open={unassignDialogOpen}
        onOpenChange={setUnassignDialogOpen}
        onConfirm={handleUnassignConfirm}
        title="Unassign Ticket"
        description={
          unassignTarget
            ? `Are you sure you want to remove the assignee from ticket #${unassignTarget.id}?`
            : "Remove the assignee from this ticket?"
        }
        confirmLabel="Unassign"
        submitting={actionSubmitting}
      />

      {/* ── Complete Confirm Dialog ──────────────────────────────────────────── */}
      <ConfirmActionDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        onConfirm={handleCompleteConfirm}
        title="Complete Ticket"
        description={
          completeTarget
            ? `Mark ticket #${completeTarget.id} as complete? This will set the status to resolved.`
            : "Mark this ticket as complete?"
        }
        confirmLabel="Complete"
        submitting={actionSubmitting}
      />
    </>
  )
}

