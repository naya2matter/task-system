import { useMemo } from "react"
import { useNavigate, useParams } from "react-router"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useKanban } from "./hooks/useKanban"
import { useProject } from "./hooks/useProject"
import { KanbanBoard } from "./pages/kanban-board"

function KanbanSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 overflow-hidden animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4 shrink-0">
        <Skeleton className="h-10 w-10 outline-none rounded-md" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Members Bar Skeleton */}
      <div className="flex items-center gap-3 shrink-0 mt-2">
        <div className="flex -space-x-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="size-8 rounded-full border-2 border-background" />
          ))}
        </div>
        <Skeleton className="h-3 w-20" />
      </div>

      {/* Board Columns Skeleton */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 pt-2">
        {/* Section 1 */}
        <div className="flex flex-col gap-3 min-w-[280px]">
          <Skeleton className="h-5 w-32 mb-2" />
          <div className="flex flex-col gap-3 p-3 bg-card/50 rounded-xl border border-border/50">
            <Skeleton className="h-[120px] rounded-lg w-full" />
            <Skeleton className="h-[100px] rounded-lg w-full" />
            <Skeleton className="h-[140px] rounded-lg w-full" />
          </div>
        </div>

        {/* Section 2 */}
        <div className="flex flex-col gap-3 min-w-[280px]">
          <Skeleton className="h-5 w-32 mb-2" />
          <div className="flex flex-col gap-3 p-3 bg-card/50 rounded-xl border border-border/50">
            <Skeleton className="h-[100px] rounded-lg w-full" />
            <Skeleton className="h-[160px] rounded-lg w-full" />
          </div>
        </div>

        {/* Section 3 */}
        <div className="flex flex-col gap-3 min-w-[280px]">
          <Skeleton className="h-5 w-32 mb-2" />
          <div className="flex flex-col gap-3 p-3 bg-card/50 rounded-xl border border-border/50">
            <Skeleton className="h-[140px] rounded-lg w-full" />
          </div>
        </div>

         {/* Section 4 */}
         <div className="flex flex-col gap-3 min-w-[280px]">
          <Skeleton className="h-5 w-32 mb-2" />
          <div className="flex flex-col gap-3 p-3 bg-card/50 rounded-xl border border-border/50">
            <Skeleton className="h-[110px] rounded-lg w-full" />
            <Skeleton className="h-[130px] rounded-lg w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Route page for /projects/:id/kanban-board — fetches kanban data from the API
export default function KanbanBoardPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  // Parse the project id from the URL
  const projectId = useMemo(() => {
    const parsed = Number(id)
    return Number.isFinite(parsed) ? parsed : null
  }, [id])

  // Fetch kanban data from GET /projects/:id/kanban
  const { data, loading, error } = useKanban(projectId)

  // Load project into store so the breadcrumb can display the project name
  useProject(projectId)

  // Loading state
  if (loading) {
    return <KanbanSkeleton />
  }

  // Error or missing data state
  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5" />
          <span className="font-medium">{error || "Project not found."}</span>
        </div>
        <Button variant="outline" onClick={() => navigate("/projects")}>
          Back to Projects
        </Button>
      </div>
    )
  }

  return (
    <KanbanBoard
      kanban={data}
      onBack={() => navigate("/projects")}
    />
  )
}
