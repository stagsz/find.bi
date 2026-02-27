import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PipelineChartWrapper from '@/components/dashboard/PipelineChartWrapper'
import DealsDonutChartWrapper from '@/components/dashboard/DealsDonutChartWrapper'
import DateRangeFilter from '@/components/dashboard/DateRangeFilter'
import { getDateRangeFromParams, type DateRangePreset } from '@/lib/date-utils'

interface DashboardStats {
  totalContacts: number
  totalDeals: number
  totalPipelineValue: number
  dealsClosedWon: number
  dealsClosedLost: number
  activeTasks: number
  completedTasksThisWeek: number
  activitiesThisWeek: number
  dealsByStage: Record<string, { count: number; value: number }>
  recentDeals: any[]
  upcomingTasks: any[]
}

interface SearchParams {
  range?: string
  start?: string
  end?: string
}

const STAGES = {
  lead: { label: 'Lead', color: 'bg-blue-500', chartColor: '#3b82f6' },
  proposal: { label: 'Proposal', color: 'bg-purple-500', chartColor: '#a855f7' },
  negotiation: { label: 'Negotiation', color: 'bg-yellow-500', chartColor: '#eab308' },
  'closed-won': { label: 'Closed Won', color: 'bg-green-500', chartColor: '#22c55e' },
  'closed-lost': { label: 'Closed Lost', color: 'bg-red-500', chartColor: '#ef4444' }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Parse date range from search params
  const { startDate, endDate } = getDateRangeFromParams(params)
  const preset = (params.range || 'all') as DateRangePreset

  // Build base queries with optional date filtering
  let contactsQuery = supabase.from('contacts').select('id, created_at').is('deleted_at', null)
  let dealsQuery = supabase.from('deals').select('*').is('deleted_at', null)
  let tasksQuery = supabase.from('activities').select('*').eq('type', 'task').is('deleted_at', null)
  let activitiesQuery = supabase.from('activities').select('*').is('deleted_at', null)

  // Apply date filters if specified
  if (startDate && endDate) {
    const startDateTime = `${startDate}T00:00:00`
    const endDateTime = `${endDate}T23:59:59`

    contactsQuery = contactsQuery.gte('created_at', startDateTime).lte('created_at', endDateTime)
    dealsQuery = dealsQuery.gte('created_at', startDateTime).lte('created_at', endDateTime)
    tasksQuery = tasksQuery.gte('created_at', startDateTime).lte('created_at', endDateTime)
    activitiesQuery = activitiesQuery.gte('created_at', startDateTime).lte('created_at', endDateTime)
  }

  // Fetch all data in parallel
  const [
    { data: contacts },
    { data: deals },
    { data: tasks },
    { data: activities }
  ] = await Promise.all([
    contactsQuery,
    dealsQuery,
    tasksQuery,
    activitiesQuery
  ])

  // Calculate stats
  const totalContacts = contacts?.length || 0
  const totalDeals = deals?.length || 0
  const totalPipelineValue = deals?.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) || 0
  const dealsClosedWon = deals?.filter(d => d.stage === 'closed-won').length || 0
  const dealsClosedLost = deals?.filter(d => d.stage === 'closed-lost').length || 0
  const conversionRate = totalDeals > 0 ? ((dealsClosedWon / totalDeals) * 100).toFixed(1) : '0.0'

  const activeTasks = tasks?.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length || 0

  // For "this period" metrics, use the date range or default to last 7 days
  const periodStart = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 7))
  const completedTasksInPeriod = tasks?.filter(t =>
    t.status === 'completed' &&
    t.completed_at &&
    new Date(t.completed_at) >= periodStart
  ).length || 0

  const activitiesInPeriod = activities?.filter(a =>
    new Date(a.created_at) >= periodStart
  ).length || 0

  // Group deals by stage
  const dealsByStage: Record<string, { count: number; value: number }> = {}
  Object.keys(STAGES).forEach(stage => {
    const stageDeals = deals?.filter(d => d.stage === stage) || []
    dealsByStage[stage] = {
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
    }
  })

  // Get recent deals
  const recentDeals = deals?.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5) || []

  // Get upcoming tasks
  const upcomingTasks = tasks?.filter(t =>
    t.due_date &&
    t.status !== 'completed' &&
    t.status !== 'cancelled'
  ).sort((a, b) =>
    new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  ).slice(0, 5) || []

  // Format date range for display
  const dateRangeLabel = startDate && endDate
    ? `${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'All Time'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Overview of your sales performance
            {startDate && endDate && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                • Showing data from {dateRangeLabel}
              </span>
            )}
          </p>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-8">
          <DateRangeFilter
            startDate={startDate || undefined}
            endDate={endDate || undefined}
            preset={preset}
          />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <MetricCard
            title="Total Contacts"
            value={totalContacts.toLocaleString()}
            iconColor="bg-blue-500"
            iconLabel="C"
            href="/contacts"
          />
          <MetricCard
            title="Active Deals"
            value={totalDeals.toLocaleString()}
            subtitle={`$${(totalPipelineValue / 1000).toFixed(0)}K pipeline`}
            iconColor="bg-indigo-500"
            iconLabel="D"
            href="/deals"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${conversionRate}%`}
            subtitle={`${dealsClosedWon} won / ${dealsClosedLost} lost`}
            iconColor="bg-green-500"
            iconLabel="%"
            href="/deals"
          />
          <MetricCard
            title="Active Tasks"
            value={activeTasks.toLocaleString()}
            subtitle={`${completedTasksInPeriod} completed in period`}
            iconColor="bg-orange-500"
            iconLabel="T"
            href="/tasks"
          />
        </div>

        {/* Pipeline Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Pipeline Breakdown</h2>
          </div>
          <PipelineChartWrapper
            data={Object.entries(STAGES).map(([key, stage]) => ({
              stage: stage.label,
              count: dealsByStage[key].count,
              value: dealsByStage[key].value,
              color: stage.color
            }))}
          />
        </div>

        {/* Deals by Stage Donut Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Deals by Stage</h2>
          </div>
          <DealsDonutChartWrapper
            data={Object.entries(STAGES).map(([key, stage]) => ({
              name: stage.label,
              value: dealsByStage[key].count,
              color: stage.chartColor
            }))}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Deals */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Deals</h2>
              </div>
              <Link href="/deals" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {recentDeals.length > 0 ? (
                recentDeals.map(deal => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="block p-3 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{deal.title}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {STAGES[deal.stage as keyof typeof STAGES]?.label}
                        </p>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        ${(deal.amount / 1000).toFixed(0)}K
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No deals in this period</p>
              )}
            </div>
          </div>

          {/* Upcoming Tasks */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Upcoming Tasks</h2>
              </div>
              <Link href="/tasks" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingTasks.length > 0 ? (
                upcomingTasks.map(task => {
                  const dueDate = new Date(task.due_date)
                  const isOverdue = dueDate < new Date()

                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded ${isOverdue ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100">{task.subject}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                          {isOverdue ? 'Overdue' : 'Due'}: {dueDate.toLocaleDateString()}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No upcoming tasks</p>
              )}
            </div>
          </div>
        </div>

        {/* Activity Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Activity {startDate ? 'in Period' : 'This Week'}
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{activitiesInPeriod}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Activities</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{completedTasksInPeriod}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tasks Completed</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{dealsClosedWon}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Deals Won</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                ${(dealsByStage['closed-won']?.value / 1000).toFixed(0)}K
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Revenue Won</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  iconColor,
  iconLabel,
  href
}: {
  title: string
  value: string
  subtitle?: string
  iconColor: string
  iconLabel: string
  href: string
}) {
  return (
    <Link href={href} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
        <div className={`${iconColor} w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-4`}>
          <span className="text-white text-xl font-bold">{iconLabel}</span>
        </div>
      </div>
    </Link>
  )
}
