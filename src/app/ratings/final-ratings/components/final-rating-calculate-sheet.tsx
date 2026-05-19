import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/ui/date-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Calculator, Loader2 } from "lucide-react"
import { useCalculateFinalRatings } from "@/app/ratings/final-ratings/hooks/useCalculateFinalRatings"
import { useFinalRatingConfigs } from "@/app/ratings/final-ratings/hooks/useFinalRatingConfigs"
import type {
  ApiFinalRatingConfig,
  CalculateFinalRatingsPayload,
  FinalRatingsCalculateResult,
} from "@/app/ratings/final-ratings/types"

// ─── Props ────────────────────────────────────────────────────────────────────

type FinalRatingCalculateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Active config pre-selected in the config dropdown (can be null) */
  activeConfig: ApiFinalRatingConfig | null
  /** Called when calculation succeeds — passes the result up so the parent
   *  can open the results sheet */
  onSuccess: (result: FinalRatingsCalculateResult, payload: CalculateFinalRatingsPayload) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" for the default period_end */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Returns the first day of the current month as "YYYY-MM-DD" for default period_start */
function firstOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FinalRatingCalculateSheet({
  open,
  onOpenChange,
  activeConfig,
  onSuccess,
}: FinalRatingCalculateSheetProps) {
  // All configs for the dropdown (allows user to pick a specific config)
  const { configs } = useFinalRatingConfigs()

  // Hook for the POST /final-ratings/calculate call
  const { calculate, calculating, error, clearError } = useCalculateFinalRatings()

  // ── Form state ───────────────────────────────────────────────────
  const [periodStart, setPeriodStart] = useState(firstOfMonth())
  const [periodEnd, setPeriodEnd] = useState(today())
  const [maxPoints, setMaxPoints] = useState("100")
  // "active" is a sentinel meaning "use the active config (no config_id sent)"
  const [configId, setConfigId] = useState<string>("active")

  // ── Reset form when the sheet opens ──────────────────────────────
  useEffect(() => {
    if (!open) return
    setPeriodStart(firstOfMonth())
    setPeriodEnd(today())
    setMaxPoints("100")
    // Default to the active config when available
    setConfigId(activeConfig ? String(activeConfig.id) : "active")
    clearError()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Derived values ───────────────────────────────────────────────

  /** Build the payload — config_id is null when user picks "Active config" */
  function buildPayload(): CalculateFinalRatingsPayload {
    return {
      period_start: periodStart,
      period_end: periodEnd,
      max_points: parseFloat(maxPoints),
      config_id: configId === "active" ? null : parseInt(configId, 10),
    }
  }

  // ── Submit ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    const payload = buildPayload()
    const result = await calculate(payload)
    if (result) {
      // Pass result & the exact payload to the parent so the export button
      // can reuse the same params without re-entering them
      onSuccess(result, payload)
    }
  }

  // Basic client-side validation for the submit button
  const isValid =
    periodStart.length === 10 &&
    periodEnd.length === 10 &&
    periodStart <= periodEnd &&
    parseFloat(maxPoints) >= 1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Wide enough to comfortably show the date + number fields */}
      <SheetContent className="sm:max-w-md w-full overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5">
              <Calculator className="size-4 text-primary" />
            </div>
            Calculate Final Ratings
          </SheetTitle>
          <SheetDescription>
            Select a period and maximum points, then run the calculation.  
            Results will show each employee's score breakdown.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* ── Error banner ─────────────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Period start ──────────────────────────────────────── */}
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

          {/* ── Period end ────────────────────────────────────────── */}
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

          {/* ── Max points ────────────────────────────────────────── */}
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
            <p className="text-xs text-muted-foreground">
              The score a user needs to achieve 100 % in the final rating.
            </p>
          </div>

          {/* ── Config selector ────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="config_id">Rating Configuration</Label>
            <Select value={configId} onValueChange={setConfigId}>
              <SelectTrigger id="config_id">
                <SelectValue placeholder="Use active configuration" />
              </SelectTrigger>
              <SelectContent>
                {/* Sentinel value — backend uses the currently active config */}
                <SelectItem value="active">
                  <span className="flex items-center gap-2">
                    Use active configuration
                    {activeConfig && (
                      <Badge variant="secondary" className="text-xs">
                        {activeConfig.name}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
                {/* List every available config so the user can override */}
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
            <p className="text-xs text-muted-foreground">
              Leave as "Use active configuration" to automatically pick the current active config.
            </p>
          </div>

          {/* ── Actions ───────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={calculating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={calculating || !isValid}
              className="transition-all hover:shadow-md hover:shadow-primary/25"
            >
              {calculating && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {calculating ? "Calculating…" : "Calculate"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
