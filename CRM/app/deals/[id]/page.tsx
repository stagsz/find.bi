import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ActivityTimeline from '@/components/activities/ActivityTimeline'
import Timer from '@/components/timer/Timer'
import LogTimeEntryButton from '@/components/timer/LogTimeEntryButton'
import TimeEntriesList from '@/components/timer/TimeEntriesList'
import { getActivitiesForDeal } from '@/app/activities/actions'
import { getTimeEntriesForDeal } from '@/app/time-entries/actions'

const STAGES = {
  lead: { label: 'Lead', color: 'bg-blue-100', textColor: 'text-blue-800' },
  proposal: { label: 'Proposal', color: 'bg-purple-100', textColor: 'text-purple-800' },
  negotiation: { label: 'Negotiation', color: 'bg-yellow-100', textColor: 'text-yellow-800' },
  'closed-won': { label: 'Closed Won', color: 'bg-green-100', textColor: 'text-green-800' },
  'closed-lost': { label: 'Closed Lost', color: 'bg-red-100', textColor: 'text-red-800' }
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: deal, error } = await supabase
    .from('deals')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, company),
      owner:users(id, full_name, email)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !deal) {
    notFound()
  }

  const stage = STAGES[deal.stage as keyof typeof STAGES]

  // Fetch activities and time entries for this deal
  const activities = await getActivitiesForDeal(id)
  const timeEntries = await getTimeEntriesForDeal(id)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/deals" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4 inline-block">
            ← Back to Deals
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{deal.title}</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {deal.contact?.first_name} {deal.contact?.last_name}
                {deal.contact?.company && ` • ${deal.contact.company}`}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${stage.color} ${stage.textColor}`}>
              {stage.label}
            </span>
          </div>
        </div>

        {/* Time Tracking */}
        <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Time Tracking ({timeEntries.length})
            </h2>
            <LogTimeEntryButton dealId={deal.id} contactId={deal.contact?.id} />
          </div>
          <Timer
            label="Session Timer"
            dealId={deal.id}
            contactId={deal.contact?.id}
          />
          {timeEntries.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <TimeEntriesList entries={timeEntries} showActivity={true} />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Deal Information</h2>
          </div>

          <div className="px-6 py-5 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Amount</dt>
                <dd className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${deal.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Win Probability</dt>
                <dd className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{deal.probability}%</dd>
              </div>

              {deal.description && (
                <div className="col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{deal.description}</dd>
                </div>
              )}

              {deal.expected_close_date && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Expected Close Date</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(deal.expected_close_date).toLocaleDateString()}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  <Link
                    href={`/contacts/${deal.contact?.id}`}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    {deal.contact?.first_name} {deal.contact?.last_name}
                  </Link>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Owner</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {deal.owner?.full_name || deal.owner?.email || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {new Date(deal.created_at).toLocaleDateString()}
                </dd>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-end gap-3">
              <Link
                href={`/deals/${id}/edit`}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                Edit
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Activity Timeline ({activities.length})
            </h3>
            <Link
              href={`/deals/${deal.id}/activities/new`}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              + Log Activity
            </Link>
          </div>
          <ActivityTimeline activities={activities} showContact={true} />
        </div>
      </div>
    </div>
  )
}
