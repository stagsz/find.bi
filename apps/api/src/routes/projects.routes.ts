/**
 * Project routes.
 *
 * Provides endpoints for project management:
 * - GET /projects - List user's projects with search/filter/pagination
 *
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { listProjects } from '../controllers/projects.controller.js';

const router = Router();

/**
 * GET /projects
 * List projects for the authenticated user.
 * Returns projects where the user is the creator or a team member.
 *
 * Query parameters:
 * - page: number (1-based, default 1)
 * - limit: number (default 20, max 100)
 * - sortBy: 'created_at' | 'updated_at' | 'name' | 'status'
 * - sortOrder: 'asc' | 'desc'
 * - search: string (searches name and description)
 * - status: ProjectStatus (filter by status)
 * - organization: string (filter by organization)
 */
router.get('/', authenticate, requireAuth, listProjects);

export default router;
