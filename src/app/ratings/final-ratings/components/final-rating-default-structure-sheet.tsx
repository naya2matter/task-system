import { useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { AlertCircle, CheckCircle2, XCircle, Info } from "lucide-react"
// Hook to fetch GET /final-ratings/configs/default-structure
import { useFinalRatingDefaultStructure } from "@/app/ratings/final-ratings/hooks/useFinalRatingDefaultStructure"
import type { FinalRatingConfigData } from "@/app/ratings/final-ratings/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Human-readable label for each component key */
const COMPONENT_LABELS: Record<string, string> = {
  task_ratings: "Task Ratings",
  stakeholder_ratings: "Stakeholder Ratings",
  help_requests_helper: "Help Requests (Helper)",
  help_requests_requester: "Help Requests (Requester)",
  tickets_resolved: "Tickets Resolved",
}

/** Render a single component's default settings */
function ComponentDefaultRow({
  label,
  data,
}: {
  label: string
  data: Record<string, unknown> | undefined
}) {
  const enabled = data?.enabled === true
  return (
    <div className="rounded-md border px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {enabled ? (
          <Badge
            variant="outline"
            className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs"
          >
            <CheckCircle2 className="size-3 mr-1" />
            Enabled by default
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            <XCircle className="size-3 mr-1" />
            Disabled by default
          </Badge>
        )}
      </div>
      {/* Show each setting as a small key-value pair (skip the `enabled` key) */}
      {data && (
        <div className="flex flex-col gap-1.5">
          {/* Primitive values (string, number, boolean) — inline chips */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {Object.entries(data)
              .filter(([k]) => k !== "enabled")
              .filter(([, v]) => typeof v !== "object" || v === null)
              .map(([k, v]) => (
                <span key={k} className="text-[11px] text-muted-foreground">
                  <span className="font-mono">{k.replace(/_/g, " ")}</span>:{" "}
                  <span className="font-semibold text-foreground">{String(v)}</span>
                </span>
              ))}
          </div>
          {/* Object values (e.g. penalties) — expanded as indented sub-rows */}
          {Object.entries(data)
            .filter(([k]) => k !== "enabled")
            .filter(([, v]) => typeof v === "object" && v !== null)
            .map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground font-mono">
                  {k.replace(/_/g, " ")}:
                </span>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 ps-2 border-s border-border">
                  {Object.entries(v as Record<string, unknown>).map(([sk, sv]) => (
                    <span key={sk} className="text-[11px] text-muted-foreground">
                      <span className="font-mono">{sk.replace(/_/g, " ")}</span>:{" "}
                      <span className="font-semibold text-foreground">{String(sv)}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

type FinalRatingDefaultStructureSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FinalRatingDefaultStructureSheet({
  open,
  onOpenChange,
}: FinalRatingDefaultStructureSheetProps) {
  // GET /final-ratings/configs/default-structure — called lazily when the sheet opens
  const { defaultStructure, loading, error, fetchDefaultStructure, clearError } =
    useFinalRatingDefaultStructure()

  // Fetch when the sheet opens (only if we don't have the data yet)
  useEffect(() => {
    if (open && !defaultStructure && !loading) {
      fetchDefaultStructure()
    }
  }, [open, defaultStructure, loading, fetchDefaultStructure])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Default Configuration Structure</SheetTitle>
          <SheetDescription>
            The default component settings applied when creating a new configuration.
          </SheetDescription>
        </SheetHeader>

        {/* ── Info banner ─────────────────────────────────────── */}
        <div className="mx-6 mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 flex items-start gap-2">
          <Info className="size-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            These are the factory defaults. You can override any setting when creating or editing
            a configuration.
          </p>
        </div>

        {/* ── Loading skeleton ─────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col gap-3 px-6 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        )}

        {/* ── Error state ──────────────────────────────────────── */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearError()
                fetchDefaultStructure()
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {/* ── Default structure content ────────────────────────── */}
        {!loading && !error && defaultStructure && (
          <div className="flex flex-col gap-2 px-6 py-4">
            {(Object.keys(COMPONENT_LABELS) as Array<keyof FinalRatingConfigData>).map((key) => (
              <ComponentDefaultRow
                key={key}
                label={COMPONENT_LABELS[key]}
                data={defaultStructure[key] as Record<string, unknown> | undefined}
              />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
