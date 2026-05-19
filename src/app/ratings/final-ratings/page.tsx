import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/ui/date-input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Settings2,
  Plus,
  Search,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  XCircle,
  Calendar,
  Calculator,
  Trophy,
  FileArchive,
  FileText,
  Loader2,
  BarChart2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Pagination } from "@/components/pagination"
import { usePagination } from "@/hooks/use-pagination"
import InlineStats from "@/components/inline-stats"
import { usePermissions } from "@/hooks/usePermissions"

// ── API hooks ────────────────────────────────────────────────────────────────
import { useFinalRatingConfigs } from "@/app/ratings/final-ratings/hooks/useFinalRatingConfigs"
import { useFinalRatingActiveConfig } from "@/app/ratings/final-ratings/hooks/useFinalRatingActiveConfig"
import { useDeleteFinalRatingConfig } from "@/app/ratings/final-ratings/hooks/useDeleteFinalRatingConfig"
import { useCalculateFinalRatings } from "@/app/ratings/final-ratings/hooks/useCalculateFinalRatings"
import { useExportFinalRatingsPdf } from "@/app/ratings/final-ratings/hooks/useExportFinalRatingsPdf"

// ── Components ───────────────────────────────────────────────────────────────
import { FinalRatingConfigTable } from "@/app/ratings/final-ratings/components/final-rating-config-table"
import { FinalRatingConfigDetailSheet } from "@/app/ratings/final-ratings/components/final-rating-config-detail-sheet"
import { FinalRatingConfigFormSheet } from "@/app/ratings/final-ratings/components/final-rating-config-form-sheet"
import { ConfirmDeleteFinalRatingDialog } from "@/app/ratings/final-ratings/components/confirm-delete-final-rating-dialog"
import { FinalRatingDefaultStructureSheet } from "@/app/ratings/final-ratings/components/final-rating-default-structure-sheet"

import type {
  ApiFinalRatingConfig,
  CalculateFinalRatingsPayload,
  FinalRatingsExportFormat,
  FinalRatingUserResult,
  FinalRatingsCalculateResult,
} from "@/app/ratings/final-ratings/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatPeriodDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2)
}

function scoreColour(pct: number): string {
  if (pct >= 80) return "text-emerald-600 dark:text-emerald-400"
  if (pct >= 60) return "text-yellow-600 dark:text-yellow-400"
  if (pct >= 40) return "text-orange-600 dark:text-orange-400"
  return "text-red-600 dark:text-red-400"
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function BreakdownItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value.toFixed(2)} pts</span>
    </div>
  )
}

function UserRatingCard({ result, rank }: { result: FinalRatingUserResult; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const { breakdown } = result

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-7 shrink-0 text-center text-sm font-bold text-muted-foreground">
          #{rank}
        </div>
        <Avatar className="size-9 shrink-0">
          <AvatarImage src={result.avatar_url ?? undefined} alt={result.user_name} />
          <AvatarFallback className="text-xs">{initials(result.user_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{result.user_name}</p>
          <p className="text-xs text-muted-foreground truncate">{result.user_email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-sm font-bold tabular-nums ${scoreColour(result.final_percentage)}`}>
            {result.final_percentage.toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
            ({result.total_points} / {result.max_points} pts)
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={expanded ? "Hide breakdown" : "Show breakdown"}
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(result.final_percentage, 100)}%` }}
          />
        </div>
      </div>
      {expanded && (
        <div className="border-t px-4 py-3 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Score Breakdown
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <BreakdownItem label="Task Ratings" value={breakdown.task_ratings?.value ?? 0} />
            <BreakdownItem label="Stakeholder Ratings" value={breakdown.stakeholder_ratings?.value ?? 0} />
            <BreakdownItem label="Help Requests (Helper)" value={breakdown.help_requests?.helper?.value ?? 0} />
            <BreakdownItem label="Help Requests (Requester)" value={breakdown.help_requests?.requester?.value ?? 0} />
            <BreakdownItem label="Tickets Resolved" value={breakdown.tickets_resolved?.value ?? 0} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinalRatingsPage() {
  const { hasPermission } = usePermissions()
  const canCreateConfig = hasPermission("create rating configs")
  const canEditConfig = hasPermission("edit rating configs")
  const canDeleteConfig = hasPermission("delete rating configs")
  
  // ── API hooks ──────────────────────────────────────────────────
  const { configs, loading, error, refetch, clearError } = useFinalRatingConfigs()
  const {
    activeConfig,
    loading: activeLoading,
    error: activeError,
    refetch: refetchActive,
    clearError: clearActiveError,
  } = useFinalRatingActiveConfig()
  const { deleteConfig: apiDelete, deleting } = useDeleteFinalRatingConfig()
  const { calculate, calculating, error: calcError, clearError: clearCalcError } = useCalculateFinalRatings()
  const { exportPdf, exporting, error: exportError, clearError: clearExportError } = useExportFinalRatingsPdf()

  // ── UI state ────────────────────────────────────────────────────
  const [search, setSearch] = useState("")

  // Detail sheet
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailConfigId, setDetailConfigId] = useState<number | null>(null)

  // Form sheet
  const [formOpen, setFormOpen] = useState(false)
  const [editConfig, setEditConfig] = useState<ApiFinalRatingConfig | null>(null)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ApiFinalRatingConfig | null>(null)

  // Default structure sheet
  const [defaultStructureOpen, setDefaultStructureOpen] = useState(false)

  // ── Calculate form state ─────────────────────────────────────────
  const [periodStart, setPeriodStart] = useState(firstOfMonth())
  const [periodEnd, setPeriodEnd] = useState(today())
  const [maxPoints, setMaxPoints] = useState("100")
  const [configId, setConfigId] = useState<string>("active")

  // ── Calculation result state ─────────────────────────────────────
  const [calcResult, setCalcResult] = useState<FinalRatingsCalculateResult | null>(null)
  const [calcPayload, setCalcPayload] = useState<CalculateFinalRatingsPayload | null>(null)
  const [exportFormat, setExportFormat] = useState<FinalRatingsExportFormat>("zip")

  // ── Client-side search ──────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return configs
    const q = search.toLowerCase()
    return configs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false),
    )
  }, [configs, search])

  const { page, totalPages, paged, setPage, resetPage } = usePagination(filtered)

  const stats = useMemo(
    () => ({
      total: configs.length,
      active: configs.filter((c) => c.is_active).length,
      inactive: configs.filter((c) => !c.is_active).length,
    }),
    [configs],
  )

  // ── Event handlers ──────────────────────────────────────────────

  function handleView(config: ApiFinalRatingConfig) {
    setDetailConfigId(config.id)
    setDetailOpen(true)
  }

  function handleEdit(config: ApiFinalRatingConfig) {
    setEditConfig(config)
    setFormOpen(true)
  }

  function handleDelete(config: ApiFinalRatingConfig) {
    setDeleteTarget(config)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const ok = await apiDelete(deleteTarget.id)
    if (ok) {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      refetchActive()
    }
  }

  function handleCreate() {
    setEditConfig(null)
    setFormOpen(true)
  }

  function handleFormSuccess() {
    refetchActive()
  }

  // ── Calculate handlers ───────────────────────────────────────────

  function buildCalcPayload(): CalculateFinalRatingsPayload {
    return {
      period_start: periodStart,
      period_end: periodEnd,
      max_points: parseFloat(maxPoints),
      config_id: configId === "active" ? null : parseInt(configId, 10),
    }
  }

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault()
    clearCalcError()
    const payload = buildCalcPayload()
    const result = await calculate(payload)
    if (result) {
      setCalcResult(result)
      setCalcPayload(payload)
    }
  }

  const isCalcValid =
    periodStart.length === 10 &&
    periodEnd.length === 10 &&
    periodStart <= periodEnd &&
    parseFloat(maxPoints) >= 1

  async function handleExport() {
    if (!calcPayload) return
    clearExportError()
    await exportPdf(calcPayload, exportFormat)
  }

  const sortedResults = calcResult
    ? [...calcResult.users].sort((a, b) => b.final_percentage - a.final_percentage)
    : []

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">Final Ratings</h2>
            <Badge variant="secondary" className="uppercase tracking-wider">
              {filtered.length} {filtered.length === 1 ? "Config" : "Configs"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Manage final rating configurations that define how performance scores are calculated.
          </p>
        </div>
      </div>

      {/* ── Inline stats ────────────────────────────────────────── */}
      <div className="mt-2">
        <InlineStats
          items={[
            { label: "Total", value: stats.total },
            { label: "Active", value: stats.active },
            { label: "Inactive", value: stats.inactive },
          ]}
        />
      </div>

      {/* ── Error banner ────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => { clearError(); refetch() }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SECTION: Active Configuration
         ══════════════════════════════════════════════════════════ */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <div className="rounded-md bg-primary/10 p-1.5">
            <Settings2 className="size-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium">Active Configuration</span>
        </div>

        {activeLoading && (
          <div className="px-4 py-3 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}

        {!activeLoading && activeError && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <XCircle className="size-4 shrink-0 text-muted-foreground" />
              <span>No active configuration found.</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0"
              onClick={() => { clearActiveError(); refetchActive() }}
            >
              Retry
            </Button>
          </div>
        )}

        {!activeLoading && !activeError && activeConfig && (
          <div className="px-4 py-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm">{activeConfig.name}</span>
              <Badge
                variant="outline"
                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs"
              >
                <CheckCircle2 className="size-3 mr-1" />
                Active
              </Badge>
            </div>
            {activeConfig.description && (
              <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
                {activeConfig.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                Updated {formatDate(activeConfig.updated_at)}
              </span>
              <span>
                {Object.values(activeConfig.config ?? {}).filter((v) => v?.enabled === true).length}
                {" / 5 components enabled"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION: Calculate Final Ratings
         ══════════════════════════════════════════════════════════ */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <div className="rounded-md bg-primary/10 p-1.5">
            <Calculator className="size-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium">Calculate Final Ratings</span>
        </div>

        <form onSubmit={handleCalculate} className="px-4 py-4 flex flex-col gap-4">
          {/* Error banner */}
          {calcError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span className="flex-1">{calcError}</span>
              <button type="button" className="text-xs underline shrink-0" onClick={clearCalcError}>
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Period start */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="period_start">
                Period Start <span className="text-destructive">*</span>
              </Label>
              <DateInput
                id="period_start"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>

            {/* Period end */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="period_end">
                Period End <span className="text-destructive">*</span>
              </Label>
              <DateInput
                id="period_end"
                value={periodEnd}
                min={periodStart}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>

            {/* Max points */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max_points">
                Max Points (100%) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="max_points"
                type="number"
                min="1"
                step="0.01"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
                placeholder="e.g. 100"
                required
              />
            </div>

            {/* Config selector */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="config_id">Rating Configuration</Label>
              <Select value={configId} onValueChange={setConfigId}>
                <SelectTrigger id="config_id">
                  <SelectValue placeholder="Use active configuration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <span className="flex items-center gap-2">
                      Use active configuration
                      {activeConfig && (
                        <Badge variant="secondary" className="text-xs">{activeConfig.name}</Badge>
                      )}
                    </span>
                  </SelectItem>
                  {configs.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="flex items-center gap-2">
                        {c.name}
                        {c.is_active && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs"
                          >
                            Active
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={calculating || !isCalcValid}
              className="transition-all hover:shadow-md hover:shadow-primary/25"
            >
              {calculating && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {calculating ? "Calculating…" : "Calculate"}
            </Button>
          </div>
        </form>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION: Calculation Results
         ══════════════════════════════════════════════════════════ */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5">
              <Trophy className="size-3.5 text-primary" />
            </div>
            <span className="text-sm font-medium">Calculation Results</span>
            {calcResult && (
              <Badge variant="secondary">
                {calcResult.users.length} {calcResult.users.length === 1 ? "employee" : "employees"}
              </Badge>
            )}
          </div>
          {calcResult && (
            <div className="flex items-center gap-2">
              <Select
                value={exportFormat}
                onValueChange={(value) => setExportFormat(value as FinalRatingsExportFormat)}
              >
                <SelectTrigger className="h-8 w-32.5" disabled={exporting}>
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zip">ZIP (all PDFs)</SelectItem>
                  <SelectItem value="pdf">PDF (overview)</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : exportFormat === "zip" ? (
                  <FileArchive className="size-3.5 mr-1.5" />
                ) : (
                  <FileText className="size-3.5 mr-1.5" />
                )}
                {exporting ? "Exporting…" : `Export as ${exportFormat.toUpperCase()}`}
              </Button>
            </div>
          )}
        </div>

        <div className="px-4 py-4">
          {/* No results yet */}
          {!calcResult && !calculating && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <BarChart2 className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No results yet</p>
                <p className="text-sm text-muted-foreground">
                  Fill in the form above and click Calculate to see results.
                </p>
              </div>
            </div>
          )}

          {/* Calculating */}
          {calculating && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Calculating ratings…</p>
            </div>
          )}

          {/* Results */}
          {calcResult && !calculating && (
            <div className="flex flex-col gap-4">
              {/* Period / config / max-points strip */}
              <div className="rounded-lg border bg-muted/30 p-3 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="size-3.5 shrink-0" />
                  <span>
                    {formatPeriodDate(calcResult.period.start)} — {formatPeriodDate(calcResult.period.end)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Settings2 className="size-3.5 shrink-0" />
                  <span>{calcResult.config.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <BarChart2 className="size-3.5 shrink-0" />
                  <span>Max {calcResult.max_points_for_100_percent} pts = 100%</span>
                </div>
              </div>

              {/* Export error */}
              {exportError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" />
                  <span className="flex-1">{exportError}</span>
                  <button type="button" className="text-xs underline shrink-0" onClick={clearExportError}>
                    Dismiss
                  </button>
                </div>
              )}

              {/* Empty employees */}
              {sortedResults.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <BarChart2 className="size-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">No employees found</p>
                    <p className="text-sm text-muted-foreground">
                      No users had tasks due within the selected period.
                    </p>
                  </div>
                </div>
              )}

              {/* Ranked employee cards */}
              <div className="flex flex-col gap-2">
                {sortedResults.map((user, idx) => (
                  <UserRatingCard key={user.user_id} result={user} rank={idx + 1} />
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center pt-1">
                Calculated at {formatDateTime(calcResult.calculated_at)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION: Configuration Management
         ══════════════════════════════════════════════════════════ */}

      {/* Search + action buttons row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search configurations…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetPage()
            }}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDefaultStructureOpen(true)}
          >
            <BookOpen className="size-3.5" />
            Default Structure
          </Button>
          {canCreateConfig && (
            <Button
              size="sm"
              className="transition-all hover:shadow-md hover:shadow-primary/25"
              onClick={handleCreate}
            >
              <Plus className="size-3.5" />
              New Configuration
            </Button>
          )}
        </div>
      </div>

      {/* Configurations table */}
      <Card>
        <CardContent className="p-0">
          {loading && (
            <div className="flex flex-col divide-y">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              ))}
            </div>
          )}

          {!loading && !error && paged.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <Settings2 className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">No configurations found</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {search
                    ? "Try adjusting your search."
                    : "Create your first configuration to get started."}
                </p>
              </div>
              {!search && canCreateConfig && (
                <Button variant="outline" size="sm" onClick={handleCreate}>
                  <Plus className="size-3.5" />
                  New Configuration
                </Button>
              )}
            </div>
          )}

          {!loading && !error && paged.length > 0 && (
            <FinalRatingConfigTable
              configs={paged}
              onView={handleView}
              onEdit={canEditConfig ? handleEdit : undefined}
              onDelete={canDeleteConfig ? handleDelete : undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      {/* ── Detail Sheet ─────────────────────────────────────────── */}
      <FinalRatingConfigDetailSheet
        configId={detailConfigId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={canEditConfig ? handleEdit : undefined}
        onDelete={canDeleteConfig ? handleDelete : undefined}
      />

      {/* ── Form Sheet ───────────────────────────────────────────── */}
      <FinalRatingConfigFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        editConfig={editConfig}
        onSuccess={handleFormSuccess}
      />

      {/* ── Delete Dialog ─────────────────────────────────────────── */}
      <ConfirmDeleteFinalRatingDialog
        config={deleteTarget}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
      />

      {/* ── Default Structure Sheet ───────────────────────────────── */}
      <FinalRatingDefaultStructureSheet
        open={defaultStructureOpen}
        onOpenChange={setDefaultStructureOpen}
      />
    </div>
  )
}
