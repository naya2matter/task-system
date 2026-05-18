// ─── HelpRequestGridView ──────────────────────────────────────────────────────
// Renders help requests as a responsive card grid.
// Updated to use the API-aligned HelpRequest type from ../types.

import type { HelpRequest } from "@/app/help-requests/types"
import { HelpRequestCard } from "@/app/help-requests/pages/help-request-card"

function truncateWithFullStops(text: string, maxChars: number) {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trimEnd()}...`
}

type HelpRequestGridViewProps = {
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

export function HelpRequestGridView({
  requests,
  onSelect,
  onEdit,
  onDelete,
  onClaim,
  onUnclaim,
  onAssign,
  onComplete,
}: HelpRequestGridViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      {requests.map((request) => (
        <HelpRequestCard
          key={request.id}
          request={{
            ...request,
            description: truncateWithFullStops(request.description, 110),
            task: request.task
              ? {
                  ...request.task,
                  name: truncateWithFullStops(request.task.name, 28),
                }
              : null,
          }}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onClaim={onClaim}
          onUnclaim={onUnclaim}
          onAssign={onAssign}
          onComplete={onComplete}
        />
      ))}
    </div>
  )
}
