// src/app/clocking/in-out/page.tsx
// ─── Clocking In/Out Page ────────────────────────────────────────
// Displays the live clock, session stats, and action buttons.
// Connects to the backend via clockingService for real data.
// Subscribes to WebSocket for real-time session updates.

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Play, Square, Coffee, Clock, CalendarDays, Info, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { isCancel } from "axios"
import { toast } from "sonner"
import { clockingService } from "@/services/clockingService"
import { useAuthStore } from "@/app/(auth)/stores/authStore"
import { useClockingChannel } from "@/hooks/useClockingChannel"
import { ClockingInOutSkeleton } from "./clocking-in-out-skeleton"
import type {
  ClockingSessionResponse,
  ClockSession,
  BreakRecord,
  SessionEvent,
} from "../data"

// ─── Helper: format the live clock display ───────────────────────
function formatTime(date: Date): { hours: string; minutes: string; seconds: string; period: string } {
  const h = date.getHours()
  const period = h >= 12 ? "PM" : "AM"
  const hours12 = h % 12 || 12
  return {
    hours: String(hours12).padStart(2, "0"),
    minutes: String(date.getMinutes()).padStart(2, "0"),
    seconds: String(date.getSeconds()).padStart(2, "0"),
    period,
  }
}

// ─── Helper: format milliseconds as HH:MM:SS ────────────────────
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ─── Helper: format a Date to readable time ──────────────────────
function formatTimeFromDate(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

// ─── Helper: compute total break milliseconds from break records ─
function computeTotalBreakMs(breaks: BreakRecord[]): number {
  let total = 0
  for (const b of breaks) {
    if (b.break_end_utc && b.status === "completed") {
      // Completed break — use stored start/end
      total += new Date(b.break_end_utc).getTime() - new Date(b.break_start_utc).getTime()
    } else if (b.status === "active") {
      // Active break — count from start until now
      total += Date.now() - new Date(b.break_start_utc).getTime()
    }
  }
  return Math.max(0, total)
}

// ─── Helper: build the session-event timeline from a ClockSession ─
function buildSessionEvents(session: ClockSession): SessionEvent[] {
  const events: SessionEvent[] = []

  // Clock-in event
  const clockInDate = new Date(session.clock_in_utc)
  events.push({
    type: "clock-in",
    label: `Clock In at ${formatTimeFromDate(clockInDate)}`,
    detail: "Session Started",
  })

  // Break events — one entry per break record
  session.break_records.forEach((b, i) => {
    const startDate = new Date(b.break_start_utc)
    if (b.break_end_utc && b.status === "completed") {
      // Completed break — show duration & time range
      const endDate = new Date(b.break_end_utc)
      const dur = endDate.getTime() - startDate.getTime()
      events.push({
        type: "break",
        label: `Break ${i + 1}`,
        detail: `${formatTimeFromDate(startDate)} → ${formatTimeFromDate(endDate)}`,
        duration: formatDuration(dur),
      })
    } else {
      // Active break — still ongoing
      events.push({
        type: "break",
        label: `Break ${i + 1}`,
        detail: `Started at ${formatTimeFromDate(startDate)}`,
      })
    }
  })

  // Clock-out event (only if session completed)
  if (session.clock_out_utc) {
    const clockOutDate = new Date(session.clock_out_utc)
    events.push({
      type: "clock-out",
      label: `Clock Out at ${formatTimeFromDate(clockOutDate)}`,
      detail: "Session Ended",
    })
  }

  return events
}

// ─── Main Component ──────────────────────────────────────────────
export default function ClockingInOutPage() {
  // ── Live clock (ticks every second) ────────────────────────────
  const [now, setNow] = useState(new Date())

  // ── Session state from the API ─────────────────────────────────
  const [session, setSession] = useState<ClockSession | null>(null)
  const [, setCompanyTimezone] = useState<string>("UTC")

  // ── Loading / error states ─────────────────────────────────────
  const [initialLoading, setInitialLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false) // true while clock-in/out/break API call is in-flight
  const [error, setError] = useState<string | null>(null)   // shows recoverable errors in the UI

  // ── Timers (computed from session data every second) ───────────
  const [workMs, setWorkMs] = useState(0)
  const [breakMs, setBreakMs] = useState(0)

  // ── Session event timeline (derived from session) ──────────────
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])

  // ── Get authenticated user for WebSocket subscription ──────────
  const user = useAuthStore((s) => s.user)

  // ── Ref to avoid re-running effect when session changes ────────
  const sessionRef = useRef(session)
  sessionRef.current = session

  // ── Ref to track whether the 15-min break warning has fired ────
  // Stores the session id for which the warning was already shown so
  // we never fire more than once per session.
  const breakWarningSessionRef = useRef<number | null>(null)

  // ── Request browser notification permission on mount ───────────
  // Needed so we can fire a native OS notification when the user is
  // on a different tab and the break limit is reached.
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }, [])

  // ── Derived booleans (computed from session status) ────────────
  const isActive = session !== null && session.status !== "completed"
  const isOnBreak = session?.status === "on_break"
  const breakCount = session?.break_records?.length ?? 0

  // ── Apply API response to local state ──────────────────────────
  // Called after every API call and every WebSocket update
  const applySessionResponse = useCallback((data: ClockingSessionResponse) => {
    setSession(data.session)
    setCompanyTimezone(data.company_timezone)

    if (data.session) {
      // Rebuild the event timeline from the real session data
      setSessionEvents(buildSessionEvents(data.session))
    } else {
      setSessionEvents([])
    }
  }, [])

  // ── Fetch initial data on mount ────────────────────────────────
  // GET /clocking/initial-data — loads the user's active session (if any)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setInitialLoading(true)
        setError(null)
        const data = await clockingService.getInitialData()
        if (!cancelled) applySessionResponse(data)
      } catch (err) {
        // Skip canceled requests (e.g. component unmounted)
        if (!cancelled && !isCancel(err)) {
          setError("Failed to load clocking data. Please try again.")
        }
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [applySessionResponse])

  // ── Subscribe to WebSocket updates ─────────────────────────────
  // When the backend broadcasts a session update, apply it instantly
  useClockingChannel(user?.id ?? null, applySessionResponse)

  // ── Live clock tick (updates every second) ─────────────────────
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Recompute work/break durations every second ────────────────
  // Uses the session's UTC timestamps to keep the timer accurate
  useEffect(() => {
    if (!session || session.status === "completed") {
      // No active session — reset or keep last values
      if (!session) {
        setWorkMs(0)
        setBreakMs(0)
      }
      return
    }

    // Recalculate every second while session is active
    const interval = setInterval(() => {
      const s = sessionRef.current
      if (!s) return

      const clockInMs = new Date(s.clock_in_utc).getTime()
      const totalElapsed = Date.now() - clockInMs
      const totalBreak = computeTotalBreakMs(s.break_records)
      setBreakMs(totalBreak)
      setWorkMs(Math.max(0, totalElapsed - totalBreak))
    }, 1000)

    // Run once immediately so the timer starts right away
    const clockInMs = new Date(session.clock_in_utc).getTime()
    const totalElapsed = Date.now() - clockInMs
    const totalBreak = computeTotalBreakMs(session.break_records)
    setBreakMs(totalBreak)
    setWorkMs(Math.max(0, totalElapsed - totalBreak))

    return () => clearInterval(interval)
  }, [session])

  // ── Action: Clock In — POST /clocking/clock-in ─────────────────
  const handleClockIn = useCallback(async () => {
    try {
      setActionLoading(true)
      setError(null)
      const data = await clockingService.clockIn()
      applySessionResponse(data)
    } catch (err) {
      if (!isCancel(err)) setError("Failed to clock in. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }, [applySessionResponse])

  // ── Action: Clock Out — POST /clocking/clock-out ───────────────
  const handleClockOut = useCallback(async () => {
    try {
      setActionLoading(true)
      setError(null)
      const data = await clockingService.clockOut()
      applySessionResponse(data)
    } catch (err) {
      if (!isCancel(err)) setError("Failed to clock out. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }, [applySessionResponse])

  // ── Action: Toggle Break — POST /clocking/break/start or /end ──
  const handleToggleBreak = useCallback(async () => {
    try {
      setActionLoading(true)
      setError(null)
      if (isOnBreak) {
        // End the current break (no description for quick toggle)
        const data = await clockingService.endBreak(null)
        applySessionResponse(data)
      } else {
        // Start a new break
        const data = await clockingService.startBreak()
        applySessionResponse(data)
      }
    } catch (err) {
      if (!isCancel(err)) setError("Failed to update break. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }, [isOnBreak, applySessionResponse])

  // ── Break over-limit warning (> 17 min total break time) ───────
  // Fires once per session when cumulative break time exceeds 17 minutes.
  const BREAK_LIMIT_MS = 17 * 60 * 1000
  useEffect(() => {
    if (!session || session.status === "completed") return
    // Reset the warning if a new session started
    if (breakWarningSessionRef.current !== null && breakWarningSessionRef.current !== session.id) {
      breakWarningSessionRef.current = null
    }
    // Fire exactly once per session when the limit is crossed
    if (breakMs >= BREAK_LIMIT_MS && breakWarningSessionRef.current !== session.id) {
      breakWarningSessionRef.current = session.id

      const title = "Break limit reached"
      const body = "Your total break time has exceeded 17 minutes. Please end your break and resume working."

      // Always show the in-app toast
      toast.warning(title, { description: body, duration: Infinity })

      // Also fire a native OS notification so the alert surfaces on other tabs
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: `break-limit-${session.id}`, // prevents duplicate OS notifications
          requireInteraction: true,         // stays visible until dismissed
        })
        // Clicking the notification focuses this tab
        n.onclick = () => {
          window.focus()
          n.close()
        }
      }
    }
  }, [breakMs, session])

  // ── Retry: re-fetch initial data after an error ────────────────
  const handleRetry = useCallback(async () => {
    try {
      setInitialLoading(true)
      setError(null)
      const data = await clockingService.getInitialData()
      applySessionResponse(data)
    } catch (err) {
      if (!isCancel(err)) setError("Failed to load clocking data. Please try again.")
    } finally {
      setInitialLoading(false)
    }
  }, [applySessionResponse])

  // ── Format the live clock values ───────────────────────────────
  const time = formatTime(now)
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // ── Clock-in time display (from real session data) ─────────────
  const clockInTimeStr = session?.clock_in_utc
    ? formatTimeFromDate(new Date(session.clock_in_utc))
    : null

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col items-center text-center">

        {/* ── Digital Clock ──────────────────────────────────────── */}
        <div className="mb-12">
          <h2 className="flex items-baseline gap-1 text-6xl font-thin tracking-tighter text-foreground sm:text-7xl lg:text-8xl">
            {time.hours}:{time.minutes}:
            <span className="text-primary font-light">{time.seconds}</span>
            <span className="ml-3 text-xl font-bold uppercase tracking-widest text-muted-foreground sm:text-2xl">
              {time.period}
            </span>
          </h2>
          <div className="mt-2 flex items-center justify-center gap-2 text-muted-foreground">
            <CalendarDays className="size-3.5" />
            <p className="text-xs font-bold uppercase tracking-widest">{dateStr}</p>
          </div>
        </div>

        {/* ── Error Banner ──────────────────────────────────────── */}
        {/* Shows API errors with a retry button */}
        {error && (
          <div className="mb-6 flex w-full items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-left">
            <AlertCircle className="size-5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 text-destructive hover:text-destructive"
              onClick={handleRetry}
              disabled={initialLoading}
            >
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* ── Initial Loading State ─────────────────────────────── */}
        {/* Spinner shown while fetching initial data from the API */}
        {initialLoading ? (
          <ClockingInOutSkeleton />
        ) : (
          <>
            {/* ── Central Card ────────────────────────────────────── */}
            <div
              className={cn(
                "w-full rounded-3xl border bg-card/60 p-6 backdrop-blur-xl transition-all sm:p-8 lg:p-10",
                isActive
                  ? "border-primary/20 shadow-[0_0_40px_-10px] shadow-primary/20"
                  : "border-border/50"
              )}
            >
              {/* ── Stats Row (Work Time / Break Time / Breaks) ──── */}
              <div className="mb-8 grid grid-cols-3 gap-4 border-b border-border/20 pb-8 sm:gap-8">
                <div className="text-center">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                    Work Time
                  </p>
                  <p
                    className={cn(
                      "font-mono text-lg font-light tracking-tight sm:text-2xl",
                      isActive && !isOnBreak && "animate-pulse"
                    )}
                  >
                    {formatDuration(workMs)}
                  </p>
                </div>
                <div className="border-x border-border/20 text-center">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Break Time
                  </p>
                  <p
                    className={cn(
                      "font-mono text-lg font-light tracking-tight text-muted-foreground sm:text-2xl",
                      isOnBreak && "text-foreground animate-pulse"
                    )}
                  >
                    {formatDuration(breakMs)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Breaks Today
                  </p>
                  <p className="font-mono text-lg font-light tracking-tight sm:text-2xl">{breakCount}</p>
                </div>
              </div>

              {/* ── Action Area ─────────────────────────────────────── */}
              <div className="flex flex-col items-center gap-6">
                {!isActive ? (
                  <>
                    {/* Clock-In Button — big circle, calls POST /clocking/clock-in */}
                    <button
                      onClick={handleClockIn}
                      disabled={actionLoading}
                      className="group relative size-36 rounded-full bg-linear-to-br from-primary to-primary/60 p-0.5 shadow-2xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:pointer-events-none sm:size-48"
                    >
                      <div className="flex size-full flex-col items-center justify-center rounded-full border-4 border-background/20">
                        {/* Show spinner while clock-in request is in-flight */}
                        {actionLoading ? (
                          <Loader2 className="size-10 animate-spin text-primary-foreground sm:size-12" />
                        ) : (
                          <Play className="mb-1 size-10 fill-primary-foreground text-primary-foreground sm:size-12" />
                        )}
                        <span className="text-xs font-black uppercase tracking-widest text-primary-foreground">
                          {actionLoading ? "Starting…" : "Clock In"}
                        </span>
                      </div>
                    </button>
                    <p className="text-xs italic text-muted-foreground">
                      Press to start your recording session
                    </p>
                  </>
                ) : (
                  <>
                    {/* Active session status pill */}
                    <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
                      <span className="size-2 animate-pulse rounded-full bg-primary" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                        {isOnBreak ? "On Break" : "Working"}
                      </span>
                    </div>

                    {/* Clock-in timestamp from the API response */}
                    <p className="text-sm text-muted-foreground">
                      Clocked in at{" "}
                      <span className="text-foreground">{clockInTimeStr}</span>
                    </p>

                    {/* Break / Clock Out buttons */}
                    <div className="flex items-center gap-3">
                      {/* Toggle break — POST /clocking/break/start or /end */}
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleToggleBreak}
                        disabled={actionLoading}
                        className="gap-2 rounded-full px-6"
                      >
                        {actionLoading ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Coffee className="size-3.5" />
                        )}
                        {isOnBreak ? "End Break" : "Start Break"}
                      </Button>
                      {/* Clock out — POST /clocking/clock-out */}
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={handleClockOut}
                        disabled={actionLoading}
                        className="gap-2 rounded-full bg-destructive px-6 text-white hover:bg-destructive/80"
                      >
                        {actionLoading ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Square className="size-3.5" />
                        )}
                        Clock Out
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Session Log / Status ──────────────────────────────── */}
            {/* Timeline of events built from the real session break_records */}
            <div className="mt-6 w-full rounded-2xl border border-border/10 bg-card/40 p-6 text-left">
              {!isActive && sessionEvents.length === 0 ? (
                // No session — show info prompt
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <Info className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">Current Session</h4>
                      <p className="text-xs text-muted-foreground">
                        No session for today. Clock in to start tracking.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Session log header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-primary" />
                      <h4 className="text-sm font-bold">Today&apos;s Session</h4>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      {isActive ? "In Progress" : "Completed"}
                    </span>
                  </div>

                  {/* Event timeline — each event is a clock-in, break, or clock-out */}
                  <div className="space-y-3">
                    {sessionEvents.map((event, i) => (
                      <div key={i} className="flex items-start gap-3">
                        {/* Colored dot per event type */}
                        <div
                          className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                            event.type === "clock-in" && "bg-primary",
                            event.type === "break" && "bg-muted-foreground",
                            event.type === "clock-out" && "bg-destructive"
                          )}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold">{event.label}</p>
                            {event.duration && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {event.duration}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {event.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
