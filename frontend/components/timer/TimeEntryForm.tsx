'use client'

import { useState } from 'react'
import { createTimeEntry, updateTimeEntry } from '@/app/time-entries/actions'

interface TimeEntryFormProps {
  mode?: 'create' | 'edit'
  contactId?: string
  dealId?: string
  activityId?: string
  /** Pre-populate with duration from timer (in seconds) */
  initialSeconds?: number
  timeEntry?: {
    id: string
    duration_minutes: number
    entry_date: string
    notes?: string
    is_billable: boolean
  }
  onSuccess?: () => void
  onCancel?: () => void
}

/**
 * Parse duration input and return minutes
 * Supports formats: "2:30" (2h 30m = 150), "30" (30 minutes), "2.5" (2.5 hours = 150)
 */
function parseDurationToMinutes(input: string): number | null {
  if (!input || input.trim() === '') return null

  const trimmed = input.trim()

  // Format: HH:MM (e.g., "2:30")
  if (trimmed.includes(':')) {
    const [hours, minutes] = trimmed.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) return null
    return hours * 60 + minutes
  }

  // Format: decimal hours (e.g., "2.5" = 2h 30m)
  if (trimmed.includes('.')) {
    const hours = parseFloat(trimmed)
    if (isNaN(hours)) return null
    return Math.round(hours * 60)
  }

  // Format: plain number (interpret as minutes)
  const minutes = parseInt(trimmed)
  if (isNaN(minutes)) return null
  return minutes
}

/**
 * Format minutes to HH:MM display
 */
function formatMinutesToHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}:${String(mins).padStart(2, '0')}`
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export default function TimeEntryForm({
  mode = 'create',
  contactId,
  dealId,
  activityId,
  initialSeconds,
  timeEntry,
  onSuccess,
  onCancel
}: TimeEntryFormProps) {
  // Calculate initial duration from timer seconds or existing entry
  const initialMinutes = initialSeconds
    ? Math.ceil(initialSeconds / 60)
    : timeEntry?.duration_minutes || 0

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [durationInput, setDurationInput] = useState(
    initialMinutes > 0 ? formatMinutesToHHMM(initialMinutes) : ''
  )
  const [durationError, setDurationError] = useState('')

  const handleDurationChange = (value: string) => {
    setDurationInput(value)
    setDurationError('')

    // Validate on change
    if (value.trim()) {
      const minutes = parseDurationToMinutes(value)
      if (minutes === null || minutes <= 0) {
        setDurationError('Enter a valid duration (e.g., 1:30 or 90)')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setDurationError('')

    // Parse and validate duration
    const minutes = parseDurationToMinutes(durationInput)
    if (minutes === null || minutes <= 0) {
      setDurationError('Enter a valid duration (e.g., 1:30 or 90)')
      setLoading(false)
      return
    }

    const formData = new FormData(e.currentTarget)

    // Set the parsed duration in minutes
    formData.set('duration_minutes', minutes.toString())

    // Add entity IDs if provided
    if (contactId) formData.append('contact_id', contactId)
    if (dealId) formData.append('deal_id', dealId)
    if (activityId) formData.append('activity_id', activityId)

    // Handle checkbox - FormData doesn't include unchecked checkboxes
    const isBillable = formData.get('is_billable') === 'on'
    formData.set('is_billable', isBillable.toString())

    const result = mode === 'create'
      ? await createTimeEntry(formData)
      : await updateTimeEntry(timeEntry!.id, formData)

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

      {/* Duration */}
      <div>
        <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Duration *
        </label>
        <input
          type="text"
          id="duration"
          name="duration"
          required
          value={durationInput}
          onChange={(e) => handleDurationChange(e.target.value)}
          className={`mt-1 block w-full rounded-md border shadow-sm focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
            durationError
              ? 'border-red-500 dark:border-red-500 focus:border-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
          }`}
          placeholder="1:30 or 90 minutes"
        />
        {durationError ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{durationError}</p>
        ) : (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Enter as hours:minutes (1:30) or total minutes (90)
          </p>
        )}
      </div>

      {/* Entry Date */}
      <div>
        <label htmlFor="entry_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Date *
        </label>
        <input
          type="date"
          id="entry_date"
          name="entry_date"
          required
          defaultValue={timeEntry?.entry_date || getTodayDate()}
          max={getTodayDate()}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={timeEntry?.notes}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="What did you work on?"
        />
      </div>

      {/* Billable */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_billable"
          name="is_billable"
          defaultChecked={timeEntry?.is_billable ?? true}
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
        />
        <label htmlFor="is_billable" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Billable
        </label>
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
          {loading ? 'Saving...' : mode === 'create' ? 'Log Time' : 'Update Entry'}
        </button>
      </div>
    </form>
  )
}
