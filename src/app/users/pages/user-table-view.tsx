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
import { TruncatedText } from "@/components/ui/truncated-text"
import { Pencil, Trash2, Shield, Code } from "lucide-react"
import type { User } from "@/app/users/data"

type UserTableViewProps = {
  users: User[]
  onEdit: (user: User) => void
  onDelete: (user: User) => void
  onSelect: (user: User) => void
  /** Show the Edit button — true when caller has "edit users" permission */
  canEdit?: boolean
  /** Show the Delete button — true when caller has "delete users" permission */
  canDelete?: boolean
  /** Allow clicking the user name to open the detail sheet — true when caller has "view users" */
  canView?: boolean
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

const statusLabel: Record<string, string> = {
  active: "Active",
  away: "Away",
  suspended: "Suspended",
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  away: "outline",
  suspended: "destructive",
}

export function UserTableView({ users, onEdit, onDelete, onSelect, canEdit = true, canDelete = true, canView = true }: UserTableViewProps) {
  return (
    <Table className="w-full table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          {/* Only render the Actions column when at least one action is permitted */}
          {(canEdit || canDelete) && (
            <TableHead className="text-right">Actions</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id} className="group">
            <TableCell className="py-3">
              <div className="flex items-center gap-4">
                {/* Avatar with role overlay. If no avatarUrl the initials are used. */}
                <Avatar size="lg" className="size-12 relative">
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                  ) : (
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  )}

                  {user.role?.toLowerCase().includes("admin") ? (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background text-white">
                      <Shield className="size-3" />
                    </span>
                  ) : user.role?.toLowerCase().includes("developer") ? (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 ring-2 ring-background text-white">
                      <Code className="size-3" />
                    </span>
                  ) : null}
                </Avatar>

                {/* User name — clicking opens the detail sheet.
                    Rendered as a plain span when the caller lacks "view users". */}
                {canView ? (
                  <button
                    type="button"
                    className="font-medium text-foreground text-base sm:text-lg hover:text-primary hover:underline underline-offset-2 transition-colors text-left"
                    onClick={() => onSelect(user)}
                  >
                    <TruncatedText
                      value={user.name}
                      className="max-w-30 sm:max-w-45 lg:max-w-60"
                    />
                  </button>
                ) : (
                  <TruncatedText
                    value={user.name}
                    className="font-medium text-foreground text-base sm:text-lg max-w-30 sm:max-w-45 lg:max-w-60"
                  />
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground py-3 text-sm">
              <TruncatedText
                value={user.email}
                className="max-w-35 sm:max-w-55 lg:max-w-70"
              />
            </TableCell>
            <TableCell className="py-3">
              <Badge variant="secondary" className="max-w-30">
                <TruncatedText value={user.role} className="max-w-25" />
              </Badge>
            </TableCell>
            <TableCell className="py-3">
              <Badge variant={statusVariant[user.status] ?? "outline"}>
                {statusLabel[user.status] ?? user.status}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground py-3">{user.createdAt}</TableCell>

            {/* Action buttons — each is rendered only when the matching permission exists */}
            {(canEdit || canDelete) && (
              <TableCell className="text-right py-3">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Edit button — shown only with "edit users" permission */}
                  {canEdit && (
                    <Button variant="ghost" size="icon-lg" onClick={() => onEdit(user)}>
                      <Pencil />
                    </Button>
                  )}
                  {/* Delete button — shown only with "delete users" permission */}
                  {canDelete && (
                    <Button variant="destructive" size="icon-lg" onClick={() => onDelete(user)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
