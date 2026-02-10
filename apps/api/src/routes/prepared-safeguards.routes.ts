/**
 * Prepared Safeguards routes.
 *
 * Provides endpoints for prepared safeguard answer templates:
 * - GET /prepared-safeguards - List all prepared safeguards with optional filtering
 * - GET /prepared-safeguards/common - List common/recommended safeguards
 * - GET /prepared-safeguards/stats - Get statistics about prepared safeguards
 * - GET /prepared-safeguards/by-equipment/:type - Get safeguards for equipment type
 * - GET /prepared-safeguards/by-guide-word/:guideWord - Get safeguards for guide word
 * - GET /prepared-safeguards/context - Get safeguards for equipment type and guide word
 * - GET /prepared-safeguards/search - Search safeguards by text
 * - GET /prepared-safeguards/:id - Get a single prepared safeguard by ID
 *
 * These endpoints are public (no authentication required) since prepared safeguards
 * are static reference data for HazOps analysis templates.
 */

import { Router } from 'express';
import {
  listPreparedSafeguards,
  listCommonPreparedSafeguards,
  getPreparedSafeguardsStatistics,
  getPreparedSafeguardsByEquipmentType,
  getPreparedSafeguardsByGuideWord,
  getPreparedSafeguardsByContext,
  searchPreparedSafeguardsHandler,
  getPreparedSafeguard,
} from '../controllers/prepared-safeguards.controller.js';

const router = Router();

/**
 * GET /prepared-safeguards
 * List all prepared safeguards with optional filtering.
 *
 * Query parameters:
 * - equipmentType: Filter by equipment type (pump, valve, reactor, etc.)
 * - guideWord: Filter by guide word (no, more, less, etc.)
 * - commonOnly: Only return common safeguards (true/false)
 * - search: Search text to filter safeguards
 *
 * Returns all prepared safeguard templates for HazOps analysis.
 */
router.get('/', listPreparedSafeguards);

/**
 * GET /prepared-safeguards/common
 * List common/recommended prepared safeguards.
 *
 * Returns only the safeguards marked as commonly used or recommended.
 * Useful for quick selection during analysis.
 */
router.get('/common', listCommonPreparedSafeguards);

/**
 * GET /prepared-safeguards/stats
 * Get statistics about prepared safeguards.
 *
 * Returns counts of safeguards by equipment type, guide word, and common status.
 * Useful for understanding the coverage of prepared answers.
 */
router.get('/stats', getPreparedSafeguardsStatistics);

/**
 * GET /prepared-safeguards/by-equipment/:type
 * Get prepared safeguards applicable to a specific equipment type.
 *
 * Path parameters:
 * - type: string (required) - Equipment type (pump, valve, reactor, heat_exchanger, tank, pipe, other)
 *
 * Returns safeguards that are applicable to the specified equipment type,
 * including universal safeguards that apply to all equipment.
 */
router.get('/by-equipment/:type', getPreparedSafeguardsByEquipmentType);

/**
 * GET /prepared-safeguards/by-guide-word/:guideWord
 * Get prepared safeguards applicable to a specific guide word.
 *
 * Path parameters:
 * - guideWord: string (required) - Guide word (no, more, less, reverse, early, late, other_than)
 *
 * Returns safeguards that are applicable to the specified guide word,
 * including universal safeguards that apply to all guide words.
 */
router.get('/by-guide-word/:guideWord', getPreparedSafeguardsByGuideWord);

/**
 * GET /prepared-safeguards/context
 * Get prepared safeguards for a specific equipment type and guide word combination.
 *
 * Query parameters:
 * - equipmentType: string (required) - Equipment type
 * - guideWord: string (required) - Guide word
 *
 * Returns safeguards that are applicable to both the equipment type and guide word,
 * providing context-aware suggestions during HazOps analysis.
 */
router.get('/context', getPreparedSafeguardsByContext);

/**
 * GET /prepared-safeguards/search
 * Search prepared safeguards by text.
 *
 * Query parameters:
 * - q: string (required) - Search query
 *
 * Searches safeguard text and descriptions for matching terms.
 */
router.get('/search', searchPreparedSafeguardsHandler);

/**
 * GET /prepared-safeguards/:id
 * Get a single prepared safeguard by its ID.
 *
 * Path parameters:
 * - id: string (required) - The prepared safeguard ID
 *
 * Returns 404 if the prepared safeguard is not found.
 */
router.get('/:id', getPreparedSafeguard);

export default router;
