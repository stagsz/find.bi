'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'

export type ApprovalStatusPreset = 'all' | 'draft' | 'submitted' | 'approved' | 'rejected'

interface ApprovalStatusFilterProps {
  preset?: ApprovalStatusPreset
  basePath?: string
}

export default function ApprovalStatusFilter({ preset = 'all', basePath = '/admin/time-tracking' }: ApprovalStatusFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateUrl = useCallback((newPreset: ApprovalStatusPreset) => {
    const params = new URLSearchParams(searchParams.toString())

    if (newPreset === 'all') {
      params.delete('status')
    } else {
      params.set('status', newPreset)
    }

    startTransition(() => {
      const query = params.toString()
      router.push(query ? `${basePath}?${query}` : basePath)
    })
  }, [router, searchParams, basePath])

  const options: { value: ApprovalStatusPreset; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="flex items-center gap-2">
      <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
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
