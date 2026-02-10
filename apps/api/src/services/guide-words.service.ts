/**
 * Guide Words service.
 *
 * Provides guide word definitions and helper functions for HazOps analysis.
 * Guide words are the standard terms used in HazOps methodology to identify
 * process deviations from normal operation.
 *
 * Standard HazOps Guide Words:
 * - NO: Complete negation of intention (e.g., no flow)
 * - MORE: Quantitative increase (e.g., more pressure)
 * - LESS: Quantitative decrease (e.g., less temperature)
 * - REVERSE: Opposite of intention (e.g., reverse flow)
 * - EARLY: Timing-related early occurrence
 * - LATE: Timing-related late occurrence
 * - OTHER THAN: Qualitative deviation (e.g., wrong composition)
 */

import {
  type GuideWord,
  GUIDE_WORDS,
  GUIDE_WORD_LABELS,
  GUIDE_WORD_DESCRIPTIONS,
} from '@hazop/types';

// ============================================================================
// Guide Word Definition Types
// ============================================================================

/**
 * A single guide word definition with all associated metadata.
 */
export interface GuideWordDefinition {
  /** The guide word value (e.g., "no", "more") */
  value: GuideWord;
  /** Human-readable label (e.g., "No", "More") */
  label: string;
  /** Description of what the guide word represents */
  description: string;
  /** Common parameters this guide word applies to */
  applicableParameters: string[];
  /** Example deviations for this guide word */
  exampleDeviations: string[];
}

/**
 * Complete guide words response with all definitions and metadata.
 */
export interface GuideWordsResponse {
  /** Array of all guide word definitions */
  guideWords: GuideWordDefinition[];
  /** Total count of guide words */
  count: number;
}

// ============================================================================
// Parameter-to-GuideWord Applicability Mapping
// ============================================================================

/**
 * Mapping of which guide words typically apply to which process parameters.
 * This helps analysts select relevant guide words for specific parameters.
 */
const GUIDE_WORD_APPLICABLE_PARAMETERS: Record<GuideWord, string[]> = {
  no: ['flow', 'level', 'pressure', 'temperature', 'power', 'signal', 'reaction', 'mixing', 'agitation'],
  more: ['flow', 'level', 'pressure', 'temperature', 'viscosity', 'pH', 'concentration', 'speed', 'time'],
  less: ['flow', 'level', 'pressure', 'temperature', 'viscosity', 'pH', 'concentration', 'speed', 'time'],
  reverse: ['flow', 'reaction', 'sequence', 'rotation', 'current'],
  early: ['reaction', 'addition', 'heating', 'cooling', 'start', 'shutdown', 'transfer', 'sampling'],
  late: ['reaction', 'addition', 'heating', 'cooling', 'start', 'shutdown', 'transfer', 'sampling'],
  other_than: ['composition', 'material', 'phase', 'state', 'operation', 'maintenance', 'contamination'],
};

/**
 * Example deviations for each guide word to help analysts understand application.
 */
const GUIDE_WORD_EXAMPLE_DEVIATIONS: Record<GuideWord, string[]> = {
  no: [
    'No flow through pump P-101',
    'No level indication in tank T-201',
    'No pressure in reactor vessel',
    'No power to control system',
  ],
  more: [
    'Higher than normal flow rate',
    'Elevated pressure beyond design limits',
    'Temperature exceeds setpoint',
    'Increased concentration of reactant',
  ],
  less: [
    'Reduced flow rate through heat exchanger',
    'Lower than expected pressure',
    'Temperature below minimum threshold',
    'Decreased coolant level',
  ],
  reverse: [
    'Backflow through check valve',
    'Reverse rotation of pump',
    'Reverse reaction occurring',
    'Current flowing in opposite direction',
  ],
  early: [
    'Premature addition of catalyst',
    'Reaction starts before temperature stabilized',
    'Early valve opening',
    'Premature transfer to next vessel',
  ],
  late: [
    'Delayed catalyst addition',
    'Reaction initiation delayed',
    'Late shutdown of heating system',
    'Delayed response to alarm',
  ],
  other_than: [
    'Wrong material composition',
    'Contamination in feedstock',
    'Different phase state than expected',
    'Incorrect operating procedure followed',
  ],
};

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get all guide word definitions with full metadata.
 *
 * @returns All guide words with labels, descriptions, applicable parameters, and examples
 */
export function getAllGuideWords(): GuideWordsResponse {
  const guideWords: GuideWordDefinition[] = GUIDE_WORDS.map((value) => ({
    value,
    label: GUIDE_WORD_LABELS[value],
    description: GUIDE_WORD_DESCRIPTIONS[value],
    applicableParameters: GUIDE_WORD_APPLICABLE_PARAMETERS[value],
    exampleDeviations: GUIDE_WORD_EXAMPLE_DEVIATIONS[value],
  }));

  return {
    guideWords,
    count: guideWords.length,
  };
}

/**
 * Get a single guide word definition by value.
 *
 * @param guideWord - The guide word value to look up
 * @returns The guide word definition, or null if not found
 */
export function getGuideWordByValue(guideWord: string): GuideWordDefinition | null {
  if (!isValidGuideWord(guideWord)) {
    return null;
  }

  const value = guideWord as GuideWord;
  return {
    value,
    label: GUIDE_WORD_LABELS[value],
    description: GUIDE_WORD_DESCRIPTIONS[value],
    applicableParameters: GUIDE_WORD_APPLICABLE_PARAMETERS[value],
    exampleDeviations: GUIDE_WORD_EXAMPLE_DEVIATIONS[value],
  };
}

/**
 * Validate if a string is a valid guide word.
 *
 * @param value - The value to validate
 * @returns True if the value is a valid guide word, false otherwise
 */
export function isValidGuideWord(value: string): value is GuideWord {
  return (GUIDE_WORDS as readonly string[]).includes(value);
}

/**
 * Get guide words that are applicable to a specific parameter.
 *
 * @param parameter - The process parameter (e.g., "flow", "pressure")
 * @returns Array of guide word definitions applicable to the parameter
 */
export function getGuideWordsForParameter(parameter: string): GuideWordDefinition[] {
  const normalizedParameter = parameter.toLowerCase();

  return GUIDE_WORDS
    .filter((gw) => GUIDE_WORD_APPLICABLE_PARAMETERS[gw].includes(normalizedParameter))
    .map((value) => ({
      value,
      label: GUIDE_WORD_LABELS[value],
      description: GUIDE_WORD_DESCRIPTIONS[value],
      applicableParameters: GUIDE_WORD_APPLICABLE_PARAMETERS[value],
      exampleDeviations: GUIDE_WORD_EXAMPLE_DEVIATIONS[value],
    }));
}

/**
 * Get all valid parameter names that have guide word mappings.
 *
 * @returns Array of unique parameter names
 */
export function getAllParameters(): string[] {
  const allParams = new Set<string>();

  for (const params of Object.values(GUIDE_WORD_APPLICABLE_PARAMETERS)) {
    for (const param of params) {
      allParams.add(param);
    }
  }

  return Array.from(allParams).sort();
}

/**
 * Get the guide word label for display purposes.
 *
 * @param guideWord - The guide word value
 * @returns The human-readable label, or null if invalid
 */
export function getGuideWordLabel(guideWord: string): string | null {
  if (!isValidGuideWord(guideWord)) {
    return null;
  }
  return GUIDE_WORD_LABELS[guideWord as GuideWord];
}

/**
 * Get the guide word description.
 *
 * @param guideWord - The guide word value
 * @returns The description, or null if invalid
 */
export function getGuideWordDescription(guideWord: string): string | null {
  if (!isValidGuideWord(guideWord)) {
    return null;
  }
  return GUIDE_WORD_DESCRIPTIONS[guideWord as GuideWord];
}
