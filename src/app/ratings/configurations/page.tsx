import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Settings2, AlertCircle, LayoutList, LayoutGrid } from "lucide-react"
import { Pagination } from "@/components/pagination"
import { usePagination } from "@/hooks/use-pagination"
import { ConfigurationTableView } from "@/app/ratings/configurations/configuration-table-view"
import { ConfigurationGridView } from "@/app/ratings/configurations/configuration-grid-view"
import { ConfirmDeleteConfigurationDialog } from "@/app/ratings/configurations/confirm-delete-configuration-dialog"
import { ConfigurationDetailSheet } from "@/app/ratings/configurations/configuration-detail"
import InlineStats from "@/components/inline-stats"
// ── API hooks — replace the old mock-data local state ───────────────────────
import { useRatingConfigs } from "@/app/ratings/configurations/hooks/useRatingConfigs"
import { useRatingConfigsByType } from "@/app/ratings/configurations/hooks/useRatingConfigsByType"
import { useDeleteRatingConfig } from "@/app/ratings/configurations/hooks/useDeleteRatingConfig"
import type { ApiRatingConfig, ApiRatingConfigType } from "@/app/ratings/configurations/types"
import { usePermissions } from "@/hooks/usePermissions"

// "ALL" stays client-side; the other two values call GET /rating-configs/type/{type}
type TypeFilter = "ALL" | ApiRatingConfigType
type ViewMode = "table" | "grid"

const typeOptions: { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "task_rating", label: "Task Rating" },
  { value: "stakeholder_rating", label: "Stakeholder Rating" },
]

export default function RatingsConfigurationsPage() {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canCreate = hasPermission("create rating configs")
  const canEdit = hasPermission("edit rating configs")
  const canDelete = hasPermission("delete rating configs")

  // ── API hooks ───────────────────────────────────────────────────
  // Full list: called on mount, always available for the ALL tab and stats
  const { configs, loading, error, refetch, clearError } = useRatingConfigs()
  // By-type: lazy — triggered when TASK or STAKEHOLDER tab is selected
  const {
    configsByType,
    loading: typeLoading,
    error: typeError,
    fetchByType,
    clearError: clearTypeError,
  } = useRatingConfigsByType()
  // Delete: wraps DELETE /rating-configs/{id}
  const { deleteConfig: apiDelete, deleting } = useDeleteRatingConfig()

  // ── UI state ────────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL")
  const [view, setView] = useState<ViewMode>("table")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfig, setDeleteConfig] = useState<ApiRatingConfig | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  // detailConfigId is now a number (API uses numeric IDs)
  const [detailConfigId, setDetailConfigId] = useState<number | null>(null)

  // When a type tab is selected, call GET /rating-configs/type/{type}
  useEffect(() => {
    if (typeFilter !== "ALL") {
      fetchByType(typeFilter as ApiRatingConfigType)
    }
  }, [typeFilter, fetchByType])

  // Active dataset: ALL tab uses the full list; type tabs use the filtered list
  const activeList = typeFilter === "ALL" ? configs : configsByType
  const activeLoading = typeFilter === "ALL" ? loading : typeLoading
  const activeError = typeFilter === "ALL" ? error : typeError
  const activeClearError = typeFilter === "ALL" ? clearError : clearTypeError

  // Client-side search on top of whichever list is active
  const filtered = useMemo(() => {
    if (!search.trim()) return activeList
    const q = search.toLowerCase()
    return activeList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.creator.name.toLowerCase().includes(q),
    )
  }, [activeList, search])

  const { page, totalPages, paged, setPage, resetPage } = usePagination(filtered)

  // Stats always reflect the full unfiltered list
  const stats = useMemo(
    () => ({
      total: configs.length,
      active: configs.filter((c) => c.is_active).length,
      task: configs.filter((c) => c.type === "task_rating").length,
      stakeholder: configs.filter((c) => c.type === "stakeholder_rating").length,
    }),
    [configs],
  )

  // Opens the detail sheet; GET /rating-configs/{id} fires inside the hook
  function handleView(config: ApiRatingConfig) {
    setDetailConfigId(config.id)
    setDetailOpen(true)
  }

  function handleEdit(config: ApiRatingConfig) {
    navigate(`/ratings/configurations/${config.id}/edit`)
  }

  function handleDelete(config: ApiRatingConfig) {
    setDeleteConfig(config)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!deleteConfig) return
    // Calls DELETE /rating-configs/{id}; store removes the item from the list on success
    const ok = await apiDelete(deleteConfig.id)
    if (ok) {
      setDeleteDialogOpen(false)
      setDeleteConfig(null)
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">Configurations</h2>
              <Badge variant="secondary" className="uppercase tracking-wider">
                {filtered.length} {filtered.length === 1 ? "Config" : "Configs"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Define rating configurations and their scoring fields for tasks and stakeholder evaluations.
            </p>
          </div>
        </div>
        {/* Inline stats — always based on the full list, not the active tab */}
        <div className="mt-2">
          <InlineStats
            items={[
              { label: "Total", value: stats.total },
              { label: "Active", value: stats.active },
              { label: "Task Rating", value: stats.task },
              { label: "Stakeholder", value: stats.stakeholder },
            ]}
          />
        </div>

        {/* Error banner — shown when the active list fetch fails */}
        {activeError && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{activeError}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                activeClearError()
                if (typeFilter === "ALL") refetch()
                else fetchByType(typeFilter as ApiRatingConfigType)
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, description or creator..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetPage()
              }}
              className="pl-8 h-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as TypeFilter)
                resetPage()
              }}
            >
              <TabsList>
                {typeOptions.map((opt) => (
                  <TabsTrigger key={opt.value} value={opt.value}>
                    {opt.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

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

            {canCreate && (
              <Button
                className="transition-all hover:shadow-md hover:shadow-primary/25"
                size="sm"
                onClick={() => navigate("/ratings/configurations/new")}
              >
                <Plus />
                New
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {/* Loading skeleton while the API request is in flight */}
        {activeLoading && (
          view === "table" ? (
            <Card>
              <CardContent className="p-0">
                <div className="flex flex-col divide-y">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-7 w-7 rounded-full" />
                      <Skeleton className="h-4 w-24 ml-auto" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Card key={i}>
                  <CardContent className="flex flex-col gap-4 pt-4 px-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-6 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {/* Empty state */}
        {!activeLoading && !activeError && paged.length === 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Settings2 className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">No configurations found</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {search || typeFilter !== "ALL"
                      ? "Try adjusting your search or filters."
                      : "Create your first configuration to get started."}
                  </p>
                </div>
                {!search && typeFilter === "ALL" && canCreate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/ratings/configurations/new")}
                  >
                    <Plus className="size-3.5" />
                    New Configuration
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loaded data — Table or Grid depending on the selected view */}
        {!activeLoading && !activeError && paged.length > 0 && (
          view === "table" ? (
            <Card>
              <CardContent className="p-0">
                <ConfigurationTableView
                  configurations={paged}
                  onView={handleView}
                  onEdit={canEdit ? handleEdit : undefined}
                  onDelete={canDelete ? handleDelete : undefined}
                />
              </CardContent>
            </Card>
          ) : (
            <ConfigurationGridView
              configurations={paged}
              onView={handleView}
              onEdit={canEdit ? handleEdit : undefined}
              onDelete={canDelete ? handleDelete : undefined}
            />
          )
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Delete dialog — passes deleting flag for button feedback */}
      <ConfirmDeleteConfigurationDialog
        configuration={deleteConfig}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
      />

      {/* Detail sheet — configId is now a number (API numeric IDs) */}
      <ConfigurationDetailSheet
        configId={detailConfigId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}
