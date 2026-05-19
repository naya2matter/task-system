// src/app/clocking/components/correction-request-dialog.tsx
// Dialog for requesting a time correction on a clocking session.
// Accepts a real ClockRecordApiItem (API session), builds the request payload,
// calls POST /clocking/correction-request, and returns the created correction.

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { HistoryIcon, ShieldCheckIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { isCancel } from "axios"
import { toast } from "sonner"
import { DateInput } from "@/components/ui/date-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ClockRecordApiItem, ApiCorrectionType, PendingCorrectionApiItem } from "../data"

// ─── Time picker helpers ──────────────────────────────────────────

const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))

/** Parse a 24-h "HH:MM" string into { hour12, minute, period } display parts */
function parseTo12h(value: string) {
  if (!value) return { hour12: "", minute: "", period: "AM" as "AM" | "PM" }
  const [hStr, mStr] = value.split(":")
  const h = parseInt(hStr, 10)
  return {
    hour12: String(h === 0 ? 12 : h > 12 ? h - 12 : h).padStart(2, "0"),
    minute: mStr ?? "00",
    period: (h < 12 ? "AM" : "PM") as "AM" | "PM",
  }
}

/** Combine 12-h parts back to "HH:MM" 24-hour string */
function to24h(hour12: string, minute: string, period: "AM" | "PM"): string {
  if (!hour12 || !minute) return ""
  let h = parseInt(hour12, 10)
  if (period === "AM") { if (h === 12) h = 0 }
  else                 { if (h !== 12) h += 12 }
  return `${String(h).padStart(2, "0")}:${minute}`
}
import { clockingService } from "@/services/clockingService"

// ─── Correction type options ──────────────────────────────────────

const CORRECTION_TYPES: { value: ApiCorrectionType; label: string }[] = [
  { value: "clock_in",  label: "Clock In"    },
  { value: "clock_out", label: "Clock Out"   },
  { value: "break_in",  label: "Break Start" },
  { value: "break_out", label: "Break End"   },
]

// Human-readable label for a correction type value
const correctionTypeLabel = (type: ApiCorrectionType) =>
  CORRECTION_TYPES.find((t) => t.value === type)?.label ?? type

// ─── Props ────────────────────────────────────────────────────────

interface CorrectionRequestDialogProps {
  /** The API session record being corrected (null = hide dialog) */
  record: ClockRecordApiItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the newly created correction after a successful API submission */
  onSubmit?: (correction: PendingCorrectionApiItem) => void
}

const MAX_REASON_LENGTH = 500

// ─── Component ────────────────────────────────────────────────────

export function CorrectionRequestDialog({
  record,
  open,
  onOpenChange,
  onSubmit,
}: CorrectionRequestDialogProps) {
  // What kind of time entry to correct
  const [correctionType, setCorrectionType] = useState<ApiCorrectionType>("clock_in")
  // Break record ID — required only when correcting a break start/end
  const [breakRecordId, setBreakRecordId] = useState<number | "">("")
  // Proposed corrected date + time (user enters in their local timezone)
  const [proposedDate, setProposedDate] = useState("")
  const [proposedTime, setProposedTime] = useState("")      // stored as HH:MM 24-h
  const [reason, setReason] = useState("")

  // Derived 12-h display parts for the time picker
  const { hour12, minute, period } = parseTo12h(proposedTime)

  function setTimePart(h: string, m: string, p: "AM" | "PM") {
    setProposedTime(to24h(h, m, p))
  }
  const [submitting, setSubmitting] = useState(false)

  if (!record) return null

  // Reference ID shown at the bottom for tracking purposes
  const refId = `CHR-${String(record.id).padStart(4, "0")}`
  const remainingChars = MAX_REASON_LENGTH - reason.length
  // Whether the selected type requires choosing a break record
  const isBreakType = correctionType === "break_in" || correctionType === "break_out"

  // Reset all local state and close the dialog
  function resetAndClose() {
    setCorrectionType("clock_in")
    setBreakRecordId("")
    setProposedDate("")
    setProposedTime("")
    setReason("")
    onOpenChange(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!proposedDate || !proposedTime || reason.trim().length < 10) return
    if (isBreakType && !breakRecordId) return

    // Build a UTC zulu timestamp from the local date + time inputs
    const requestedTimeUtc = `${proposedDate}T${proposedTime}:00Z`

    const payload = {
      correction_type: correctionType,
      reason: reason.trim(),
      requested_time_utc: requestedTimeUtc,
      // For clock corrections send the session id; for breaks send the break record id
      clock_session_id: !isBreakType ? record!.id : null,
      break_record_id:  isBreakType  ? (breakRecordId as number) : null,
    }

    setSubmitting(true)
    try {
      const correction = await clockingService.requestCorrection(payload)
      onSubmit?.(correction)
      resetAndClose()
    } catch (err) {
      if (!isCancel(err)) {
        toast.error("Failed to submit correction request.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(true) }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl p-0"
      >
        <div className="p-7 sm:p-10">
          {/* ── Header ─────────────────────────────────────────── */}
          <header className="mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
              <HistoryIcon className="size-3 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Correction Request
              </span>
            </div>

            {/* Title changes based on the selected correction type */}
            <h1 className="mb-3 text-2xl font-black tracking-tighter leading-none sm:text-3xl">
              Request {correctionTypeLabel(correctionType)} Correction
            </h1>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Session date:{" "}
                <span className="font-mono text-foreground">
                  {format(parseISO(record.session_date), "MMM d, yyyy")}
                </span>
              </p>
              <p className="text-xs italic text-primary">
                Enter the corrected time in UTC for this record.
              </p>
            </div>
          </header>

          {/* ── Form ───────────────────────────────────────────── */}
          <form className="space-y-6" onSubmit={handleSubmit}>

            {/* Correction type selection */}
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Correction Type
              </label>
              <div className="grid grid-[auto-fit] sm:grid-cols-4 grid-cols-2 gap-3">
                {CORRECTION_TYPES.map((t) => {
                  const isSelected = correctionType === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setCorrectionType(t.value)
                        setBreakRecordId("")
                      }}
                      className={cn(
                        "flex items-center justify-center rounded-xl border-2 px-3 py-3 text-xs font-bold transition-all duration-200",
                        isSelected
                          ? t.value === "clock_in"
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : t.value === "clock_out"
                            ? "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : t.value === "break_in"
                            ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "border-border/40 bg-muted/20 text-muted-foreground hover:border-border/80 hover:bg-muted/50"
                      )}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Break record selector — only visible for break_in / break_out */}
            {isBreakType && (
              <InputField label="Select Break Record">
                {record.break_records.length === 0 ? (
                  <p className="px-4 py-3.5 text-sm text-muted-foreground">
                    No break records found for this session.
                  </p>
                ) : (
                  <select
                    required
                    value={breakRecordId}
                    onChange={(e) => setBreakRecordId(Number(e.target.value))}
                    className="w-full border-none bg-background dark:bg-zinc-900 px-4 py-3.5 text-sm text-foreground outline-none appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-background text-muted-foreground">— Select a break —</option>
                    {record.break_records.map((br) => (
                      <option key={br.id} value={br.id} className="bg-background text-foreground py-2">
                        Break #{br.id} — Start: {new Date(br.break_start_utc).toLocaleTimeString()}
                        {br.break_end_utc
                          ? ` / End: ${new Date(br.break_end_utc).toLocaleTimeString()}`
                          : " (active)"}
                      </option>
                    ))}
                  </select>
                )}
              </InputField>
            )}

            {/* Date + Time row */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <InputField label="Proposed Date">
                <DateInput
                  required
                  value={proposedDate}
                  onChange={(e: any) => setProposedDate(e.target.value)}
                  className="w-full border-none bg-transparent px-4 py-3.5 text-sm text-foreground outline-none"
                />
              </InputField>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Proposed Time (UTC)
                </label>
                {/* Unified pill — same visual weight as InputField but borderless between segments */}
                <div className="group flex items-center overflow-hidden rounded-t-xl bg-muted/40 ring-1 ring-border/30 transition-all focus-within:ring-primary">
                  {/* Hour */}
                  <Select
                    value={hour12}
                    onValueChange={(v) => setTimePart(v, minute || "00", period)}
                  >
                    <SelectTrigger className="flex-1 h-12 rounded-none border-none bg-transparent px-4 text-sm font-semibold shadow-none focus:ring-0 focus-visible:ring-0">
                      <SelectValue placeholder="HH" />
                    </SelectTrigger>
                    <SelectContent className="max-h-52">
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="shrink-0 text-muted-foreground/60 font-bold text-lg leading-none select-none">:</span>

                  {/* Minute */}
                  <Select
                    value={minute}
                    onValueChange={(v) => setTimePart(hour12 || "12", v, period)}
                  >
                    <SelectTrigger className="flex-1 h-12 rounded-none border-none bg-transparent px-4 text-sm font-semibold shadow-none focus:ring-0 focus-visible:ring-0">
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent className="max-h-52">
                      {MINUTES.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Divider */}
                  <div className="h-5 w-px bg-border/40 shrink-0" />

                  {/* AM / PM */}
                  <Select
                    value={period}
                    onValueChange={(v) => setTimePart(hour12 || "12", minute || "00", v as "AM" | "PM")}
                  >
                    <SelectTrigger className="w-24 h-12 rounded-none border-none bg-transparent px-4 text-sm font-semibold shadow-none focus:ring-0 focus-visible:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Bottom accent line — mirrors InputField */}
                  <div className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-full" />
                </div>
                {/* bottom underline accent (replicates InputField) */}
                <div className="h-0.5 bg-border/40 group-focus-within:bg-primary transition-colors" />
              </div>
            </div>

            {/* Reason */}
            <div>
              <div className="mb-2 flex items-end justify-between">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Reason for Correction
                </label>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    remainingChars < 50 ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {remainingChars} remaining
                </span>
              </div>
              <InputField>
                <textarea
                  required
                  minLength={10}
                  rows={4}
                  maxLength={MAX_REASON_LENGTH}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you need this correction… (min 10 characters)"
                  className="w-full resize-none border-none bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
              </InputField>
              {/* Minimum length hint */}
              {reason.length > 0 && reason.trim().length < 10 && (
                <p className="mt-1.5 text-[10px] font-semibold text-destructive uppercase tracking-widest">
                  {10 - reason.trim().length} more character{10 - reason.trim().length !== 1 ? "s" : ""} required
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={resetAndClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                className="flex-[1.5] gap-2 font-bold"
                disabled={
                  submitting ||
                  !proposedDate ||
                  !proposedTime ||
                  reason.trim().length < 10 ||
                  (isBreakType && !breakRecordId)
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-border/10 bg-muted/20 px-7 py-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheckIcon className="size-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Authenticated Action
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Ref ID: {refId}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Shared InputField wrapper ────────────────────────────────────

function InputField({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div>
      {label && (
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </label>
      )}
      <div className="group relative overflow-hidden rounded-t-xl bg-muted/40 ring-1 ring-border/30 transition-all focus-within:ring-primary">
        {children}
        {/* bottom underline accent */}
        <div className="absolute bottom-0 left-0 h-0.5 w-full bg-border/40 transition-colors group-focus-within:bg-primary" />
      </div>
    </div>
  )
}
