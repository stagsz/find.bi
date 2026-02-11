/**
 * LOPA Recommendation Trigger Service.
 *
 * Provides functions for determining when LOPA (Layers of Protection Analysis)
 * should be recommended or required based on risk assessment results. This service
 * integrates risk thresholds with LOPA trigger logic to automatically flag
 * high-risk entries that need deeper protection analysis.
 *
 * LOPA is typically triggered when:
 * - Risk level is 'high' (score >= 61 by default)
 * - Severity is 4 (Major) or 5 (Catastrophic)
 * - Risk score exceeds configurable threshold
 *
 * This service supports:
 * - Single entry evaluation
 * - Bulk evaluation of analysis entries
 * - Analysis-level aggregation of LOPA recommendations
 * - Project-level LOPA recommendation summary
 *
 * Reference Standards:
 * - IEC 61511: Functional safety for process industries
 * - CCPS Guidelines for LOPA decision criteria
 */

import { getPool } from '../config/database.config.js';
import type {
  RiskRanking,
  RiskLevel,
  SeverityLevel,
  LikelihoodLevel,
  DetectabilityLevel,
  LOPATriggerConfig,
  LOPATriggerResult,
  GuideWord,
} from '@hazop/types';
import { DEFAULT_LOPA_TRIGGER_CONFIG } from '@hazop/types';
import { checkLOPATrigger, isLOPARecommended } from './lopa-calculation.service.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Entry with LOPA recommendation status.
 */
export interface EntryLOPARecommendation {
  /** Entry ID */
  entryId: string;
  /** Node ID */
  nodeId: string;
  /** Node identifier */
  nodeIdentifier: string;
  /** Guide word */
  guideWord: GuideWord;
  /** Parameter */
  parameter: string;
  /** Deviation */
  deviation: string;
  /** Risk ranking (null if not assessed) */
  riskRanking: RiskRanking | null;
  /** LOPA trigger result */
  lopaTrigger: LOPATriggerResult;
  /** Whether a LOPA analysis already exists for this entry */
  hasExistingLOPA: boolean;
}

/**
 * Summary of LOPA recommendations for an analysis.
 */
export interface AnalysisLOPARecommendationSummary {
  /** Analysis ID */
  analysisId: string;
  /** Analysis name */
  analysisName: string;
  /** Total entries in the analysis */
  totalEntries: number;
  /** Entries with risk assessment */
  assessedEntries: number;
  /** Entries where LOPA is recommended */
  recommendedCount: number;
  /** Entries where LOPA is required (mandatory) */
  requiredCount: number;
  /** Entries with existing LOPA analysis */
  existingLOPACount: number;
  /** Entries needing LOPA (recommended or required but no existing LOPA) */
  pendingLOPACount: number;
  /** Entries where LOPA is recommended */
  recommendedEntries: EntryLOPARecommendation[];
  /** Trigger configuration used */
  triggerConfig: LOPATriggerConfig;
}

/**
 * Summary of LOPA recommendations for a project.
 */
export interface ProjectLOPARecommendationSummary {
  /** Project ID */
  projectId: string;
  /** Project name */
  projectName: string;
  /** Total analyses in the project */
  totalAnalyses: number;
  /** Total entries across all analyses */
  totalEntries: number;
  /** Total assessed entries */
  assessedEntries: number;
  /** Total entries where LOPA is recommended */
  totalRecommendedCount: number;
  /** Total entries where LOPA is required */
  totalRequiredCount: number;
  /** Total entries with existing LOPA analysis */
  totalExistingLOPACount: number;
  /** Total entries needing LOPA */
  totalPendingLOPACount: number;
  /** Per-analysis summaries */
  analysisSummaries: AnalysisLOPARecommendationSummary[];
  /** Top priority entries needing LOPA (highest risk first) */
  priorityEntries: EntryLOPARecommendation[];
  /** Trigger configuration used */
  triggerConfig: LOPATriggerConfig;
}

/**
 * Database row for entry risk data.
 */
interface EntryRiskRow {
  id: string;
  node_id: string;
  node_identifier: string;
  guide_word: GuideWord;
  parameter: string;
  deviation: string;
  severity: number | null;
  likelihood: number | null;
  detectability: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  has_lopa: boolean;
}

/**
 * Database row for analysis metadata.
 */
interface AnalysisMetaRow {
  id: string;
  name: string;
}

// ============================================================================
// Single Entry Functions
// ============================================================================

/**
 * Check if LOPA is recommended for a single risk ranking.
 *
 * This is a convenience wrapper around checkLOPATrigger that works with
 * a RiskRanking object directly.
 *
 * @param riskRanking - The risk ranking to evaluate
 * @param config - Optional trigger configuration (defaults to standard)
 * @returns LOPA trigger result
 */
export function checkLOPARecommendationForRanking(
  riskRanking: RiskRanking,
  config: LOPATriggerConfig = DEFAULT_LOPA_TRIGGER_CONFIG
): LOPATriggerResult {
  return checkLOPATrigger(riskRanking, config);
}

/**
 * Check if LOPA is recommended based on individual risk factors.
 *
 * Useful when the full RiskRanking object is not available.
 *
 * @param severity - Severity level (1-5)
 * @param likelihood - Likelihood level (1-5)
 * @param detectability - Detectability level (1-5)
 * @param config - Optional trigger configuration (defaults to standard)
 * @returns LOPA trigger result
 */
export function checkLOPARecommendationForFactors(
  severity: SeverityLevel,
  likelihood: LikelihoodLevel,
  detectability: DetectabilityLevel,
  config: LOPATriggerConfig = DEFAULT_LOPA_TRIGGER_CONFIG
): LOPATriggerResult {
  const riskScore = severity * likelihood * detectability;
  let riskLevel: RiskLevel = 'low';

  if (riskScore >= 61) {
    riskLevel = 'high';
  } else if (riskScore >= 21) {
    riskLevel = 'medium';
  }

  const riskRanking: RiskRanking = {
    severity,
    likelihood,
    detectability,
    riskScore,
    riskLevel,
  };

  return checkLOPATrigger(riskRanking, config);
}

/**
 * Quick check if LOPA is recommended based on severity and likelihood only.
 *
 * This is a simplified check useful when detectability is not yet assessed.
 * Uses the isLOPARecommended function from lopa-calculation.service.
 *
 * @param severity - Severity level (1-5)
 * @param likelihood - Likelihood level (1-5)
 * @returns Whether LOPA is recommended
 */
export function isLOPARecommendedSimple(
  severity: SeverityLevel,
  likelihood: LikelihoodLevel
): boolean {
  return isLOPARecommended(severity, likelihood);
}

// ============================================================================
// Entry-Level Database Functions
// ============================================================================

/**
 * Check if the lopa_analyses table exists.
 * This is a helper for graceful degradation while the table is being created.
 */
async function checkLOPATableExists(): Promise<boolean> {
  const pool = getPool();
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'hazop' AND table_name = 'lopa_analyses'
       ) AS exists`
    );
    return result.rows[0]?.exists ?? false;
  } catch {
    return false;
  }
}

/**
 * Get LOPA recommendation for a single entry by ID.
 *
 * @param entryId - The analysis entry ID
 * @param config - Optional trigger configuration
 * @returns Entry LOPA recommendation, or null if entry not found
 */
export async function getEntryLOPARecommendation(
  entryId: string,
  config: LOPATriggerConfig = DEFAULT_LOPA_TRIGGER_CONFIG
): Promise<EntryLOPARecommendation | null> {
  const pool = getPool();
  const lopaTableExists = await checkLOPATableExists();

  // Query with or without LOPA table check depending on whether table exists
  const hasLopaSubquery = lopaTableExists
    ? `EXISTS(SELECT 1 FROM hazop.lopa_analyses la WHERE la.analysis_entry_id = ae.id)`
    : `FALSE`;

  const result = await pool.query<EntryRiskRow>(
    `SELECT
       ae.id,
       ae.node_id,
       an.node_identifier,
       ae.guide_word,
       ae.parameter,
       ae.deviation,
       ae.severity,
       ae.likelihood,
       ae.detectability,
       ae.risk_score,
       ae.risk_level,
       ${hasLopaSubquery} AS has_lopa
     FROM hazop.analysis_entries ae
     JOIN hazop.analysis_nodes an ON ae.node_id = an.id
     WHERE ae.id = $1`,
    [entryId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return mapEntryToRecommendation(row, config);
}

/**
 * Get LOPA recommendations for multiple entries by IDs.
 *
 * @param entryIds - Array of entry IDs
 * @param config - Optional trigger configuration
 * @returns Array of entry LOPA recommendations (entries not found are omitted)
 */
export async function getEntriesLOPARecommendations(
  entryIds: string[],
  config: LOPATriggerConfig = DEFAULT_LOPA_TRIGGER_CONFIG
): Promise<EntryLOPARecommendation[]> {
  if (entryIds.length === 0) {
    return [];
  }

  const pool = getPool();
  const lopaTableExists = await checkLOPATableExists();

  const hasLopaSubquery = lopaTableExists
    ? `EXISTS(SELECT 1 FROM hazop.lopa_analyses la WHERE la.analysis_entry_id = ae.id)`
    : `FALSE`;

  const result = await pool.query<EntryRiskRow>(
    `SELECT
       ae.id,
       ae.node_id,
       an.node_identifier,
       ae.guide_word,
       ae.parameter,
       ae.deviation,
       ae.severity,
       ae.likelihood,
       ae.detectability,
       ae.risk_score,
       ae.risk_level,
       ${hasLopaSubquery} AS has_lopa
     FROM hazop.analysis_entries ae
     JOIN hazop.analysis_nodes an ON ae.node_id = an.id
     WHERE ae.id = ANY($1)
     ORDER BY ae.risk_score DESC NULLS LAST`,
    [entryIds]
  );

  return result.rows.map((row) => mapEntryToRecommendation(row, config));
}

// ============================================================================
// Analysis-Level Functions
// ============================================================================

/**
 * Get LOPA recommendations for all entries in an analysis.
 *
 * Returns entries where LOPA is recommended, sorted by risk score descending.
 *
 * @param analysisId - The analysis session ID
 * @param config - Optional trigger configuration
 * @returns Analysis LOPA recommendation summary, or null if analysis not found
 */
export async function getAnalysisLOPARecommendations(
  analysisId: string,
  config: LOPATriggerConfig = DEFAULT_LOPA_TRIGGER_CONFIG
): Promise<AnalysisLOPARecommendationSummary | null> {
  const pool = getPool();
  const lopaTableExists = await checkLOPATableExists();

  // Get analysis metadata
  const analysisResult = await pool.query<AnalysisMetaRow>(
    `SELECT id, name FROM hazop.hazop_analyses WHERE id = $1`,
    [analysisId]
  );

  if (analysisResult.rows.length === 0) {
    return null;
  }

  const analysis = analysisResult.rows[0];

  const hasLopaSubquery = lopaTableExists
    ? `EXISTS(SELECT 1 FROM hazop.lopa_analyses la WHERE la.analysis_entry_id = ae.id)`
    : `FALSE`;

  // Get all entries with their risk data
  const entriesResult = await pool.query<EntryRiskRow>(
    `SELECT
       ae.id,
       ae.node_id,
       an.node_identifier,
       ae.guide_word,
       ae.parameter,
       ae.deviation,
       ae.severity,
       ae.likelihood,
       ae.detectability,
       ae.risk_score,
       ae.risk_level,
       ${hasLopaSubquery} AS has_lopa
     FROM hazop.analysis_entries ae
     JOIN hazop.analysis_nodes an ON ae.node_id = an.id
     WHERE ae.analysis_id = $1
     ORDER BY ae.risk_score DESC NULLS LAST`,
    [analysisId]
  );

  // Process entries
  const entries = entriesResult.rows;
  const totalEntries = entries.length;
  const assessedEntries = entries.filter((e) => e.risk_score !== null).length;

  let recommendedCount = 0;
  let requiredCount = 0;
  let existingLOPACount = 0;
  const recommendedEntries: EntryLOPARecommendation[] = [];

  for (const row of entries) {
    const recommendation = mapEntryToRecommendation(row, config);

    if (row.has_lopa) {
      existingLOPACount++;
    }

    if (recommendation.lopaTrigger.recommended) {
      recommendedCount++;
      recommendedEntries.push(recommendation);

      if (recommendation.lopaTrigger.required) {
        requiredCount++;
      }
    }
  }

  // Calculate pending LOPA count (recommended but no existing LOPA)
  const pendingLOPACount = recommendedEntries.filter((e) => !e.hasExistingLOPA).length;

  return {
    analysisId: analysis.id,
    analysisName: analysis.name,
    totalEntries,
    assessedEntries,
    recommendedCount,
    requiredCount,
    existingLOPACount,
    pendingLOPACount,
    recommendedEntries,
    triggerConfig: config,
  };
}

/**
 * Get entries in an analysis that need LOPA but don't have one.
 *
 * Convenience function that returns only the pending entries.
 *
 * @param analysisId - The analysis session ID
 * @param config - Optional trigger configuration
 * @returns Array of entries needing LOPA, or null if analysis not found
 */
export async function getAnalysisPendingLOPAEntries(
  analysisId: string,
  config: LOPATriggerConfig = DEFAULT_LOPA_TRIGGER_CONFIG
): Promise<EntryLOPARecommendation[] | null> {
  const summary = await getAnalysisLOPARecommendations(analysisId, config);

  if (!summary) {
    return null;
  }

  return summary.recommendedEntries.filter((e) => !e.hasExistingLOPA);
}

/**
 * Check if an analysis has any entries needing LOPA.
 *
 * @param analysisId - The analysis session ID
 * @param config - Optional trigger configuration
 * @returns Object with counts, or null if analysis not found
 */
export async function hasAnalysisPendingLOPA(
  analysisId: string,
  config: LOPATriggerConfig = DEFAULT_LOPA_TRIGGER_CONFIG
): Promise<{ hasPending: boolean; pendingCount: number; requiredCount: number } | null> {
  const summary = await getAnalysisLOPARecommendations(analysisId, config);

  if (!summary) {
    return null;
  }

  return {
    hasPending: summary.pendingLOPACount > 0,
    pendingCount: summary.pendingLOPACount,
    requiredCount: summary.requiredCount,
  };
}

// ============================================================================
// Project-Level Functions
// ============================================================================

/**
 * Get LOPA recommendations summary for an entire project.
 *
 * Aggregates LOPA recommendations across all analyses in the project.
 *
 * @param projectId - The project ID
 * @param config - Optional trigger configuration
 * @param maxPriorityEntries - Maximum number of priority entries to return (default 20)
 * @returns Project LOPA recommendation summary, or null if project not found
 */
export async function getProjectLOPARecommendations(
  projectId: string,
  config: LOPATriggerConfig = DEFAULT_LOPA_TRIGGER_CONFIG,
  maxPriorityEntries: number = 20
): Promise<ProjectLOPARecommendationSummary | null> {
  const pool = getPool();

  // Get project info
  const projectResult = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM hazop.projects WHERE id = $1`,
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return null;
  }

  const project = projectResult.rows[0];

  // Get all analyses for the project
  const analysesResult = await pool.query<AnalysisMetaRow>(
    `SELECT id, name FROM hazop.hazop_analyses WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId]
  );

  // Process each analysis
  const analysisSummaries: AnalysisLOPARecommendationSummary[] = [];
  let totalEntries = 0;
  let assessedEntries = 0;
  let totalRecommendedCount = 0;
  let totalRequiredCount = 0;
  let totalExistingLOPACount = 0;
  let totalPendingLOPACount = 0;
  const allPriorityEntries: EntryLOPARecommendation[] = [];

  for (const analysis of analysesResult.rows) {
    const summary = await getAnalysisLOPARecommendations(analysis.id, config);

    if (summary) {
      analysisSummaries.push(summary);
      totalEntries += summary.totalEntries;
      assessedEntries += summary.assessedEntries;
      totalRecommendedCount += summary.recommendedCount;
      totalRequiredCount += summary.requiredCount;
      totalExistingLOPACount += summary.existingLOPACount;
      totalPendingLOPACount += summary.pendingLOPACount;

      // Collect pending entries for priority list
      const pendingEntries = summary.recommendedEntries.filter((e) => !e.hasExistingLOPA);
      allPriorityEntries.push(...pendingEntries);
    }
  }

  // Sort priority entries by risk score descending and take top N
  allPriorityEntries.sort((a, b) => {
    const scoreA = a.riskRanking?.riskScore ?? 0;
    const scoreB = b.riskRanking?.riskScore ?? 0;
    return scoreB - scoreA;
  });

  const priorityEntries = allPriorityEntries.slice(0, maxPriorityEntries);

  return {
    projectId: project.id,
    projectName: project.name,
    totalAnalyses: analysesResult.rows.length,
    totalEntries,
    assessedEntries,
    totalRecommendedCount,
    totalRequiredCount,
    totalExistingLOPACount,
    totalPendingLOPACount,
    analysisSummaries,
    priorityEntries,
    triggerConfig: config,
  };
}

/**
 * Check if a project has any entries needing LOPA.
 *
 * @param projectId - The project ID
 * @param config - Optional trigger configuration
 * @returns Object with counts, or null if project not found
 */
export async function hasProjectPendingLOPA(
  projectId: string,
  config: LOPATriggerConfig = DEFAULT_LOPA_TRIGGER_CONFIG
): Promise<{ hasPending: boolean; pendingCount: number; requiredCount: number } | null> {
  const summary = await getProjectLOPARecommendations(projectId, config, 0);

  if (!summary) {
    return null;
  }

  return {
    hasPending: summary.totalPendingLOPACount > 0,
    pendingCount: summary.totalPendingLOPACount,
    requiredCount: summary.totalRequiredCount,
  };
}

// ============================================================================
// Trigger Configuration Functions
// ============================================================================

/**
 * Create a custom LOPA trigger configuration.
 *
 * @param riskScoreThreshold - Minimum risk score to trigger LOPA recommendation
 * @param riskLevels - Risk levels that trigger LOPA recommendation
 * @param requiredSeverityLevels - Severity levels that require LOPA regardless of risk score
 * @returns Validated trigger configuration
 */
export function createLOPATriggerConfig(
  riskScoreThreshold: number,
  riskLevels: RiskLevel[],
  requiredSeverityLevels: SeverityLevel[]
): LOPATriggerConfig {
  // Validate risk score threshold
  if (riskScoreThreshold < 1 || riskScoreThreshold > 125) {
    throw new Error('Risk score threshold must be between 1 and 125');
  }

  // Validate risk levels
  const validRiskLevels: RiskLevel[] = ['low', 'medium', 'high'];
  for (const level of riskLevels) {
    if (!validRiskLevels.includes(level)) {
      throw new Error(`Invalid risk level: ${level}`);
    }
  }

  // Validate severity levels
  const validSeverityLevels: SeverityLevel[] = [1, 2, 3, 4, 5];
  for (const level of requiredSeverityLevels) {
    if (!validSeverityLevels.includes(level)) {
      throw new Error(`Invalid severity level: ${level}`);
    }
  }

  return {
    riskScoreThreshold,
    riskLevels,
    requiredSeverityLevels,
  };
}

/**
 * Get the default LOPA trigger configuration.
 *
 * @returns Default configuration
 */
export function getDefaultLOPATriggerConfig(): LOPATriggerConfig {
  return { ...DEFAULT_LOPA_TRIGGER_CONFIG };
}

/**
 * Create a conservative LOPA trigger configuration.
 *
 * Lower thresholds for high-consequence industries.
 *
 * @returns Conservative configuration
 */
export function getConservativeLOPATriggerConfig(): LOPATriggerConfig {
  return {
    riskScoreThreshold: 41, // Lower threshold
    riskLevels: ['medium', 'high'], // Include medium risk
    requiredSeverityLevels: [3, 4, 5], // Include Moderate severity
  };
}

/**
 * Create a relaxed LOPA trigger configuration.
 *
 * Higher thresholds for environments with established safeguards.
 *
 * @returns Relaxed configuration
 */
export function getRelaxedLOPATriggerConfig(): LOPATriggerConfig {
  return {
    riskScoreThreshold: 81, // Higher threshold
    riskLevels: ['high'], // Only high risk
    requiredSeverityLevels: [5], // Only Catastrophic
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map a database row to an EntryLOPARecommendation.
 *
 * @param row - The database row
 * @param config - Trigger configuration
 * @returns Entry LOPA recommendation
 */
function mapEntryToRecommendation(
  row: EntryRiskRow,
  config: LOPATriggerConfig
): EntryLOPARecommendation {
  // Build risk ranking if assessed
  let riskRanking: RiskRanking | null = null;
  if (
    row.severity !== null &&
    row.likelihood !== null &&
    row.detectability !== null &&
    row.risk_score !== null &&
    row.risk_level !== null
  ) {
    riskRanking = {
      severity: row.severity as SeverityLevel,
      likelihood: row.likelihood as LikelihoodLevel,
      detectability: row.detectability as DetectabilityLevel,
      riskScore: row.risk_score,
      riskLevel: row.risk_level,
    };
  }

  // Check LOPA trigger
  let lopaTrigger: LOPATriggerResult;
  if (riskRanking) {
    lopaTrigger = checkLOPATrigger(riskRanking, config);
  } else {
    // Not assessed - LOPA not applicable
    lopaTrigger = {
      recommended: false,
      required: false,
      reason: 'Entry has not been risk assessed - LOPA evaluation requires risk ranking',
    };
  }

  return {
    entryId: row.id,
    nodeId: row.node_id,
    nodeIdentifier: row.node_identifier,
    guideWord: row.guide_word,
    parameter: row.parameter,
    deviation: row.deviation,
    riskRanking,
    lopaTrigger,
    hasExistingLOPA: row.has_lopa,
  };
}
