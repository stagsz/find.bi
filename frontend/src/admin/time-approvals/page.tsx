import { requireAdmin } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import TimeApprovalsTable from '@/components/admin/TimeApprovalsTable'
import Link from 'next/link'

interface TimeApprovalsPageProps {
  searchParams: Promise<{
    search?: string
    status?: string
    sort?: string
    order?: 'asc' | 'desc'
  }>
}

export default async function TimeApprovalsPage({ searchParams }: TimeApprovalsPageProps) {
  // Require admin role - will redirect if not admin
  const currentUser = await requireAdmin()

  const params = await searchParams
  const supabase = await createClient()

  // Build query with filters - get all time entries with submitted status by default
  let query = supabase
    .from('time_entries')
    .select(`
      *,
      user:users(id, email, full_name),
      contact:contacts(id, first_name, last_name, company),
      deal:deals(id, title),
      activity:activities(id, subject, type)
    `, { count: 'exact' })

  // Filter by status (default to 'submitted' for pending approvals)
  const statusFilter = params.status || 'submitted'
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  // Apply search filter (search by user name/email or notes)
  if (params.search) {
    // We can't directly search on joined tables, so we'll filter in JS after fetch
    // For now, search by notes only in the query
    query = query.ilike('notes', `%${params.search}%`)
  }

  // Apply sorting
  const sortColumn = params.sort || 'created_at'
  const sortOrder = params.order || 'desc'
  query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

  const { data: timeEntries, count } = await query

  // Get counts by status for the summary
  const [
    { count: submittedCount },
    { count: approvedCount },
    { count: rejectedCount },
    { count: draftCount }
  ] = await Promise.all([
    supabase.from('time_entries').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase.from('time_entries').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('time_entries').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('time_entries').select('*', { count: 'exact', head: true }).eq('status', 'draft')
  ])

  // Calculate total hours pending approval
  const pendingHours = timeEntries
    ?.filter(e => e.status === 'submitted')
    .reduce((sum, e) => sum + (e.duration_minutes || 0), 0) || 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Time Approvals</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Review and approve time entries</p>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Summary */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Approval Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Approval</p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{submittedCount || 0}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {Math.floor(pendingHours / 60)}h {pendingHours % 60}m total
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{approvedCount || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Rejected</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">{rejectedCount || 0}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Draft</p>
                  <p className="text-3xl font-bold text-gray-600 dark:text-gray-400">{draftCount || 0}</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Entries Table Section */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Time Entries</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {count !== null ? `${count} entries` : 'Loading...'}
          </p>
        </div>
        <TimeApprovalsTable
          timeEntries={timeEntries || []}
          currentUserId={currentUser.id}
          searchParams={params}
        />
      </div>
    </div>
  )
}
