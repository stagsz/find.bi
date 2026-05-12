'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { approveTimeEntry, rejectTimeEntry } from '@/app/time-entries/actions'

interface TimeEntry {
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

interface TimeApprovalsTableProps {
  timeEntries: TimeEntry[]
  currentUserId: string
  searchParams: {
    search?: string
    status?: string
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

export default function TimeApprovalsTable({ timeEntries, searchParams }: TimeApprovalsTableProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(searchParams.search || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.status || 'submitted')

  // Approval action state
  const [isActionPending, setIsActionPending] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectingEntryId, setRejectingEntryId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

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
      router.push(`/admin/time-approvals?${newParams.toString()}`)
    })
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    updateURL({ search: value })
  }

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value)
    updateURL({ status: value })
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

  const handleApprove = async (id: string) => {
    setActionError(null)
    setIsActionPending(true)
    try {
      const result = await approveTimeEntry(id)
      if (result.error) {
        setActionError(result.error)
      } else {
        router.refresh()
      }
    } catch {
      setActionError('Failed to approve time entry')
    } finally {
      setIsActionPending(false)
    }
  }

  const openRejectModal = (id: string) => {
    setRejectingEntryId(id)
    setRejectNotes('')
    setRejectModalOpen(true)
    setActionError(null)
  }

  const closeRejectModal = () => {
    setRejectModalOpen(false)
    setRejectingEntryId(null)
    setRejectNotes('')
  }

  const handleReject = async () => {
    if (!rejectingEntryId) return

    setActionError(null)
    setIsActionPending(true)
    try {
      const result = await rejectTimeEntry(rejectingEntryId, rejectNotes || undefined)
      if (result.error) {
        setActionError(result.error)
      } else {
        closeRejectModal()
        router.refresh()
      }
    } catch {
      setActionError('Failed to reject time entry')
    } finally {
      setIsActionPending(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      {/* Filters and Search */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <input
              type="text"
              id="search"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by notes..."
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
            >
              <option value="submitted">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
              <option value="all">All Statuses</option>
            </select>
          </div>
        </div>
      </div>

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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {isPending && (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isPending && timeEntries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No time entries found. Try adjusting your search or filters.
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
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {entry.status === 'submitted' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(entry.id)}
                        disabled={isActionPending}
                        className="px-3 py-1 text-xs font-medium rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openRejectModal(entry.id)}
                        disabled={isActionPending}
                        className="px-3 py-1 text-xs font-medium rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {entry.status !== 'submitted' && (
                    <span className="text-gray-400 dark:text-gray-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Error Alert */}
      {actionError && (
        <div className="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700 dark:text-red-300">{actionError}</p>
            <button
              onClick={() => setActionError(null)}
              className="text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity"
              onClick={closeRejectModal}
            />
            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              <div className="bg-white dark:bg-gray-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                    <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                      Reject Time Entry
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to reject this time entry? The user will be notified and can revise it.
                      </p>
                      <div className="mt-4">
                        <label htmlFor="reject-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Rejection Notes (optional)
                        </label>
                        <textarea
                          id="reject-notes"
                          rows={3}
                          value={rejectNotes}
                          onChange={(e) => setRejectNotes(e.target.value)}
                          placeholder="Provide feedback on why the entry is being rejected..."
                          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm px-3 py-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isActionPending}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto"
                >
                  {isActionPending ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  type="button"
                  onClick={closeRejectModal}
                  disabled={isActionPending}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
