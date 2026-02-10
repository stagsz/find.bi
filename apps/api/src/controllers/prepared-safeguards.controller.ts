/**
 * Prepared Safeguards controller for handling prepared safeguard requests.
 *
 * Handles:
 * - GET /prepared-safeguards - List all prepared safeguards
 * - GET /prepared-safeguards/common - List common/recommended safeguards
 * - GET /prepared-safeguards/stats - Get statistics about prepared safeguards
 * - GET /prepared-safeguards/by-equipment/:type - Get safeguards for equipment type
 * - GET /prepared-safeguards/by-guide-word/:guideWord - Get safeguards for guide word
 * - GET /prepared-safeguards/context - Get safeguards for equipment type and guide word
 * - GET /prepared-safeguards/search - Search safeguards by text
 * - GET /prepared-safeguards/:id - Get a single prepared safeguard by ID
 */

import type { Request, Response } from 'express';
import type { EquipmentType, GuideWord } from '@hazop/types';
import {
  getAllPreparedSafeguards,
  getPreparedSafeguardsFiltered,
  getPreparedSafeguardsForEquipmentType,
  getPreparedSafeguardsForGuideWord,
  getPreparedSafeguardsForContext,
  searchPreparedSafeguards,
  getCommonPreparedSafeguards,
  getPreparedSafeguardById,
  getPreparedSafeguardStats,
  isValidEquipmentType,
  isValidGuideWord,
} from '../services/prepared-safeguards.service.js';

/**
 * GET /prepared-safeguards
 * List all prepared safeguards with optional filtering.
 *
 * Query parameters:
 * - equipmentType: Filter by equipment type
 * - guideWord: Filter by guide word
 * - commonOnly: Only return common safeguards (true/false)
 * - search: Search text
 *
 * Returns:
 * - 200: Prepared safeguards list
 *
 * Response body:
 * {
 *   success: true,
 *   data: PreparedAnswersFilteredResponse
 * }
 */
export function listPreparedSafeguards(req: Request, res: Response): void {
  const { equipmentType, guideWord, commonOnly, search } = req.query;

  // If no filters, return all
  if (!equipmentType && !guideWord && !commonOnly && !search) {
    const result = getAllPreparedSafeguards();
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

  const result = getPreparedSafeguardsFiltered({
    equipmentType: equipmentType as EquipmentType | undefined,
    guideWord: guideWord as GuideWord | undefined,
    commonOnly: commonOnly === 'true',
    search: search as string | undefined,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-safeguards/common
 * List common/recommended prepared safeguards.
 *
 * Returns:
 * - 200: Common prepared safeguards
 */
export function listCommonPreparedSafeguards(_req: Request, res: Response): void {
  const result = getCommonPreparedSafeguards();

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-safeguards/stats
 * Get statistics about prepared safeguards.
 *
 * Returns:
 * - 200: Statistics including counts by equipment type and guide word
 */
export function getPreparedSafeguardsStatistics(_req: Request, res: Response): void {
  const stats = getPreparedSafeguardStats();

  res.status(200).json({
    success: true,
    data: stats,
  });
}

/**
 * GET /prepared-safeguards/by-equipment/:type
 * Get prepared safeguards for a specific equipment type.
 *
 * Path parameters:
 * - type: Equipment type (pump, valve, reactor, etc.)
 *
 * Returns:
 * - 200: Prepared safeguards for the equipment type
 * - 400: Invalid equipment type
 */
export function getPreparedSafeguardsByEquipmentType(req: Request, res: Response): void {
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

  const result = getPreparedSafeguardsForEquipmentType(type);

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-safeguards/by-guide-word/:guideWord
 * Get prepared safeguards for a specific guide word.
 *
 * Path parameters:
 * - guideWord: Guide word (no, more, less, etc.)
 *
 * Returns:
 * - 200: Prepared safeguards for the guide word
 * - 400: Invalid guide word
 */
export function getPreparedSafeguardsByGuideWord(req: Request, res: Response): void {
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

  const result = getPreparedSafeguardsForGuideWord(guideWord);

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-safeguards/context
 * Get prepared safeguards for a specific equipment type and guide word combination.
 *
 * Query parameters:
 * - equipmentType: Required - Equipment type
 * - guideWord: Required - Guide word
 *
 * Returns:
 * - 200: Prepared safeguards for the context
 * - 400: Missing or invalid parameters
 */
export function getPreparedSafeguardsByContext(req: Request, res: Response): void {
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

  const result = getPreparedSafeguardsForContext(
    equipmentType as EquipmentType,
    guideWord as GuideWord
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-safeguards/search
 * Search prepared safeguards by text.
 *
 * Query parameters:
 * - q: Required - Search text
 *
 * Returns:
 * - 200: Matching prepared safeguards
 * - 400: Missing search query
 */
export function searchPreparedSafeguardsHandler(req: Request, res: Response): void {
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

  const result = searchPreparedSafeguards(q as string);

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /prepared-safeguards/:id
 * Get a single prepared safeguard by ID.
 *
 * Path parameters:
 * - id: Prepared safeguard ID
 *
 * Returns:
 * - 200: The prepared safeguard
 * - 404: Prepared safeguard not found
 */
export function getPreparedSafeguard(req: Request, res: Response): void {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Prepared safeguard ID is required',
      },
    });
    return;
  }

  const safeguard = getPreparedSafeguardById(id);

  if (!safeguard) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Prepared safeguard with ID '${id}' not found`,
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: safeguard,
  });
}
