/**
 * User routes.
 *
 * Provides endpoints for user profile operations:
 * - GET /users/me - Get current user's profile
 * - PUT /users/me - Update current user's profile
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { getCurrentProfile, updateCurrentProfile } from '../controllers/users.controller.js';

const router = Router();

/**
 * GET /users/me
 * Get the current authenticated user's profile.
 * Requires authentication.
 */
router.get('/me', authenticate, requireAuth, getCurrentProfile);

/**
 * PUT /users/me
 * Update the current authenticated user's profile.
 * Requires authentication.
 */
router.put('/me', authenticate, requireAuth, updateCurrentProfile);

export default router;
