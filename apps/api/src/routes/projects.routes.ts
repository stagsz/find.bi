/**
 * Project routes.
 *
 * Provides endpoints for project management:
 * - GET /projects - List user's projects with search/filter/pagination
 * - POST /projects - Create a new project
 *
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { listProjects, createProject, getProjectById, updateProject } from '../controllers/projects.controller.js';

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

/**
 * POST /projects
 * Create a new project.
 *
 * Request body:
 * - name: string (required) - Project name
 * - description: string (optional) - Project description
 *
 * The organization is automatically set from the authenticated user's profile.
 * The project status is set to 'planning' by default.
 *
 * Returns the created project with creator info.
 */
router.post('/', authenticate, requireAuth, createProject);

/**
 * GET /projects/:id
 * Get a project by ID.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Returns the project details with creator info and user's role.
 * Only accessible if the user is the project creator or a member.
 */
router.get('/:id', authenticate, requireAuth, getProjectById);

/**
 * PUT /projects/:id
 * Update a project by ID.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Request body:
 * - name: string (optional) - New project name
 * - description: string (optional) - New project description
 * - status: ProjectStatus (optional) - New project status
 *
 * Only project owners and leads can update project details.
 * Returns the updated project with creator info and user's role.
 */
router.put('/:id', authenticate, requireAuth, updateProject);

export default router;
