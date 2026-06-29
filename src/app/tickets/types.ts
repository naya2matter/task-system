// ─── API-aligned Ticket Types ─────────────────────────────────────────────────
// These types exactly mirror the backend response shapes.
// Used by the service, store, hooks, and all ticket UI components.

// ── Backend enum string values ────────────────────────────────────────────────
// Note: backend uses snake_case ("in_progress"), not hyphenated ("in-progress")

export type ApiTicketStatus   = "open" | "in_progress" | "resolved"
export type ApiTicketType     = "quick_fix" | "bug_investigation" | "user_support" | "suggestion"
export type ApiTicketPriority = "low" | "medium" | "high" | "critical"

// ── User shape returned inside ticket relations ───────────────────────────────
export type ApiTicketUser = {
  id: number
  name: string
  email: string
  // Backend appends avatar_url from User model
  avatar_url: string | null
}

// ── Attachment returned on GET /tickets/{id} ──────────────────────────────────
export type ApiTicketAttachment = {
  id: number
  ticket_id: number
  file_path: string
  file_name: string
  file_type: string
  file_size: number
}

// ── Single ticket item (list or detail endpoints) ─────────────────────────────
export type ApiTicket = {
  id: number
  title: string
  description: string
  status: ApiTicketStatus
  type: ApiTicketType
  priority: ApiTicketPriority
  requester_id: number
  assigned_to: number | null
  // Stored on the ticket row itself when requester has no account
  requester_name: string
  // Eager-loaded relations
  requester: ApiTicketUser | null
  assignee: ApiTicketUser | null
  completed_at: string | null
  created_at: string
  updated_at: string
  // Only present on GET /tickets/{id}
  attachments?: ApiTicketAttachment[]
}

// ── Pagination shape included in every paginated endpoint ─────────────────────
export type ApiTicketPagination = {
  current_page: number
  total: number
  per_page: number
  last_page: number
  from: number | null
  to: number | null
}

// ── Full paginated list response (GET /tickets, /available, /status, /type) ───
export type ApiTicketListResponse = {
  success: boolean
  data: ApiTicket[]
  pagination: ApiTicketPagination
  message: string
}

// ── Query params accepted by list endpoints ───────────────────────────────────
export type TicketListParams = {
  page?: number
  per_page?: number
}

// ─── Display Mapping Helpers ──────────────────────────────────────────────────
// Maps backend enum values → human-readable labels and badge variants.
// Import these in components to avoid duplicate label strings.

export const TICKET_STATUS_LABELS: Record<ApiTicketStatus, string> = {
  open:        "Open",
  in_progress: "In Progress",
  resolved:    "Resolved",
}

export const TICKET_STATUS_VARIANTS: Record<
  ApiTicketStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  open:        "outline",
  in_progress: "default",
  resolved:    "secondary",
}

export const TICKET_TYPE_LABELS: Record<ApiTicketType, string> = {
  quick_fix:         "Quick Fix",
  bug_investigation: "Bug Investigation",
  user_support:      "User Support",
  suggestion:        "Suggestion",
}

export const TICKET_PRIORITY_LABELS: Record<ApiTicketPriority, string> = {
  low:      "Low",
  medium:   "Medium",
  high:     "High",
  critical: "Critical",
}

export const TICKET_PRIORITY_VARIANTS: Record<
  ApiTicketPriority,
  "default" | "secondary" | "destructive" | "outline"
> = {
  low:      "secondary",
  medium:   "outline",
  high:     "destructive",
  critical: "destructive",
}

// ── Helper: extract a display name from a ticket's requester relationship ─────
// Falls back to requester_name field if the User relation wasn't loaded.
export function getRequesterName(ticket: ApiTicket): string {
  return ticket.requester?.name ?? ticket.requester_name ?? "Unknown"
}

// ── Helper: format ISO date string to a short locale date ─────────────────────
export function formatTicketDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  })
}

// ─── Write Payload Types ──────────────────────────────────────────────────────
// These types define the data shapes collected by the form and sent to the API.

/**
 * Values collected by the ticket form (both create and edit modes).
 * The service converts this into a multipart/form-data payload.
 */
export type TicketFormValues = {
  title: string
  description: string
  type: ApiTicketType
  priority: ApiTicketPriority
  // Only sent in edit mode (create always starts as "open")
  status?: ApiTicketStatus
  // Optional: user ID to assign the ticket to (null = unassigned)
  assigned_to?: number | null
  // Required when submitting as a guest (unauthenticated user)
  requester_name?: string | null
  // New file attachments to upload (max 5 MB each)
  newAttachments?: File[]
  // IDs of existing attachments to keep; any not listed will be removed (edit only)
  keepAttachmentIds?: number[]
}

/** Shape returned by every write endpoint wrapped in the standard envelope */
export type ApiTicketResponse = {
  success: boolean
  data: ApiTicket
  message: string
}
