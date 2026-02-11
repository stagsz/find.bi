/**
 * Risk Aggregation Service.
 *
 * Provides functions for aggregating risk scores across analysis sessions,
 * calculating comprehensive statistics, and generating breakdowns by node
 * and guide word. Integrates with configurable thresholds from RISK-03.
 *
 * This service is the main entry point for risk score aggregation (RISK-04).
 */

import { getPool } from '../config/database.config.js';
import type { RiskLevel, GuideWord, RiskRanking } from '@hazop/types';
import {
  calculateRiskStatistics,
  getRiskDistribution,
  type RiskStatistics,
} from './risk-calculation.service.js';
import {
  type RiskThresholdConfig,
  determineRiskLevelWithConfig,
  getDefaultRiskThresholds,
} from './risk-threshold-config.service.js';

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Raw entry row with risk data from the database.
 */
interface RiskEntryRow {
  id: string;
  node_id: string;
  guide_word: GuideWord;
  parameter: string;
  severity: number | null;
  likelihood: number | null;
  detectability: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
}

/**
 * Aggregated counts by risk level from database query.
 */
interface RiskCountsRow {
  total_entries: string;
  assessed_entries: string;
  high_risk_count: string;
  medium_risk_count: string;
  low_risk_count: string;
  avg_risk_score: string | null;
  max_risk_score: string | null;
  min_risk_score: string | null;
}

/**
 * Node-level risk aggregation row from database.
 */
interface NodeRiskRow {
  node_id: string;
  node_identifier: string;
  node_description: string | null;
  equipment_type: string;
  entry_count: string;
  assessed_count: string;
  high_risk_count: string;
  medium_risk_count: string;
  low_risk_count: string;
  avg_risk_score: string | null;
  max_risk_score: string | null;
}

/**
 * Guide word-level risk aggregation row from database.
 */
interface GuideWordRiskRow {
  guide_word: GuideWord;
  entry_count: string;
  assessed_count: string;
  high_risk_count: string;
  medium_risk_count: string;
  low_risk_count: string;
  avg_risk_score: string | null;
  max_risk_score: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Risk distribution percentages.
 */
export interface RiskDistribution {
  /** Percentage of low risk entries */
  low: number;
  /** Percentage of medium risk entries */
  medium: number;
  /** Percentage of high risk entries */
  high: number;
}

/**
 * Comprehensive risk aggregation for an analysis session.
 */
export interface AnalysisRiskAggregation {
  /** Analysis session ID */
  analysisId: string;
  /** Basic statistics */
  statistics: RiskStatistics;
  /** Risk level distribution as percentages (null if no assessed entries) */
  distribution: RiskDistribution | null;
  /** Score percentiles for assessed entries */
  percentiles: ScorePercentiles | null;
  /** Breakdown by node */
  byNode: NodeRiskSummary[];
  /** Breakdown by guide word */
  byGuideWord: GuideWordRiskSummary[];
  /** Highest risk entries (up to 10) */
  highestRiskEntries: HighRiskEntry[];
  /** Threshold configuration used for classification */
  thresholds: RiskThresholdConfig;
}

/**
 * Score percentiles for risk score distribution analysis.
 */
export interface ScorePercentiles {
  /** 25th percentile (first quartile) */
  p25: number;
  /** 50th percentile (median) */
  p50: number;
  /** 75th percentile (third quartile) */
  p75: number;
  /** 90th percentile */
  p90: number;
  /** 95th percentile */
  p95: number;
}

/**
 * Risk summary for a single node.
 */
export interface NodeRiskSummary {
  /** Node ID */
  nodeId: string;
  /** Node identifier (user-assigned) */
  nodeIdentifier: string;
  /** Node description */
  nodeDescription: string | null;
  /** Equipment type */
  equipmentType: string;
  /** Total entries for this node */
  entryCount: number;
  /** Entries with risk assessment */
  assessedCount: number;
  /** Count of high risk entries */
  highRiskCount: number;
  /** Count of medium risk entries */
  mediumRiskCount: number;
  /** Count of low risk entries */
  lowRiskCount: number;
  /** Average risk score (null if no assessed entries) */
  averageRiskScore: number | null;
  /** Maximum risk score (null if no assessed entries) */
  maxRiskScore: number | null;
  /** Overall risk level for the node (based on max score) */
  overallRiskLevel: RiskLevel | null;
}

/**
 * Risk summary for a guide word.
 */
export interface GuideWordRiskSummary {
  /** Guide word */
  guideWord: GuideWord;
  /** Total entries for this guide word */
  entryCount: number;
  /** Entries with risk assessment */
  assessedCount: number;
  /** Count of high risk entries */
  highRiskCount: number;
  /** Count of medium risk entries */
  mediumRiskCount: number;
  /** Count of low risk entries */
  lowRiskCount: number;
  /** Average risk score (null if no assessed entries) */
  averageRiskScore: number | null;
  /** Maximum risk score (null if no assessed entries) */
  maxRiskScore: number | null;
}

/**
 * High risk entry information for the highest risk entries list.
 */
export interface HighRiskEntry {
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
  /** Risk ranking */
  riskRanking: RiskRanking;
}

// ============================================================================
// Aggregation Functions
// ============================================================================

/**
 * Get comprehensive risk aggregation for an analysis session.
 *
 * Aggregates all risk data for the specified analysis, including:
 * - Overall statistics (counts, averages, min/max)
 * - Risk level distribution
 * - Score percentiles
 * - Breakdown by node
 * - Breakdown by guide word
 * - List of highest risk entries
 *
 * @param analysisId - The analysis session ID
 * @param thresholdConfig - Optional custom threshold configuration (defaults to standard)
 * @returns Comprehensive risk aggregation, or null if analysis not found
 */
export async function getAnalysisRiskAggregation(
  analysisId: string,
  thresholdConfig?: RiskThresholdConfig
): Promise<AnalysisRiskAggregation | null> {
  const pool = getPool();
  const thresholds = thresholdConfig ?? getDefaultRiskThresholds();

  // Check if analysis exists
  const analysisExists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hazop.hazop_analyses WHERE id = $1) AS exists`,
    [analysisId]
  );

  if (!analysisExists.rows[0]?.exists) {
    return null;
  }

  // Execute all queries in parallel for efficiency
  const [
    statisticsResult,
    scoresResult,
    byNodeResult,
    byGuideWordResult,
    highestRiskResult,
  ] = await Promise.all([
    // Overall statistics
    pool.query<RiskCountsRow>(
      `SELECT
         COUNT(*) AS total_entries,
         COUNT(risk_score) AS assessed_entries,
         COUNT(*) FILTER (WHERE risk_level = 'high') AS high_risk_count,
         COUNT(*) FILTER (WHERE risk_level = 'medium') AS medium_risk_count,
         COUNT(*) FILTER (WHERE risk_level = 'low') AS low_risk_count,
         AVG(risk_score) AS avg_risk_score,
         MAX(risk_score) AS max_risk_score,
         MIN(risk_score) AS min_risk_score
       FROM hazop.analysis_entries
       WHERE analysis_id = $1`,
      [analysisId]
    ),

    // All risk scores for percentile calculation
    pool.query<{ risk_score: number }>(
      `SELECT risk_score
       FROM hazop.analysis_entries
       WHERE analysis_id = $1 AND risk_score IS NOT NULL
       ORDER BY risk_score`,
      [analysisId]
    ),

    // By node
    pool.query<NodeRiskRow>(
      `SELECT
         an.id AS node_id,
         an.node_identifier,
         an.description AS node_description,
         an.equipment_type,
         COUNT(ae.id) AS entry_count,
         COUNT(ae.risk_score) AS assessed_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'high') AS high_risk_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'medium') AS medium_risk_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'low') AS low_risk_count,
         AVG(ae.risk_score) AS avg_risk_score,
         MAX(ae.risk_score) AS max_risk_score
       FROM hazop.analysis_nodes an
       LEFT JOIN hazop.analysis_entries ae ON ae.node_id = an.id AND ae.analysis_id = $1
       WHERE an.document_id = (SELECT document_id FROM hazop.hazop_analyses WHERE id = $1)
       GROUP BY an.id, an.node_identifier, an.description, an.equipment_type
       ORDER BY MAX(ae.risk_score) DESC NULLS LAST, an.node_identifier`,
      [analysisId]
    ),

    // By guide word
    pool.query<GuideWordRiskRow>(
      `SELECT
         guide_word,
         COUNT(*) AS entry_count,
         COUNT(risk_score) AS assessed_count,
         COUNT(*) FILTER (WHERE risk_level = 'high') AS high_risk_count,
         COUNT(*) FILTER (WHERE risk_level = 'medium') AS medium_risk_count,
         COUNT(*) FILTER (WHERE risk_level = 'low') AS low_risk_count,
         AVG(risk_score) AS avg_risk_score,
         MAX(risk_score) AS max_risk_score
       FROM hazop.analysis_entries
       WHERE analysis_id = $1
       GROUP BY guide_word
       ORDER BY MAX(risk_score) DESC NULLS LAST`,
      [analysisId]
    ),

    // Highest risk entries (top 10)
    pool.query<RiskEntryRow & { node_identifier: string }>(
      `SELECT
         ae.id,
         ae.node_id,
         an.node_identifier,
         ae.guide_word,
         ae.parameter,
         ae.severity,
         ae.likelihood,
         ae.detectability,
         ae.risk_score,
         ae.risk_level
       FROM hazop.analysis_entries ae
       JOIN hazop.analysis_nodes an ON ae.node_id = an.id
       WHERE ae.analysis_id = $1 AND ae.risk_score IS NOT NULL
       ORDER BY ae.risk_score DESC
       LIMIT 10`,
      [analysisId]
    ),
  ]);

  // Parse statistics
  const statsRow = statisticsResult.rows[0];
  const totalEntries = parseInt(statsRow.total_entries, 10);
  const assessedEntries = parseInt(statsRow.assessed_entries, 10);
  const unassessedEntries = totalEntries - assessedEntries;
  const highRiskCount = parseInt(statsRow.high_risk_count, 10);
  const mediumRiskCount = parseInt(statsRow.medium_risk_count, 10);
  const lowRiskCount = parseInt(statsRow.low_risk_count, 10);
  const averageRiskScore = statsRow.avg_risk_score !== null
    ? parseFloat(statsRow.avg_risk_score)
    : null;
  const maxRiskScore = statsRow.max_risk_score !== null
    ? parseInt(statsRow.max_risk_score, 10)
    : null;
  const minRiskScore = statsRow.min_risk_score !== null
    ? parseInt(statsRow.min_risk_score, 10)
    : null;

  const statistics: RiskStatistics = {
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

  // Calculate distribution
  let distribution: RiskDistribution | null = null;
  if (assessedEntries > 0) {
    distribution = {
      low: (lowRiskCount / assessedEntries) * 100,
      medium: (mediumRiskCount / assessedEntries) * 100,
      high: (highRiskCount / assessedEntries) * 100,
    };
  }

  // Calculate percentiles
  const scores = scoresResult.rows.map((r) => r.risk_score);
  const percentiles = calculatePercentiles(scores);

  // Map node summaries
  const byNode: NodeRiskSummary[] = byNodeResult.rows.map((row) => {
    const maxScore = row.max_risk_score !== null
      ? parseInt(row.max_risk_score, 10)
      : null;

    return {
      nodeId: row.node_id,
      nodeIdentifier: row.node_identifier,
      nodeDescription: row.node_description,
      equipmentType: row.equipment_type,
      entryCount: parseInt(row.entry_count, 10),
      assessedCount: parseInt(row.assessed_count, 10),
      highRiskCount: parseInt(row.high_risk_count, 10),
      mediumRiskCount: parseInt(row.medium_risk_count, 10),
      lowRiskCount: parseInt(row.low_risk_count, 10),
      averageRiskScore: row.avg_risk_score !== null
        ? parseFloat(row.avg_risk_score)
        : null,
      maxRiskScore: maxScore,
      overallRiskLevel: maxScore !== null
        ? determineRiskLevelWithConfig(maxScore, thresholds)
        : null,
    };
  });

  // Map guide word summaries
  const byGuideWord: GuideWordRiskSummary[] = byGuideWordResult.rows.map((row) => ({
    guideWord: row.guide_word,
    entryCount: parseInt(row.entry_count, 10),
    assessedCount: parseInt(row.assessed_count, 10),
    highRiskCount: parseInt(row.high_risk_count, 10),
    mediumRiskCount: parseInt(row.medium_risk_count, 10),
    lowRiskCount: parseInt(row.low_risk_count, 10),
    averageRiskScore: row.avg_risk_score !== null
      ? parseFloat(row.avg_risk_score)
      : null,
    maxRiskScore: row.max_risk_score !== null
      ? parseInt(row.max_risk_score, 10)
      : null,
  }));

  // Map highest risk entries
  const highestRiskEntries: HighRiskEntry[] = highestRiskResult.rows.map((row) => ({
    entryId: row.id,
    nodeId: row.node_id,
    nodeIdentifier: row.node_identifier,
    guideWord: row.guide_word,
    parameter: row.parameter,
    riskRanking: {
      severity: row.severity as 1 | 2 | 3 | 4 | 5,
      likelihood: row.likelihood as 1 | 2 | 3 | 4 | 5,
      detectability: row.detectability as 1 | 2 | 3 | 4 | 5,
      riskScore: row.risk_score!,
      riskLevel: row.risk_level!,
    },
  }));

  return {
    analysisId,
    statistics,
    distribution,
    percentiles,
    byNode,
    byGuideWord,
    highestRiskEntries,
    thresholds,
  };
}

/**
 * Get basic risk statistics for an analysis session.
 *
 * A lightweight alternative to full aggregation when only basic statistics are needed.
 *
 * @param analysisId - The analysis session ID
 * @returns Basic risk statistics, or null if analysis not found
 */
export async function getAnalysisRiskStatistics(
  analysisId: string
): Promise<RiskStatistics | null> {
  const pool = getPool();

  const result = await pool.query<RiskCountsRow>(
    `SELECT
       COUNT(*) AS total_entries,
       COUNT(risk_score) AS assessed_entries,
       COUNT(*) FILTER (WHERE risk_level = 'high') AS high_risk_count,
       COUNT(*) FILTER (WHERE risk_level = 'medium') AS medium_risk_count,
       COUNT(*) FILTER (WHERE risk_level = 'low') AS low_risk_count,
       AVG(risk_score) AS avg_risk_score,
       MAX(risk_score) AS max_risk_score,
       MIN(risk_score) AS min_risk_score
     FROM hazop.analysis_entries
     WHERE analysis_id = $1`,
    [analysisId]
  );

  // Check if analysis exists (totalEntries will be 0 for non-existent analysis)
  const analysisExists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hazop.hazop_analyses WHERE id = $1) AS exists`,
    [analysisId]
  );

  if (!analysisExists.rows[0]?.exists) {
    return null;
  }

  const row = result.rows[0];

  return {
    totalEntries: parseInt(row.total_entries, 10),
    assessedEntries: parseInt(row.assessed_entries, 10),
    unassessedEntries: parseInt(row.total_entries, 10) - parseInt(row.assessed_entries, 10),
    highRiskCount: parseInt(row.high_risk_count, 10),
    mediumRiskCount: parseInt(row.medium_risk_count, 10),
    lowRiskCount: parseInt(row.low_risk_count, 10),
    averageRiskScore: row.avg_risk_score !== null
      ? parseFloat(row.avg_risk_score)
      : null,
    maxRiskScore: row.max_risk_score !== null
      ? parseInt(row.max_risk_score, 10)
      : null,
    minRiskScore: row.min_risk_score !== null
      ? parseInt(row.min_risk_score, 10)
      : null,
  };
}

/**
 * Get risk distribution for an analysis session.
 *
 * @param analysisId - The analysis session ID
 * @returns Risk distribution percentages, or null if no assessed entries or analysis not found
 */
export async function getAnalysisRiskDistribution(
  analysisId: string
): Promise<RiskDistribution | null> {
  const stats = await getAnalysisRiskStatistics(analysisId);

  if (!stats || stats.assessedEntries === 0) {
    return null;
  }

  return {
    low: (stats.lowRiskCount / stats.assessedEntries) * 100,
    medium: (stats.mediumRiskCount / stats.assessedEntries) * 100,
    high: (stats.highRiskCount / stats.assessedEntries) * 100,
  };
}

/**
 * Get risk breakdown by node for an analysis session.
 *
 * @param analysisId - The analysis session ID
 * @param thresholdConfig - Optional custom threshold configuration
 * @returns Array of node risk summaries, or null if analysis not found
 */
export async function getAnalysisRiskByNode(
  analysisId: string,
  thresholdConfig?: RiskThresholdConfig
): Promise<NodeRiskSummary[] | null> {
  const pool = getPool();
  const thresholds = thresholdConfig ?? getDefaultRiskThresholds();

  // Check if analysis exists
  const analysisExists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hazop.hazop_analyses WHERE id = $1) AS exists`,
    [analysisId]
  );

  if (!analysisExists.rows[0]?.exists) {
    return null;
  }

  const result = await pool.query<NodeRiskRow>(
    `SELECT
       an.id AS node_id,
       an.node_identifier,
       an.description AS node_description,
       an.equipment_type,
       COUNT(ae.id) AS entry_count,
       COUNT(ae.risk_score) AS assessed_count,
       COUNT(*) FILTER (WHERE ae.risk_level = 'high') AS high_risk_count,
       COUNT(*) FILTER (WHERE ae.risk_level = 'medium') AS medium_risk_count,
       COUNT(*) FILTER (WHERE ae.risk_level = 'low') AS low_risk_count,
       AVG(ae.risk_score) AS avg_risk_score,
       MAX(ae.risk_score) AS max_risk_score
     FROM hazop.analysis_nodes an
     LEFT JOIN hazop.analysis_entries ae ON ae.node_id = an.id AND ae.analysis_id = $1
     WHERE an.document_id = (SELECT document_id FROM hazop.hazop_analyses WHERE id = $1)
     GROUP BY an.id, an.node_identifier, an.description, an.equipment_type
     ORDER BY MAX(ae.risk_score) DESC NULLS LAST, an.node_identifier`,
    [analysisId]
  );

  return result.rows.map((row) => {
    const maxScore = row.max_risk_score !== null
      ? parseInt(row.max_risk_score, 10)
      : null;

    return {
      nodeId: row.node_id,
      nodeIdentifier: row.node_identifier,
      nodeDescription: row.node_description,
      equipmentType: row.equipment_type,
      entryCount: parseInt(row.entry_count, 10),
      assessedCount: parseInt(row.assessed_count, 10),
      highRiskCount: parseInt(row.high_risk_count, 10),
      mediumRiskCount: parseInt(row.medium_risk_count, 10),
      lowRiskCount: parseInt(row.low_risk_count, 10),
      averageRiskScore: row.avg_risk_score !== null
        ? parseFloat(row.avg_risk_score)
        : null,
      maxRiskScore: maxScore,
      overallRiskLevel: maxScore !== null
        ? determineRiskLevelWithConfig(maxScore, thresholds)
        : null,
    };
  });
}

/**
 * Get risk breakdown by guide word for an analysis session.
 *
 * @param analysisId - The analysis session ID
 * @returns Array of guide word risk summaries, or null if analysis not found
 */
export async function getAnalysisRiskByGuideWord(
  analysisId: string
): Promise<GuideWordRiskSummary[] | null> {
  const pool = getPool();

  // Check if analysis exists
  const analysisExists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hazop.hazop_analyses WHERE id = $1) AS exists`,
    [analysisId]
  );

  if (!analysisExists.rows[0]?.exists) {
    return null;
  }

  const result = await pool.query<GuideWordRiskRow>(
    `SELECT
       guide_word,
       COUNT(*) AS entry_count,
       COUNT(risk_score) AS assessed_count,
       COUNT(*) FILTER (WHERE risk_level = 'high') AS high_risk_count,
       COUNT(*) FILTER (WHERE risk_level = 'medium') AS medium_risk_count,
       COUNT(*) FILTER (WHERE risk_level = 'low') AS low_risk_count,
       AVG(risk_score) AS avg_risk_score,
       MAX(risk_score) AS max_risk_score
     FROM hazop.analysis_entries
     WHERE analysis_id = $1
     GROUP BY guide_word
     ORDER BY MAX(risk_score) DESC NULLS LAST`,
    [analysisId]
  );

  return result.rows.map((row) => ({
    guideWord: row.guide_word,
    entryCount: parseInt(row.entry_count, 10),
    assessedCount: parseInt(row.assessed_count, 10),
    highRiskCount: parseInt(row.high_risk_count, 10),
    mediumRiskCount: parseInt(row.medium_risk_count, 10),
    lowRiskCount: parseInt(row.low_risk_count, 10),
    averageRiskScore: row.avg_risk_score !== null
      ? parseFloat(row.avg_risk_score)
      : null,
    maxRiskScore: row.max_risk_score !== null
      ? parseInt(row.max_risk_score, 10)
      : null,
  }));
}

/**
 * Get the highest risk entries for an analysis session.
 *
 * @param analysisId - The analysis session ID
 * @param limit - Maximum number of entries to return (default 10, max 100)
 * @returns Array of high risk entries, or null if analysis not found
 */
export async function getHighestRiskEntries(
  analysisId: string,
  limit: number = 10
): Promise<HighRiskEntry[] | null> {
  const pool = getPool();
  const effectiveLimit = Math.min(Math.max(limit, 1), 100);

  // Check if analysis exists
  const analysisExists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hazop.hazop_analyses WHERE id = $1) AS exists`,
    [analysisId]
  );

  if (!analysisExists.rows[0]?.exists) {
    return null;
  }

  const result = await pool.query<RiskEntryRow & { node_identifier: string }>(
    `SELECT
       ae.id,
       ae.node_id,
       an.node_identifier,
       ae.guide_word,
       ae.parameter,
       ae.severity,
       ae.likelihood,
       ae.detectability,
       ae.risk_score,
       ae.risk_level
     FROM hazop.analysis_entries ae
     JOIN hazop.analysis_nodes an ON ae.node_id = an.id
     WHERE ae.analysis_id = $1 AND ae.risk_score IS NOT NULL
     ORDER BY ae.risk_score DESC
     LIMIT $2`,
    [analysisId, effectiveLimit]
  );

  return result.rows.map((row) => ({
    entryId: row.id,
    nodeId: row.node_id,
    nodeIdentifier: row.node_identifier,
    guideWord: row.guide_word,
    parameter: row.parameter,
    riskRanking: {
      severity: row.severity as 1 | 2 | 3 | 4 | 5,
      likelihood: row.likelihood as 1 | 2 | 3 | 4 | 5,
      detectability: row.detectability as 1 | 2 | 3 | 4 | 5,
      riskScore: row.risk_score!,
      riskLevel: row.risk_level!,
    },
  }));
}

/**
 * Get entries with a specific risk level.
 *
 * @param analysisId - The analysis session ID
 * @param riskLevel - The risk level to filter by
 * @returns Array of entries with the specified risk level, or null if analysis not found
 */
export async function getEntriesByRiskLevel(
  analysisId: string,
  riskLevel: RiskLevel
): Promise<HighRiskEntry[] | null> {
  const pool = getPool();

  // Check if analysis exists
  const analysisExists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hazop.hazop_analyses WHERE id = $1) AS exists`,
    [analysisId]
  );

  if (!analysisExists.rows[0]?.exists) {
    return null;
  }

  const result = await pool.query<RiskEntryRow & { node_identifier: string }>(
    `SELECT
       ae.id,
       ae.node_id,
       an.node_identifier,
       ae.guide_word,
       ae.parameter,
       ae.severity,
       ae.likelihood,
       ae.detectability,
       ae.risk_score,
       ae.risk_level
     FROM hazop.analysis_entries ae
     JOIN hazop.analysis_nodes an ON ae.node_id = an.id
     WHERE ae.analysis_id = $1 AND ae.risk_level = $2
     ORDER BY ae.risk_score DESC`,
    [analysisId, riskLevel]
  );

  return result.rows.map((row) => ({
    entryId: row.id,
    nodeId: row.node_id,
    nodeIdentifier: row.node_identifier,
    guideWord: row.guide_word,
    parameter: row.parameter,
    riskRanking: {
      severity: row.severity as 1 | 2 | 3 | 4 | 5,
      likelihood: row.likelihood as 1 | 2 | 3 | 4 | 5,
      detectability: row.detectability as 1 | 2 | 3 | 4 | 5,
      riskScore: row.risk_score!,
      riskLevel: row.risk_level!,
    },
  }));
}

// ============================================================================
// In-Memory Aggregation Functions
// ============================================================================

/**
 * Aggregate risk rankings from an array (in-memory calculation).
 *
 * Useful when you already have the entries loaded and don't want to query the database.
 *
 * @param riskRankings - Array of risk rankings (null values represent unassessed entries)
 * @param thresholdConfig - Optional custom threshold configuration
 * @returns Aggregated statistics and distribution
 */
export function aggregateRiskRankings(
  riskRankings: (RiskRanking | null)[],
  thresholdConfig?: RiskThresholdConfig
): {
  statistics: RiskStatistics;
  distribution: RiskDistribution | null;
  percentiles: ScorePercentiles | null;
} {
  const statistics = calculateRiskStatistics(riskRankings);
  const distribution = getRiskDistribution(riskRankings);

  // Calculate percentiles from assessed rankings
  const scores = riskRankings
    .filter((r): r is RiskRanking => r !== null)
    .map((r) => r.riskScore)
    .sort((a, b) => a - b);

  const percentiles = calculatePercentiles(scores);

  return {
    statistics,
    distribution,
    percentiles,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percentiles from a sorted array of scores.
 *
 * @param sortedScores - Array of scores sorted in ascending order
 * @returns Percentile values, or null if array is empty
 */
function calculatePercentiles(sortedScores: number[]): ScorePercentiles | null {
  if (sortedScores.length === 0) {
    return null;
  }

  const getPercentile = (p: number): number => {
    const index = (p / 100) * (sortedScores.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const fraction = index - lower;

    if (lower === upper) {
      return sortedScores[lower];
    }

    return sortedScores[lower] + (sortedScores[upper] - sortedScores[lower]) * fraction;
  };

  return {
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75),
    p90: getPercentile(90),
    p95: getPercentile(95),
  };
}
