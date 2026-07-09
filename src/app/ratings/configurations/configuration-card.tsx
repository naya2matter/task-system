import { Card, CardContent, CardFooter } from "@/components/ui/card"
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
import { MoreHorizontal, Eye, Pencil, Trash2, Calendar, ListChecks } from "lucide-react"
import { useTilt } from "@/hooks/use-tilt"
import type { ApiRatingConfig } from "@/app/ratings/configurations/types"

type ConfigurationCardProps = {
  config: ApiRatingConfig
  onView: (config: ApiRatingConfig) => void
  onEdit?: (config: ApiRatingConfig) => void
  onDelete?: (config: ApiRatingConfig) => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function ConfigurationCard({
  config,
  onView,
  onEdit,
  onDelete,
}: ConfigurationCardProps) {
  const { ref, style } = useTilt<HTMLDivElement>({ maxTilt: 5, scale: 1.015 })
  const showMenu = !!onEdit || !!onDelete
  const fieldCount = (config.config_data?.fields ?? []).length

  return (
    <Card ref={ref} style={style} className="flex flex-col">
      <CardContent className="flex flex-col gap-4 pt-4 px-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* type: API returns 'task_rating' or 'stakeholder_rating' */}
            <Badge
              variant="outline"
              className={
                config.type === "task_rating"
                  ? "text-[10px] border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "text-[10px] border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400"
              }
            >
              {config.type === "task_rating" ? "Task Rating" : "Stakeholder Rating"}
            </Badge>
            {/* is_active status */}
            <Badge
              variant={config.is_active ? "default" : "secondary"}
              className={
                config.is_active
                  ? "text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : "text-[10px]"
              }
            >
              {config.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          {showMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="Actions">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onView(config)}>
                  <Eye className="size-3.5" />
                  View Details
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(config)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(config)}>
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="text-lg font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors text-left leading-tight"
            onClick={() => onView(config)}
          >
            {config.name}
          </button>
          {config.description && (
            <span className="text-xs text-muted-foreground line-clamp-2">
              {config.description}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ListChecks className="size-3" />
            {fieldCount} {fieldCount === 1 ? "field" : "fields"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {formatDate(config.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarImage src={config.creator.avatar_url ?? undefined} alt={config.creator.name} />
            <AvatarFallback className="text-[10px]">
              {getInitials(config.creator.name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{config.creator.name}</span>
        </div>
      </CardContent>

      {(onEdit || onDelete) && (
        <CardFooter className="flex items-center gap-3 w-full mt-auto">
          {onEdit && (
            <Button variant="secondary" size="lg" className="flex-1 py-2" onClick={() => onEdit(config)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" size="icon-lg" onClick={() => onDelete(config)}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
