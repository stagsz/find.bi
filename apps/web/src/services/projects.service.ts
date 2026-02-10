import type {
  ProjectWithCreator,
  ProjectStatus,
  ProjectMemberRole,
  ProjectMemberWithUser,
  ApiResult,
  PaginationMeta,
} from '@hazop/types';
import { api } from './api.client';

/**
 * Project item in list response with additional user context.
 */
export interface ProjectListItem extends ProjectWithCreator {
  /** User's role in this project (null if only creator without explicit membership) */
  memberRole: ProjectMemberRole | null;
}

/**
 * Response type for listing projects.
 */
export interface ListProjectsResponse {
  data: ProjectListItem[];
  meta: PaginationMeta;
}

/**
 * Response type for creating a project.
 */
export interface CreateProjectResponse {
  project: ProjectWithCreator;
}

/**
 * Response type for getting a single project.
 */
export interface GetProjectResponse {
  project: ProjectListItem;
}

/**
 * Response type for listing project members.
 */
export interface ListMembersResponse {
  members: ProjectMemberWithUser[];
}

/**
 * Response type for adding a project member.
 */
export interface AddMemberResponse {
  member: ProjectMemberWithUser;
}

/**
 * Filter options for listing projects.
 */
export interface ListProjectsFilters {
  search?: string;
  status?: ProjectStatus;
  organization?: string;
}

/**
 * Sort options for listing projects.
 */
export interface ListProjectsSortOptions {
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination options for listing projects.
 */
export interface ListProjectsPagination {
  page?: number;
  limit?: number;
}

/**
 * Build query string from filter, sort, and pagination options.
 */
function buildQueryString(
  filters: ListProjectsFilters,
  sort: ListProjectsSortOptions,
  pagination: ListProjectsPagination
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
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.organization) {
    params.set('organization', filters.organization);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Projects service for handling project-related API operations.
 *
 * This service provides methods for:
 * - Listing user's projects with search/filter/pagination
 * - Creating new projects
 * - Getting project details
 * - Updating projects
 * - Archiving projects
 */
export const projectsService = {
  /**
   * List user's projects with optional filtering, sorting, and pagination.
   *
   * @param filters - Filter options (search, status, organization)
   * @param sort - Sort options (sortBy, sortOrder)
   * @param pagination - Pagination options (page, limit)
   * @returns Promise resolving to the API result with project list and metadata
   */
  async listProjects(
    filters: ListProjectsFilters = {},
    sort: ListProjectsSortOptions = {},
    pagination: ListProjectsPagination = {}
  ): Promise<ApiResult<ListProjectsResponse>> {
    const queryString = buildQueryString(filters, sort, pagination);
    const result = await api.get<ListProjectsResponse>(`/projects${queryString}`);

    // The API returns { success, data: Project[], meta } but we need { data: Project[], meta }
    if (result.success && result.data) {
      return {
        success: true,
        data: {
          data: result.data as unknown as ProjectListItem[],
          meta: result.meta!,
        },
      };
    }

    return result as ApiResult<ListProjectsResponse>;
  },

  /**
   * Get a single project by ID.
   *
   * @param projectId - The ID of the project to retrieve
   * @returns Promise resolving to the API result with project details
   */
  async getProject(projectId: string): Promise<ApiResult<GetProjectResponse>> {
    return api.get<GetProjectResponse>(`/projects/${projectId}`);
  },

  /**
   * Create a new project.
   *
   * @param name - Project name
   * @param description - Optional project description
   * @returns Promise resolving to the API result with created project
   */
  async createProject(
    name: string,
    description?: string
  ): Promise<ApiResult<CreateProjectResponse>> {
    return api.post<CreateProjectResponse>('/projects', { name, description });
  },

  /**
   * Update a project.
   *
   * @param projectId - The ID of the project to update
   * @param data - Update data (name, description, status)
   * @returns Promise resolving to the API result with updated project
   */
  async updateProject(
    projectId: string,
    data: { name?: string; description?: string; status?: ProjectStatus }
  ): Promise<ApiResult<GetProjectResponse>> {
    return api.put<GetProjectResponse>(`/projects/${projectId}`, data);
  },

  /**
   * Archive (delete) a project.
   *
   * @param projectId - The ID of the project to archive
   * @returns Promise resolving to the API result
   */
  async archiveProject(projectId: string): Promise<ApiResult<{ message: string }>> {
    return api.delete<{ message: string }>(`/projects/${projectId}`);
  },

  /**
   * List project members.
   *
   * @param projectId - The ID of the project
   * @returns Promise resolving to the API result with members list
   */
  async listMembers(projectId: string): Promise<ApiResult<ListMembersResponse>> {
    return api.get<ListMembersResponse>(`/projects/${projectId}/members`);
  },

  /**
   * Add a member to a project.
   *
   * @param projectId - The ID of the project
   * @param userId - The ID of the user to add
   * @param role - The role for the new member
   * @returns Promise resolving to the API result with created member
   */
  async addMember(
    projectId: string,
    userId: string,
    role: ProjectMemberRole
  ): Promise<ApiResult<AddMemberResponse>> {
    return api.post<AddMemberResponse>(`/projects/${projectId}/members`, { userId, role });
  },

  /**
   * Remove a member from a project.
   *
   * @param projectId - The ID of the project
   * @param userId - The ID of the user to remove
   * @returns Promise resolving to the API result
   */
  async removeMember(projectId: string, userId: string): Promise<ApiResult<{ message: string }>> {
    return api.delete<{ message: string }>(`/projects/${projectId}/members/${userId}`);
  },
};
