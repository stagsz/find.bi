'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

interface TimeReportEntry {
  id: string
  user_id: string
  contact_id?: string
  deal_id?: string
  activity_id?: string
  duration_minutes: number
  entry_date: string
  notes?: string
  is_billable: boolean
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  approval_notes?: string
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
  user?: { id: string; email: string; full_name?: string }
  contact?: { id: string; first_name: string; last_name: string; company?: string }
  deal?: { id: string; title: string }
  activity?: { id: string; subject: string; type: string }
}

interface TimeReportTableProps {
  timeEntries: TimeReportEntry[]
  searchParams: {
    sort?: string
    order?: 'asc' | 'desc'
  }
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    case 'submitted':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
    case 'approved':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    case 'rejected':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
  }
}

export default function TimeReportTable({ timeEntries, searchParams }: TimeReportTableProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateURL = (updates: Record<string, string>) => {
    const newParams = new URLSearchParams(params.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== 'all') {
        newParams.set(key, value)
      } else {
        newParams.delete(key)
      }
    })

    startTransition(() => {
      router.push(`/admin/time-report?${newParams.toString()}`)
    })
  }

  const handleSort = (column: string) => {
    const currentSort = searchParams.sort
    const currentOrder = searchParams.order || 'desc'

    let newOrder: 'asc' | 'desc' = 'asc'

    if (currentSort === column) {
      newOrder = currentOrder === 'asc' ? 'desc' : 'asc'
    }

    updateURL({ sort: column, order: newOrder })
  }

  const SortIcon = ({ column }: { column: string }) => {
    const isActive = searchParams.sort === column
    const order = searchParams.order || 'desc'

    if (!isActive) {
      return <span className="ml-1 text-gray-400">&#8645;</span>
    }

    return (
      <span className="ml-1 text-blue-600 dark:text-blue-400">
        {order === 'asc' ? '\u2191' : '\u2193'}
      </span>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                onClick={() => handleSort('entry_date')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Date <SortIcon column="entry_date" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                User
              </th>
              <th
                onClick={() => handleSort('duration_minutes')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Duration <SortIcon column="duration_minutes" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Contact/Deal
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Billable
              </th>
              <th
                onClick={() => handleSort('status')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Status <SortIcon column="status" />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {isPending && (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isPending && timeEntries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No time entries found. Try adjusting your filters.
                </td>
              </tr>
            )}
            {!isPending && timeEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {new Date(entry.entry_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {entry.user?.full_name?.charAt(0).toUpperCase() || entry.user?.email?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {entry.user?.full_name || 'No name'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.user?.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDuration(entry.duration_minutes)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {entry.contact && (
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {entry.contact.first_name} {entry.contact.last_name}
                      {entry.contact.company && (
                        <span className="text-gray-500 dark:text-gray-400"> @ {entry.contact.company}</span>
                      )}
                    </div>
                  )}
                  {entry.deal && (
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      {entry.deal.title}
                    </div>
                  )}
                  {entry.activity && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.activity.type}: {entry.activity.subject}
                    </div>
                  )}
                  {!entry.contact && !entry.deal && !entry.activity && (
                    <span className="text-gray-400 dark:text-gray-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                  {entry.notes || <span className="text-gray-400 dark:text-gray-500">-</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {entry.is_billable ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                      Yes
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                      No
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded capitalize ${getStatusBadge(entry.status)}`}>
                    {entry.status}
                  </span>
                  {entry.approval_notes && entry.status === 'rejected' && (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-xs truncate" title={entry.approval_notes}>
                      {entry.approval_notes}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
