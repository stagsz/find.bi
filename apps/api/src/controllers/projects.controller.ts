/**
 * Projects controller for handling project operations.
 *
 * Handles:
 * - GET /projects - List user's projects with search/filter/pagination
 */

import type { Request, Response } from 'express';
import { listUserProjects } from '../services/project.service.js';
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
