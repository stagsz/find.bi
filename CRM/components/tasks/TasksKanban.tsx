'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { TaskCard, Task } from './TaskCard'
import { updateActivityStatus } from '@/app/activities/actions'

const STATUSES = [
  { key: 'todo', label: 'To Do', textColor: 'text-gray-900 dark:text-gray-100' },
  { key: 'in_progress', label: 'In Progress', textColor: 'text-blue-900 dark:text-blue-400' },
  { key: 'completed', label: 'Completed', textColor: 'text-green-900 dark:text-green-400' },
  { key: 'cancelled', label: 'Cancelled', textColor: 'text-red-900 dark:text-red-400' },
] as const

type StatusKey = typeof STATUSES[number]['key']

interface DroppableColumnProps {
  status: typeof STATUSES[number]
  tasks: Task[]
  children: React.ReactNode
}

function DroppableColumn({ status, tasks, children }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.key,
  })

  return (
    <div
      ref={setNodeRef}
      className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow min-h-[200px] transition-colors ${
        isOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-gray-700' : ''
      }`}
    >
      <div className="mb-4">
        <h3 className={`font-medium ${status.textColor}`}>{status.label}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {tasks.length} tasks
        </p>
      </div>
      <div className="space-y-3">
        {children}
        {tasks.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            Drop tasks here
          </p>
        )}
      </div>
    </div>
  )
}

interface TasksKanbanProps {
  initialTasks: Task[]
}

export function TasksKanban({ initialTasks }: TasksKanbanProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const tasksByStatus: Record<StatusKey, Task[]> = {
    todo: [],
    in_progress: [],
    completed: [],
    cancelled: [],
  }

  tasks.forEach((task) => {
    tasksByStatus[task.status].push(task)
  })

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeTask = tasks.find((t) => t.id === activeId)
    if (!activeTask) return

    // Check if dropping over a column
    const isOverColumn = STATUSES.some((s) => s.key === overId)
    if (isOverColumn) {
      const newStatus = overId as StatusKey
      if (activeTask.status !== newStatus) {
        setTasks((prev) =>
          prev.map((t) => (t.id === activeId ? { ...t, status: newStatus } : t))
        )
      }
    } else {
      // Dropping over another task - find which column that task is in
      const overTask = tasks.find((t) => t.id === overId)
      if (overTask && activeTask.status !== overTask.status) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === activeId ? { ...t, status: overTask.status } : t
          )
        )
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const activeTask = tasks.find((t) => t.id === activeId)

    if (!activeTask) return

    // Determine target status
    let targetStatus: StatusKey = activeTask.status
    const overId = over.id as string

    const isOverColumn = STATUSES.some((s) => s.key === overId)
    if (isOverColumn) {
      targetStatus = overId as StatusKey
    } else {
      const overTask = tasks.find((t) => t.id === overId)
      if (overTask) {
        targetStatus = overTask.status
      }
    }

    // Only update if status changed from original
    const originalTask = initialTasks.find((t) => t.id === activeId)
    if (!originalTask || originalTask.status === targetStatus) {
      // Reset to initial state if no real change
      setTasks(initialTasks)
      return
    }

    // Persist change to server
    setIsUpdating(true)
    const result = await updateActivityStatus(activeId, targetStatus)
    setIsUpdating(false)

    if (result.error) {
      // Revert on error
      console.error('Failed to update task status:', result.error)
      setTasks(initialTasks)
    }
  }

  function handleDragCancel() {
    setActiveId(null)
    setTasks(initialTasks)
  }

  return (
    <div>
      {isUpdating && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          Updating...
        </div>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Drag tasks between columns to update their status.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {STATUSES.map((status) => {
            const statusTasks = tasksByStatus[status.key]
            return (
              <SortableContext
                key={status.key}
                items={statusTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <DroppableColumn status={status} tasks={statusTasks}>
                  {statusTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isDragging={task.id === activeId}
                    />
                  ))}
                </DroppableColumn>
              </SortableContext>
            )
          })}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="opacity-90 shadow-xl">
              <TaskCard task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
