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

/**
 * Payload for creating a new project.
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  organization: string;
}

/**
 * Create a new project.
 * The project is created with 'planning' status and the creator is set as the owner.
 *
 * @param userId - The ID of the user creating the project
 * @param data - Project creation data
 * @returns The created project with creator information
 * @throws Error with code '23505' if project name already exists in the organization
 */
export async function createProject(
  userId: string,
  data: CreateProjectData
): Promise<ProjectWithCreator> {
  const pool = getPool();

  // Insert the new project with default status 'planning'
  const result = await pool.query<ProjectRow>(
    `INSERT INTO hazop.projects
       (name, description, status, created_by_id, organization)
     VALUES ($1, $2, 'planning', $3, $4)
     RETURNING id, name, description, status, created_by_id, organization, created_at, updated_at`,
    [data.name, data.description ?? '', userId, data.organization]
  );

  const row = result.rows[0];

  // Fetch the project with creator info
  const projectWithCreator = await findProjectById(row.id);
  if (!projectWithCreator) {
    throw new Error('Failed to fetch created project');
  }

  return projectWithCreator;
}

/**
 * Payload for updating a project.
 * All fields are optional - only provided fields are updated.
 */
export interface UpdateProjectData {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

/**
 * Payload for adding a member to a project.
 */
export interface AddProjectMemberData {
  userId: string;
  role: ProjectMemberRole;
}

/**
 * Project member row from the database.
 */
export interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  joined_at: Date;
  user_name: string;
  user_email: string;
}

/**
 * Project member with user details (API response format).
 */
export interface ProjectMemberWithUser {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  joinedAt: Date;
  userName: string;
  userEmail: string;
}

/**
 * Convert a database row to a ProjectMemberWithUser object.
 */
function rowToProjectMemberWithUser(row: ProjectMemberRow): ProjectMemberWithUser {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    userName: row.user_name,
    userEmail: row.user_email,
  };
}

/**
 * Update a project by ID.
 * Only updates the fields provided in the data object.
 *
 * @param projectId - The ID of the project to update
 * @param data - Update data (name, description, status - all optional)
 * @returns The updated project with creator information
 * @throws Error with code '23505' if name conflicts with existing project in organization
 */
export async function updateProject(
  projectId: string,
  data: UpdateProjectData
): Promise<ProjectWithCreator | null> {
  const pool = getPool();

  // Build dynamic SET clause based on provided fields
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIndex}`);
    values.push(data.name);
    paramIndex++;
  }

  if (data.description !== undefined) {
    setClauses.push(`description = $${paramIndex}`);
    values.push(data.description);
    paramIndex++;
  }

  if (data.status !== undefined) {
    setClauses.push(`status = $${paramIndex}`);
    values.push(data.status);
    paramIndex++;
  }

  // If no fields to update, just return the existing project
  if (setClauses.length === 0) {
    return findProjectById(projectId);
  }

  // Add project ID as the last parameter
  values.push(projectId);

  const result = await pool.query<ProjectRow>(
    `UPDATE hazop.projects
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, name, description, status, created_by_id, organization, created_at, updated_at`,
    values
  );

  if (!result.rows[0]) {
    return null;
  }

  // Fetch the updated project with creator info
  return findProjectById(result.rows[0].id);
}

/**
 * Check if a user exists by ID.
 *
 * @param userId - The user ID to check
 * @returns True if the user exists, false otherwise
 */
export async function userExists(userId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hazop.users WHERE id = $1) AS exists`,
    [userId]
  );
  return result.rows[0]?.exists ?? false;
}

/**
 * Check if a user is already a member of a project.
 *
 * @param projectId - The project ID
 * @param userId - The user ID
 * @returns True if the user is already a member, false otherwise
 */
export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM hazop.project_members
       WHERE project_id = $1 AND user_id = $2
     ) AS exists`,
    [projectId, userId]
  );
  return result.rows[0]?.exists ?? false;
}

/**
 * Add a member to a project.
 * Creates a new membership record in the project_members table.
 *
 * @param projectId - The ID of the project
 * @param data - Member data (userId and role)
 * @returns The created member with user details
 * @throws Error with code '23505' if user is already a member (unique constraint violation)
 * @throws Error with code '23503' if user or project doesn't exist (foreign key violation)
 */
export async function addProjectMember(
  projectId: string,
  data: AddProjectMemberData
): Promise<ProjectMemberWithUser> {
  const pool = getPool();

  // Insert the new member
  const result = await pool.query<ProjectMemberRow>(
    `INSERT INTO hazop.project_members (project_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING
       id,
       project_id,
       user_id,
       role,
       joined_at,
       (SELECT name FROM hazop.users WHERE id = $2) AS user_name,
       (SELECT email FROM hazop.users WHERE id = $2) AS user_email`,
    [projectId, data.userId, data.role]
  );

  return rowToProjectMemberWithUser(result.rows[0]);
}
