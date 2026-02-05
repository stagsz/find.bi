import { requireAdmin } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import UserHoursTable from '@/components/admin/UserHoursTable'
import ContactHoursTable from '@/components/admin/ContactHoursTable'
import DealHoursTable from '@/components/admin/DealHoursTable'
import DateRangeFilter, { getDateRangeFromParams, type DateRangePreset } from '@/components/dashboard/DateRangeFilter'
import BillableFilter, { type BillablePreset } from '@/components/admin/BillableFilter'
import ApprovalStatusFilter, { type ApprovalStatusPreset } from '@/components/admin/ApprovalStatusFilter'
import HoursPerDayChartWrapper from '@/components/admin/HoursPerDayChartWrapper'

interface SearchParams {
  range?: string
  start?: string
  end?: string
  billable?: string
  status?: string
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

export default async function AdminTimeTrackingDashboard({
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

  // Get date ranges for summary cards
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0]

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  const weekStartStr = weekStart.toISOString().split('T')[0]

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  // Fetch time entries with related data, applying date range filter
  let timeEntriesQuery = supabase
    .from('time_entries')
    .select(`
      *,
      user:users(id, email, full_name),
      contact:contacts(id, first_name, last_name, company),
      deal:deals(id, title)
    `)

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

  const { data: allTimeEntries } = await timeEntriesQuery
    .order('entry_date', { ascending: false })

  const entries = allTimeEntries || []

  // Calculate summary statistics
  // When a date range filter is active, all entries are already filtered
  // Show today/week/month as sub-filters of the selected range
  const todayEntries = entries.filter(e => e.entry_date === todayStart)
  const weekEntries = entries.filter(e => e.entry_date >= weekStartStr)
  const monthEntries = entries.filter(e => e.entry_date >= monthStart)

  const todayMinutes = todayEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  const weekMinutes = weekEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  const monthMinutes = monthEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)

  // Calculate billable vs non-billable
  const billableMinutes = entries.reduce((sum, e) => sum + (e.is_billable ? e.duration_minutes || 0 : 0), 0)
  const nonBillableMinutes = totalMinutes - billableMinutes
  const billablePercent = totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0

  // Status breakdown
  const approvedMinutes = entries.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  const submittedMinutes = entries.filter(e => e.status === 'submitted').reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  const draftMinutes = entries.filter(e => e.status === 'draft').reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
  const rejectedMinutes = entries.filter(e => e.status === 'rejected').reduce((sum, e) => sum + (e.duration_minutes || 0), 0)

  // Hours by user
  const hoursByUser: Record<string, { userId: string, name: string, email: string, totalMinutes: number, billableMinutes: number, approvedMinutes: number }> = {}
  entries.forEach(e => {
    const userId = e.user_id
    const user = e.user as { id: string, email: string, full_name: string | null } | null
    if (!hoursByUser[userId]) {
      hoursByUser[userId] = {
        userId,
        name: user?.full_name || 'Unknown',
        email: user?.email || '',
        totalMinutes: 0,
        billableMinutes: 0,
        approvedMinutes: 0
      }
    }
    hoursByUser[userId].totalMinutes += e.duration_minutes || 0
    if (e.is_billable) hoursByUser[userId].billableMinutes += e.duration_minutes || 0
    if (e.status === 'approved') hoursByUser[userId].approvedMinutes += e.duration_minutes || 0
  })
  const userHoursList = Object.values(hoursByUser).sort((a, b) => b.totalMinutes - a.totalMinutes)

  // Hours by contact (top 10)
  const hoursByContact: Record<string, { contactId: string, name: string, company: string | null, totalMinutes: number }> = {}
  entries.filter(e => e.contact_id).forEach(e => {
    const contactId = e.contact_id
    const contact = e.contact as { id: string, first_name: string, last_name: string, company: string | null } | null
    if (!hoursByContact[contactId]) {
      hoursByContact[contactId] = {
        contactId,
        name: contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown',
        company: contact?.company || null,
        totalMinutes: 0
      }
    }
    hoursByContact[contactId].totalMinutes += e.duration_minutes || 0
  })
  const contactHoursList = Object.values(hoursByContact).sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, 10)

  // Hours by deal (top 10)
  const hoursByDeal: Record<string, { dealId: string, title: string, totalMinutes: number }> = {}
  entries.filter(e => e.deal_id).forEach(e => {
    const dealId = e.deal_id
    const deal = e.deal as { id: string, title: string } | null
    if (!hoursByDeal[dealId]) {
      hoursByDeal[dealId] = {
        dealId,
        title: deal?.title || 'Unknown',
        totalMinutes: 0
      }
    }
    hoursByDeal[dealId].totalMinutes += e.duration_minutes || 0
  })
  const dealHoursList = Object.values(hoursByDeal).sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, 10)

  // Hours per day for last 7 days chart
  const last7Days: { date: string, label: string, totalHours: number, billableHours: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayEntries = entries.filter(e => e.entry_date === dateStr)
    const totalMinutesDay = dayEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
    const billableMinutesDay = dayEntries.reduce((sum, e) => sum + (e.is_billable ? e.duration_minutes || 0 : 0), 0)
    last7Days.push({
      date: dateStr,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      totalHours: Math.round((totalMinutesDay / 60) * 10) / 10,
      billableHours: Math.round((billableMinutesDay / 60) * 10) / 10,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Time Tracking Dashboard</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of all time tracking across the organization</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/admin/time-approvals"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Manage Approvals
              </Link>
              <Link
                href="/admin/time-report"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                View Report
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
            basePath="/admin/time-tracking"
          />
          <BillableFilter
            preset={billablePreset}
            basePath="/admin/time-tracking"
          />
          <ApprovalStatusFilter
            preset={statusPreset}
            basePath="/admin/time-tracking"
          />
        </div>

        {/* Time Summary Stats */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Time Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatDuration(todayMinutes)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{todayEntries.length} entries</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">This Week</p>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{formatDuration(weekMinutes)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{weekEntries.length} entries</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">This Month</p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{formatDuration(monthMinutes)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{monthEntries.length} entries</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">All Time</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatDuration(totalMinutes)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{entries.length} total entries</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Billable Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Billable Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Billable</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDuration(billableMinutes)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Non-Billable</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDuration(nonBillableMinutes)}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Billable Rate</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{billablePercent}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Status Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Approved</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDuration(approvedMinutes)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Submitted</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDuration(submittedMinutes)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Draft</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDuration(draftMinutes)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Rejected</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDuration(rejectedMinutes)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hours Per Day Chart (Last 7 Days) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Hours Per Day (Last 7 Days)</h3>
          <HoursPerDayChartWrapper data={last7Days} />
        </div>

        {/* Hours by User (Sortable) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Hours by User</h3>
          <UserHoursTable users={userHoursList} />
        </div>

        {/* Hours by Contact/Deal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hours by Contact */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top 10 Contacts by Hours</h3>
            <ContactHoursTable contacts={contactHoursList} />
          </div>

          {/* Hours by Deal */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top 10 Deals by Hours</h3>
            <DealHoursTable deals={dealHoursList} />
          </div>
        </div>
      </div>
    </div>
  )
}
