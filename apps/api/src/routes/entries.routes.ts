/**
 * Entries routes.
 *
 * Provides endpoints for analysis entry operations:
 * - PUT /entries/:id - Update an existing analysis entry
 * - DELETE /entries/:id - Delete an existing analysis entry
 *
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { updateEntry, deleteEntry } from '../controllers/analyses.controller.js';

const router = Router();

/**
 * PUT /entries/:id
 * Update an existing analysis entry.
 *
 * Path parameters:
 * - id: string (required) - Entry UUID
 *
 * Body (all fields optional):
 * - deviation: string - Description of the deviation
 * - causes: string[] - Possible causes
 * - consequences: string[] - Potential consequences
 * - safeguards: string[] - Existing safeguards
 * - recommendations: string[] - Recommended actions
 * - notes: string | null - Additional notes (null to clear)
 *
 * Note: nodeId, guideWord, and parameter cannot be updated as they form the unique constraint.
 *
 * Only draft analyses can have their entries updated.
 * Only accessible by project members.
 */
router.put('/:id', authenticate, requireAuth, updateEntry);

/**
 * DELETE /entries/:id
 * Delete an existing analysis entry.
 *
 * Path parameters:
 * - id: string (required) - Entry UUID
 *
 * Only draft analyses can have their entries deleted.
 * Viewers cannot delete entries.
 */
router.delete('/:id', authenticate, requireAuth, deleteEntry);

export default router;
