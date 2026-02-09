import type { User, UserRole, ApiResult, PaginationMeta } from '@hazop/types';
import { api } from './api.client';

/**
 * Response type for listing users.
 */
export interface ListUsersResponse {
  data: User[];
  meta: PaginationMeta;
}

/**
 * Response type for updating a user.
 */
interface UpdateUserResponse {
  user: User;
}

/**
 * Filter options for listing users.
 */
export interface ListUsersFilters {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * Sort options for listing users.
 */
export interface ListUsersSortOptions {
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'email' | 'role';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination options for listing users.
 */
export interface ListUsersPagination {
  page?: number;
  limit?: number;
}

/**
 * Build query string from filter, sort, and pagination options.
 */
function buildQueryString(
  filters: ListUsersFilters,
  sort: ListUsersSortOptions,
  pagination: ListUsersPagination
): string {
  const params = new URLSearchParams();

  if (pagination.page !== undefined) {
    params.set('page', String(pagination.page));
  }
  if (pagination.limit !== undefined) {
    params.set('limit', String(pagination.limit));
  }
  if (sort.sortBy) {
    params.set('sortBy', sort.sortBy);
  }
  if (sort.sortOrder) {
    params.set('sortOrder', sort.sortOrder);
  }
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.role) {
    params.set('role', filters.role);
  }
  if (filters.isActive !== undefined) {
    params.set('isActive', String(filters.isActive));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Admin service for handling administrator operations.
 *
 * This service provides methods for:
 * - Listing all users with search/filter/pagination
 * - Changing user roles
 * - Activating/deactivating users
 */
export const adminService = {
  /**
   * List all users with optional filtering, sorting, and pagination.
   *
   * @param filters - Filter options (search, role, isActive)
   * @param sort - Sort options (sortBy, sortOrder)
   * @param pagination - Pagination options (page, limit)
   * @returns Promise resolving to the API result with user list and metadata
   */
  async listUsers(
    filters: ListUsersFilters = {},
    sort: ListUsersSortOptions = {},
    pagination: ListUsersPagination = {}
  ): Promise<ApiResult<ListUsersResponse>> {
    const queryString = buildQueryString(filters, sort, pagination);
    const result = await api.get<ListUsersResponse>(`/admin/users${queryString}`);

    // The API returns { success, data: User[], meta } but we need { data: User[], meta }
    if (result.success && result.data) {
      return {
        success: true,
        data: {
          data: result.data as unknown as User[],
          meta: result.meta!,
        },
      };
    }

    return result as ApiResult<ListUsersResponse>;
  },

  /**
   * Change a user's role.
   *
   * @param userId - The ID of the user to update
   * @param role - The new role to assign
   * @returns Promise resolving to the API result with updated user
   */
  async changeUserRole(userId: string, role: UserRole): Promise<ApiResult<UpdateUserResponse>> {
    return api.put<UpdateUserResponse>(`/admin/users/${userId}/role`, { role });
  },

  /**
   * Change a user's active status.
   *
   * @param userId - The ID of the user to update
   * @param isActive - The new active status
   * @returns Promise resolving to the API result with updated user
   */
  async changeUserStatus(userId: string, isActive: boolean): Promise<ApiResult<UpdateUserResponse>> {
    return api.put<UpdateUserResponse>(`/admin/users/${userId}/status`, { isActive });
  },
};
