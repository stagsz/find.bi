/**
 * Guide Words controller for handling guide word definition requests.
 *
 * Handles:
 * - GET /guide-words - List all guide word definitions
 * - GET /guide-words/:value - Get a single guide word definition
 * - GET /guide-words/parameters - List all valid parameters
 * - GET /guide-words/by-parameter/:parameter - Get guide words for a specific parameter
 */

import type { Request, Response } from 'express';
import {
  getAllGuideWords,
  getGuideWordByValue,
  getGuideWordsForParameter,
  getAllParameters,
  isValidGuideWord,
} from '../services/guide-words.service.js';

/**
 * GET /guide-words
 * List all guide word definitions with metadata.
 *
 * Returns:
 * - 200: All guide word definitions
 *
 * Response body:
 * {
 *   success: true,
 *   data: {
 *     guideWords: GuideWordDefinition[],
 *     count: number
 *   }
 * }
 */
export function listGuideWords(_req: Request, res: Response): void {
  const result = getAllGuideWords();

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /guide-words/parameters
 * List all valid process parameters that have guide word mappings.
 *
 * Returns:
 * - 200: Array of parameter names
 *
 * Response body:
 * {
 *   success: true,
 *   data: {
 *     parameters: string[],
 *     count: number
 *   }
 * }
 */
export function listParameters(_req: Request, res: Response): void {
  const parameters = getAllParameters();

  res.status(200).json({
    success: true,
    data: {
      parameters,
      count: parameters.length,
    },
  });
}

/**
 * GET /guide-words/by-parameter/:parameter
 * Get guide words applicable to a specific process parameter.
 *
 * Path parameters:
 * - parameter: string - The process parameter (e.g., "flow", "pressure")
 *
 * Returns:
 * - 200: Guide words applicable to the parameter
 * - 400: Invalid parameter
 *
 * Response body:
 * {
 *   success: true,
 *   data: {
 *     parameter: string,
 *     guideWords: GuideWordDefinition[],
 *     count: number
 *   }
 * }
 */
export function getGuideWordsByParameter(req: Request, res: Response): void {
  const { parameter } = req.params;

  if (!parameter || parameter.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Parameter is required',
      },
    });
    return;
  }

  const guideWords = getGuideWordsForParameter(parameter);

  res.status(200).json({
    success: true,
    data: {
      parameter: parameter.toLowerCase(),
      guideWords,
      count: guideWords.length,
    },
  });
}

/**
 * GET /guide-words/:value
 * Get a single guide word definition by its value.
 *
 * Path parameters:
 * - value: string - The guide word value (e.g., "no", "more", "other_than")
 *
 * Returns:
 * - 200: The guide word definition
 * - 404: Guide word not found
 *
 * Response body:
 * {
 *   success: true,
 *   data: GuideWordDefinition
 * }
 */
export function getGuideWord(req: Request, res: Response): void {
  const { value } = req.params;

  if (!value || !isValidGuideWord(value)) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Guide word '${value}' not found`,
      },
    });
    return;
  }

  const guideWord = getGuideWordByValue(value);

  if (!guideWord) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Guide word '${value}' not found`,
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: guideWord,
  });
}
