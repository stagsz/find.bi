/**
 * Users controller for handling user profile operations.
 *
 * Handles:
 * - GET /users/me - Get current user's profile
 * - PUT /users/me - Update current user's profile
 */

import type { Request, Response } from 'express';
import {
  findUserById,
  updateUserProfile,
  emailExistsForOtherUser,
} from '../services/user.service.js';
import { getAuthUserId } from '../middleware/auth.middleware.js';

/**
 * Validation error for a specific field.
 */
interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Request body for profile update.
 */
interface UpdateProfileRequestBody {
  name?: string;
  email?: string;
  organization?: string;
}

/**
 * Validate email format.
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validate profile update request body.
 * Returns an array of field errors if validation fails.
 */
function validateUpdateProfileRequest(body: UpdateProfileRequestBody): FieldError[] {
  const errors: FieldError[] = [];

  // Name validation (if provided)
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      errors.push({ field: 'name', message: 'Name must be a string', code: 'INVALID_TYPE' });
    } else if (body.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name cannot be empty', code: 'EMPTY' });
    } else if (body.name.trim().length > 255) {
      errors.push({ field: 'name', message: 'Name must be 255 characters or less', code: 'TOO_LONG' });
    }
  }

  // Email validation (if provided)
  if (body.email !== undefined) {
    if (typeof body.email !== 'string') {
      errors.push({ field: 'email', message: 'Email must be a string', code: 'INVALID_TYPE' });
    } else if (body.email.trim().length === 0) {
      errors.push({ field: 'email', message: 'Email cannot be empty', code: 'EMPTY' });
    } else if (!isValidEmail(body.email)) {
      errors.push({ field: 'email', message: 'Invalid email format', code: 'INVALID_FORMAT' });
    }
  }

  // Organization validation (if provided)
  if (body.organization !== undefined) {
    if (typeof body.organization !== 'string') {
      errors.push({ field: 'organization', message: 'Organization must be a string', code: 'INVALID_TYPE' });
    } else if (body.organization.trim().length === 0) {
      errors.push({ field: 'organization', message: 'Organization cannot be empty', code: 'EMPTY' });
    } else if (body.organization.trim().length > 255) {
      errors.push({ field: 'organization', message: 'Organization must be 255 characters or less', code: 'TOO_LONG' });
    }
  }

  return errors;
}

/**
 * GET /users/me
 * Get the current authenticated user's profile.
 *
 * Returns:
 * - 200: User profile
 * - 401: Not authenticated
 * - 404: User not found (should not happen if auth is valid)
 * - 500: Internal server error
 */
export async function getCurrentProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = getAuthUserId(req);

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

    const user = await findUserById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get profile error:', error);

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
 * PUT /users/me
 * Update the current authenticated user's profile.
 *
 * Request body:
 * - name?: string (optional) - New display name
 * - email?: string (optional) - New email address
 * - organization?: string (optional) - New organization
 *
 * Returns:
 * - 200: Profile updated successfully
 * - 400: Validation error
 * - 401: Not authenticated
 * - 409: Email already in use by another user
 * - 500: Internal server error
 */
export async function updateCurrentProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = getAuthUserId(req);

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

    const body = req.body as UpdateProfileRequestBody;

    // Validate request body
    const validationErrors = validateUpdateProfileRequest(body);
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

    // Check if email is being changed and is already in use
    if (body.email) {
      const emailTaken = await emailExistsForOtherUser(body.email, userId);
      if (emailTaken) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Email address already in use',
          },
        });
        return;
      }
    }

    // Update the profile
    const updatedUser = await updateUserProfile(userId, {
      name: body.name,
      email: body.email,
      organization: body.organization,
    });

    res.status(200).json({
      success: true,
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error('Update profile error:', error);

    // Handle unique constraint violation (backup for race condition)
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Email address already in use',
        },
      });
      return;
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
