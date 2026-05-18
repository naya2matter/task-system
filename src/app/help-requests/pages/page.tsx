// ─── Help Requests Page ───────────────────────────────────────────────────────
// Main listing page for help requests.
// Connects to these API endpoints:
//   - GET    /help-requests            → full paginated list (server-side)
//   - GET    /help-requests/available  → unclaimed requests shown in a card grid
//   - POST   /help-requests            → create a new help request (form sheet)
//   - PUT    /help-requests/{id}       → update description / helper (form sheet)
//   - POST   /help-requests/{id}/claim   → claim a request
//   - POST   /help-requests/{id}/unclaim → unclaim a request
//   - DELETE /help-requests/{id}       → delete (confirm dialog)
//
// Layout:
//   1. Page header (title + total badge + Create button)
//   2. Stats grid (Total | Available | Claimed | Completed)
//   3. Tabs — All Requests / Available
//   4. Search + status filter + view toggle
//   5. Table or card grid view
//   6. Pagination

import { useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, LayoutList, LayoutGrid, HelpCircle, Loader2, Plus } from "lucide-react"
import { Pagination } from "@/components/pagination"
import { PaginationInfo } from "@/components/pagination-info"
import InlineStats from "@/components/inline-stats"

// Hooks that call the real read endpoints
import { useHelpRequests } from "@/app/help-requests/hooks/useHelpRequests"
import { useAvailableHelpRequests } from "@/app/help-requests/hooks/useAvailableHelpRequests"
// Hook that exposes all write actions (create / update / claim / unclaim / delete)
import { useHelpRequestMutations } from "@/app/help-requests/hooks/useHelpRequestMutations"

// UI sub-components
import { HelpRequestTableView } from "@/app/help-requests/pages/help-request-table-view"
import { HelpRequestGridView } from "@/app/help-requests/pages/help-request-grid-view"
import { HelpRequestTableSkeleton, HelpRequestGridSkeleton } from "@/app/help-requests/pages/help-request-skeletons"
import { HelpRequestDetailSheet } from "@/app/help-requests/pages/help-request-detail-sheet"
import { ConfirmDeleteHelpRequestDialog } from "@/app/help-requests/pages/confirm-delete-help-request-dialog"
// Sheet-based form for create and edit — no separate page needed
import { HelpRequestFormSheet } from "@/app/help-requests/pages/help-request-form-sheet"
// New action dialogs for assign and complete endpoints
import { AssignHelpRequestDialog } from "@/app/help-requests/pages/assign-help-request-dialog"
import { CompleteHelpRequestDialog } from "@/app/help-requests/pages/complete-help-request-dialog"

import { usePermissions } from "@/hooks/usePermissions"

// API-aligned type
import type { HelpRequest, HelpRequestRatingValue } from "@/app/help-requests/types"

type ViewMode = "table" | "grid"

// Options for the status filter (maps to derived display status values)
const statusOptions = [
  { value: "all", label: "All Requests" },
  { value: "open", label: "Open" },
  { value: "claimed", label: "Claimed" },
  { value: "completed", label: "Completed" },
]

export default function HelpRequestsPage() {
  // ── View / UI state ──────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>("table")
  const [activeTab, setActiveTab] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [availablePage, setAvailablePage] = useState(1)

  // Detail sheet state — view-only side panel
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetRequest, setSheetRequest] = useState<HelpRequest | null>(null)

  // Form sheet state — create or edit
  const [formSheetOpen, setFormSheetOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [formRequest, setFormRequest] = useState<HelpRequest | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteRequest, setDeleteRequest] = useState<HelpRequest | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Assign dialog state — POST /help-requests/{id}/assign/{userId}
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignRequest, setAssignRequest] = useState<HelpRequest | null>(null)
  const [assigning, setAssigning] = useState(false)

  // Complete dialog state — POST /help-requests/{id}/complete
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [completeRequest, setCompleteRequest] = useState<HelpRequest | null>(null)
  const [completing, setCompleting] = useState(false)

  // ── Permission checks ─────────────────────────────────────────────────────
  const { hasPermission } = usePermissions()

  // ── Mutation actions from the store ──────────────────────────────────────────
  const { claimHelpRequest, unclaimHelpRequest, deleteHelpRequest, assignHelpRequest, completeHelpRequest } = useHelpRequestMutations()

  // Reset to page 1 whenever the status filter changes
  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }, [])

  // ── API params for the full list ─────────────────────────────────────────────
  // Note: The backend help-requests API doesn't yet expose a server-side `status`
  // filter, so we apply status filtering client-side on the current page.
  const listParams = {
    page: currentPage,
    per_page: 15,
  }

  // Fetch the full paginated list from GET /help-requests
  const { helpRequests, pagination, loading, error, refetch } = useHelpRequests(listParams)

  // Fetch available (unclaimed) requests from GET /help-requests/available
  const availableParams = {
    page: availablePage,
    per_page: 15,
  }
  const {
    availableRequests,
    availablePagination,
    availableLoading,
  } = useAvailableHelpRequests(availableParams)

  // ── Client-side status filter on the current page ───────────────────────────
  // Since the API doesn't support status filtering natively, we filter the
  // current page of results in the browser.
  const filteredRequests = helpRequests.filter((r) => {
    if (statusFilter === "all") return true
    if (statusFilter === "open")      return r.is_available          // not claimed, not completed
    if (statusFilter === "claimed")   return r.is_claimed && !r.is_completed
    if (statusFilter === "completed") return r.is_completed
    return true
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────

  // Open the view-only detail sheet
  function handleViewSheet(request: HelpRequest) {
    setSheetRequest(request)
    setSheetOpen(true)
  }

  // Open the form sheet in create mode
  function handleCreate() {
    setFormRequest(null)
    setFormMode("create")
    setFormSheetOpen(true)
  }

  // Open the form sheet in edit mode pre-filled with the selected request
  function handleEdit(request: HelpRequest) {
    setFormRequest(request)
    setFormMode("edit")
    setFormSheetOpen(true)
  }

  // Open the delete confirmation dialog
  function handleDelete(request: HelpRequest) {
    setDeleteRequest(request)
    setDeleteDialogOpen(true)
  }

  // Confirm deletion — calls POST /help-requests/{id} then re-fetches
  async function handleConfirmDelete() {
    if (!deleteRequest) return
    setDeleting(true)
    await deleteHelpRequest(deleteRequest.id)
    setDeleting(false)
    setDeleteDialogOpen(false)
    setDeleteRequest(null)
  }

  // Claim a request via POST /help-requests/{id}/claim
  // Updates the list inline via the store (no full refetch needed)
  async function handleClaim(request: HelpRequest) {
    await claimHelpRequest(request.id)
  }

  // Unclaim a request via POST /help-requests/{id}/unclaim
  async function handleUnclaim(request: HelpRequest) {
    await unclaimHelpRequest(request.id)
  }

  // Open the assign dialog — POST /help-requests/{id}/assign/{userId}
  function handleAssignOpen(request: HelpRequest) {
    setAssignRequest(request)
    setAssignDialogOpen(true)
  }

  // Confirmed assign: calls assignHelpRequest and closes the dialog
  async function handleConfirmAssign(requestId: number, userId: number) {
    setAssigning(true)
    await assignHelpRequest(requestId, userId)
    setAssigning(false)
    setAssignDialogOpen(false)
    setAssignRequest(null)
  }

  // Open the complete dialog — POST /help-requests/{id}/complete
  function handleCompleteOpen(request: HelpRequest) {
    setCompleteRequest(request)
    setCompleteDialogOpen(true)
  }

  // Confirmed complete: calls completeHelpRequest and closes the dialog
  async function handleConfirmComplete(requestId: number, rating: HelpRequestRatingValue) {
    setCompleting(true)
    await completeHelpRequest(requestId, { rating })
    setCompleting(false)
    setCompleteDialogOpen(false)
    setCompleteRequest(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">

        {/* ── Page header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">Help Requests</h2>
              {/* Total count from the pagination object returned by the API */}
              {pagination && (
                <Badge variant="secondary" className="uppercase tracking-wider">
                  {pagination.total} Requests
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Manage and track help requests across all teams and projects.
            </p>
          </div>
          {/* Create button — only shown when user has the create permission */}
          {hasPermission("create help requests") && (
            <Button onClick={handleCreate} className="w-full sm:w-auto">
              <Plus className="size-4" />
              New Request
            </Button>
          )}
        </div>

        {/* ── Main Content ─────────────────────────────────────────── */}
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
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

              <InlineStats
                items={[
                  { label: "Total", value: pagination?.total ?? (loading ? "..." : 0) },
                  { label: "Available", value: availablePagination?.total ?? (availableLoading ? "..." : 0) },
                  { label: "Claimed", value: loading ? "..." : helpRequests.filter((r) => r.is_claimed && !r.is_completed).length },
                  { label: "Completed", value: loading ? "..." : helpRequests.filter((r) => r.is_completed).length }
                ]}
              />
            </div>

            {/* ── Controls: status filter + view toggle ───────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Status filter — only show on "all" tab */}
              {activeTab === "all" && (
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-36 h-10">
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

              {/* Table / Grid view toggle */}
              <ToggleGroup
                type="single"
                variant="outline"
                value={view}
                onValueChange={(v) => { if (v) setView(v as ViewMode) }}
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

          <TabsContent value="all" className="mt-0">
            {/* ── Error banner ─────────────────────────────────────────────────────── */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive mb-4">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
            {loading && (
              view === "table" ? <HelpRequestTableSkeleton /> : <HelpRequestGridSkeleton />
            )}

            {/* ── Content: table or card grid ──────────────────────────────────────── */}
            {!loading && !error && (
              <>
                {filteredRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <Loader2 className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No help requests found.</p>
                  </div>
                ) : view === "table" ? (
                  <HelpRequestTableView
                    requests={filteredRequests}
                    onSelect={handleViewSheet}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onClaim={handleClaim}
                    onUnclaim={handleUnclaim}
                    onAssign={handleAssignOpen}
                    onComplete={handleCompleteOpen}
                  />
                ) : (
                  <HelpRequestGridView
                    requests={filteredRequests}
                    onSelect={handleViewSheet}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onClaim={handleClaim}
                    onUnclaim={handleUnclaim}
                    onAssign={handleAssignOpen}
                    onComplete={handleCompleteOpen}
                  />
                )}

                {/* ── Pagination ─────────────────────────────────────────────────── */}
                {pagination && pagination.last_page > 1 && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-4">
                    <PaginationInfo
                      startItem={pagination.from ?? 1}
                      endItem={pagination.to ?? filteredRequests.length}
                      totalItems={pagination.total}
                      label="requests"
                    />
                    <Pagination
                      currentPage={pagination.current_page}
                      totalPages={pagination.last_page}
                      onPageChange={(p) => setCurrentPage(p)}
                    />
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="available" className="mt-0">
            {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
            {availableLoading && (
              view === "table" ? <HelpRequestTableSkeleton /> : <HelpRequestGridSkeleton />
            )}

            {/* ── Content: table or card grid ──────────────────────────────────────── */}
            {!availableLoading && (
              <>
                {availableRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <HelpCircle className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No available help requests found.</p>
                  </div>
                ) : view === "table" ? (
                  <HelpRequestTableView
                    requests={availableRequests}
                    onSelect={handleViewSheet}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onClaim={handleClaim}
                    onUnclaim={handleUnclaim}
                    onAssign={handleAssignOpen}
                    onComplete={handleCompleteOpen}
                  />
                ) : (
                  <HelpRequestGridView
                    requests={availableRequests}
                    onSelect={handleViewSheet}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onClaim={handleClaim}
                    onUnclaim={handleUnclaim}
                    onAssign={handleAssignOpen}
                    onComplete={handleCompleteOpen}
                  />
                )}

                {/* ── Pagination ─────────────────────────────────────────────────── */}
                {availablePagination && availablePagination.last_page > 1 && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-4">
                    <PaginationInfo
                      startItem={availablePagination.from ?? 1}
                      endItem={availablePagination.to ?? availableRequests.length}
                      totalItems={availablePagination.total}
                      label="available requests"
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

      {/* ── Detail Sheet ─────────────────────────────────────────────────────── */}
      {/* Slides in from the right to show full details for the selected request */}
      <HelpRequestDetailSheet
        request={sheetRequest}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={handleEdit}
        onClaim={handleClaim}
        onUnclaim={handleUnclaim}
      />

      {/* ── Form Sheet (create / edit) ────────────────────────────────────────── */}
      {/* Reused for both create and edit — mode prop switches behavior */}
      <HelpRequestFormSheet
        mode={formMode}
        request={formRequest}
        open={formSheetOpen}
        onOpenChange={setFormSheetOpen}
        onSuccess={refetch}
      />

      {/* ── Delete Confirmation Dialog ────────────────────────────────────────── */}
      <ConfirmDeleteHelpRequestDialog
        request={deleteRequest}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        confirming={deleting}
      />

      {/* ── Assign Help Request Dialog — POST /help-requests/{id}/assign/{userId} ── */}
      <AssignHelpRequestDialog
        request={assignRequest}
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        onAssign={handleConfirmAssign}
        assigning={assigning}
      />

      {/* ── Complete Help Request Dialog — POST /help-requests/{id}/complete ──── */}
      <CompleteHelpRequestDialog
        request={completeRequest}
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        onComplete={handleConfirmComplete}
        completing={completing}
      />
    </>
  )
}
