// ─── HelpRequestTableView ─────────────────────────────────────────────────────
// Renders help requests in a responsive scrollable table.
// Uses the API-aligned HelpRequest type from ../types.

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TruncatedText } from "@/components/ui/truncated-text"
import { MoreHorizontal, Pencil, Trash2, Eye, HandHelping, X, UserCheck, CheckCircle2 } from "lucide-react"
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Link } from "react-router"
import { usePermissions } from "@/hooks/usePermissions"
import { useAuthStore } from "@/app/(auth)/stores/authStore"
// API types replacing the old mock-data types
import type { HelpRequest } from "@/app/help-requests/types"
import { getDisplayStatus, helpRequestRatingLabel } from "@/app/help-requests/types"

type HelpRequestTableViewProps = {
  requests: HelpRequest[]
  onSelect: (request: HelpRequest) => void
  onEdit: (request: HelpRequest) => void
  onDelete: (request: HelpRequest) => void
  onClaim: (request: HelpRequest) => void
  onUnclaim: (request: HelpRequest) => void
  /** Opens the assign-user dialog for POST /help-requests/{id}/assign/{userId} */
  onAssign: (request: HelpRequest) => void
  /** Opens the complete dialog for POST /help-requests/{id}/complete */
  onComplete: (request: HelpRequest) => void
}

// Extract two uppercase initials from a full name
function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

// Map derived status to badge variant
const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "outline",
  claimed: "default",
  completed: "secondary",
}

// Human-readable labels for each status value
const statusLabel: Record<string, string> = {
  open: "Open",
  claimed: "Claimed",
  completed: "Completed",
}

// Format an ISO datetime string to a short readable date
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function HelpRequestTableView({
  requests,
  onSelect,
  onEdit,
  onDelete,
  onClaim,
  onUnclaim,
  onAssign,
  onComplete,
}: HelpRequestTableViewProps) {
  const { hasPermission } = usePermissions()
  const currentUser = useAuthStore((s) => s.user)
  const canView   = hasPermission("view help requests")
  const canEdit   = hasPermission("edit help requests")
  const canCreate = hasPermission("create help requests")
  const canDelete = hasPermission("delete help requests")
  const showMenu  = canView || canEdit || canDelete
  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Task</TableHead>
            <TableHead>Requester</TableHead>
            <TableHead>Helper</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => {
            // Compute a display status from the API boolean flags
            const status = getDisplayStatus(request)

            return (
              <TableRow key={request.id} className="group">
                {/* Description — limited to 2 lines with ellipsis overflow */}
                <TableCell className="py-3 max-w-55">
                  <button
                    type="button"
                    className="font-medium text-foreground text-sm hover:text-primary hover:underline underline-offset-2 transition-colors w-full text-left"
                    onClick={() => onSelect(request)}
                  >
                    <TruncatedText
                      value={request.description}
                      className="max-w-37.5 sm:max-w-52.5 lg:max-w-75"
                    />
                  </button>
                </TableCell>

                {/* Task name linked to the task detail page */}
                <TableCell className="py-3 text-sm text-muted-foreground max-w-32.5 truncate">
                  {request.task ? (
                    <Link
                      to={`/tasks/${request.task.id}`}
                      className="hover:text-primary hover:underline underline-offset-2 transition-colors block"
                    >
                      <TruncatedText
                        value={request.task.name}
                        className="max-w-22.5 sm:max-w-30 lg:max-w-40"
                      />
                    </Link>
                  ) : (
                    <span>—</span>
                  )}
                </TableCell>

                {/* Requester avatar + name */}
                <TableCell className="py-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7 border-2 border-card">
                      <AvatarImage
                        src={request.requester.avatar_url ?? undefined}
                        alt={request.requester.name}
                      />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(request.requester.name)}
                      </AvatarFallback>
                    </Avatar>
                    <TruncatedText
                      value={request.requester.name}
                      className="text-sm max-w-22.5 sm:max-w-30 lg:max-w-37.5"
                    />
                  </div>
                </TableCell>

                {/* Helper avatar + name (or "Unassigned") */}
                <TableCell className="py-3">
                  {request.helper ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7 border-2 border-card">
                        <AvatarImage
                          src={request.helper.avatar_url ?? undefined}
                          alt={request.helper.name}
                        />
                        <AvatarFallback className="text-[8px]">
                          {getInitials(request.helper.name)}
                        </AvatarFallback>
                      </Avatar>
                      <TruncatedText
                        value={request.helper.name}
                        className="text-sm max-w-22.5 sm:max-w-30 lg:max-w-37.5"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>

                {/* Status badge — derived from is_claimed + is_completed */}
                <TableCell className="py-3">
                  <Badge variant={statusVariant[status] ?? "outline"}>
                    {statusLabel[status] ?? status}
                  </Badge>
                </TableCell>

                {/* Rating category label from the API enum string */}
                <TableCell className="py-3 text-sm">
                  {request.rating ? (
                    <span className="text-xs text-muted-foreground">
                      {helpRequestRatingLabel[request.rating]}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Created timestamp formatted for readability */}
                <TableCell className="py-3 text-sm text-muted-foreground font-mono whitespace-nowrap">
                  {formatDate(request.created_at)}
                </TableCell>

                {/* Row-level actions dropdown — only rendered when the user has at least one permission */}
                <TableCell className="text-right py-3">
                  {showMenu && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canView && (
                          <DropdownMenuItem onClick={() => onSelect(request)}>
                            <Eye className="size-4" />
                            View Details
                          </DropdownMenuItem>
                        )}
                        {canEdit && (
                          <DropdownMenuItem onClick={() => onEdit(request)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {/* Claim or unclaim depending on state and current-user ownership */}
                        {!request.helper ? (
                          <DropdownMenuItem onClick={() => onClaim(request)}>
                            <HandHelping className="size-4" />
                            Claim
                          </DropdownMenuItem>
                        ) : request.helper.id === currentUser?.id ? (
                          <DropdownMenuItem onClick={() => onUnclaim(request)}>
                            <X className="size-4" />
                            Unclaim
                          </DropdownMenuItem>
                        ) : null}
                        {/* Assign — requires edit or create help requests permission */}
                        {(canEdit || canCreate) && (
                          <DropdownMenuItem onClick={() => onAssign(request)}>
                            <UserCheck className="size-4" />
                            Assign
                          </DropdownMenuItem>
                        )}
                        {/* Complete — only for the current helper when not yet completed */}
                        {request.helper?.id === currentUser?.id && !request.is_completed && (
                          <DropdownMenuItem onClick={() => onComplete(request)}>
                            <CheckCircle2 className="size-4" />
                            Complete
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onDelete(request)}
                            >
                              <Trash2 className="size-4" />
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
