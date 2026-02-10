/**
 * Project routes.
 *
 * Provides endpoints for project management:
 * - GET /projects - List user's projects with search/filter/pagination
 * - POST /projects - Create a new project
 * - POST /projects/:id/documents - Upload a P&ID document
 *
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { listProjects, createProject, getProjectById, updateProject, deleteProject, addMember, removeMember, listMembers } from '../controllers/projects.controller.js';
import { listDocuments, uploadDocument } from '../controllers/documents.controller.js';
import { createAnalysis } from '../controllers/analyses.controller.js';
import { uploadPID, handleMulterError, validatePIDUpload } from '../middleware/upload.middleware.js';

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

/**
 * DELETE /projects/:id
 * Archive a project by ID.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Sets the project status to 'archived' rather than permanently deleting.
 * Only project owners and leads can archive projects.
 * Returns the archived project with creator info and user's role.
 */
router.delete('/:id', authenticate, requireAuth, deleteProject);

/**
 * GET /projects/:id/members
 * List all members of a project.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Only accessible to project members.
 * Returns array of members with user info.
 */
router.get('/:id/members', authenticate, requireAuth, listMembers);

/**
 * POST /projects/:id/members
 * Add a user as a member to a project.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Request body:
 * - userId: string (required) - User UUID to add
 * - role: ProjectMemberRole (optional) - Member role, defaults to 'member'
 *
 * Only project owners and leads can add members.
 * Returns the created member with user info.
 */
router.post('/:id/members', authenticate, requireAuth, addMember);

/**
 * DELETE /projects/:id/members/:userId
 * Remove a user from a project.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 * - userId: string (required) - User UUID to remove
 *
 * Only project owners and leads can remove members.
 * Project owners cannot remove themselves.
 * Returns success confirmation.
 */
router.delete('/:id/members/:userId', authenticate, requireAuth, removeMember);

/**
 * GET /projects/:id/documents
 * List P&ID documents for a project.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Query parameters:
 * - page: number (1-based, default 1)
 * - limit: number (default 20, max 100)
 * - sortBy: 'created_at' | 'uploaded_at' | 'filename' | 'status' | 'file_size'
 * - sortOrder: 'asc' | 'desc'
 * - search: string (searches filename)
 * - status: PIDDocumentStatus (filter by status)
 *
 * Returns paginated list of documents with uploader info.
 */
router.get('/:id/documents', authenticate, requireAuth, listDocuments);

/**
 * POST /projects/:id/documents
 * Upload a P&ID document to a project.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Body (multipart/form-data):
 * - file: The P&ID document file (PDF, PNG, JPG, or DWG)
 *
 * Supported file types: PDF, PNG, JPG, DWG (max 50MB)
 * Only project members (owner, lead, member) can upload documents.
 * Viewers cannot upload documents.
 *
 * Returns the created document with uploader info.
 */
router.post(
  '/:id/documents',
  authenticate,
  requireAuth,
  uploadPID.single('file'),
  handleMulterError,
  validatePIDUpload,
  uploadDocument
);

/**
 * POST /projects/:id/analyses
 * Create a new HazOps analysis session for a project.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Request body:
 * - documentId: string (required) - P&ID Document UUID to analyze
 * - name: string (required) - Analysis session name
 * - description: string (optional) - Analysis description
 * - leadAnalystId: string (optional) - Lead analyst UUID (defaults to creator)
 *
 * Only project members can create analyses.
 * Returns the created analysis with details.
 */
router.post('/:id/analyses', authenticate, requireAuth, createAnalysis);

export default router;
