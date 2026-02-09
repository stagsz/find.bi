/**
 * Admin routes.
 *
 * Provides endpoints for admin-only operations:
 * - GET /admin/users - List all users with search/filter/pagination
 * - PUT /admin/users/:id/role - Change a user's role
 *
 * All routes require administrator role.
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { listUsers, changeUserRole } from '../controllers/admin.controller.js';

const router = Router();

/**
 * GET /admin/users
 * List all users with optional search, filter, and pagination.
 * Requires administrator role.
 *
 * Query parameters:
 * - page: number (1-based, default 1)
 * - limit: number (default 20, max 100)
 * - sortBy: 'created_at' | 'updated_at' | 'name' | 'email' | 'role'
 * - sortOrder: 'asc' | 'desc'
 * - search: string (searches name and email)
 * - role: UserRole (filter by role)
 * - isActive: 'true' | 'false' (filter by active status)
 */
router.get('/users', authenticate, requireAuth, requireRole('administrator'), listUsers);

/**
 * PUT /admin/users/:id/role
 * Change a user's role.
 * Requires administrator role.
 *
 * Path parameters:
 * - id: User ID (UUID)
 *
 * Request body:
 * - role: UserRole ('administrator' | 'lead_analyst' | 'analyst' | 'viewer')
 */
router.put('/users/:id/role', authenticate, requireAuth, requireRole('administrator'), changeUserRole);

export default router;
