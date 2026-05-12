'use client'

import { useState } from 'react'

interface UserHours {
  userId: string
  name: string
  email: string
  totalMinutes: number
  billableMinutes: number
  approvedMinutes: number
}

interface UserHoursTableProps {
  users: UserHours[]
}

type SortField = 'name' | 'totalMinutes' | 'billableMinutes' | 'approvedMinutes'
type SortOrder = 'asc' | 'desc'

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export default function UserHoursTable({ users }: UserHoursTableProps) {
  const [sortField, setSortField] = useState<SortField>('totalMinutes')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'name' ? 'asc' : 'desc')
    }
  }

  const sortedUsers = [...users].sort((a, b) => {
    let comparison: number
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name)
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

  if (users.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No time entries recorded yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr>
            <th
              onClick={() => handleSort('name')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
            >
              User <SortIcon field="name" />
            </th>
            <th
              onClick={() => handleSort('totalMinutes')}
              className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
            >
              Total Hours <SortIcon field="totalMinutes" />
            </th>
            <th
              onClick={() => handleSort('billableMinutes')}
              className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
            >
              Billable <SortIcon field="billableMinutes" />
            </th>
            <th
              onClick={() => handleSort('approvedMinutes')}
              className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
            >
              Approved <SortIcon field="approvedMinutes" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedUsers.map((user) => (
            <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatDuration(user.totalMinutes)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-green-600 dark:text-green-400">
                {formatDuration(user.billableMinutes)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                {formatDuration(user.approvedMinutes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
