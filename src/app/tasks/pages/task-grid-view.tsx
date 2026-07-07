// Use the API-aligned Task type (not the mock from data.ts)
import type { Task } from "@/app/tasks/types"
import { TaskCard } from "@/app/tasks/pages/task-card"

type TaskGridViewProps = {
  tasks: Task[]
  onSelect: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onRate: (task: Task) => void
  onMarkComplete: (task: Task) => void
  canEdit: boolean
  canDelete: boolean
  canRate: boolean
  currentUserId: number | null
}

export function TaskGridView({ tasks, onSelect, onEdit, onDelete, onRate, onMarkComplete, canEdit, canDelete, canRate, currentUserId }: TaskGridViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onRate={onRate}
          onMarkComplete={onMarkComplete}
          canEdit={canEdit}
          canDelete={canDelete}
          canRate={canRate}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}
