import { requireAdmin } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import UsersTable from '@/components/admin/UsersTable'

interface AdminDashboardProps {
  searchParams: Promise<{
    search?: string
    role?: string
    sort?: string
    order?: 'asc' | 'desc'
  }>
}

export default async function AdminDashboard({ searchParams }: AdminDashboardProps) {
  // Require admin role - will redirect if not admin
  const currentUser = await requireAdmin()

  const params = await searchParams
  const supabase = await createClient()

  // Build query with filters
  let query = supabase.from('users').select('*', { count: 'exact' })

  // Apply search filter
  if (params.search) {
    query = query.or(`full_name.ilike.%${params.search}%,email.ilike.%${params.search}%`)
  }

  // Apply role filter
  if (params.role && params.role !== 'all') {
    query = query.eq('role', params.role)
  }

  // Apply sorting
  const sortColumn = params.sort || 'created_at'
  const sortOrder = params.order || 'desc'
  query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

  const { data: users, count } = await query

  // Get total counts (unfiltered) for user stats
  const { data: allUsers } = await supabase.from('users').select('role')
  const adminCount = allUsers?.filter(u => u.role === 'admin').length || 0
  const userCount = allUsers?.filter(u => u.role === 'user').length || 0
  const totalCount = allUsers?.length || 0

  // Fetch system-wide CRM statistics (all data in parallel)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString()

  const [
    { data: allContacts },
    { data: allDeals },
    { data: recentActivities },
    { data: allActivities }
  ] = await Promise.all([
    supabase.from('contacts').select('id').is('deleted_at', null),
    supabase.from('deals').select('id, amount, stage').is('deleted_at', null),
    supabase.from('activities').select('id, type').is('deleted_at', null).gte('created_at', thirtyDaysAgoStr),
    supabase.from('activities').select('id, type').is('deleted_at', null)
  ])

  // Calculate CRM stats
  const totalContacts = allContacts?.length || 0
  const totalDeals = allDeals?.length || 0
  const totalPipelineValue = allDeals?.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) || 0
  const openDeals = allDeals?.filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost').length || 0
  const closedWonDeals = allDeals?.filter(d => d.stage === 'closed-won').length || 0
  const closedLostDeals = allDeals?.filter(d => d.stage === 'closed-lost').length || 0
  const winRate = totalDeals > 0 && (closedWonDeals + closedLostDeals) > 0
    ? ((closedWonDeals / (closedWonDeals + closedLostDeals)) * 100).toFixed(1)
    : '0.0'

  // Activity stats
  const totalActivities = allActivities?.length || 0
  const activitiesLast30Days = recentActivities?.length || 0

  // Activity breakdown by type
  const activityByType: Record<string, number> = {}
  allActivities?.forEach(a => {
    activityByType[a.type] = (activityByType[a.type] || 0) + 1
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Manage users and system settings</p>
            </div>
            <a
              href="/"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Stats */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">User Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalCount}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Admins</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{adminCount}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Regular Users</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{userCount}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System-wide CRM Statistics */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">System-wide CRM Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Contacts</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalContacts.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Deals</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalDeals.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{openDeals} open</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pipeline Value</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    ${totalPipelineValue >= 1000000
                      ? `${(totalPipelineValue / 1000000).toFixed(1)}M`
                      : totalPipelineValue >= 1000
                        ? `${(totalPipelineValue / 1000).toFixed(0)}K`
                        : totalPipelineValue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{winRate}% win rate</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Activities</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalActivities.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{activitiesLast30Days} last 30 days</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Deal Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Deal Status Breakdown</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Open Deals</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{openDeals}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Closed Won</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{closedWonDeals}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Closed Lost</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{closedLostDeals}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Activities by Type</h3>
              <div className="space-y-3">
                {Object.entries(activityByType).length > 0 ? (
                  Object.entries(activityByType)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{type}</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{count}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No activities recorded</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Users Table Section */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">All Users</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {count !== totalCount
              ? `Showing ${count} of ${totalCount} users`
              : `${totalCount} total users`
            }
          </p>
        </div>
        <UsersTable
          users={users || []}
          currentUserId={currentUser.id}
          searchParams={params}
        />
      </div>
    </div>
  )
}
