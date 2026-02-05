'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

interface UserFilterSelectClientProps {
  users: { id: string; email: string; full_name?: string | null }[]
  currentValue: string
}

export default function UserFilterSelectClient({ users, currentValue }: UserFilterSelectClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value === 'all') {
      params.delete('user')
    } else {
      params.set('user', value)
    }

    startTransition(() => {
      const query = params.toString()
      router.push(query ? `/admin/time-report?${query}` : '/admin/time-report')
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className={`px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          isPending ? 'opacity-50 cursor-wait' : ''
        }`}
      >
        <option value="all">All Users</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.full_name || user.email}
          </option>
        ))}
      </select>
      {isPending && (
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      )}
    </div>
  )
}
