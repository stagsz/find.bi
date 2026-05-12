import { requireAdmin } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DateRangeFilter from '@/components/dashboard/DateRangeFilter'
import { getDateRangeFromParams, type DateRangePreset } from '@/lib/date-utils'
import BillableFilter, { type BillablePreset } from '@/components/admin/BillableFilter'
import ApprovalStatusFilter, { type ApprovalStatusPreset } from '@/components/admin/ApprovalStatusFilter'
import TimeReportTable from '@/components/admin/TimeReportTable'
import UserFilterSelectClient from '@/components/admin/UserFilterSelectClient'
import ExportTimeEntriesButton from '@/components/admin/ExportTimeEntriesButton'
import BillableBreakdownChartWrapper from '@/components/admin/BillableBreakdownChartWrapper'
import ApprovalStatusBreakdownChartWrapper from '@/components/admin/ApprovalStatusBreakdownChartWrapper'

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
  const nonBillableMinutes = totalMinutes - billableMinutes
  const billablePercent = totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0

  // Billable breakdown by user
  const billableByUser: Record<string, { name: string, billableMinutes: number, nonBillableMinutes: number }> = {}
  entries.forEach(e => {
    const userId = e.user_id
    const user = e.user as { id: string, email: string, full_name: string | null } | null
    if (!billableByUser[userId]) {
      billableByUser[userId] = {
        name: user?.full_name || user?.email || 'Unknown',
        billableMinutes: 0,
        nonBillableMinutes: 0,
      }
    }
    if (e.is_billable) {
      billableByUser[userId].billableMinutes += e.duration_minutes || 0
    } else {
      billableByUser[userId].nonBillableMinutes += e.duration_minutes || 0
    }
  })
  const billableByUserList = Object.values(billableByUser).sort((a, b) =>
    (b.billableMinutes + b.nonBillableMinutes) - (a.billableMinutes + a.nonBillableMinutes)
  )

  // Billable entries count
  const billableEntries = entries.filter(e => e.is_billable).length
  const nonBillableEntries = entries.length - billableEntries

  // Approval status breakdown
  const approvedMinutes = entries.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  const submittedMinutes = entries.filter(e => e.status === 'submitted').reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  const draftMinutes = entries.filter(e => e.status === 'draft').reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  const rejectedMinutes = entries.filter(e => e.status === 'rejected').reduce((sum, e) => sum + (e.duration_minutes || 0), 0)

  const approvedEntries = entries.filter(e => e.status === 'approved').length
  const submittedEntries = entries.filter(e => e.status === 'submitted').length
  const draftEntries = entries.filter(e => e.status === 'draft').length
  const rejectedEntries = entries.filter(e => e.status === 'rejected').length

  // Approval status breakdown by user
  const statusByUser: Record<string, { name: string, approvedMinutes: number, submittedMinutes: number, draftMinutes: number, rejectedMinutes: number }> = {}
  entries.forEach(e => {
    const userId = e.user_id
    const user = e.user as { id: string, email: string, full_name: string | null } | null
    if (!statusByUser[userId]) {
      statusByUser[userId] = {
        name: user?.full_name || user?.email || 'Unknown',
        approvedMinutes: 0,
        submittedMinutes: 0,
        draftMinutes: 0,
        rejectedMinutes: 0,
      }
    }
    if (e.status === 'approved') {
      statusByUser[userId].approvedMinutes += e.duration_minutes || 0
    } else if (e.status === 'submitted') {
      statusByUser[userId].submittedMinutes += e.duration_minutes || 0
    } else if (e.status === 'draft') {
      statusByUser[userId].draftMinutes += e.duration_minutes || 0
    } else if (e.status === 'rejected') {
      statusByUser[userId].rejectedMinutes += e.duration_minutes || 0
    }
  })
  const statusByUserList = Object.values(statusByUser).sort((a, b) =>
    (b.approvedMinutes + b.submittedMinutes + b.draftMinutes + b.rejectedMinutes) - (a.approvedMinutes + a.submittedMinutes + a.draftMinutes + a.rejectedMinutes)
  )

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
              <ExportTimeEntriesButton
                searchParams={{
                  startDate: startDate || undefined,
                  endDate: endDate || undefined,
                  billable: billablePreset !== 'all' ? billablePreset : undefined,
                  status: statusPreset !== 'all' ? statusPreset : undefined,
                  user: userFilter !== 'all' ? userFilter : undefined,
                }}
              />
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

        {/* Billable vs Non-Billable Breakdown */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Billable Breakdown</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Hours Distribution</h3>
              <BillableBreakdownChartWrapper data={{ billableMinutes, nonBillableMinutes }} />
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Billable</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatDuration(billableMinutes)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{billableEntries} {billableEntries === 1 ? 'entry' : 'entries'}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Non-Billable</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatDuration(nonBillableMinutes)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{nonBillableEntries} {nonBillableEntries === 1 ? 'entry' : 'entries'}</p>
                </div>
              </div>
            </div>

            {/* Billable Breakdown by User */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Billable Hours by User</h3>
              {billableByUserList.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-gray-500 dark:text-gray-400">
                  <p className="text-sm">No time entries to display</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">User</th>
                        <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">Billable</th>
                        <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">Non-Billable</th>
                        <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {billableByUserList.map((user, idx) => {
                        const userTotal = user.billableMinutes + user.nonBillableMinutes
                        const userRate = userTotal > 0 ? Math.round((user.billableMinutes / userTotal) * 100) : 0
                        return (
                          <tr key={idx}>
                            <td className="py-2 text-sm text-gray-900 dark:text-gray-100">{user.name}</td>
                            <td className="py-2 text-sm text-right text-green-600 dark:text-green-400 font-medium">{formatDuration(user.billableMinutes)}</td>
                            <td className="py-2 text-sm text-right text-gray-500 dark:text-gray-400">{formatDuration(user.nonBillableMinutes)}</td>
                            <td className="py-2 text-sm text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                userRate >= 75
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : userRate >= 50
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {userRate}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                        <td className="py-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Total</td>
                        <td className="py-2 text-sm text-right font-semibold text-green-600 dark:text-green-400">{formatDuration(billableMinutes)}</td>
                        <td className="py-2 text-sm text-right font-semibold text-gray-500 dark:text-gray-400">{formatDuration(nonBillableMinutes)}</td>
                        <td className="py-2 text-sm text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {billablePercent}%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Approval Status Breakdown */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Approval Status Breakdown</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Status Distribution</h3>
              <ApprovalStatusBreakdownChartWrapper data={{ approvedMinutes, submittedMinutes, draftMinutes, rejectedMinutes }} />
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Approved</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatDuration(approvedMinutes)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{approvedEntries} {approvedEntries === 1 ? 'entry' : 'entries'}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Submitted</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatDuration(submittedMinutes)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{submittedEntries} {submittedEntries === 1 ? 'entry' : 'entries'}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Draft</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatDuration(draftMinutes)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{draftEntries} {draftEntries === 1 ? 'entry' : 'entries'}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Rejected</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatDuration(rejectedMinutes)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{rejectedEntries} {rejectedEntries === 1 ? 'entry' : 'entries'}</p>
                </div>
              </div>
            </div>

            {/* Status Breakdown by User */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Status by User</h3>
              {statusByUserList.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-gray-500 dark:text-gray-400">
                  <p className="text-sm">No time entries to display</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">User</th>
                        <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">Approved</th>
                        <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">Submitted</th>
                        <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">Draft</th>
                        <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">Rejected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {statusByUserList.map((user, idx) => (
                        <tr key={idx}>
                          <td className="py-2 text-sm text-gray-900 dark:text-gray-100">{user.name}</td>
                          <td className="py-2 text-sm text-right text-green-600 dark:text-green-400 font-medium">{formatDuration(user.approvedMinutes)}</td>
                          <td className="py-2 text-sm text-right text-yellow-600 dark:text-yellow-400 font-medium">{formatDuration(user.submittedMinutes)}</td>
                          <td className="py-2 text-sm text-right text-gray-500 dark:text-gray-400">{formatDuration(user.draftMinutes)}</td>
                          <td className="py-2 text-sm text-right text-red-600 dark:text-red-400 font-medium">{formatDuration(user.rejectedMinutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                        <td className="py-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Total</td>
                        <td className="py-2 text-sm text-right font-semibold text-green-600 dark:text-green-400">{formatDuration(approvedMinutes)}</td>
                        <td className="py-2 text-sm text-right font-semibold text-yellow-600 dark:text-yellow-400">{formatDuration(submittedMinutes)}</td>
                        <td className="py-2 text-sm text-right font-semibold text-gray-500 dark:text-gray-400">{formatDuration(draftMinutes)}</td>
                        <td className="py-2 text-sm text-right font-semibold text-red-600 dark:text-red-400">{formatDuration(rejectedMinutes)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
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
