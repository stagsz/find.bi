/**
 * Prepared Causes controller for handling prepared cause requests.
 *
 * Handles:
 * - GET /prepared-causes - List all prepared causes
 * - GET /prepared-causes/common - List common/recommended causes
 * - GET /prepared-causes/stats - Get statistics about prepared causes
 * - GET /prepared-causes/by-equipment/:type - Get causes for equipment type
 * - GET /prepared-causes/by-guide-word/:guideWord - Get causes for guide word
 * - GET /prepared-causes/context - Get causes for equipment type and guide word
 * - GET /prepared-causes/search - Search causes by text
 * - GET /prepared-causes/:id - Get a single prepared cause by ID
 */

import type { Request, Response } from 'express';
import {
  getAllPreparedCauses,
  getPreparedCausesFiltered,
  getPreparedCausesForEquipmentType,
  getPreparedCausesForGuideWord,
  getPreparedCausesForContext,
  searchPreparedCauses,
  getCommonPreparedCauses,
  getPreparedCauseById,
  getPreparedCauseStats,
  isValidEquipmentType,
  isValidGuideWord,
} from '../services/prepared-causes.service.js';

/**
 * GET /prepared-causes
 * List all prepared causes with optional filtering.
 *
 * Query parameters:
 * - equipmentType: Filter by equipment type
 * - guideWord: Filter by guide word
 * - commonOnly: Only return common causes (true/false)
 * - search: Search text
 *
 * Returns:
 * - 200: Prepared causes list
 *
 * Response body:
 * {
 *   success: true,
 *   data: PreparedAnswersFilteredResponse
 * }
 */
export function listPreparedCauses(req: Request, res: Response): void {
  const { equipmentType, guideWord, commonOnly, search } = req.query;

  // If no filters, return all
  if (!equipmentType && !guideWord && !commonOnly && !search) {
    const result = getAllPreparedCauses();
    res.status(200).json({
      success: true,
      data: result,
    });
    return;
  }

  // Validate equipment type if provided
  if (equipmentType && !isValidEquipmentType(equipmentType as string)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid equipment type: ${equipmentType}`,
      },
    });
    return;
  }

  // Validate guide word if provided
  if (guideWord && !isValidGuideWord(guideWord as string)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid guide word: ${guideWord}`,
      },
    });
    return;
  }

  const result = getPreparedCausesFiltered({
    equipmentType: equipmentType as string | undefined,
    guideWord: guideWord as string | undefined,
    commonOnly: commonOnly === 'true',
    search: search as string | undefined,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-causes/common
 * List common/recommended prepared causes.
 *
 * Returns:
 * - 200: Common prepared causes
 */
export function listCommonPreparedCauses(_req: Request, res: Response): void {
  const result = getCommonPreparedCauses();

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-causes/stats
 * Get statistics about prepared causes.
 *
 * Returns:
 * - 200: Statistics including counts by equipment type and guide word
 */
export function getPreparedCausesStatistics(_req: Request, res: Response): void {
  const stats = getPreparedCauseStats();

  res.status(200).json({
    success: true,
    data: stats,
  });
}

/**
 * GET /prepared-causes/by-equipment/:type
 * Get prepared causes for a specific equipment type.
 *
 * Path parameters:
 * - type: Equipment type (pump, valve, reactor, etc.)
 *
 * Returns:
 * - 200: Prepared causes for the equipment type
 * - 400: Invalid equipment type
 */
export function getPreparedCausesByEquipmentType(req: Request, res: Response): void {
  const { type } = req.params;

  if (!type || !isValidEquipmentType(type)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid equipment type: ${type}`,
      },
    });
    return;
  }

  const result = getPreparedCausesForEquipmentType(type);

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-causes/by-guide-word/:guideWord
 * Get prepared causes for a specific guide word.
 *
 * Path parameters:
 * - guideWord: Guide word (no, more, less, etc.)
 *
 * Returns:
 * - 200: Prepared causes for the guide word
 * - 400: Invalid guide word
 */
export function getPreparedCausesByGuideWord(req: Request, res: Response): void {
  const { guideWord } = req.params;

  if (!guideWord || !isValidGuideWord(guideWord)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid guide word: ${guideWord}`,
      },
    });
    return;
  }

  const result = getPreparedCausesForGuideWord(guideWord);

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-causes/context
 * Get prepared causes for a specific equipment type and guide word combination.
 *
 * Query parameters:
 * - equipmentType: Required - Equipment type
 * - guideWord: Required - Guide word
 *
 * Returns:
 * - 200: Prepared causes for the context
 * - 400: Missing or invalid parameters
 */
export function getPreparedCausesByContext(req: Request, res: Response): void {
  const { equipmentType, guideWord } = req.query;

  if (!equipmentType) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Equipment type is required',
      },
    });
    return;
  }

  if (!guideWord) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Guide word is required',
      },
    });
    return;
  }

  if (!isValidEquipmentType(equipmentType as string)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid equipment type: ${equipmentType}`,
      },
    });
    return;
  }

  if (!isValidGuideWord(guideWord as string)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid guide word: ${guideWord}`,
      },
    });
    return;
  }

  const result = getPreparedCausesForContext(
    equipmentType as string,
    guideWord as string
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-causes/search
 * Search prepared causes by text.
 *
 * Query parameters:
 * - q: Required - Search text
 *
 * Returns:
 * - 200: Matching prepared causes
 * - 400: Missing search query
 */
export function searchPreparedCausesHandler(req: Request, res: Response): void {
  const { q } = req.query;

  if (!q || (typeof q === 'string' && q.trim().length === 0)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Search query is required',
      },
    });
    return;
  }

  const result = searchPreparedCauses(q as string);

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-causes/:id
 * Get a single prepared cause by ID.
 *
 * Path parameters:
 * - id: Prepared cause ID
 *
 * Returns:
 * - 200: The prepared cause
 * - 404: Prepared cause not found
 */
export function getPreparedCause(req: Request, res: Response): void {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Prepared cause ID is required',
      },
    });
    return;
  }

  const cause = getPreparedCauseById(id);

  if (!cause) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Prepared cause with ID '${id}' not found`,
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: cause,
  });
}
