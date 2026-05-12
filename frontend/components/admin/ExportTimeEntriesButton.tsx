'use client'

import { useState } from 'react'
import { exportTimeEntriesToCSV } from '@/app/time-entries/actions'

interface ExportTimeEntriesButtonProps {
  searchParams: {
    startDate?: string
    endDate?: string
    billable?: string
    status?: string
    user?: string
  }
}

export default function ExportTimeEntriesButton({ searchParams }: ExportTimeEntriesButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string>('')

  const handleExport = async () => {
    setIsExporting(true)
    setError('')

    try {
      const result = await exportTimeEntriesToCSV({
        startDate: searchParams.startDate,
        endDate: searchParams.endDate,
        billable: searchParams.billable,
        status: searchParams.status,
        user: searchParams.user,
      })

      if (result.error) {
        setError(result.error)
        setTimeout(() => setError(''), 3000)
      } else if (result.data) {
        // Create blob and download
        const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)

        link.setAttribute('href', url)
        link.setAttribute('download', `time-entries-${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        URL.revokeObjectURL(url)
      }
    } catch (err) {
      setError('Failed to export time entries')
      setTimeout(() => setError(''), 3000)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {isExporting ? 'Exporting...' : 'Export CSV'}
      </button>

      {error && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 shadow-lg z-10">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}
    </div>
  )
}
