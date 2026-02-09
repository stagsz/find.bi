/**
 * Admin controller for handling admin-only operations.
 *
 * Handles:
 * - GET /admin/users - List all users with search/filter/pagination
 */

import type { Request, Response } from 'express';
import { listAllUsers } from '../services/user.service.js';
import type { UserRole } from '@hazop/types';

/**
 * Validation error for a specific field.
 */
interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Query parameters for listing users.
 */
interface ListUsersQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
  role?: string;
  isActive?: string;
}

/**
 * Validate list users query parameters.
 * Returns an array of field errors if validation fails.
 */
function validateListUsersQuery(query: ListUsersQuery): FieldError[] {
  const errors: FieldError[] = [];
  const validRoles = ['administrator', 'lead_analyst', 'analyst', 'viewer'];
  const validSortFields = ['created_at', 'updated_at', 'name', 'email', 'role'];

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

  // Validate role filter
  if (query.role !== undefined && !validRoles.includes(query.role)) {
    errors.push({
      field: 'role',
      message: `role must be one of: ${validRoles.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // Validate isActive filter
  if (query.isActive !== undefined && !['true', 'false'].includes(query.isActive)) {
    errors.push({
      field: 'isActive',
      message: 'isActive must be "true" or "false"',
      code: 'INVALID_VALUE',
    });
  }

  return errors;
}

/**
 * GET /admin/users
 * List all users with optional search, filter, and pagination.
 *
 * Query parameters:
 * - page: number (1-based, default 1)
 * - limit: number (default 20, max 100)
 * - sortBy: 'created_at' | 'updated_at' | 'name' | 'email' | 'role' (default 'created_at')
 * - sortOrder: 'asc' | 'desc' (default 'desc')
 * - search: string (searches name and email)
 * - role: UserRole (filter by role)
 * - isActive: 'true' | 'false' (filter by active status)
 *
 * Returns:
 * - 200: Paginated list of users
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized (non-admin)
 * - 500: Internal server error
 */
export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query as ListUsersQuery;

    // Validate query parameters
    const validationErrors = validateListUsersQuery(query);
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
    const sortBy = query.sortBy as 'created_at' | 'updated_at' | 'name' | 'email' | 'role' | undefined;
    const sortOrder = query.sortOrder as 'asc' | 'desc' | undefined;
    const search = query.search;
    const role = query.role as UserRole | undefined;
    const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined;

    // Fetch users
    const result = await listAllUsers(
      { search, role, isActive },
      { page, limit, sortBy, sortOrder }
    );

    // Calculate pagination metadata
    const currentPage = page ?? 1;
    const currentLimit = limit ?? 20;
    const totalPages = Math.ceil(result.total / currentLimit);

    res.status(200).json({
      success: true,
      data: result.users,
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
    console.error('List users error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}
