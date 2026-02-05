'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ContactHours {
  contactId: string
  name: string
  company: string | null
  totalMinutes: number
}

interface ContactHoursTableProps {
  contacts: ContactHours[]
}

type SortField = 'name' | 'company' | 'totalMinutes'
type SortOrder = 'asc' | 'desc'

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export default function ContactHoursTable({ contacts }: ContactHoursTableProps) {
  const [sortField, setSortField] = useState<SortField>('totalMinutes')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'name' || field === 'company' ? 'asc' : 'desc')
    }
  }

  const sortedContacts = [...contacts].sort((a, b) => {
    let comparison: number
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name)
    } else if (sortField === 'company') {
      comparison = (a.company || '').localeCompare(b.company || '')
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

  if (contacts.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No time entries linked to contacts yet.</p>
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
              Contact <SortIcon field="name" />
            </th>
            <th
              onClick={() => handleSort('company')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none"
            >
              Company <SortIcon field="company" />
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
          {sortedContacts.map((contact) => (
            <tr key={contact.contactId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-4 py-3 whitespace-nowrap">
                <Link
                  href={`/contacts/${contact.contactId}`}
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {contact.name}
                </Link>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {contact.company || '\u2014'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatDuration(contact.totalMinutes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
