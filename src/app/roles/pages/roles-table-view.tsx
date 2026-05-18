import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TruncatedText } from "@/components/ui/truncated-text"
import { Pencil, Trash2, Shield } from "lucide-react"
import type { Role } from "@/types"
import { usePermissions } from "@/hooks/usePermissions"

type RolesTableViewProps = {
  roles: Role[]
  onEdit?: (role: Role) => void
  onDelete?: (role: Role) => void
  onSelect: (role: Role) => void
}



export function RolesTableView({
  roles,
  onEdit,
  onDelete,
  onSelect,
}: RolesTableViewProps) {
  const { hasPermission } = usePermissions()
  const canViewPermissions = hasPermission("view permissions")
  const showActions = !!onEdit || !!onDelete
  if (roles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <div className="flex items-center justify-center size-12 rounded-xl bg-muted">
          <Shield className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">No roles found</p>
          <p className="text-xs text-muted-foreground">
            Try adjusting your search or create a new role.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Table className="w-full table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Role Name</TableHead>
          {canViewPermissions && <TableHead>Permissions</TableHead>}
          <TableHead>Guard</TableHead>
          <TableHead>Created</TableHead>
          {showActions && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((role) => (
          <TableRow key={role.id} className="group">
            <TableCell className="py-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 shrink-0">
                  <Shield className="size-4 text-primary" />
                </div>
                <button
                  type="button"
                  className="font-medium text-foreground text-base hover:text-primary hover:underline underline-offset-2 transition-colors text-left"
                  onClick={() => onSelect(role)}
                >
                  <TruncatedText
                    value={role.name}
                    className="max-w-37.5 sm:max-w-55 lg:max-w-75"
                  />
                </button>
              </div>
            </TableCell>
            <TableCell className="py-3">
              {canViewPermissions && (
                <Badge variant="secondary" className="text-xs">
                  {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </TableCell>
            <TableCell className="py-3">
              <Badge variant="outline" className="font-mono text-xs">
                <TruncatedText value={role.guard_name} className="max-w-20 sm:max-w-30" />
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground py-3 text-sm">
              {new Date(role.created_at).toLocaleDateString()}
            </TableCell>
            {showActions && (
              <TableCell className="text-right py-3">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => onEdit(role)}
                    >
                      <Pencil />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="destructive"
                      size="icon-lg"
                      onClick={() => onDelete(role)}
                    >
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
