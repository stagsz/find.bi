/**
 * Entries routes.
 *
 * Provides endpoints for analysis entry operations:
 * - PUT /entries/:id - Update an existing analysis entry
 * - PUT /entries/:id/risk - Update risk ranking for an analysis entry
 * - DELETE /entries/:id - Delete an existing analysis entry
 *
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { updateEntry, deleteEntry, updateEntryRisk } from '../controllers/analyses.controller.js';

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
 * PUT /entries/:id/risk
 * Update the risk ranking for an analysis entry.
 *
 * Path parameters:
 * - id: string (required) - Entry UUID
 *
 * Body:
 * - severity: number (required, 1-5) - Severity level
 * - likelihood: number (required, 1-5) - Likelihood level
 * - detectability: number (required, 1-5) - Detectability level
 * - clear: boolean (optional) - Set to true to remove risk assessment
 *
 * The risk score (severity × likelihood × detectability, range 1-125) and
 * risk level (low, medium, high) are calculated automatically.
 *
 * Only draft analyses can have their entries' risk updated.
 * Only accessible by project members.
 */
router.put('/:id/risk', authenticate, requireAuth, updateEntryRisk);

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
