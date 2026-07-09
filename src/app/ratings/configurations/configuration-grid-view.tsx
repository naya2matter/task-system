import type { ApiRatingConfig } from "@/app/ratings/configurations/types"
import { ConfigurationCard } from "@/app/ratings/configurations/configuration-card"

type ConfigurationGridViewProps = {
  configurations: ApiRatingConfig[]
  onView: (config: ApiRatingConfig) => void
  onEdit?: (config: ApiRatingConfig) => void
  onDelete?: (config: ApiRatingConfig) => void
}

export function ConfigurationGridView({
  configurations,
  onView,
  onEdit,
  onDelete,
}: ConfigurationGridViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {configurations.map((config) => (
        <ConfigurationCard
          key={config.id}
          config={config}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
