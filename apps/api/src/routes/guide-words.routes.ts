/**
 * Guide Words routes.
 *
 * Provides endpoints for guide word definitions and lookups:
 * - GET /guide-words - List all guide word definitions
 * - GET /guide-words/parameters - List all valid parameters
 * - GET /guide-words/by-parameter/:parameter - Get guide words for a parameter
 * - GET /guide-words/:value - Get a single guide word definition
 *
 * These endpoints are public (no authentication required) since guide words
 * are static reference data.
 */

import { Router } from 'express';
import {
  listGuideWords,
  getGuideWord,
  listParameters,
  getGuideWordsByParameter,
} from '../controllers/guide-words.controller.js';

const router = Router();

/**
 * GET /guide-words
 * List all guide word definitions with metadata.
 *
 * Returns all 7 standard HazOps guide words with their labels,
 * descriptions, applicable parameters, and example deviations.
 */
router.get('/', listGuideWords);

/**
 * GET /guide-words/parameters
 * List all valid process parameters that have guide word mappings.
 *
 * Returns an array of parameter names (e.g., "flow", "pressure", "temperature")
 * that can be used with the /by-parameter endpoint.
 */
router.get('/parameters', listParameters);

/**
 * GET /guide-words/by-parameter/:parameter
 * Get guide words applicable to a specific process parameter.
 *
 * Path parameters:
 * - parameter: string (required) - The process parameter (e.g., "flow", "pressure")
 *
 * Returns guide words that are typically applicable to the specified parameter.
 */
router.get('/by-parameter/:parameter', getGuideWordsByParameter);

/**
 * GET /guide-words/:value
 * Get a single guide word definition by its value.
 *
 * Path parameters:
 * - value: string (required) - The guide word value (e.g., "no", "more", "other_than")
 *
 * Returns 404 if the guide word value is not valid.
 */
router.get('/:value', getGuideWord);

export default router;
