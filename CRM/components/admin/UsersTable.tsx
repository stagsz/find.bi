'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { updateUserRole, type UserRole } from '@/app/admin/actions'

interface User {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'user'
  created_at: string
}

interface UsersTableProps {
  users: User[]
  currentUserId: string
  searchParams: {
    search?: string
    role?: string
    sort?: string
    order?: 'asc' | 'desc'
  }
}

export default function UsersTable({ users, currentUserId, searchParams }: UsersTableProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)

  const [search, setSearch] = useState(searchParams.search || '')
  const [roleFilter, setRoleFilter] = useState(searchParams.role || 'all')

  const updateURL = (updates: Record<string, string>) => {
    const newParams = new URLSearchParams(params.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== 'all') {
        newParams.set(key, value)
      } else {
        newParams.delete(key)
      }
    })

    startTransition(() => {
      router.push(`/admin?${newParams.toString()}`)
    })
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    updateURL({ search: value })
  }

  const handleRoleFilter = (value: string) => {
    setRoleFilter(value)
    updateURL({ role: value })
  }

  const handleSort = (column: string) => {
    const currentSort = searchParams.sort
    const currentOrder = searchParams.order || 'desc'

    let newOrder: 'asc' | 'desc' = 'asc'

    if (currentSort === column) {
      newOrder = currentOrder === 'asc' ? 'desc' : 'asc'
    }

    updateURL({ sort: column, order: newOrder })
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setRoleError(null)
    setIsUpdatingRole(userId)

    try {
      const result = await updateUserRole(userId, newRole)

      if (!result.success) {
        setRoleError(result.error || 'Failed to update role')
      }
    } catch {
      setRoleError('An unexpected error occurred')
    } finally {
      setIsUpdatingRole(null)
    }
  }

  const SortIcon = ({ column }: { column: string }) => {
    const isActive = searchParams.sort === column
    const order = searchParams.order || 'desc'

    if (!isActive) {
      return <span className="ml-1 text-gray-400">&#8645;</span>
    }

    return (
      <span className="ml-1 text-blue-600 dark:text-blue-400">
        {order === 'asc' ? '\u2191' : '\u2193'}
      </span>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      {/* Error Banner */}
      {roleError && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700 dark:text-red-300">{roleError}</p>
            <button
              onClick={() => setRoleError(null)}
              className="text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
            >
              <span className="sr-only">Dismiss</span>
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <input
              type="text"
              id="search"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Name or email..."
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
            />
          </div>

          {/* Role Filter */}
          <div className="sm:w-48">
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              id="role"
              value={roleFilter}
              onChange={(e) => handleRoleFilter(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                onClick={() => handleSort('full_name')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                User <SortIcon column="full_name" />
              </th>
              <th
                onClick={() => handleSort('email')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Email <SortIcon column="email" />
              </th>
              <th
                onClick={() => handleSort('role')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Role <SortIcon column="role" />
              </th>
              <th
                onClick={() => handleSort('created_at')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Created <SortIcon column="created_at" />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {isPending && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isPending && users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No users found. Try adjusting your search or filters.
                </td>
              </tr>
            )}
            {!isPending && users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.full_name || 'No name'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-gray-100">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.id === currentUserId ? (
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      user.role === 'admin'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                    }`}>
                      {user.role}
                      <span className="ml-1 text-gray-400">(you)</span>
                    </span>
                  ) : (
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                      disabled={isUpdatingRole === user.id}
                      className={`px-2 py-1 text-xs font-semibold rounded border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${
                        user.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                      } ${isUpdatingRole === user.id ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
