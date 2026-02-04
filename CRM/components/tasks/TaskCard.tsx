'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { formatDate, isPast } from '@/lib/utils'

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
}

export interface Task {
  id: string
  subject: string
  description?: string
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  due_date?: string
  contact?: {
    id: string
    first_name: string
    last_name: string
    company?: string
  } | null
  deal?: {
    id: string
    title: string
    amount: number
  } | null
}

interface TaskCardProps {
  task: Task
  isDragging?: boolean
}

export function TaskCard({ task, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isOverdue = task.due_date && isPast(task.due_date) && task.status !== 'completed'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 hover:shadow-md transition cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
          {task.subject}
        </h4>
        <span className={`
          inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
          ${PRIORITY_COLORS[task.priority]}
        `}>
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      {task.due_date && (
        <div className={`text-xs mb-2 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
          Due: {formatDate(task.due_date)}
          {isOverdue && ' (Overdue)'}
        </div>
      )}

      {task.contact && (
        <Link
          href={`/contacts/${task.contact.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 block mb-1"
        >
          Contact: {task.contact.first_name} {task.contact.last_name}
        </Link>
      )}

      {task.deal && (
        <Link
          href={`/deals/${task.deal.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 block"
        >
          Deal: {task.deal.title}
        </Link>
      )}
    </div>
  )
}
