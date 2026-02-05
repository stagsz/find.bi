'use client'

import { useState } from 'react'
import Link from 'next/link'

interface DealHours {
  dealId: string
  title: string
  totalMinutes: number
}

interface DealHoursTableProps {
  deals: DealHours[]
}

type SortField = 'title' | 'totalMinutes'
type SortOrder = 'asc' | 'desc'

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export default function DealHoursTable({ deals }: DealHoursTableProps) {
  const [sortField, setSortField] = useState<SortField>('totalMinutes')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'title' ? 'asc' : 'desc')
    }
  }

  const sortedDeals = [...deals].sort((a, b) => {
    let comparison: number
    if (sortField === 'title') {
      comparison = a.title.localeCompare(b.title)
    } else {
      comparison = a[sortField] - b[sortField]
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="ml-1 text-gray-400">&#8645;</span>
    }
    return (
      <span className="ml-1 text-blue-600 dark:text-blue-400">
        {sortOrder === 'asc' ? '\u2191' : '\u2193'}
      </span>
    )
  }

  if (deals.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No time entries linked to deals yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr>
            <th
              onClick={() => handleSort('title')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
            >
              Deal <SortIcon field="title" />
            </th>
            <th
              onClick={() => handleSort('totalMinutes')}
              className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
            >
              Total Hours <SortIcon field="totalMinutes" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedDeals.map((deal) => (
            <tr key={deal.dealId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-4 py-3 whitespace-nowrap">
                <Link
                  href={`/deals/${deal.dealId}`}
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {deal.title}
                </Link>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatDuration(deal.totalMinutes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
