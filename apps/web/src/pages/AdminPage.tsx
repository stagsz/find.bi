import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button, TextInput, Select, Table, Alert, Pagination, Modal } from '@mantine/core';
import { useAuthStore, selectUser } from '../store/auth.store';
import {
  adminService,
  type ListUsersFilters,
  type ListUsersSortOptions,
} from '../services/admin.service';
import type { User, UserRole, ApiError } from '@hazop/types';
import { TableRowSkeleton } from '../components/skeletons';

/**
 * Role display labels mapping.
 */
const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrator',
  lead_analyst: 'Lead Analyst',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

/**
 * Role options for the filter dropdown.
 */
const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'lead_analyst', label: 'Lead Analyst' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'viewer', label: 'Viewer' },
];

/**
 * Status options for the filter dropdown.
 */
const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

/**
 * Sort options for the table.
 */
const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'created_at:asc', label: 'Oldest First' },
  { value: 'name:asc', label: 'Name (A-Z)' },
  { value: 'name:desc', label: 'Name (Z-A)' },
  { value: 'email:asc', label: 'Email (A-Z)' },
  { value: 'email:desc', label: 'Email (Z-A)' },
];

/**
 * Role options for the role editor modal (no "All Roles" option).
 */
const ROLE_EDITOR_OPTIONS = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'lead_analyst', label: 'Lead Analyst' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'viewer', label: 'Viewer' },
];

/**
 * Admin page for managing users.
 *
 * Features:
 * - Paginated user list in a data table
 * - Search by name or email
 * - Filter by role and status
 * - Sort by various fields
 * - Quick status toggle (activate/deactivate)
 *
 * Role editing is handled by a separate modal (ADMIN-05).
 */
export function AdminPage() {
  const currentUser = useAuthStore(selectUser);

  // User list state
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Sort state
  const [sortValue, setSortValue] = useState('created_at:desc');

  // Status update state
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Role editor modal state
  const [roleModalUser, setRoleModalUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  /**
   * Debounce search query.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * Fetch users from the API.
   */
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setError(null);

    const filters: ListUsersFilters = {};
    if (debouncedSearch) {
      filters.search = debouncedSearch;
    }
    if (roleFilter) {
      filters.role = roleFilter as UserRole;
    }
    if (statusFilter) {
      filters.isActive = statusFilter === 'true';
    }

    const [sortBy, sortOrder] = sortValue.split(':') as [
      ListUsersSortOptions['sortBy'],
      ListUsersSortOptions['sortOrder'],
    ];

    const result = await adminService.listUsers(filters, { sortBy, sortOrder }, { page, limit });

    if (result.success && result.data) {
      setUsers(result.data.data);
      setTotalPages(result.data.meta.totalPages);
      setTotal(result.data.meta.total);
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to load users' });
    }

    setIsLoadingUsers(false);
  }, [page, debouncedSearch, roleFilter, statusFilter, sortValue]);

  /**
   * Load users on mount and when filters/pagination change.
   */
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /**
   * Toggle user active status.
   */
  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUser?.id) {
      return;
    }

    setUpdatingUserId(user.id);
    const result = await adminService.changeUserStatus(user.id, !user.isActive);

    if (result.success && result.data) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? result.data!.user : u))
      );
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to update user status' });
    }

    setUpdatingUserId(null);
  };

  /**
   * Format date for display.
   */
  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * Reset filters.
   */
  const handleResetFilters = () => {
    setSearchQuery('');
    setRoleFilter('');
    setStatusFilter('');
    setSortValue('created_at:desc');
    setPage(1);
  };

  /**
   * Open the role editor modal for a user.
   */
  const handleOpenRoleModal = (user: User) => {
    setRoleModalUser(user);
    setSelectedRole(user.role);
  };

  /**
   * Close the role editor modal.
   */
  const handleCloseRoleModal = () => {
    setRoleModalUser(null);
    setSelectedRole(null);
  };

  /**
   * Submit the role change.
   */
  const handleChangeRole = async () => {
    if (!roleModalUser || !selectedRole) {
      return;
    }

    // Don't submit if role hasn't changed
    if (selectedRole === roleModalUser.role) {
      handleCloseRoleModal();
      return;
    }

    setIsUpdatingRole(true);
    const result = await adminService.changeUserRole(roleModalUser.id, selectedRole);

    if (result.success && result.data) {
      setUsers((prev) =>
        prev.map((u) => (u.id === roleModalUser.id ? result.data!.user : u))
      );
      handleCloseRoleModal();
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to update user role' });
    }

    setIsUpdatingRole(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link to="/" className="text-sm text-blue-700 hover:text-blue-800">
            Dashboard
          </Link>
          <span className="text-sm text-slate-400 mx-2">/</span>
          <span className="text-sm text-slate-600">User Management</span>
        </nav>

        <div className="bg-white rounded border border-slate-200">
          {/* Page header */}
          <div className="px-6 py-4 border-b border-slate-200">
            <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage user accounts, roles, and access status
            </p>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px] max-w-[300px]">
                <TextInput
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  styles={{
                    input: {
                      borderRadius: '4px',
                      '&:focus': {
                        borderColor: '#1e40af',
                      },
                    },
                  }}
                />
              </div>

              <div className="w-[160px]">
                <Select
                  placeholder="Filter by role"
                  data={ROLE_OPTIONS}
                  value={roleFilter}
                  onChange={(value) => {
                    setRoleFilter(value || '');
                    setPage(1);
                  }}
                  clearable={false}
                  styles={{
                    input: {
                      borderRadius: '4px',
                      '&:focus': {
                        borderColor: '#1e40af',
                      },
                    },
                  }}
                />
              </div>

              <div className="w-[140px]">
                <Select
                  placeholder="Filter by status"
                  data={STATUS_OPTIONS}
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value || '');
                    setPage(1);
                  }}
                  clearable={false}
                  styles={{
                    input: {
                      borderRadius: '4px',
                      '&:focus': {
                        borderColor: '#1e40af',
                      },
                    },
                  }}
                />
              </div>

              <div className="w-[160px]">
                <Select
                  placeholder="Sort by"
                  data={SORT_OPTIONS}
                  value={sortValue}
                  onChange={(value) => {
                    setSortValue(value || 'created_at:desc');
                    setPage(1);
                  }}
                  clearable={false}
                  styles={{
                    input: {
                      borderRadius: '4px',
                      '&:focus': {
                        borderColor: '#1e40af',
                      },
                    },
                  }}
                />
              </div>

              <Button
                variant="subtle"
                color="gray"
                onClick={handleResetFilters}
                styles={{
                  root: {
                    borderRadius: '4px',
                  },
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Error alert */}
          {error && (
            <div className="px-6 py-4">
              <Alert
                color="red"
                variant="light"
                styles={{
                  root: { borderRadius: '4px' },
                }}
                onClose={() => setError(null)}
                withCloseButton
              >
                {error.message}
              </Alert>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr className="bg-slate-50">
                  <Table.Th className="font-medium text-slate-700">Name</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Email</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Organization</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Role</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Status</Table.Th>
                  <Table.Th className="font-medium text-slate-700">Created</Table.Th>
                  <Table.Th className="font-medium text-slate-700 text-right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoadingUsers ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRowSkeleton
                      key={index}
                      columns={7}
                      showActions
                      columnWidths={['wide', 'wide', 'medium', 'medium', 'narrow', 'medium', 'medium']}
                    />
                  ))
                ) : users.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7} className="text-center py-8 text-slate-500">
                      No users found
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  users.map((user) => (
                    <Table.Tr key={user.id}>
                      <Table.Td className="font-medium text-slate-900">
                        {user.name}
                        {user.id === currentUser?.id && (
                          <span className="ml-2 text-xs text-slate-400">(you)</span>
                        )}
                      </Table.Td>
                      <Table.Td className="text-slate-600">{user.email}</Table.Td>
                      <Table.Td className="text-slate-600">{user.organization || '-'}</Table.Td>
                      <Table.Td>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {ROLE_LABELS[user.role]}
                        </span>
                      </Table.Td>
                      <Table.Td>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                            user.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </Table.Td>
                      <Table.Td className="text-slate-500 text-sm">
                        {formatDate(user.createdAt)}
                      </Table.Td>
                      <Table.Td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="subtle"
                            size="xs"
                            color="blue"
                            onClick={() => handleOpenRoleModal(user)}
                            disabled={user.id === currentUser?.id}
                            styles={{
                              root: {
                                borderRadius: '4px',
                              },
                            }}
                          >
                            Edit Role
                          </Button>
                          <Button
                            variant="subtle"
                            size="xs"
                            color={user.isActive ? 'red' : 'green'}
                            onClick={() => handleToggleStatus(user)}
                            loading={updatingUserId === user.id}
                            disabled={user.id === currentUser?.id}
                            styles={{
                              root: {
                                borderRadius: '4px',
                              },
                            }}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} users
              </div>
              <Pagination
                value={page}
                onChange={setPage}
                total={totalPages}
                boundaries={1}
                siblings={1}
                styles={{
                  control: {
                    borderRadius: '4px',
                    '&[data-active]': {
                      backgroundColor: '#1e40af',
                    },
                  },
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* Role Editor Modal */}
      <Modal
        opened={roleModalUser !== null}
        onClose={handleCloseRoleModal}
        title={
          <span className="font-semibold text-slate-900">
            Edit User Role
          </span>
        }
        centered
        styles={{
          content: {
            borderRadius: '4px',
          },
          header: {
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '12px',
          },
        }}
      >
        {roleModalUser && (
          <div className="mt-4">
            <div className="mb-4">
              <p className="text-sm text-slate-600">
                Change role for <span className="font-medium text-slate-900">{roleModalUser.name}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">{roleModalUser.email}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Role
              </label>
              <Select
                data={ROLE_EDITOR_OPTIONS}
                value={selectedRole}
                onChange={(value) => setSelectedRole(value as UserRole)}
                styles={{
                  input: {
                    borderRadius: '4px',
                    '&:focus': {
                      borderColor: '#1e40af',
                    },
                  },
                }}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="subtle"
                color="gray"
                onClick={handleCloseRoleModal}
                disabled={isUpdatingRole}
                styles={{
                  root: {
                    borderRadius: '4px',
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleChangeRole}
                loading={isUpdatingRole}
                disabled={selectedRole === roleModalUser.role}
                styles={{
                  root: {
                    borderRadius: '4px',
                    backgroundColor: '#1e40af',
                    '&:hover': {
                      backgroundColor: '#1e3a8a',
                    },
                  },
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
