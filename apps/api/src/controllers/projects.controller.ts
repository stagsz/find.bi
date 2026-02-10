/**
 * Projects controller for handling project operations.
 *
 * Handles:
 * - GET /projects - List user's projects with search/filter/pagination
 * - POST /projects - Create a new project
 * - GET /projects/:id - Get project details
 * - PUT /projects/:id - Update project
 * - DELETE /projects/:id - Archive project
 */

import type { Request, Response } from 'express';
import {
  listUserProjects,
  createProject as createProjectService,
  findProjectById as findProjectByIdService,
  updateProject as updateProjectService,
  userHasProjectAccess,
  getUserProjectRole,
  userExists,
  isProjectMember,
  addProjectMember as addProjectMemberService,
  removeProjectMember as removeProjectMemberService,
  getProjectCreatorId,
  listProjectMembers as listProjectMembersService,
} from '../services/project.service.js';
import type { ProjectStatus, ProjectMemberRole } from '@hazop/types';
import { PROJECT_STATUSES, PROJECT_MEMBER_ROLES } from '@hazop/types';

/**
 * Validation error for a specific field.
 */
interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Query parameters for listing projects.
 */
interface ListProjectsQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
  status?: string;
  organization?: string;
}

/**
 * Valid sort fields for projects.
 */
const validSortFields = ['created_at', 'updated_at', 'name', 'status'];

/**
 * Validate list projects query parameters.
 * Returns an array of field errors if validation fails.
 */
function validateListProjectsQuery(query: ListProjectsQuery): FieldError[] {
  const errors: FieldError[] = [];

  // Validate page
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) {
      errors.push({
        field: 'page',
        message: 'Page must be a positive integer',
        code: 'INVALID_VALUE',
      });
    }
  }

  // Validate limit
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({
        field: 'limit',
        message: 'Limit must be between 1 and 100',
        code: 'INVALID_VALUE',
      });
    }
  }

  // Validate sortBy
  if (query.sortBy !== undefined && !validSortFields.includes(query.sortBy)) {
    errors.push({
      field: 'sortBy',
      message: `sortBy must be one of: ${validSortFields.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // Validate sortOrder
  if (query.sortOrder !== undefined && !['asc', 'desc'].includes(query.sortOrder)) {
    errors.push({
      field: 'sortOrder',
      message: 'sortOrder must be "asc" or "desc"',
      code: 'INVALID_VALUE',
    });
  }

  // Validate status filter
  if (query.status !== undefined && !PROJECT_STATUSES.includes(query.status as ProjectStatus)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${PROJECT_STATUSES.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  return errors;
}

/**
 * GET /projects
 * List projects for the authenticated user with optional search, filter, and pagination.
 * Returns projects where the user is either the creator or a team member.
 *
 * Query parameters:
 * - page: number (1-based, default 1)
 * - limit: number (default 20, max 100)
 * - sortBy: 'created_at' | 'updated_at' | 'name' | 'status' (default 'created_at')
 * - sortOrder: 'asc' | 'desc' (default 'desc')
 * - search: string (searches name and description)
 * - status: ProjectStatus (filter by status)
 * - organization: string (filter by organization)
 *
 * Returns:
 * - 200: Paginated list of projects
 * - 400: Validation error
 * - 401: Not authenticated
 * - 500: Internal server error
 */
export async function listProjects(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query as ListProjectsQuery;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate query parameters
    const validationErrors = validateListProjectsQuery(query);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          errors: validationErrors,
        },
      });
      return;
    }

    // Parse query parameters
    const page = query.page ? parseInt(query.page, 10) : undefined;
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const sortBy = query.sortBy as 'created_at' | 'updated_at' | 'name' | 'status' | undefined;
    const sortOrder = query.sortOrder as 'asc' | 'desc' | undefined;
    const search = query.search;
    const status = query.status as ProjectStatus | undefined;
    const organization = query.organization;

    // Fetch projects
    const result = await listUserProjects(
      userId,
      { search, status, organization },
      { page, limit, sortBy, sortOrder }
    );

    // Calculate pagination metadata
    const currentPage = page ?? 1;
    const currentLimit = limit ?? 20;
    const totalPages = Math.ceil(result.total / currentLimit);

    res.status(200).json({
      success: true,
      data: result.projects,
      meta: {
        page: currentPage,
        limit: currentLimit,
        total: result.total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error('List projects error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * Request body for creating a project.
 */
interface CreateProjectBody {
  name?: unknown;
  description?: unknown;
}

/**
 * Validate create project request body.
 * Returns an array of field errors if validation fails.
 */
function validateCreateProjectRequest(body: CreateProjectBody): FieldError[] {
  const errors: FieldError[] = [];

  // Validate name (required, non-empty string, max 255 chars)
  if (body.name === undefined || body.name === null) {
    errors.push({
      field: 'name',
      message: 'Name is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Name must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (body.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Name cannot be empty',
      code: 'EMPTY',
    });
  } else if (body.name.length > 255) {
    errors.push({
      field: 'name',
      message: 'Name must be 255 characters or less',
      code: 'MAX_LENGTH',
    });
  }

  // Validate description (optional, but if provided must be string)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Description must be a string',
        code: 'INVALID_TYPE',
      });
    }
  }

  return errors;
}

/**
 * POST /projects
 * Create a new project for the authenticated user.
 * The project organization is automatically set from the user's profile.
 * The project status is set to 'planning' by default.
 *
 * Request body:
 * - name: string (required) - Project name
 * - description: string (optional) - Project description
 *
 * Returns:
 * - 201: Created project with creator info
 * - 400: Validation error
 * - 401: Not authenticated
 * - 409: Project name already exists in organization
 * - 500: Internal server error
 */
export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as CreateProjectBody;

    // Get authenticated user
    const user = req.user as { id: string; organization: string } | undefined;
    if (!user?.id) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate request body
    const validationErrors = validateCreateProjectRequest(body);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: validationErrors,
        },
      });
      return;
    }

    // Create the project using the user's organization
    const project = await createProjectService(user.id, {
      name: (body.name as string).trim(),
      description: typeof body.description === 'string' ? body.description : undefined,
      organization: user.organization,
    });

    res.status(201).json({
      success: true,
      data: { project },
    });
  } catch (error) {
    console.error('Create project error:', error);

    // Handle unique constraint violation (duplicate project name in organization)
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code: string };
      if (dbError.code === '23505') {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A project with this name already exists in your organization',
          },
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * GET /projects/:id
 * Get a project by ID.
 * Returns the project details with creator info and the user's role in the project.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Returns:
 * - 200: Project details with creator info and user's role
 * - 400: Invalid project ID format
 * - 401: Not authenticated
 * - 403: Not authorized to access this project
 * - 404: Project not found
 * - 500: Internal server error
 */
export async function getProjectById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project ID format',
          errors: [
            {
              field: 'id',
              message: 'Project ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Check if user has access to the project
    const hasAccess = await userHasProjectAccess(userId, id);
    if (!hasAccess) {
      // Check if project exists to return appropriate error
      const project = await findProjectByIdService(id);
      if (!project) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
        return;
      }

      // Project exists but user doesn't have access
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        },
      });
      return;
    }

    // Fetch project details
    const project = await findProjectByIdService(id);
    if (!project) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
      return;
    }

    // Get user's role in the project
    const userRole = await getUserProjectRole(userId, id);

    res.status(200).json({
      success: true,
      data: {
        project: {
          ...project,
          userRole,
        },
      },
    });
  } catch (error) {
    console.error('Get project by ID error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * Request body for updating a project.
 */
interface UpdateProjectBody {
  name?: unknown;
  description?: unknown;
  status?: unknown;
}

/**
 * Validate update project request body.
 * Returns an array of field errors if validation fails.
 * All fields are optional but must be valid if provided.
 */
function validateUpdateProjectRequest(body: UpdateProjectBody): FieldError[] {
  const errors: FieldError[] = [];

  // Validate name (optional, but if provided: non-empty string, max 255 chars)
  if (body.name !== undefined && body.name !== null) {
    if (typeof body.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Name must be a string',
        code: 'INVALID_TYPE',
      });
    } else if (body.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Name cannot be empty',
        code: 'EMPTY',
      });
    } else if (body.name.length > 255) {
      errors.push({
        field: 'name',
        message: 'Name must be 255 characters or less',
        code: 'MAX_LENGTH',
      });
    }
  }

  // Validate description (optional, but if provided must be string)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Description must be a string',
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate status (optional, but if provided must be a valid ProjectStatus)
  if (body.status !== undefined && body.status !== null) {
    if (typeof body.status !== 'string') {
      errors.push({
        field: 'status',
        message: 'Status must be a string',
        code: 'INVALID_TYPE',
      });
    } else if (!PROJECT_STATUSES.includes(body.status as ProjectStatus)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${PROJECT_STATUSES.join(', ')}`,
        code: 'INVALID_VALUE',
      });
    }
  }

  return errors;
}

/**
 * PUT /projects/:id
 * Update a project by ID.
 * Only the project creator or users with 'owner' or 'lead' role can update the project.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Request body:
 * - name: string (optional) - New project name
 * - description: string (optional) - New project description
 * - status: ProjectStatus (optional) - New project status
 *
 * Returns:
 * - 200: Updated project with creator info and user's role
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized to update this project
 * - 404: Project not found
 * - 409: Project name already exists in organization
 * - 500: Internal server error
 */
export async function updateProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as UpdateProjectBody;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project ID format',
          errors: [
            {
              field: 'id',
              message: 'Project ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate request body
    const validationErrors = validateUpdateProjectRequest(body);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: validationErrors,
        },
      });
      return;
    }

    // Check if user has access to the project
    const hasAccess = await userHasProjectAccess(userId, id);
    if (!hasAccess) {
      // Check if project exists to return appropriate error
      const project = await findProjectByIdService(id);
      if (!project) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
        return;
      }

      // Project exists but user doesn't have access
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        },
      });
      return;
    }

    // Get user's role - only owner and lead can update projects
    const userRole = await getUserProjectRole(userId, id);
    if (!userRole || !['owner', 'lead'].includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only project owners and leads can update project details',
        },
      });
      return;
    }

    // Build update data from validated fields
    const updateData: { name?: string; description?: string; status?: ProjectStatus } = {};
    if (typeof body.name === 'string') {
      updateData.name = body.name.trim();
    }
    if (typeof body.description === 'string') {
      updateData.description = body.description;
    }
    if (typeof body.status === 'string' && PROJECT_STATUSES.includes(body.status as ProjectStatus)) {
      updateData.status = body.status as ProjectStatus;
    }

    // Update the project
    const updatedProject = await updateProjectService(id, updateData);
    if (!updatedProject) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        project: {
          ...updatedProject,
          userRole,
        },
      },
    });
  } catch (error) {
    console.error('Update project error:', error);

    // Handle unique constraint violation (duplicate project name in organization)
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code: string };
      if (dbError.code === '23505') {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A project with this name already exists in your organization',
          },
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * DELETE /projects/:id
 * Archive a project by ID.
 * This endpoint sets the project status to 'archived' rather than permanently deleting it.
 * Only the project owner or users with 'lead' role can archive the project.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Returns:
 * - 200: Archived project with creator info and user's role
 * - 400: Invalid project ID format
 * - 401: Not authenticated
 * - 403: Not authorized to archive this project
 * - 404: Project not found
 * - 500: Internal server error
 */
export async function deleteProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project ID format',
          errors: [
            {
              field: 'id',
              message: 'Project ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Check if user has access to the project
    const hasAccess = await userHasProjectAccess(userId, id);
    if (!hasAccess) {
      // Check if project exists to return appropriate error
      const project = await findProjectByIdService(id);
      if (!project) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
        return;
      }

      // Project exists but user doesn't have access
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        },
      });
      return;
    }

    // Get user's role - only owner and lead can archive projects
    const userRole = await getUserProjectRole(userId, id);
    if (!userRole || !['owner', 'lead'].includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only project owners and leads can archive projects',
        },
      });
      return;
    }

    // Archive the project by setting status to 'archived'
    const archivedProject = await updateProjectService(id, { status: 'archived' });
    if (!archivedProject) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        project: {
          ...archivedProject,
          userRole,
        },
      },
    });
  } catch (error) {
    console.error('Delete project error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * Request body for adding a project member.
 */
interface AddMemberBody {
  userId?: unknown;
  role?: unknown;
}

/**
 * Validate add member request body.
 * Returns an array of field errors if validation fails.
 */
function validateAddMemberRequest(body: AddMemberBody): FieldError[] {
  const errors: FieldError[] = [];

  // Validate userId (required, must be a valid UUID)
  if (body.userId === undefined || body.userId === null) {
    errors.push({
      field: 'userId',
      message: 'User ID is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.userId !== 'string') {
    errors.push({
      field: 'userId',
      message: 'User ID must be a string',
      code: 'INVALID_TYPE',
    });
  } else {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.userId)) {
      errors.push({
        field: 'userId',
        message: 'User ID must be a valid UUID',
        code: 'INVALID_FORMAT',
      });
    }
  }

  // Validate role (optional, but if provided must be a valid ProjectMemberRole)
  // Note: 'owner' role cannot be assigned via this endpoint
  if (body.role !== undefined && body.role !== null) {
    if (typeof body.role !== 'string') {
      errors.push({
        field: 'role',
        message: 'Role must be a string',
        code: 'INVALID_TYPE',
      });
    } else if (!PROJECT_MEMBER_ROLES.includes(body.role as ProjectMemberRole)) {
      errors.push({
        field: 'role',
        message: `Role must be one of: ${PROJECT_MEMBER_ROLES.join(', ')}`,
        code: 'INVALID_VALUE',
      });
    } else if (body.role === 'owner') {
      errors.push({
        field: 'role',
        message: 'Cannot assign owner role via this endpoint',
        code: 'INVALID_VALUE',
      });
    }
  }

  return errors;
}

/**
 * POST /projects/:id/members
 * Add a user as a member to a project.
 * Only project owners and leads can add members.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Request body:
 * - userId: string (required) - User UUID to add
 * - role: ProjectMemberRole (optional) - Member role, defaults to 'member'
 *
 * Returns:
 * - 201: Created member with user info
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized to add members
 * - 404: Project or user not found
 * - 409: User is already a member of the project
 * - 500: Internal server error
 */
export async function addMember(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as AddMemberBody;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format for project ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project ID format',
          errors: [
            {
              field: 'id',
              message: 'Project ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate request body
    const validationErrors = validateAddMemberRequest(body);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: validationErrors,
        },
      });
      return;
    }

    // Check if user has access to the project
    const hasAccess = await userHasProjectAccess(userId, id);
    if (!hasAccess) {
      // Check if project exists to return appropriate error
      const project = await findProjectByIdService(id);
      if (!project) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
        return;
      }

      // Project exists but user doesn't have access
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        },
      });
      return;
    }

    // Get user's role - only owner and lead can add members
    const userRole = await getUserProjectRole(userId, id);
    if (!userRole || !['owner', 'lead'].includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only project owners and leads can add members',
        },
      });
      return;
    }

    const targetUserId = body.userId as string;
    const memberRole = (body.role as ProjectMemberRole) ?? 'member';

    // Check if target user exists
    const targetUserExists = await userExists(targetUserId);
    if (!targetUserExists) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Check if user is already a member
    const alreadyMember = await isProjectMember(id, targetUserId);
    if (alreadyMember) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'User is already a member of this project',
        },
      });
      return;
    }

    // Add the member
    const member = await addProjectMemberService(id, {
      userId: targetUserId,
      role: memberRole,
    });

    res.status(201).json({
      success: true,
      data: { member },
    });
  } catch (error) {
    console.error('Add member error:', error);

    // Handle unique constraint violation (shouldn't happen due to pre-check, but just in case)
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code: string };
      if (dbError.code === '23505') {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'User is already a member of this project',
          },
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * DELETE /projects/:id/members/:userId
 * Remove a user from a project.
 * Only project owners and leads can remove members.
 * Project owners cannot remove themselves from the project.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 * - userId: string (required) - User UUID to remove
 *
 * Returns:
 * - 200: Member removed successfully
 * - 400: Invalid UUID format
 * - 401: Not authenticated
 * - 403: Not authorized to remove members OR cannot remove project owner
 * - 404: Project or member not found
 * - 500: Internal server error
 */
export async function removeMember(req: Request, res: Response): Promise<void> {
  try {
    const { id, userId: targetUserId } = req.params;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format for project ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project ID format',
          errors: [
            {
              field: 'id',
              message: 'Project ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate UUID format for target user ID
    if (!uuidRegex.test(targetUserId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid user ID format',
          errors: [
            {
              field: 'userId',
              message: 'User ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Check if user has access to the project
    const hasAccess = await userHasProjectAccess(userId, id);
    if (!hasAccess) {
      // Check if project exists to return appropriate error
      const project = await findProjectByIdService(id);
      if (!project) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
        return;
      }

      // Project exists but user doesn't have access
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        },
      });
      return;
    }

    // Get user's role - only owner and lead can remove members
    const userRole = await getUserProjectRole(userId, id);
    if (!userRole || !['owner', 'lead'].includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only project owners and leads can remove members',
        },
      });
      return;
    }

    // Check if the target user is the project creator (owner cannot be removed)
    const creatorId = await getProjectCreatorId(id);
    if (creatorId === targetUserId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot remove the project owner',
        },
      });
      return;
    }

    // Check if target user is actually a member
    const isMember = await isProjectMember(id, targetUserId);
    if (!isMember) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User is not a member of this project',
        },
      });
      return;
    }

    // Remove the member
    await removeProjectMemberService(id, targetUserId);

    res.status(200).json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Remove member error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * GET /projects/:id/members
 * List all members of a project including the creator.
 * Only project members can view the member list.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Returns:
 * - 200: Array of project members with user info
 * - 400: Invalid UUID format
 * - 401: Not authenticated
 * - 403: Not authorized to view members
 * - 404: Project not found
 * - 500: Internal server error
 */
export async function listMembers(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project ID format',
          errors: [
            {
              field: 'id',
              message: 'Project ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Check if user has access to the project
    const hasAccess = await userHasProjectAccess(userId, id);
    if (!hasAccess) {
      // Check if project exists to return appropriate error
      const project = await findProjectByIdService(id);
      if (!project) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
        return;
      }

      // Project exists but user doesn't have access
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        },
      });
      return;
    }

    // List project members
    const members = await listProjectMembersService(id);

    res.status(200).json({
      success: true,
      data: { members },
    });
  } catch (error) {
    console.error('List members error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}
