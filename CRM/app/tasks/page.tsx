import { getUserTasks } from '@/app/activities/actions'
import Link from 'next/link'
import { isPast } from '@/lib/utils'
import { TasksKanban } from '@/components/tasks/TasksKanban'
import type { Task } from '@/components/tasks/TaskCard'

export default async function TasksPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; view?: string }>
}) {
  const params = await searchParams
  const statusFilter = params.status as any
  const view = params.view || 'all'

  // Fetch tasks based on view
  const tasks = view === 'overdue'
    ? await getUserTasks({ overdue: true })
    : statusFilter
    ? await getUserTasks({ status: statusFilter })
    : await getUserTasks()

  // Transform tasks to match the Task interface
  const formattedTasks: Task[] = tasks.map(t => ({
    id: t.id,
    subject: t.subject,
    description: t.description || undefined,
    status: t.status || 'todo',
    priority: t.priority || 'medium',
    due_date: t.due_date || undefined,
    contact: t.contact,
    deal: t.deal,
  }))

  const overdueCount = tasks.filter(t =>
    t.due_date && isPast(t.due_date) && t.status !== 'completed'
  ).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">My Tasks</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage your tasks and to-dos ({tasks.length} total)
              {overdueCount > 0 && (
                <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                  • {overdueCount} overdue
                </span>
              )}
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="mb-6 flex gap-2">
          <Link
            href="/tasks?view=all"
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              view === 'all'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            All Tasks
          </Link>
          <Link
            href="/tasks?view=overdue"
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              view === 'overdue'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Overdue ({overdueCount})
          </Link>
        </div>

        {/* Kanban Board with Drag-and-Drop */}
        <TasksKanban initialTasks={formattedTasks} />
      </div>
    </div>
  )
}