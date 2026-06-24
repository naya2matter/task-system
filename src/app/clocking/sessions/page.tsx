// src/app/clocking/sessions/page.tsx
// Manager Clocking Dashboard — live view of all employee sessions.
//
// Tabs:
//  1. Live Dashboard — active/on-break employees (GET /clocking/manager/initial-data)
//  2. Corrections    — pending correction requests (GET /clocking/manager/pending-corrections)
//                      + approve/reject via POST /clocking/manager/correction/{id}/handle
//  3. All Records    — full paginated history for all employees
//                      (GET /clocking/manager/all-records)
//                      + direct session/break editing
//                      + ZIP export (POST /clocking/manager/export-all)
//
// Real-time: subscribes to "clocking.manager" WebSocket channel and refreshes
// live data + corrections whenever any employee's session changes.

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DateInput } from "@/components/ui/date-input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  RefreshCw,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Shield,
  Share,
} from "lucide-react"
import { isCancel } from "axios"
import { cn } from "@/lib/utils"
import { EmployeeCard } from "../components/employee-card"
import { ActivityFeed } from "../components/activity-feed"
import { HandleCorrectionDialog } from "../components/handle-correction-dialog"
import { AllRecordsTable } from "../components/all-records-table"
import { ManagerExportDialog } from "../components/manager-export-dialog"
import { Pagination } from "@/components/pagination"
import { ClockingSessionsGridSkeleton } from "./clocking-sessions-skeleton"
import { managerClockingService } from "@/services/managerClockingService"
import { useManagerClockingChannel } from "@/hooks/useManagerClockingChannel"
import type {
  Employee,
  ActivityEvent,
  ClockSession,
  ClockRecordApiItem,
  BreakRecord,
  PendingCorrectionApiItem,
} from "../data"
import type { ManagerInitialData } from "@/services/managerClockingService"

// ─── Time helpers ────────────────────────────────────────────────

function formatTime(utc: string | null): string {
  if (!utc) return "—"
  return new Date(utc).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

function formatUtc(utc: string): string {
  return new Date(utc).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function calcBreakSeconds(breaks: ClockSession["break_records"]): number {
  return breaks.reduce((acc, br) => {
    if (!br.break_end_utc) return acc
    return acc + (new Date(br.break_end_utc).getTime() - new Date(br.break_start_utc).getTime()) / 1000
  }, 0)
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// Map a live ClockSession from the API to the Employee UI shape used by EmployeeCard
function sessionToEmployee(session: ClockSession): Employee {
  const isOnBreak = session.status === "on_break"
  const nowMs = Date.now()
  const clockInMs = new Date(session.clock_in_utc).getTime()
  const breakMs = calcBreakSeconds(session.break_records) * 1000
  const workMs = Math.max(0, nowMs - clockInMs - breakMs)
  // If currently on break, find the active break to compute elapsed break time
  const activeBreak = session.break_records.find((b) => b.status === "active")
  const breakElapsedMs = activeBreak
    ? nowMs - new Date(activeBreak.break_start_utc).getTime()
    : 0
  const totalBreakMs =
    calcBreakSeconds(session.break_records) * 1000 + (isOnBreak ? breakElapsedMs : 0)

  return {
    id:            String(session.user_id),
    name:          session.user?.name ?? `User #${session.user_id}`,
    role:          session.user?.email ?? "",
    avatar:        session.user?.avatar_url ?? "",
    status:        isOnBreak ? "on-break" : "working",
    clockInTime:   formatTime(session.clock_in_utc),
    workTime:      formatDuration(workMs / 1000),
    breakTime:     formatDuration(totalBreakMs / 1000),
    breaksUsed:    session.break_records.length,
    breaksAllowed: 3,
  }
}

// Build a lightweight activity feed list from active sessions
function buildActivityEvents(
  sessions: ManagerInitialData["sessions"]
): ActivityEvent[] {
  return sessions
    .slice(0, 8)
    .map(({ session }) => ({
      time:      formatTime(session.clock_in_utc),
      message:   session.user?.name ?? `User #${session.user_id}`,
      highlight: session.status === "on_break" ? "is on break" : "is working",
      color:     (session.status === "on_break" ? "secondary" : "primary") as "primary" | "secondary",
    }))
}

// Human-readable labels for API correction type values
const correctionTypeLabels: Record<string, string> = {
  clock_in:  "Clock In",
  clock_out: "Clock Out",
  break_in:  "Break Start",
  break_out: "Break End",
}

// ─── Main page component ──────────────────────────────────────────

export default function ClockingSessionsPage() {
  // ── Live Dashboard state ──────────────────────────────────────
  const [liveData, setLiveData] = useState<ManagerInitialData | null>(null)
  const [loadingLive, setLoadingLive] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)

  // ── Corrections state ─────────────────────────────────────────
  const [corrections, setCorrections] = useState<PendingCorrectionApiItem[]>([])
  const [loadingCorrections, setLoadingCorrections] = useState(false)
  const [correctionsError, setCorrectionsError] = useState<string | null>(null)

  // ── All Records state ─────────────────────────────────────────
  const [records, setRecords] = useState<ClockRecordApiItem[]>([])
  const [recordsPagination, setRecordsPagination] = useState({
    total: 0, last_page: 1, current_page: 1, per_page: 15,
  })
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [recordsPage, setRecordsPage] = useState(1)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "on_break" | "completed">("all")
  const [exportOpen, setExportOpen] = useState(false)
  const PER_PAGE = 15

  // ── Handle-correction dialog state ────────────────────────────
  const [handleDialogOpen, setHandleDialogOpen] = useState(false)
  const [selectedCorrection, setSelectedCorrection] = useState<PendingCorrectionApiItem | null>(null)

  // ── Active tab tracker ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("dashboard")

  // ── Derived counts from live data ────────────────────────────
  const activeSessions = liveData?.sessions ?? []
  const activeCount    = activeSessions.filter((s) => s.session.status === "active").length
  const onBreakCount   = activeSessions.filter((s) => s.session.status === "on_break").length
  const pendingCount   = corrections.filter((c) => c.status === "pending").length

  // ── Fetch live dashboard data from manager API ────────────────
  const fetchLiveData = useCallback(async () => {
    setLoadingLive(true)
    setLiveError(null)
    try {
      const data = await managerClockingService.getInitialData()
      setLiveData(data)
    } catch (err) {
      if (!isCancel(err)) {
        setLiveError("Failed to load live session data. Please refresh.")
      }
    } finally {
      setLoadingLive(false)
    }
  }, [])

  // ── Fetch all pending corrections from manager API ────────────
  const fetchCorrections = useCallback(async () => {
    setLoadingCorrections(true)
    setCorrectionsError(null)
    try {
      const data = await managerClockingService.getPendingCorrections()
      setCorrections(data ?? [])
    } catch (err) {
      if (!isCancel(err)) {
        setCorrectionsError("Failed to load correction requests. Please refresh.")
      }
    } finally {
      setLoadingCorrections(false)
    }
  }, [])

  // ── Fetch paginated records from manager API ──────────────────
  const fetchRecords = useCallback(async (page = 1) => {
    setLoadingRecords(true)
    setRecordsError(null)
    try {
      const { records: data, pagination } = await managerClockingService.getAllRecords({
        start_date: startDate || null,
        end_date:   endDate   || null,
        status:     statusFilter !== "all" ? statusFilter : null,
        per_page:   PER_PAGE,
        page,
      })
      setRecords(data ?? [])
      setRecordsPagination(pagination as any)
    } catch (err) {
      if (!isCancel(err)) {
        setRecordsError("Failed to load records. Please refresh.")
      }
    } finally {
      setLoadingRecords(false)
    }
  }, [startDate, endDate, statusFilter])

  // ── Load live + corrections on first mount ────────────────────
  useEffect(() => {
    fetchLiveData()
    fetchCorrections()
  }, [fetchLiveData, fetchCorrections])

  // ── Refetch when the browser tab becomes visible again ────────
  // Handles the case where the user switches away and back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchLiveData()
        fetchCorrections()
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [fetchLiveData, fetchCorrections])

  // ── Load records when the All Records tab first opens ─────────
  useEffect(() => {
    if (activeTab === "records") {
      fetchRecords(recordsPage)
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-fetch records on filter change (reset to page 1) ───────
  useEffect(() => {
    if (activeTab === "records") {
      setRecordsPage(1)
      fetchRecords(1)
    }
  }, [startDate, endDate, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket: apply session changes instantly from the payload ─
  // We merge the incoming session directly into local state so the
  // dashboard updates the moment the event arrives — no HTTP round-trip.
  useManagerClockingChannel((payload) => {
    const { session, company_timezone, server_time_utc } = payload

    setLiveData((prev) => {
      // If initial data hasn't loaded yet, ignore — fetchLiveData on mount
      // will populate it shortly.
      if (!prev) return prev

      const isStillActive =
        session.status === "active" || session.status === "on_break"

      // Remove any existing entry for this user, then re-add if still active
      const without = prev.sessions.filter(
        (s) => s.session.user_id !== session.user_id
      )
      const sessions = isStillActive
        ? [...without, { session, company_timezone, server_time_utc }]
        : without

      return { ...prev, sessions }
    })

    // Corrections may change independently — keep refreshing them
    fetchCorrections()
  })

  // ── Open the review dialog for a correction ───────────────────
  function openHandleDialog(correction: PendingCorrectionApiItem) {
    setSelectedCorrection(correction)
    setHandleDialogOpen(true)
  }

  // ── After approve/reject, optimistically update the local list ─
  function handleCorrectionHandled(updated: PendingCorrectionApiItem) {
    setCorrections((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    )
  }

  // ── Replace an edited session in the records list ─────────────
  const handleSessionUpdated = useCallback((updated: ClockRecordApiItem) => {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }, [])

  // ── Replace an edited break inside a session ──────────────────
  const handleBreakUpdated = useCallback(
    (sessionId: number, updatedBreak: BreakRecord) => {
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== sessionId) return r
          return {
            ...r,
            break_records: r.break_records.map((b) =>
              b.id === updatedBreak.id ? updatedBreak : b
            ),
          }
        })
      )
    },
    []
  )

  // Activity feed is derived from live session data
  const activityEvents = buildActivityEvents(activeSessions)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ─────────────────────────────────────────── */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-primary" />
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Clocking Manager
              </h1>
            </div>
            <div className="ml-4 flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Real-time Activity Tracking
              </span>
            </div>
          </div>
          {/* Refresh button re-fetches live data and corrections */}
          <Button
            variant="outline"
            className="gap-2 self-start"
            disabled={loadingLive}
            onClick={() => { fetchLiveData(); fetchCorrections() }}
          >
            {loadingLive
              ? <Loader2 className="size-3.5 animate-spin" />
              : <RefreshCw className="size-3.5" />}
            Refresh
          </Button>
        </header>

        {/* ── Tabs ───────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="line" className="mb-6">
            <TabsTrigger value="dashboard">Live Dashboard</TabsTrigger>
            <TabsTrigger value="corrections" className="gap-2">
              Corrections
              {pendingCount > 0 && (
                <Badge className="h-4 px-1.5 text-[9px]">{pendingCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="records">All Records</TabsTrigger>
          </TabsList>

          {/* ─── Live Dashboard Tab ──────────────────────────── */}
          <TabsContent value="dashboard">
            {/* Error banner (non-cancel errors only) */}
            {liveError && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {liveError}
              </div>
            )}

            {/* Stats Overview */}
            <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Active Now"
                value={loadingLive ? "—" : String(activeCount)}
                sub="Employees working"
              />
              <StatCard
                label="On Break"
                value={loadingLive ? "—" : String(onBreakCount)}
                sub="Scheduled intervals"
                accent
              />
              {/* Efficiency card — derived from live ratio of working vs on-break */}
              <div className="rounded-2xl border border-border/10 bg-card/40 p-5 sm:col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Daily Efficiency
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-black">
                      {liveData
                        ? `${Math.min(100, Math.round((activeCount / Math.max(1, activeCount + onBreakCount)) * 100))}%`
                        : "—"}
                    </span>
                    <span className="text-xs font-bold text-primary">Live</span>
                  </div>
                </div>
                <div className="flex h-14 items-end gap-1">
                  {[32, 48, 40, 56, 64].map((h, i) => (
                    <div
                      key={i}
                      className="w-2 rounded-t bg-primary"
                      style={{ height: `${h}px`, opacity: 0.2 + i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* Loading spinner while fetching live sessions */}
            {loadingLive && (
              <div className="mb-10 w-full pt-4">
                <ClockingSessionsGridSkeleton />
              </div>
            )}

            {/* Active Personnel grid — rendered from real API sessions */}
            {!loadingLive && activeSessions.length > 0 && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    Active Personnel
                  </h3>
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary" /> Working
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-orange-400" /> On Break
                    </span>
                  </div>
                </div>
                <section className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {activeSessions.map(({ session }) => (
                    <EmployeeCard key={session.id} employee={sessionToEmployee(session)} />
                  ))}
                </section>
              </>
            )}

            {/* Empty state when nobody is clocked in */}
            {!loadingLive && !liveError && activeSessions.length === 0 && (
              <div className="mb-10 flex flex-col items-center justify-center rounded-2xl border border-border/10 bg-card/40 py-16">
                <Users className="mb-3 size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No employees are currently clocked in.</p>
              </div>
            )}

            {/* Activity Feed (derived from live sessions) */}
            <section>
              <h3 className="mb-6 text-lg font-bold">Activity Flow</h3>
              {activityEvents.length > 0
                ? <ActivityFeed events={activityEvents} />
                : <p className="text-sm text-muted-foreground">No active sessions to display.</p>}
            </section>
          </TabsContent>

          {/* ─── Corrections Tab ─────────────────────────────── */}
          <TabsContent value="corrections">
            <div className="mb-6">
              <h3 className="text-lg font-bold">Pending Correction Requests</h3>
              <p className="text-sm text-muted-foreground">
                Review and approve or reject employee clock-time correction requests.
              </p>
            </div>

            {/* Error banner */}
            {correctionsError && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {correctionsError}
              </div>
            )}

            {/* Loading spinner */}
            {loadingCorrections && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty state */}
            {!loadingCorrections && !correctionsError && pendingCount === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border/10 bg-card/40 py-16">
                <p className="text-sm text-muted-foreground">No pending correction requests.</p>
              </div>
            )}

            {/* Correction request cards — opens HandleCorrectionDialog on Review */}
            {!loadingCorrections && pendingCount > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {corrections
                  .filter((c) => c.status === "pending")
                  .map((correction) => (
                    <ManagerCorrectionCard
                      key={correction.id}
                      correction={correction}
                      onReview={() => openHandleDialog(correction)}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          {/* ─── All Records Tab ──────────────────────────────── */}
          <TabsContent value="records">
            {/* Tab header + Export ZIP button */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold">All Employee Records</h3>
                <p className="text-sm text-muted-foreground">
                  View and directly edit clock sessions and break records for all employees.
                </p>
              </div>
              <Button
                variant="outline"
                className="gap-2 self-start"
                onClick={() => setExportOpen(true)}
              >
                <Share className="size-3.5" />
                Export ZIP
              </Button>
            </div>

            {/* Filters: status + date range */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Clock className="size-3.5" />
                    {statusFilter === "all" ? "All Statuses" : statusFilter.replace("_", " ")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {(["all", "active", "on_break", "completed"] as const).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)}>
                      {s === "all" ? "All Statuses" : s.replace("_", " ")}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-2">
                <DateInput
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-36 text-sm"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <DateInput
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 w-36 text-sm"
                />
                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setStartDate(""); setEndDate("") }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Error banner */}
            {recordsError && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {recordsError}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => fetchRecords(recordsPage)}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Loading spinner */}
            {loadingRecords && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Records table + pagination */}
            {!loadingRecords && (
              <>
                <AllRecordsTable
                  records={records}
                  onSessionUpdated={handleSessionUpdated}
                  onBreakUpdated={handleBreakUpdated}
                />
                {recordsPagination.last_page > 1 && (
                  <div className="mt-6 flex justify-center">
                    <Pagination
                      currentPage={recordsPage}
                      totalPages={recordsPagination.last_page}
                      onPageChange={(p) => {
                        setRecordsPage(p)
                        fetchRecords(p)
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────── */}

      {/* Approve / reject correction with optional admin notes */}
      <HandleCorrectionDialog
        correction={selectedCorrection}
        open={handleDialogOpen}
        onOpenChange={setHandleDialogOpen}
        onHandled={handleCorrectionHandled}
      />

      {/* Export all employee records as a ZIP */}
      <ManagerExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  )
}

// ─── StatCard — preserves original visual design ─────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/10 bg-card/40 p-5",
        accent && "border-l-2 border-l-orange-400"
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="mt-3">
        <span className={cn("text-3xl font-black", accent ? "text-orange-400" : "text-primary")}>
          {value}
        </span>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

// ─── ManagerCorrectionCard ────────────────────────────────────────
// Card in the Corrections tab that displays a pending API correction
// and opens HandleCorrectionDialog when the manager clicks "Review".

function ManagerCorrectionCard({
  correction,
  onReview,
}: {
  correction: PendingCorrectionApiItem
  onReview: () => void
}) {
  const typeLabel = correctionTypeLabels[correction.correction_type] ?? correction.correction_type
  const refId     = `CRR-${String(correction.id).padStart(4, "0")}`
  const userName  = correction.clock_session?.user?.name ?? `User #${correction.user_id}`
  const userEmail = correction.clock_session?.user?.email ?? ""
  const initials  = userName.split(" ").map((n: string) => n[0]).join("").toUpperCase()

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/10 bg-card/60 backdrop-blur-xl transition-all hover:border-border/30">
      <div className="p-5 sm:p-6">
        {/* Header: user info + correction type badge */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-10 rounded-xl">
              <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-bold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="text-sm font-bold leading-tight">{userName}</h4>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit gap-1.5 self-start">
            <Clock className="size-2.5" />
            {typeLabel}
          </Badge>
        </div>

        {/* Time comparison */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Original Time
            </p>
            <p className="font-mono text-sm font-medium">{formatUtc(correction.original_time_utc)}</p>
          </div>
          <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              Requested Time
            </p>
            <p className="font-mono text-sm font-medium">{formatUtc(correction.requested_time_utc)}</p>
          </div>
        </div>

        {/* Reason */}
        <div className="mb-4">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Reason
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">{correction.reason}</p>
        </div>

        {/* Footer: ref ID + Review button */}
        <div className="flex flex-col gap-2 border-t border-border/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Shield className="size-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Ref: {refId}</span>
          </div>
          <Button size="sm" className="gap-1.5" onClick={onReview}>
            <CheckCircle className="size-3.5" />
            Review
          </Button>
        </div>
      </div>
    </div>
  )
}
