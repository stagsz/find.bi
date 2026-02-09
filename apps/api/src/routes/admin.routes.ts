/**
 * Admin routes.
 *
 * Provides endpoints for admin-only operations:
 * - GET /admin/users - List all users with search/filter/pagination
 *
 * All routes require administrator role.
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { listUsers } from '../controllers/admin.controller.js';

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

export default router;
