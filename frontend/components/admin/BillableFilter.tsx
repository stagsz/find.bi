'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'

export type BillablePreset = 'all' | 'billable' | 'non-billable'

interface BillableFilterProps {
  preset?: BillablePreset
  basePath?: string
}

export default function BillableFilter({ preset = 'all', basePath = '/admin/time-tracking' }: BillableFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateUrl = useCallback((newPreset: BillablePreset) => {
    const params = new URLSearchParams(searchParams.toString())

    if (newPreset === 'all') {
      params.delete('billable')
    } else {
      params.set('billable', newPreset)
    }

    startTransition(() => {
      const query = params.toString()
      router.push(query ? `${basePath}?${query}` : basePath)
    })
  }, [router, searchParams, basePath])

  const options: { value: BillablePreset; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'billable', label: 'Billable' },
    { value: 'non-billable', label: 'Non-Billable' },
  ]

  return (
    <div className="flex items-center gap-2">
      <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Billable:</span>
      <div className="flex gap-2">
        {options.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => updateUrl(value)}
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
      {isPending && (
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      )}
    </div>
  )
}
