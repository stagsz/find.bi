'use client'

import { useState } from 'react'
import TimeEntryForm from './TimeEntryForm'

interface LogTimeEntryButtonProps {
  contactId?: string
  dealId?: string
  activityId?: string
}

export default function LogTimeEntryButton({ contactId, dealId, activityId }: LogTimeEntryButtonProps) {
  const [showModal, setShowModal] = useState(false)

  const handleSuccess = () => {
    setShowModal(false)
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
      >
        + Log Time
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Log Time Entry
            </h3>
            <TimeEntryForm
              mode="create"
              contactId={contactId}
              dealId={dealId}
              activityId={activityId}
              onSuccess={handleSuccess}
              onCancel={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
