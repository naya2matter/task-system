import { Fragment } from "react"
import { Link } from "react-router"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs"

export function AppBreadcrumbs() {
  const items = useBreadcrumbs()
  const isDeep = items.length > 1

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap text-sm gap-1 min-w-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 && <BreadcrumbSeparator className="shrink-0" />}
              <BreadcrumbItem className="min-w-0 shrink">
                {isLast ? (
                  <BreadcrumbPage
                    className={
                      isDeep
                        ? "font-medium text-foreground truncate block min-w-0"
                        : "text-base font-semibold text-foreground truncate block min-w-0"
                    }
                  >
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="truncate block min-w-0 shrink">
                    <Link to={item.href!}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
