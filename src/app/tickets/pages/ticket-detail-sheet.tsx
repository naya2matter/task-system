// â”€â”€â”€ Ticket Detail Sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Slide-in side panel that fetches GET /tickets/{id} when opened.
// Shows a loading skeleton while the request is in flight, and an inline error
// banner on failure (cancel errors from fast open/close are silently ignored).
//
// Action buttons available in the sheet:
//   Edit      â€” fires onEdit callback (parent switches to form view)
//   Claim     â€” fires onClaim (self-assign)
//   Unclaim   â€” fires onUnclaim (remove assignee)
//   Assign    â€” fires onAssign (opens assign dialog)
//   Status    â€” inline dropdown to change status via onStatusChange
//   Complete  â€” fires onComplete

import { useState } from "react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  Pencil,
  UserRoundPlus,
  UserRoundX,
  UserCog,
  AlertCircle,
  Eye,
  Paperclip,
  Trash2,
} from "lucide-react"
// useTicket hook fetches GET /tickets/{id} and manages loading/error state
import { useTicket } from "@/app/tickets/hooks/useTicket"
// Display mapping helpers for backend enum values
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_VARIANTS,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_VARIANTS,
  formatTicketDate,
  getRequesterName,
} from "@/app/tickets/types"
import type { ApiTicket, ApiTicketStatus } from "@/app/tickets/types"
import { usePermissions } from "@/hooks/usePermissions"
import { useAuthStore } from "@/app/(auth)/stores/authStore"

// Status options reused for the inline change-status dropdown
const statusOptions: { value: ApiTicketStatus; label: string }[] = [
  { value: "open",        label: TICKET_STATUS_LABELS.open },
  { value: "in_progress", label: TICKET_STATUS_LABELS.in_progress },
  { value: "resolved",    label: TICKET_STATUS_LABELS.resolved },
]

const STORAGE_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api").replace(/\/api\/?$/, "")

type TicketDetailSheetProps = {
  /** Numeric id of the ticket to load; null means nothing is shown */
  ticketId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (ticket: ApiTicket) => void
  onClaim?: (ticket: ApiTicket) => void
  onUnclaim?: (ticket: ApiTicket) => void
  /** Opens the assign-to-user dialog */
  onAssign?: (ticket: ApiTicket) => void
  /** Changes the status via POST /tickets/{id}/status */
  onStatusChange?: (ticket: ApiTicket, status: ApiTicketStatus) => void
  /** Marks the ticket complete via POST /tickets/{id}/complete */
  onComplete?: (ticket: ApiTicket) => void
  /** Opens delete confirm dialog via DELETE /tickets/{id} */
  onDelete?: (ticket: ApiTicket) => void
  /** True while a quick action (claim/unclaim/assign/status/complete) is in-flight */
  actionSubmitting?: boolean
  /** Error from a failed quick action */
  actionError?: string | null
}

/** Extracts up-to-2-character initials from a display name */
function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export function TicketDetailSheet({
  ticketId,
  open,
  onOpenChange,
  onEdit,
  onClaim,
  onUnclaim,
  onAssign,
  onStatusChange,
  onComplete,
  onDelete,
  actionSubmitting = false,
  actionError,
}: TicketDetailSheetProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const { hasPermission, hasRole } = usePermissions()
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin   = hasRole("admin")
  const canEdit   = hasPermission("edit tickets")
  const canDelete = hasPermission("delete tickets")

  // Fetch the full ticket detail whenever ticketId changes while the sheet is open.
  // The hook clears selectedTicket on unmount / id change to prevent stale flashes.
  const { ticket, loading, error } = useTicket(open ? ticketId : null)
  const isAssignee = ticket?.assignee?.id === currentUser?.id
  const isRequester = ticket?.requester?.id === currentUser?.id
  const canAssignAction = isAdmin || isRequester

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="data-[side=right]:sm:max-w-full overflow-y-auto themed-scrollbar"
      >
        {/* ── Loading state ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="px-8 pt-6 pb-10 space-y-6">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-3/4" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="px-8 pt-8">
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* ── Ticket detail ─────────────────────────────────────────────────── */}
        {!loading && !error && ticket && (
          <>
            <SheetHeader className="gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status and priority badges */}
                <Badge variant={TICKET_STATUS_VARIANTS[ticket.status] ?? "outline"}>
                  {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                </Badge>
                <Badge variant={TICKET_PRIORITY_VARIANTS[ticket.priority] ?? "outline"}>
                  {TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                </Badge>
                {/* Numeric id displayed as a monospace label */}
                <span className="text-xs text-muted-foreground font-mono">#{ticket.id}</span>
              </div>
              <SheetTitle className="text-2xl leading-tight">{ticket.title}</SheetTitle>
              <SheetDescription className="sr-only">
                Details for ticket #{ticket.id}
              </SheetDescription>
            </SheetHeader>

            <div className="px-8 pb-10 space-y-8">
              {/* ── Metadata Grid ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                {/* Status */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Status
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${
                        ticket.status === "in_progress"
                          ? "bg-primary animate-pulse"
                          : ticket.status === "resolved"
                            ? "bg-green-500"
                            : "bg-muted-foreground"
                      }`}
                    />
                    <Badge variant={TICKET_STATUS_VARIANTS[ticket.status] ?? "outline"}>
                      {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                    </Badge>
                  </div>
                </div>

                {/* Priority */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Priority
                  </p>
                  <Badge variant={TICKET_PRIORITY_VARIANTS[ticket.priority] ?? "outline"}>
                    {TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                  </Badge>
                </div>

                {/* Type — maps backend enum key to readable label */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Type
                  </p>
                  <p className="text-sm font-medium">
                    {TICKET_TYPE_LABELS[ticket.type] ?? ticket.type}
                  </p>
                </div>

                {/* Created date — formatted from ISO string */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Created
                  </p>
                  <p className="text-sm font-medium">{formatTicketDate(ticket.created_at)}</p>
                </div>

                {/* Completed date — only shown when ticket has been completed */}
                {ticket.completed_at && (
                  <div className="rounded-lg bg-muted/50 p-4 col-span-2">
                    <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                      Completed
                    </p>
                    <p className="text-sm font-medium">{formatTicketDate(ticket.completed_at)}</p>
                  </div>
                )}
              </div>

              {/* ── Requester ──────────────────────────────────────────────── */}
              <section>
                <h4 className="text-sm font-semibold mb-3">Requester</h4>
                {ticket.requester ? (
                  <div className="flex items-center gap-3 rounded-full bg-muted/50 pr-4 pl-1 py-1 w-fit">
                    <Avatar className="size-6">
                      <AvatarImage
                        src={ticket.requester.avatar_url ?? undefined}
                        alt={ticket.requester.name}
                      />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(ticket.requester.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{ticket.requester.name}</span>
                  </div>
                ) : (
                  // Fallback to requester_name when User relation is not loaded
                  <p className="text-sm text-muted-foreground">{getRequesterName(ticket)}</p>
                )}
              </section>

              {/* ── Assignee ───────────────────────────────────────────────── */}
              <section>
                <h4 className="text-sm font-semibold mb-3">Assignee</h4>
                {ticket.assignee ? (
                  <div className="flex items-center gap-3 rounded-full bg-muted/50 pr-4 pl-1 py-1 w-fit">
                    <Avatar className="size-6">
                      <AvatarImage
                        src={ticket.assignee.avatar_url ?? undefined}
                        alt={ticket.assignee.name}
                      />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(ticket.assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{ticket.assignee.name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No assignee yet.</p>
                )}
              </section>

              <Separator />

              {/* ── Description ────────────────────────────────────────────── */}
              <section>
                <h4 className="text-sm font-semibold mb-3">Description</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {ticket.description}
                </p>
              </section>

              {/* ── Attachments (only present on the detail endpoint) ──────── */}
              {ticket.attachments && ticket.attachments.length > 0 && (
                <>
                  <Separator />
                  <section>
                    <h4 className="text-sm font-semibold mb-3">
                      Attachments ({ticket.attachments.length})
                    </h4>
                    <ul className="space-y-2">
                      {ticket.attachments.map((att) => (
                        <li
                          key={att.id}
                          className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
                        >
                          {att.file_type.startsWith("image/") ? (
                            <button
                              type="button"
                              onClick={() => setLightboxSrc(`${STORAGE_BASE}/storage/${att.file_path}`)}
                              className="relative shrink-0"
                              aria-label={`Preview ${att.file_name}`}
                            >
                              <img
                                src={`${STORAGE_BASE}/storage/${att.file_path}`}
                                alt={att.file_name}
                                className="size-10 rounded object-cover border"
                              />
                              <span className="absolute inset-0 flex items-center justify-center rounded bg-black/35 opacity-0 transition-opacity hover:opacity-100">
                                <Eye className="size-3.5 text-white" />
                              </span>
                            </button>
                          ) : (
                            <Paperclip className="size-3.5 shrink-0" />
                          )}
                          <span className="truncate">{att.file_name}</span>
                          <span className="text-xs text-muted-foreground/60 shrink-0">
                            ({(att.file_size / 1024).toFixed(1)} KB)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}

              <Separator />

              {/* ── Action error banner ────────────────────────────────────── */}
              {actionError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* ── Actions ────────────────────────────────────────────────── */}
              <div className="space-y-4">
                {/* Change Status — only the current assignee can change status */}
                {onStatusChange && ticket && ticket.assignee?.id === currentUser?.id && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-24 shrink-0">Change Status</span>
                    <Select
                      value={ticket.status}
                      onValueChange={(v) => onStatusChange(ticket, v as ApiTicketStatus)}
                      disabled={actionSubmitting}
                    >
                      <SelectTrigger className="w-40 h-8 text-sm">
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
                  </div>
                )}

                {/* Quick action buttons row */}
                <div className="flex flex-wrap gap-3">
                  {canEdit && onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // onEdit navigates to /tickets/{id}/edit; the route change
                        // closes the sheet via the page effect. Calling onOpenChange
                        // here would fire navigate("/tickets") and override the edit nav.
                        onEdit(ticket)
                      }}
                    >
                      <Pencil className="size-3.5 mr-2" />
                      Edit Ticket
                    </Button>
                  )}

                  {/* Unclaim — only the current assignee can unclaim */}
                  {ticket.assignee
                    ? onUnclaim && ticket.assignee.id === currentUser?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionSubmitting}
                          onClick={() => onUnclaim(ticket)}
                        >
                          <UserRoundX className="size-3.5 mr-2" />
                          Unclaim
                        </Button>
                      )
                    : onClaim && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionSubmitting}
                          onClick={() => onClaim(ticket)}
                        >
                          <UserRoundPlus className="size-3.5 mr-2" />
                          Claim Ticket
                        </Button>
                      )}

                  {/* Assign to a specific user — only the admin or requester can assign */}
                  {onAssign && canAssignAction && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionSubmitting}
                      onClick={() => onAssign(ticket)}
                    >
                      <UserCog className="size-3.5 mr-2" />
                      Assign To…
                    </Button>
                  )}

                  {/* Mark complete — only shown when not already completed */}
                  {onComplete && ticket.status !== "resolved" && isAssignee && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionSubmitting}
                      onClick={() => onComplete(ticket)}
                    >
                      <CheckCircle2 className="size-3.5 mr-2" />
                      {actionSubmitting ? "Completing…" : "Mark Complete"}
                    </Button>
                  )}

                  {/* Delete button */}
                  {canDelete && onDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={actionSubmitting}
                      onClick={() => onDelete(ticket)}
                    >
                      <Trash2 className="size-3.5 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              <Dialog
                open={Boolean(lightboxSrc)}
                onOpenChange={(open) => { if (!open) setLightboxSrc(null) }}
              >
                <DialogContent>
                  {lightboxSrc && (
                    <div className="flex items-center justify-center">
                      <img
                        src={lightboxSrc}
                        alt="Attachment preview"
                        className="max-w-full max-h-[80vh] object-contain"
                      />
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
