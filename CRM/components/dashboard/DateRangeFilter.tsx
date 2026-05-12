'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { type DateRangePreset } from '@/lib/date-utils'

interface DateRangeFilterProps {
  startDate?: string
  endDate?: string
  preset?: DateRangePreset
  basePath?: string
}

export default function DateRangeFilter({ startDate, endDate, preset = 'all', basePath = '/dashboard' }: DateRangeFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [customStart, setCustomStart] = useState(startDate || '')
  const [customEnd, setCustomEnd] = useState(endDate || '')

  const updateUrl = useCallback((newPreset: DateRangePreset, start?: string, end?: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (newPreset === 'all') {
      params.delete('range')
      params.delete('start')
      params.delete('end')
    } else if (newPreset === 'custom' && start && end) {
      params.set('range', 'custom')
      params.set('start', start)
      params.set('end', end)
    } else {
      params.set('range', newPreset)
      params.delete('start')
      params.delete('end')
    }

    startTransition(() => {
      const query = params.toString()
      router.push(query ? `${basePath}?${query}` : basePath)
    })
  }, [router, searchParams, basePath])

  const handlePresetChange = (newPreset: DateRangePreset) => {
    if (newPreset === 'custom') {
      // Don't navigate yet, wait for custom dates
      return
    }
    updateUrl(newPreset)
  }

  const handleCustomDateApply = () => {
    if (customStart && customEnd) {
      updateUrl('custom', customStart, customEnd)
    }
  }

  const presets: { value: DateRangePreset; label: string }[] = [
    { value: 'all', label: 'All Time' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'mtd', label: 'Month to Date' },
    { value: 'ytd', label: 'Year to Date' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handlePresetChange(value)}
            disabled={isPending}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              preset === value
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 ring-1 ring-gray-200 dark:ring-gray-700'
            } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleCustomDateApply}
            disabled={isPending || !customStart || !customEnd}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        </div>
      )}

      {isPending && (
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      )}
    </div>
  )
}
