import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DeleteContactButton from '@/components/contacts/DeleteContactButton'
import ActivityTimeline from '@/components/activities/ActivityTimeline'
import Timer from '@/components/timer/Timer'
import LogTimeEntryButton from '@/components/timer/LogTimeEntryButton'
import TimeEntriesList from '@/components/timer/TimeEntriesList'
import { getActivitiesForContact } from '@/app/activities/actions'
import { getTimeEntriesForContact } from '@/app/time-entries/actions'

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // No need to check auth here - middleware already handles it
  const supabase = await createClient()
  const { id } = await params

  // Fetch contact with owner information
  const { data: contact, error } = await supabase
    .from('contacts')
    .select(`
      *,
      owner:users!owner_id(id, full_name, email)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !contact) {
    notFound()
  }

  // Fetch activities and time entries for this contact
  const activities = await getActivitiesForContact(id)
  const timeEntries = await getTimeEntriesForContact(id)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/contacts"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4 inline-block"
          >
            ← Back to Contacts
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {contact.first_name} {contact.last_name}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {contact.company && `${contact.company} • `}
            {contact.title || 'Contact'}
          </p>
        </div>

        {/* Time Tracking */}
        <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Time Tracking ({timeEntries.length})
            </h2>
            <LogTimeEntryButton contactId={contact.id} />
          </div>
          <Timer
            label="Session Timer"
            contactId={contact.id}
          />
          {timeEntries.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <TimeEntriesList entries={timeEntries} showActivity={true} />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Contact Information</h2>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  <a href={`mailto:${contact.email}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                    {contact.email}
                  </a>
                </dd>
              </div>

              {contact.phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    <a href={`tel:${contact.phone}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                      {contact.phone}
                    </a>
                  </dd>
                </div>
              )}

              {contact.company && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Company</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{contact.company}</dd>
                </div>
              )}

              {contact.title && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Title</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{contact.title}</dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    contact.status === 'customer'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                  }`}>
                    {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Owner</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {contact.owner?.full_name || contact.owner?.email || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {new Date(contact.created_at).toLocaleDateString()} at{' '}
                  {new Date(contact.created_at).toLocaleTimeString()}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {new Date(contact.updated_at).toLocaleDateString()} at{' '}
                  {new Date(contact.updated_at).toLocaleTimeString()}
                </dd>
              </div>
            </div>

            {/* Custom Fields */}
            {contact.custom_fields && Object.keys(contact.custom_fields).length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Custom Fields</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Object.entries(contact.custom_fields).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{key}</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{String(value)}</dd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-end gap-3">
              <DeleteContactButton
                contactId={contact.id}
                contactName={`${contact.first_name} ${contact.last_name}`}
              />
              <Link
                href={`/contacts/${contact.id}/edit`}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
              href={`/contacts/${contact.id}/activities/new`}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              + Log Activity
            </Link>
          </div>
          <ActivityTimeline activities={activities} />
        </div>
      </div>
    </div>
  )
}
