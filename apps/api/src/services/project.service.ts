/**
 * Project service for database operations.
 *
 * Handles project CRUD operations, membership queries, and pagination.
 * Users can see projects where they are the creator or a member.
 */

import { getPool } from '../config/database.config.js';
import type { ProjectStatus, ProjectMemberRole } from '@hazop/types';

/**
 * Project row from the database.
 * Uses snake_case column names matching PostgreSQL schema.
 */
export interface ProjectRow {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  created_by_id: string;
  organization: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Project row with creator info joined from users table.
 */
export interface ProjectRowWithCreator extends ProjectRow {
  created_by_name: string;
  created_by_email: string;
}

/**
 * Project row with membership info and creator details.
 */
export interface ProjectRowWithMembership extends ProjectRowWithCreator {
  member_role: ProjectMemberRole | null;
}

/**
 * Project object (API response format).
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdById: string;
  organization: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Project with creator information (for display purposes).
 */
export interface ProjectWithCreator extends Project {
  createdByName: string;
  createdByEmail: string;
}

/**
 * Project with creator and membership info.
 */
export interface ProjectWithMembership extends ProjectWithCreator {
  memberRole: ProjectMemberRole | null;
}

/**
 * Convert a database row to a Project object.
 * Maps snake_case columns to camelCase properties.
 */
function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdById: row.created_by_id,
    organization: row.organization,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert a database row with creator info to ProjectWithCreator object.
 */
function rowToProjectWithCreator(row: ProjectRowWithCreator): ProjectWithCreator {
  return {
    ...rowToProject(row),
    createdByName: row.created_by_name,
    createdByEmail: row.created_by_email,
  };
}

/**
 * Convert a database row with membership info to ProjectWithMembership object.
 */
function rowToProjectWithMembership(row: ProjectRowWithMembership): ProjectWithMembership {
  return {
    ...rowToProjectWithCreator(row),
    memberRole: row.member_role,
  };
}

/**
 * Filter options for listing projects.
 */
export interface ListProjectsFilters {
  /** Filter by project status */
  status?: ProjectStatus;
  /** Filter by organization */
  organization?: string;
  /** Search query for name or description */
  search?: string;
}

/**
 * Pagination options for listing projects.
 */
export interface ListProjectsPagination {
  /** Page number (1-based). Defaults to 1. */
  page?: number;
  /** Number of items per page. Defaults to 20, max 100. */
  limit?: number;
  /** Field to sort by. Defaults to 'created_at'. */
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'status';
  /** Sort direction. Defaults to 'desc'. */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Result from listing projects.
 */
export interface ListProjectsResult {
  /** Array of projects with membership info */
  projects: ProjectWithMembership[];
  /** Total number of projects matching the filters */
  total: number;
}

/**
 * List projects for a user with optional filtering and pagination.
 * Returns projects where the user is either the creator or a member.
 *
 * @param userId - The ID of the user requesting the projects
 * @param filters - Optional filters (status, organization, search)
 * @param pagination - Optional pagination options
 * @returns Paginated list of projects with membership info
 */
export async function listUserProjects(
  userId: string,
  filters?: ListProjectsFilters,
  pagination?: ListProjectsPagination
): Promise<ListProjectsResult> {
  const pool = getPool();

  // Build WHERE clause - base condition: user is creator OR member
  const whereClauses: string[] = [
    '(p.created_by_id = $1 OR pm.user_id = $1)',
  ];
  const values: unknown[] = [userId];
  let paramIndex = 2;

  // Filter by status
  if (filters?.status) {
    whereClauses.push(`p.status = $${paramIndex}`);
    values.push(filters.status);
    paramIndex++;
  }

  // Filter by organization
  if (filters?.organization) {
    whereClauses.push(`p.organization = $${paramIndex}`);
    values.push(filters.organization);
    paramIndex++;
  }

  // Search by name or description
  if (filters?.search) {
    whereClauses.push(
      `(LOWER(p.name) LIKE $${paramIndex} OR LOWER(p.description) LIKE $${paramIndex})`
    );
    values.push(`%${filters.search.toLowerCase()}%`);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Pagination
  const page = Math.max(pagination?.page ?? 1, 1);
  const limit = Math.min(Math.max(pagination?.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;

  // Sorting - use allowlist to prevent SQL injection
  const allowedSortFields = ['created_at', 'updated_at', 'name', 'status'];
  const sortBy = allowedSortFields.includes(pagination?.sortBy ?? '')
    ? pagination!.sortBy
    : 'created_at';
  // Prefix with p. for the projects table
  const sortColumn = `p.${sortBy}`;
  const sortOrder = pagination?.sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Get total count using DISTINCT since a user might be both creator and member
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(DISTINCT p.id) as count
     FROM hazop.projects p
     LEFT JOIN hazop.project_members pm ON p.id = pm.project_id
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated projects with creator info and membership role
  // Use LEFT JOIN to include projects where user is creator but not explicitly a member
  // Use COALESCE to get the membership role, checking both direct membership and owner status
  const projectsResult = await pool.query<ProjectRowWithMembership>(
    `SELECT DISTINCT ON (p.id)
       p.id,
       p.name,
       p.description,
       p.status,
       p.created_by_id,
       p.organization,
       p.created_at,
       p.updated_at,
       u.name AS created_by_name,
       u.email AS created_by_email,
       CASE
         WHEN p.created_by_id = $1 THEN COALESCE(pm_user.role, 'owner'::hazop.project_member_role)
         ELSE pm_user.role
       END AS member_role
     FROM hazop.projects p
     INNER JOIN hazop.users u ON p.created_by_id = u.id
     LEFT JOIN hazop.project_members pm ON p.id = pm.project_id
     LEFT JOIN hazop.project_members pm_user ON p.id = pm_user.project_id AND pm_user.user_id = $1
     ${whereClause}
     ORDER BY p.id, ${sortColumn} ${sortOrder}`,
    values
  );

  // Re-sort since DISTINCT ON requires its own ORDER BY first
  const sortedProjects = await pool.query<ProjectRowWithMembership>(
    `SELECT DISTINCT ON (p.id)
       p.id,
       p.name,
       p.description,
       p.status,
       p.created_by_id,
       p.organization,
       p.created_at,
       p.updated_at,
       u.name AS created_by_name,
       u.email AS created_by_email,
       CASE
         WHEN p.created_by_id = $1 THEN COALESCE(pm_user.role, 'owner'::hazop.project_member_role)
         ELSE pm_user.role
       END AS member_role
     FROM hazop.projects p
     INNER JOIN hazop.users u ON p.created_by_id = u.id
     LEFT JOIN hazop.project_members pm ON p.id = pm.project_id
     LEFT JOIN hazop.project_members pm_user ON p.id = pm_user.project_id AND pm_user.user_id = $1
     ${whereClause}
     ORDER BY p.id`,
    values
  );

  // Sort in application layer and paginate
  const allProjects = sortedProjects.rows.map(rowToProjectWithMembership);

  // Sort the projects
  allProjects.sort((a, b) => {
    let comparison = 0;
    const fieldMap: Record<string, keyof ProjectWithMembership> = {
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      name: 'name',
      status: 'status',
    };
    const field = fieldMap[sortBy ?? 'created_at'] ?? 'createdAt';
    const aVal = a[field];
    const bVal = b[field];

    if (aVal instanceof Date && bVal instanceof Date) {
      comparison = aVal.getTime() - bVal.getTime();
    } else if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    }

    return sortOrder === 'ASC' ? comparison : -comparison;
  });

  // Apply pagination
  const paginatedProjects = allProjects.slice(offset, offset + limit);

  return { projects: paginatedProjects, total };
}

/**
 * Find a project by ID.
 * Returns null if project not found.
 */
export async function findProjectById(id: string): Promise<ProjectWithCreator | null> {
  const pool = getPool();
  const result = await pool.query<ProjectRowWithCreator>(
    `SELECT
       p.id,
       p.name,
       p.description,
       p.status,
       p.created_by_id,
       p.organization,
       p.created_at,
       p.updated_at,
       u.name AS created_by_name,
       u.email AS created_by_email
     FROM hazop.projects p
     INNER JOIN hazop.users u ON p.created_by_id = u.id
     WHERE p.id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToProjectWithCreator(result.rows[0]);
}

/**
 * Check if a user has access to a project.
 * Returns true if the user is the creator or a member of the project.
 */
export async function userHasProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ has_access: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM hazop.projects p
       LEFT JOIN hazop.project_members pm ON p.id = pm.project_id
       WHERE p.id = $1 AND (p.created_by_id = $2 OR pm.user_id = $2)
     ) AS has_access`,
    [projectId, userId]
  );
  return result.rows[0]?.has_access ?? false;
}

/**
 * Get a user's role in a project.
 * Returns 'owner' if the user is the creator, the membership role if a member,
 * or null if the user has no access.
 */
export async function getUserProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectMemberRole | null> {
  const pool = getPool();
  const result = await pool.query<{ role: ProjectMemberRole | null }>(
    `SELECT
       CASE
         WHEN p.created_by_id = $1 THEN COALESCE(pm.role, 'owner'::hazop.project_member_role)
         ELSE pm.role
       END AS role
     FROM hazop.projects p
     LEFT JOIN hazop.project_members pm ON p.id = pm.project_id AND pm.user_id = $1
     WHERE p.id = $2 AND (p.created_by_id = $1 OR pm.user_id = $1)`,
    [userId, projectId]
  );
  return result.rows[0]?.role ?? null;
}
