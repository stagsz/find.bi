/**
 * Prepared Answers type definitions for HazOp Assistant.
 *
 * Prepared answers are configurable templates that provide standard options
 * for causes, consequences, safeguards, and recommendations in HazOps analysis.
 * They help analysts select from industry-standard options while maintaining
 * the flexibility to add custom entries.
 *
 * Prepared answers are organized by:
 * - Category: The type of prepared answer (cause, consequence, safeguard, recommendation)
 * - Equipment Type: The type of equipment the answer applies to (pump, valve, reactor, etc.)
 * - Guide Word: The guide word the answer is relevant to (no, more, less, etc.)
 */

import type { EquipmentType } from './analysis-node.js';
import type { GuideWord } from './hazop-analysis.js';

// ============================================================================
// Prepared Answer Categories
// ============================================================================

/**
 * Categories of prepared answers in HazOps methodology.
 *
 * - cause: Possible causes of a deviation
 * - consequence: Potential consequences of a deviation
 * - safeguard: Existing safeguards that mitigate risk
 * - recommendation: Recommended actions to reduce risk
 */
export type PreparedAnswerCategory =
  | 'cause'
  | 'consequence'
  | 'safeguard'
  | 'recommendation';

/**
 * All prepared answer categories as a constant array.
 */
export const PREPARED_ANSWER_CATEGORIES: readonly PreparedAnswerCategory[] = [
  'cause',
  'consequence',
  'safeguard',
  'recommendation',
] as const;

/**
 * Human-readable labels for prepared answer categories.
 */
export const PREPARED_ANSWER_CATEGORY_LABELS: Record<PreparedAnswerCategory, string> = {
  cause: 'Causes',
  consequence: 'Consequences',
  safeguard: 'Safeguards',
  recommendation: 'Recommendations',
};

// ============================================================================
// Prepared Answer Structure
// ============================================================================

/**
 * A single prepared answer option.
 */
export interface PreparedAnswer {
  /** Unique identifier for this prepared answer */
  id: string;

  /** The text of the prepared answer */
  text: string;

  /** Optional detailed description or explanation */
  description?: string;

  /** Equipment types this answer is applicable to (empty = all types) */
  applicableEquipmentTypes: EquipmentType[];

  /** Guide words this answer is relevant to (empty = all guide words) */
  applicableGuideWords: GuideWord[];

  /** Whether this is a commonly used/recommended option */
  isCommon: boolean;

  /** Display order priority (lower = higher priority) */
  sortOrder: number;
}

/**
 * Response structure for prepared answers list.
 */
export interface PreparedAnswersResponse {
  /** The category of prepared answers */
  category: PreparedAnswerCategory;

  /** Array of prepared answers */
  answers: PreparedAnswer[];

  /** Total count of answers */
  count: number;
}

/**
 * Prepared answers filtered by context.
 */
export interface PreparedAnswersFilteredResponse extends PreparedAnswersResponse {
  /** Equipment type filter applied (null if not filtered) */
  equipmentType: EquipmentType | null;

  /** Guide word filter applied (null if not filtered) */
  guideWord: GuideWord | null;
}

// ============================================================================
// Query Parameters
// ============================================================================

/**
 * Query parameters for filtering prepared answers.
 */
export interface PreparedAnswersQuery {
  /** Filter by equipment type */
  equipmentType?: EquipmentType;

  /** Filter by guide word */
  guideWord?: GuideWord;

  /** Only return common/recommended answers */
  commonOnly?: boolean;

  /** Search text to filter answers */
  search?: string;
}

// ============================================================================
// Prepared Answer Templates
// ============================================================================

/**
 * Template for creating prepared answer data.
 * Used internally for defining the default prepared answers.
 */
export interface PreparedAnswerTemplate {
  /** The text of the prepared answer */
  text: string;

  /** Optional detailed description */
  description?: string;

  /** Equipment types (empty = universal) */
  equipmentTypes?: EquipmentType[];

  /** Guide words (empty = universal) */
  guideWords?: GuideWord[];

  /** Common flag (default: false) */
  isCommon?: boolean;
}
