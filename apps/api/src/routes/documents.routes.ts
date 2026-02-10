/**
 * Document routes.
 *
 * Provides endpoints for P&ID document operations:
 * - GET /documents/:id - Get a document by ID
 * - DELETE /documents/:id - Delete a document
 *
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { getDocumentById, deleteDocumentById } from '../controllers/documents.controller.js';

const router = Router();

/**
 * GET /documents/:id
 * Get a P&ID document by ID.
 *
 * Path parameters:
 * - id: string (required) - Document UUID
 *
 * Returns the document details with uploader info.
 * Only accessible if the user is a member of the project that owns the document.
 */
router.get('/:id', authenticate, requireAuth, getDocumentById);

/**
 * DELETE /documents/:id
 * Delete a P&ID document by ID.
 *
 * Path parameters:
 * - id: string (required) - Document UUID
 *
 * Deletes the document record and associated file from storage.
 * Only accessible by project members with owner, lead, or member role.
 * Viewers cannot delete documents.
 */
router.delete('/:id', authenticate, requireAuth, deleteDocumentById);

export default router;
