/**
 * Admin controller for handling admin-only operations.
 *
 * Handles:
 * - GET /admin/users - List all users with search/filter/pagination
 */

import type { Request, Response } from 'express';
import { listAllUsers, updateUserRole, findUserById } from '../services/user.service.js';
import type { UserRole } from '@hazop/types';

/**
 * Valid user roles.
 */
const VALID_ROLES: UserRole[] = ['administrator', 'lead_analyst', 'analyst', 'viewer'];

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

/**
 * Request body for updating a user's role.
 */
interface UpdateUserRoleBody {
  role?: unknown;
}

/**
 * Validate update user role request body.
 * Returns an array of field errors if validation fails.
 */
function validateUpdateUserRoleBody(body: UpdateUserRoleBody): FieldError[] {
  const errors: FieldError[] = [];

  // Role is required
  if (body.role === undefined || body.role === null) {
    errors.push({
      field: 'role',
      message: 'Role is required',
      code: 'REQUIRED',
    });
    return errors;
  }

  // Role must be a string
  if (typeof body.role !== 'string') {
    errors.push({
      field: 'role',
      message: 'Role must be a string',
      code: 'INVALID_TYPE',
    });
    return errors;
  }

  // Role must be valid
  if (!VALID_ROLES.includes(body.role as UserRole)) {
    errors.push({
      field: 'role',
      message: `Role must be one of: ${VALID_ROLES.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  return errors;
}

/**
 * Validate UUID format.
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * PUT /admin/users/:id/role
 * Update a user's role.
 * Requires administrator role.
 *
 * Path parameters:
 * - id: User ID (UUID)
 *
 * Request body:
 * - role: UserRole (required)
 *
 * Returns:
 * - 200: Updated user
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized (non-admin) or self-role-change
 * - 404: User not found
 * - 500: Internal server error
 */
export async function changeUserRole(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as UpdateUserRoleBody;

    // Validate user ID format
    if (!id || !isValidUUID(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid user ID format',
        },
      });
      return;
    }

    // Validate request body
    const validationErrors = validateUpdateUserRoleBody(body);
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

    const newRole = body.role as UserRole;

    // Prevent admin from changing their own role
    const currentUserId = (req.user as { id: string } | undefined)?.id;
    if (currentUserId === id) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot change your own role',
        },
      });
      return;
    }

    // Check if user exists
    const existingUser = await findUserById(id);
    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    // Update the user's role
    const updatedUser = await updateUserRole(id, newRole);

    res.status(200).json({
      success: true,
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error('Change user role error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}
