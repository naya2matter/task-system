// ─── Ticket Table View ────────────────────────────────────────────────────────
// Renders API tickets in a responsive table. Visible columns collapse at smaller
// breakpoints so the table stays usable on narrow screens.
// Includes all quick actions: Edit, Assign, Unassign, Complete, Status, Delete.

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  UserRoundPlus,
  UserRoundX,
  UserCheck,
  CheckCircle2,
  ArrowUpDown,
} from "lucide-react"
import { TruncatedText } from "@/components/ui/truncated-text"
// Import API-aligned type and display helpers from the tickets types module
import type { ApiTicket } from "@/app/tickets/types"
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_VARIANTS,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_VARIANTS,
  formatTicketDate,
} from "@/app/tickets/types"
import { usePermissions } from "@/hooks/usePermissions"
import { useAuthStore } from "@/app/(auth)/stores/authStore"

type TicketTableViewProps = {
  tickets: ApiTicket[]
  onSelect: (ticket: ApiTicket) => void
  onEdit: (ticket: ApiTicket) => void
  onDelete: (ticket: ApiTicket) => void
  // Quick-action callbacks — all provided from the parent page
  onAssign?: (ticket: ApiTicket) => void
  onUnassign?: (ticket: ApiTicket) => void
  onComplete?: (ticket: ApiTicket) => void
  onStatusChange?: (ticket: ApiTicket) => void
  onClaim?: (ticket: ApiTicket) => void
}

// Extract initials from a full name for avatar fallbacks
function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export function TicketTableView({
  tickets,
  onSelect,
  onEdit,
  onDelete,
  onAssign,
  onUnassign,
  onComplete,
  onStatusChange,
  onClaim,
}: TicketTableViewProps) {
  const { hasPermission, hasRole } = usePermissions()
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin   = hasRole("admin")
  const canView   = hasPermission("view tickets")
  const canEdit   = hasPermission("edit tickets")
  const canDelete = hasPermission("delete tickets")
  const showMenu  = canView || canEdit || canDelete
  return (
    // Wrap in overflow-x-auto so the table stays scrollable on small screens
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="hidden lg:table-cell">Description</TableHead>
            {/* Type hidden below md to save space */}
            <TableHead className="hidden md:table-cell">Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            {/* Requester / Assignee hidden below xl */}
            <TableHead className="hidden xl:table-cell">Requester</TableHead>
            <TableHead className="hidden xl:table-cell">Assignee</TableHead>
            <TableHead className="hidden lg:table-cell">Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Empty state */}
          {tickets.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="h-24 text-center text-sm text-muted-foreground">
                No tickets found.

              </TableCell>
            </TableRow>
          )}

          {tickets.map((ticket) => {
            const isAssignee = ticket.assignee?.id === currentUser?.id
            const isRequester = ticket.requester?.id === currentUser?.id
            const canAssignAction = isAdmin || isRequester

            return (
            <TableRow key={ticket.id} className="group">
              {/* ID — backend returns a numeric id */}
              <TableCell className="py-3">
                <span className="text-xs font-mono text-muted-foreground">#{ticket.id}</span>
              </TableCell>

              {/* Title — clickable to open the detail sheet */}
              <TableCell className="py-3 max-w-45">
                <button
                  type="button"
                  className="font-medium text-foreground text-sm hover:text-primary hover:underline underline-offset-2 transition-colors w-full text-left"
                  onClick={() => onSelect(ticket)}
                >
                  <TruncatedText
                    value={ticket.title}
                    className="max-w-35 sm:max-w-55 lg:max-w-75"
                  />
                </button>
              </TableCell>

              {/* Description — single-line ellipsis with tooltip */}
              <TableCell className="py-3 max-w-65 hidden lg:table-cell">
                <TruncatedText
                  value={ticket.description}
                  className="text-sm text-muted-foreground max-w-55 xl:max-w-90"
                />
              </TableCell>

              {/* Type — maps backend enum key to human label */}
              <TableCell className="py-3 hidden md:table-cell">
                <span className="text-sm text-muted-foreground">
                  {TICKET_TYPE_LABELS[ticket.type] ?? ticket.type}
                </span>
              </TableCell>

              {/* Status badge */}
              <TableCell className="py-3">
                <Badge variant={TICKET_STATUS_VARIANTS[ticket.status] ?? "outline"}>
                  {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                </Badge>
              </TableCell>

              {/* Priority badge */}
              <TableCell className="py-3">
                <Badge variant={TICKET_PRIORITY_VARIANTS[ticket.priority] ?? "outline"}>
                  {TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                </Badge>
              </TableCell>

              {/* Requester — uses avatar_url from backend User relation */}
              <TableCell className="py-3 hidden xl:table-cell">
                {ticket.requester ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7 border-2 border-card">
                      <AvatarImage
                        src={ticket.requester.avatar_url ?? undefined}
                        alt={ticket.requester.name}
                      />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(ticket.requester.name)}
                      </AvatarFallback>
                    </Avatar>
                    <TruncatedText
                      value={ticket.requester.name}
                      className="text-sm max-w-25 xl:max-w-35"
                    />
                  </div>
                ) : (
                  // Fallback to requester_name if relation was not loaded
                  <TruncatedText
                    value={ticket.requester_name}
                    className="text-sm text-muted-foreground max-w-25 xl:max-w-35"
                  />
                )}
              </TableCell>

              {/* Assignee — null means unassigned */}
              <TableCell className="py-3 hidden xl:table-cell">
                {ticket.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7 border-2 border-card">
                      <AvatarImage
                        src={ticket.assignee.avatar_url ?? undefined}
                        alt={ticket.assignee.name}
                      />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(ticket.assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <TruncatedText
                      value={ticket.assignee.name}
                      className="text-sm max-w-25 xl:max-w-35"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </TableCell>

              {/* Created date — formatted from ISO string */}
              <TableCell className="py-3 hidden lg:table-cell">
                <span className="text-sm text-muted-foreground">
                  {formatTicketDate(ticket.created_at)}
                </span>
              </TableCell>

              {/* Row actions dropdown */}
              <TableCell className="py-3 text-right">
                {showMenu && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Open actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {canView && (
                        <DropdownMenuItem onClick={() => onSelect(ticket)}>
                          <Eye className="size-4 mr-2" />
                          View
                        </DropdownMenuItem>
                      )}
                      {canEdit && (
                        <DropdownMenuItem onClick={() => onEdit(ticket)}>
                          <Pencil className="size-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />

                      {/* Claim — self-assign the current user (shown when unassigned) */}
                      {onClaim && !ticket.assignee && (
                        <DropdownMenuItem onClick={() => onClaim(ticket)}>
                          <UserCheck className="size-4 mr-2" />
                          Claim
                        </DropdownMenuItem>
                      )}

                      {/* Assign — only the admin or requester can assign */}
                      {onAssign && !ticket.assignee && canAssignAction && (
                        <DropdownMenuItem onClick={() => onAssign(ticket)}>
                          <UserRoundPlus className="size-4 mr-2" />
                          Assign
                        </DropdownMenuItem>
                      )}

                      {/* Unassign — only the current assignee can unassign */}
                      {onUnassign && ticket.assignee && isAssignee && (
                        <DropdownMenuItem onClick={() => onUnassign(ticket)}>
                          <UserRoundX className="size-4 mr-2" />
                          Unassign
                        </DropdownMenuItem>
                      )}

                      {/* Change status — only the current assignee can change status */}
                      {onStatusChange && isAssignee && (
                        <DropdownMenuItem onClick={() => onStatusChange(ticket)}>
                          <ArrowUpDown className="size-4 mr-2" />
                          Change Status
                        </DropdownMenuItem>
                      )}

                      {/* Complete — only when not already resolved and the user is the assignee */}
                      {onComplete && ticket.status !== "resolved" && isAssignee && (
                        <DropdownMenuItem onClick={() => onComplete(ticket)}>
                          <CheckCircle2 className="size-4 mr-2" />
                          Complete
                        </DropdownMenuItem>
                      )}

                      {canDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(ticket)}
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
