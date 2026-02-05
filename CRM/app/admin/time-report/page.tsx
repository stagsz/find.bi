import { requireAdmin } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DateRangeFilter, { getDateRangeFromParams, type DateRangePreset } from '@/components/dashboard/DateRangeFilter'
import BillableFilter, { type BillablePreset } from '@/components/admin/BillableFilter'
import ApprovalStatusFilter, { type ApprovalStatusPreset } from '@/components/admin/ApprovalStatusFilter'
import TimeReportTable from '@/components/admin/TimeReportTable'
import UserFilterSelectClient from '@/components/admin/UserFilterSelectClient'

interface SearchParams {
  range?: string
  start?: string
  end?: string
  billable?: string
  status?: string
  user?: string
  sort?: string
  order?: 'asc' | 'desc'
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

export default async function AdminTimeReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // Require admin role - will redirect if not admin
  await requireAdmin()

  const supabase = await createClient()
  const params = await searchParams

  // Parse date range from search params
  const { startDate, endDate } = getDateRangeFromParams(params)
  const preset = (params.range || 'all') as DateRangePreset
  const billablePreset = (params.billable || 'all') as BillablePreset
  const statusPreset = (params.status || 'all') as ApprovalStatusPreset
  const userFilter = params.user || 'all'

  // Fetch time entries with related data
  let timeEntriesQuery = supabase
    .from('time_entries')
    .select(`
      *,
      user:users(id, email, full_name),
      contact:contacts(id, first_name, last_name, company),
      deal:deals(id, title),
      activity:activities(id, subject, type)
    `)

  // Apply date range filter
  if (startDate && endDate) {
    timeEntriesQuery = timeEntriesQuery
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
  }

  // Apply billable filter
  if (billablePreset === 'billable') {
    timeEntriesQuery = timeEntriesQuery.eq('is_billable', true)
  } else if (billablePreset === 'non-billable') {
    timeEntriesQuery = timeEntriesQuery.eq('is_billable', false)
  }

  // Apply approval status filter
  if (statusPreset !== 'all') {
    timeEntriesQuery = timeEntriesQuery.eq('status', statusPreset)
  }

  // Apply user filter
  if (userFilter && userFilter !== 'all') {
    timeEntriesQuery = timeEntriesQuery.eq('user_id', userFilter)
  }

  // Apply sorting
  const sortColumn = params.sort || 'entry_date'
  const sortOrder = params.order || 'desc'
  timeEntriesQuery = timeEntriesQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  const { data: allTimeEntries } = await timeEntriesQuery

  const entries = allTimeEntries || []

  // Fetch all users for the user dropdown filter
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, email, full_name')
    .order('full_name')

  // Calculate summary statistics
  const totalEntries = entries.length
  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  const billableMinutes = entries.reduce((sum, e) => sum + (e.is_billable ? e.duration_minutes || 0 : 0), 0)
  const billablePercent = totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Time Tracking Report</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Detailed view of all individual time entries</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/admin/time-tracking"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Time Dashboard
              </Link>
              <Link
                href="/admin"
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-8 space-y-3">
          <DateRangeFilter
            startDate={startDate || undefined}
            endDate={endDate || undefined}
            preset={preset}
            basePath="/admin/time-report"
          />
          <BillableFilter
            preset={billablePreset}
            basePath="/admin/time-report"
          />
          <ApprovalStatusFilter
            preset={statusPreset}
            basePath="/admin/time-report"
          />
          {/* User Filter */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">User:</span>
            <UserFilterSelectClient users={allUsers || []} currentValue={userFilter} />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Report Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Entries</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalEntries}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Hours</p>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{formatDuration(totalMinutes)}</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Billable Hours</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatDuration(billableMinutes)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Billable Rate</p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{billablePercent}%</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Entries Table */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Time Entries</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} found
          </p>
        </div>
        <TimeReportTable
          timeEntries={entries}
          searchParams={{ sort: params.sort, order: params.order }}
        />
      </div>
    </div>
  )
}
