/**
 * Analyses routes.
 *
 * Provides endpoints for HazOps analysis session operations:
 * - GET /analyses/:id - Get analysis session details with progress metrics
 * - PUT /analyses/:id - Update analysis session metadata
 * - POST /analyses/:id/entries - Create analysis entry for node/guideword
 * - GET /analyses/:id/entries - List analysis entries with filtering/pagination
 *
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.middleware.js';
import { getAnalysisById, updateAnalysis, createAnalysisEntry, listEntries, completeAnalysis, getRiskSummary } from '../controllers/analyses.controller.js';

const router = Router();

/**
 * GET /analyses/:id
 * Get a HazOps analysis session by ID.
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Returns the analysis with progress metrics including:
 * - totalNodes: Total nodes in the document
 * - analyzedNodes: Nodes with at least one analysis entry
 * - totalEntries: Total analysis entries
 * - highRiskCount, mediumRiskCount, lowRiskCount: Risk distribution
 *
 * Only accessible if the user is a member of the project that owns the analysis.
 */
router.get('/:id', authenticate, requireAuth, getAnalysisById);

/**
 * PUT /analyses/:id
 * Update a HazOps analysis session metadata.
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Request body (all fields optional):
 * - name: string - Analysis session name (max 255 chars)
 * - description: string | null - Analysis description (null to clear)
 * - leadAnalystId: string - Lead analyst UUID
 *
 * Only draft analyses can be updated.
 * Only accessible if the user is a member of the project that owns the analysis.
 */
router.put('/:id', authenticate, requireAuth, updateAnalysis);

/**
 * POST /analyses/:id/complete
 * Finalize/complete a HazOps analysis session.
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Request body (optional):
 * - comments: string - Approval/completion comments
 *
 * The analysis must be in 'in_review' status to be completed.
 * Only lead analysts, analysts with appropriate permissions, or administrators can complete analyses.
 * Changes status from 'in_review' to 'approved'.
 */
router.post('/:id/complete', authenticate, requireAuth, completeAnalysis);

/**
 * POST /analyses/:id/entries
 * Create a new analysis entry for a node/guideword combination.
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Request body:
 * - nodeId: string (required) - Analysis node UUID
 * - guideWord: GuideWord (required) - Guide word to apply (no, more, less, reverse, early, late, other_than)
 * - parameter: string (required) - Parameter being analyzed (e.g., "flow", "pressure")
 * - deviation: string (required) - Description of the deviation
 * - causes: string[] (optional) - Possible causes (default [])
 * - consequences: string[] (optional) - Potential consequences (default [])
 * - safeguards: string[] (optional) - Existing safeguards (default [])
 * - recommendations: string[] (optional) - Recommended actions (default [])
 * - notes: string (optional) - Additional notes
 *
 * Only draft analyses can have entries added.
 * Only accessible if the user is a member of the project that owns the analysis.
 */
router.post('/:id/entries', authenticate, requireAuth, createAnalysisEntry);

/**
 * GET /analyses/:id/entries
 * List analysis entries with pagination and filtering.
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Query parameters:
 * - page: number (1-based, default 1)
 * - limit: number (default 20, max 100)
 * - sortBy: 'created_at' | 'updated_at' | 'parameter' | 'guide_word' | 'risk_score' (default 'created_at')
 * - sortOrder: 'asc' | 'desc' (default 'asc')
 * - search: string (searches parameter and deviation)
 * - nodeId: string (filter by node UUID)
 * - guideWord: GuideWord (filter by guide word)
 * - riskLevel: RiskLevel (filter by risk level)
 *
 * Only accessible if the user is a member of the project that owns the analysis.
 */
router.get('/:id/entries', authenticate, requireAuth, listEntries);

/**
 * GET /analyses/:id/risk-summary
 * Get aggregated risk summary for a HazOps analysis session.
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Returns comprehensive risk aggregation including:
 * - statistics: Overall statistics (total entries, assessed entries, counts by risk level)
 * - distribution: Risk level distribution percentages
 * - percentiles: Score percentiles (p25, p50, p75, p90, p95)
 * - byNode: Risk breakdown per node
 * - byGuideWord: Risk breakdown per guide word
 * - highestRiskEntries: Top 10 highest risk entries
 * - thresholds: Threshold configuration used for classification
 *
 * Only accessible if the user is a member of the project that owns the analysis.
 */
router.get('/:id/risk-summary', authenticate, requireAuth, getRiskSummary);

export default router;
