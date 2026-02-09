/**
 * Projects controller for handling project operations.
 *
 * Handles:
 * - GET /projects - List user's projects with search/filter/pagination
 * - POST /projects - Create a new project
 */

import type { Request, Response } from 'express';
import {
  listUserProjects,
  createProject as createProjectService,
  findProjectById as findProjectByIdService,
  userHasProjectAccess,
  getUserProjectRole,
} from '../services/project.service.js';
import type { ProjectStatus } from '@hazop/types';
import { PROJECT_STATUSES } from '@hazop/types';

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
