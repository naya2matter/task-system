import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export function TaskRatingFormSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 w-full max-w-6xl mx-auto animate-pulse">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-wrap gap-2 bg-muted/50 p-3 rounded-2xl">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>

          <Card>
            <CardContent className="space-y-6 p-6 md:p-8">
              <Skeleton className="h-7 w-1/2 rounded-md" />

              <div className="grid gap-6 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-3 w-full rounded-full" />
                  </div>
                ))}
              </div>

              <div className="space-y-4 pt-4 border-t border-border/50">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-40 rounded-full" />
                </div>
                <Skeleton className="h-12 w-40 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 2 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="space-y-3 p-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
