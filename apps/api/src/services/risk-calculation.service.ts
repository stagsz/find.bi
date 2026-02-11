/**
 * Risk Calculation service.
 *
 * Provides functions for calculating risk scores using the severity × likelihood × detectability
 * methodology and determining risk levels based on configurable thresholds.
 *
 * Risk Assessment Methodology:
 * - Severity (1-5): Impact of consequence (Negligible → Catastrophic)
 * - Likelihood (1-5): Probability of occurrence (Rare → Almost Certain)
 * - Detectability (1-5): Ability to detect before impact (Almost Certain → Undetectable)
 * - Risk Score: Severity × Likelihood × Detectability (range: 1-125)
 * - Risk Level: Low (1-20), Medium (21-60), High (61-125)
 */

import {
  type SeverityLevel,
  type LikelihoodLevel,
  type DetectabilityLevel,
  type RiskLevel,
  type RiskRanking,
  SEVERITY_LEVELS,
  LIKELIHOOD_LEVELS,
  DETECTABILITY_LEVELS,
  RISK_THRESHOLDS,
  SEVERITY_LABELS,
  SEVERITY_DESCRIPTIONS,
  LIKELIHOOD_LABELS,
  LIKELIHOOD_DESCRIPTIONS,
  DETECTABILITY_LABELS,
  DETECTABILITY_DESCRIPTIONS,
  RISK_LEVEL_LABELS,
} from '@hazop/types';

// ============================================================================
// Risk Factor Definition Types
// ============================================================================

/**
 * A single risk factor level with all associated metadata.
 */
export interface RiskFactorLevel<T extends number = number> {
  /** The numeric level value (1-5) */
  value: T;
  /** Human-readable label */
  label: string;
  /** Description of what this level represents */
  description: string;
}

/**
 * Complete risk factor definition with all levels.
 */
export interface RiskFactorDefinition<T extends number = number> {
  /** Name of the risk factor (e.g., "Severity", "Likelihood", "Detectability") */
  name: string;
  /** Array of all level definitions */
  levels: RiskFactorLevel<T>[];
  /** Total count of levels */
  count: number;
}

/**
 * Risk level definition with threshold information.
 */
export interface RiskLevelDefinition {
  /** The risk level value (e.g., "low", "medium", "high") */
  value: RiskLevel;
  /** Human-readable label */
  label: string;
  /** Minimum score for this level (inclusive) */
  minScore: number;
  /** Maximum score for this level (inclusive) */
  maxScore: number;
}

/**
 * Result of a risk calculation.
 */
export interface RiskCalculationResult {
  /** Severity level used in calculation */
  severity: SeverityLevel;
  /** Likelihood level used in calculation */
  likelihood: LikelihoodLevel;
  /** Detectability level used in calculation */
  detectability: DetectabilityLevel;
  /** Calculated risk score (severity × likelihood × detectability) */
  riskScore: number;
  /** Determined risk level based on thresholds */
  riskLevel: RiskLevel;
  /** Human-readable label for the risk level */
  riskLevelLabel: string;
}

/**
 * Risk statistics for a collection of risk rankings.
 */
export interface RiskStatistics {
  /** Total number of entries analyzed */
  totalEntries: number;
  /** Number of entries with risk assessed */
  assessedEntries: number;
  /** Number of entries without risk assessment */
  unassessedEntries: number;
  /** Count of high risk entries */
  highRiskCount: number;
  /** Count of medium risk entries */
  mediumRiskCount: number;
  /** Count of low risk entries */
  lowRiskCount: number;
  /** Average risk score (only assessed entries) */
  averageRiskScore: number | null;
  /** Maximum risk score */
  maxRiskScore: number | null;
  /** Minimum risk score */
  minRiskScore: number | null;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate if a value is a valid severity level (1-5).
 *
 * @param value - The value to validate
 * @returns True if valid severity level, false otherwise
 */
export function isValidSeverityLevel(value: number): value is SeverityLevel {
  return (SEVERITY_LEVELS as readonly number[]).includes(value);
}

/**
 * Validate if a value is a valid likelihood level (1-5).
 *
 * @param value - The value to validate
 * @returns True if valid likelihood level, false otherwise
 */
export function isValidLikelihoodLevel(value: number): value is LikelihoodLevel {
  return (LIKELIHOOD_LEVELS as readonly number[]).includes(value);
}

/**
 * Validate if a value is a valid detectability level (1-5).
 *
 * @param value - The value to validate
 * @returns True if valid detectability level, false otherwise
 */
export function isValidDetectabilityLevel(value: number): value is DetectabilityLevel {
  return (DETECTABILITY_LEVELS as readonly number[]).includes(value);
}

/**
 * Validate if a risk score is within valid range (1-125).
 *
 * @param score - The score to validate
 * @returns True if valid risk score, false otherwise
 */
export function isValidRiskScore(score: number): boolean {
  return Number.isInteger(score) && score >= 1 && score <= 125;
}

/**
 * Validate all risk factors at once.
 *
 * @param severity - Severity level to validate
 * @param likelihood - Likelihood level to validate
 * @param detectability - Detectability level to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateRiskFactors(
  severity: number,
  likelihood: number,
  detectability: number
): { valid: boolean; error?: string } {
  if (!isValidSeverityLevel(severity)) {
    return { valid: false, error: `Invalid severity level: ${severity}. Must be 1-5.` };
  }
  if (!isValidLikelihoodLevel(likelihood)) {
    return { valid: false, error: `Invalid likelihood level: ${likelihood}. Must be 1-5.` };
  }
  if (!isValidDetectabilityLevel(detectability)) {
    return { valid: false, error: `Invalid detectability level: ${detectability}. Must be 1-5.` };
  }
  return { valid: true };
}

// ============================================================================
// Risk Calculation Functions
// ============================================================================

/**
 * Calculate risk score from severity, likelihood, and detectability.
 *
 * The formula is: Risk Score = Severity × Likelihood × Detectability
 * Resulting in a score range of 1-125.
 *
 * @param severity - Severity level (1-5)
 * @param likelihood - Likelihood level (1-5)
 * @param detectability - Detectability level (1-5)
 * @returns The calculated risk score (1-125)
 * @throws Error if any input is not a valid level
 */
export function calculateRiskScore(
  severity: SeverityLevel,
  likelihood: LikelihoodLevel,
  detectability: DetectabilityLevel
): number {
  const validation = validateRiskFactors(severity, likelihood, detectability);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return severity * likelihood * detectability;
}

/**
 * Determine risk level from a risk score based on thresholds.
 *
 * Thresholds:
 * - Low: 1-20
 * - Medium: 21-60
 * - High: 61-125
 *
 * @param riskScore - The risk score to classify
 * @returns The risk level classification
 * @throws Error if risk score is outside valid range
 */
export function determineRiskLevel(riskScore: number): RiskLevel {
  if (!isValidRiskScore(riskScore)) {
    throw new Error(`Invalid risk score: ${riskScore}. Must be an integer between 1 and 125.`);
  }

  if (riskScore <= RISK_THRESHOLDS.low.max) {
    return 'low';
  }
  if (riskScore <= RISK_THRESHOLDS.medium.max) {
    return 'medium';
  }
  return 'high';
}

/**
 * Calculate complete risk ranking from severity, likelihood, and detectability.
 *
 * This is the main entry point for risk calculation. It validates inputs,
 * calculates the score, and determines the risk level.
 *
 * @param severity - Severity level (1-5)
 * @param likelihood - Likelihood level (1-5)
 * @param detectability - Detectability level (1-5)
 * @returns Complete risk ranking object
 * @throws Error if any input is not a valid level
 */
export function calculateRiskRanking(
  severity: SeverityLevel,
  likelihood: LikelihoodLevel,
  detectability: DetectabilityLevel
): RiskRanking {
  const riskScore = calculateRiskScore(severity, likelihood, detectability);
  const riskLevel = determineRiskLevel(riskScore);

  return {
    severity,
    likelihood,
    detectability,
    riskScore,
    riskLevel,
  };
}

/**
 * Calculate complete risk with additional metadata.
 *
 * Extends the basic risk ranking with human-readable labels.
 *
 * @param severity - Severity level (1-5)
 * @param likelihood - Likelihood level (1-5)
 * @param detectability - Detectability level (1-5)
 * @returns Complete risk calculation result with labels
 * @throws Error if any input is not a valid level
 */
export function calculateRisk(
  severity: SeverityLevel,
  likelihood: LikelihoodLevel,
  detectability: DetectabilityLevel
): RiskCalculationResult {
  const riskScore = calculateRiskScore(severity, likelihood, detectability);
  const riskLevel = determineRiskLevel(riskScore);

  return {
    severity,
    likelihood,
    detectability,
    riskScore,
    riskLevel,
    riskLevelLabel: RISK_LEVEL_LABELS[riskLevel],
  };
}

// ============================================================================
// Risk Factor Information Functions
// ============================================================================

/**
 * Get all severity level definitions with metadata.
 *
 * @returns Complete severity factor definition with all levels
 */
export function getSeverityLevels(): RiskFactorDefinition<SeverityLevel> {
  const levels: RiskFactorLevel<SeverityLevel>[] = SEVERITY_LEVELS.map((value) => ({
    value,
    label: SEVERITY_LABELS[value],
    description: SEVERITY_DESCRIPTIONS[value],
  }));

  return {
    name: 'Severity',
    levels,
    count: levels.length,
  };
}

/**
 * Get all likelihood level definitions with metadata.
 *
 * @returns Complete likelihood factor definition with all levels
 */
export function getLikelihoodLevels(): RiskFactorDefinition<LikelihoodLevel> {
  const levels: RiskFactorLevel<LikelihoodLevel>[] = LIKELIHOOD_LEVELS.map((value) => ({
    value,
    label: LIKELIHOOD_LABELS[value],
    description: LIKELIHOOD_DESCRIPTIONS[value],
  }));

  return {
    name: 'Likelihood',
    levels,
    count: levels.length,
  };
}

/**
 * Get all detectability level definitions with metadata.
 *
 * @returns Complete detectability factor definition with all levels
 */
export function getDetectabilityLevels(): RiskFactorDefinition<DetectabilityLevel> {
  const levels: RiskFactorLevel<DetectabilityLevel>[] = DETECTABILITY_LEVELS.map((value) => ({
    value,
    label: DETECTABILITY_LABELS[value],
    description: DETECTABILITY_DESCRIPTIONS[value],
  }));

  return {
    name: 'Detectability',
    levels,
    count: levels.length,
  };
}

/**
 * Get all risk level definitions with thresholds.
 *
 * @returns Array of risk level definitions with threshold information
 */
export function getRiskLevelDefinitions(): RiskLevelDefinition[] {
  return [
    {
      value: 'low',
      label: RISK_LEVEL_LABELS.low,
      minScore: RISK_THRESHOLDS.low.min,
      maxScore: RISK_THRESHOLDS.low.max,
    },
    {
      value: 'medium',
      label: RISK_LEVEL_LABELS.medium,
      minScore: RISK_THRESHOLDS.medium.min,
      maxScore: RISK_THRESHOLDS.medium.max,
    },
    {
      value: 'high',
      label: RISK_LEVEL_LABELS.high,
      minScore: RISK_THRESHOLDS.high.min,
      maxScore: RISK_THRESHOLDS.high.max,
    },
  ];
}

/**
 * Get the severity label for a given level.
 *
 * @param level - The severity level
 * @returns The human-readable label, or null if invalid
 */
export function getSeverityLabel(level: number): string | null {
  if (!isValidSeverityLevel(level)) {
    return null;
  }
  return SEVERITY_LABELS[level];
}

/**
 * Get the likelihood label for a given level.
 *
 * @param level - The likelihood level
 * @returns The human-readable label, or null if invalid
 */
export function getLikelihoodLabel(level: number): string | null {
  if (!isValidLikelihoodLevel(level)) {
    return null;
  }
  return LIKELIHOOD_LABELS[level];
}

/**
 * Get the detectability label for a given level.
 *
 * @param level - The detectability level
 * @returns The human-readable label, or null if invalid
 */
export function getDetectabilityLabel(level: number): string | null {
  if (!isValidDetectabilityLevel(level)) {
    return null;
  }
  return DETECTABILITY_LABELS[level];
}

/**
 * Get the risk level label.
 *
 * @param level - The risk level
 * @returns The human-readable label
 */
export function getRiskLevelLabel(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level];
}

// ============================================================================
// Risk Statistics Functions
// ============================================================================

/**
 * Calculate statistics for a collection of risk rankings.
 *
 * This function analyzes a set of analysis entries (with optional risk rankings)
 * and computes aggregate statistics.
 *
 * @param riskRankings - Array of risk rankings (null values represent unassessed entries)
 * @returns Computed risk statistics
 */
export function calculateRiskStatistics(riskRankings: (RiskRanking | null)[]): RiskStatistics {
  const totalEntries = riskRankings.length;
  const assessed = riskRankings.filter((r): r is RiskRanking => r !== null);
  const assessedEntries = assessed.length;
  const unassessedEntries = totalEntries - assessedEntries;

  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  let totalScore = 0;
  let maxRiskScore: number | null = null;
  let minRiskScore: number | null = null;

  for (const ranking of assessed) {
    switch (ranking.riskLevel) {
      case 'high':
        highRiskCount++;
        break;
      case 'medium':
        mediumRiskCount++;
        break;
      case 'low':
        lowRiskCount++;
        break;
    }

    totalScore += ranking.riskScore;

    if (maxRiskScore === null || ranking.riskScore > maxRiskScore) {
      maxRiskScore = ranking.riskScore;
    }
    if (minRiskScore === null || ranking.riskScore < minRiskScore) {
      minRiskScore = ranking.riskScore;
    }
  }

  const averageRiskScore = assessedEntries > 0 ? totalScore / assessedEntries : null;

  return {
    totalEntries,
    assessedEntries,
    unassessedEntries,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    averageRiskScore,
    maxRiskScore,
    minRiskScore,
  };
}

/**
 * Get risk distribution as percentages.
 *
 * @param riskRankings - Array of risk rankings (null values are ignored)
 * @returns Object with percentage for each risk level, or null if no assessed entries
 */
export function getRiskDistribution(
  riskRankings: (RiskRanking | null)[]
): { low: number; medium: number; high: number } | null {
  const stats = calculateRiskStatistics(riskRankings);

  if (stats.assessedEntries === 0) {
    return null;
  }

  return {
    low: (stats.lowRiskCount / stats.assessedEntries) * 100,
    medium: (stats.mediumRiskCount / stats.assessedEntries) * 100,
    high: (stats.highRiskCount / stats.assessedEntries) * 100,
  };
}
