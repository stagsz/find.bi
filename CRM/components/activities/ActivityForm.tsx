'use client'

import { useState } from 'react'
import { createActivity, updateActivity } from '@/app/activities/actions'

interface ActivityFormProps {
  mode?: 'create' | 'edit'
  contactId?: string
  dealId?: string
  activity?: any
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ActivityForm({
  mode = 'create',
  contactId,
  dealId,
  activity,
  onSuccess,
  onCancel
}: ActivityFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trackTime, setTrackTime] = useState(activity?.track_time ?? true)
  const [isBillable, setIsBillable] = useState(activity?.is_billable ?? true)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)

    // Add contact_id or deal_id if provided
    if (contactId) formData.append('contact_id', contactId)
    if (dealId) formData.append('deal_id', dealId)

    // Add time tracking fields
    formData.append('track_time', trackTime ? 'true' : 'false')
    formData.append('is_billable', isBillable ? 'true' : 'false')

    const result = mode === 'create'
      ? await createActivity(formData)
      : await updateActivity(activity.id, formData)

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      onSuccess?.()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {/* Activity Type */}
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Type *
        </label>
        <select
          id="type"
          name="type"
          required
          defaultValue={activity?.type || 'note'}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="call">Call</option>
          <option value="meeting">Meeting</option>
          <option value="email">Email</option>
          <option value="note">Note</option>
          <option value="task">Task</option>
        </select>
      </div>

      {/* Subject */}
      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Subject *
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          required
          defaultValue={activity?.subject}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="Brief summary of this activity"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={activity?.description}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="Additional details..."
        />
      </div>

      {/* For Tasks: Status, Priority, Due Date */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Status (Tasks)
          </label>
          <select
            id="status"
            name="status"
            defaultValue={activity?.status || 'todo'}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={activity?.priority || 'medium'}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Due Date
          </label>
          <input
            type="datetime-local"
            id="due_date"
            name="due_date"
            defaultValue={activity?.due_date ? new Date(activity.due_date).toISOString().slice(0, 16) : ''}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Duration (for calls and meetings) */}
      <div>
        <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Duration (minutes)
        </label>
        <input
          type="number"
          id="duration_minutes"
          name="duration_minutes"
          min="0"
          defaultValue={activity?.duration_minutes}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="e.g., 30"
        />
      </div>

      {/* Time Tracking Options */}
      <div className="space-y-3 rounded-md border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="track_time"
            checked={trackTime}
            onChange={(e) => setTrackTime(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="track_time" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Track time for this activity
          </label>
        </div>
        {trackTime && (
          <div className="flex items-center gap-3 ml-7">
            <input
              type="checkbox"
              id="is_billable"
              checked={isBillable}
              onChange={(e) => setIsBillable(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_billable" className="text-sm text-gray-600 dark:text-gray-400">
              Billable time
            </label>
          </div>
        )}
        {trackTime && (
          <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
            A time entry will be created using the duration above when this activity is saved.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Create Activity' : 'Update Activity'}
        </button>
      </div>
    </form>
  )
}
