/**
 * Report routes.
 *
 * Provides endpoints for report operations:
 * - GET /reports/:id/status - Get report generation status
 *
 * Report creation is handled via POST /projects/:id/reports in projects.routes.ts.
 *
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { getReportStatus } from '../controllers/reports.controller.js';

const router = Router();

/**
 * GET /reports/:id/status
 * Get the current status of a report generation job.
 *
 * Path parameters:
 * - id: string (required) - Report UUID
 *
 * Returns the report status including:
 * - reportId: The report ID
 * - status: pending | generating | completed | failed
 * - progress: 0-100 percentage (if available)
 * - downloadUrl: Signed URL for downloading the report (if completed)
 * - errorMessage: Error details (if failed)
 * - completedAt: Timestamp when generation completed (if completed)
 *
 * Only accessible if the user is a member of the project that owns the report.
 */
router.get('/:id/status', authenticate, requireAuth, getReportStatus);

export default router;
