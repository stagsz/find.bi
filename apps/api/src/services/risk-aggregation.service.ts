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
  _thresholdConfig?: RiskThresholdConfig
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

// ============================================================================
// Project-Level Risk Dashboard Types (RISK-07)
// ============================================================================

/**
 * Summary of an individual analysis within a project for the dashboard.
 */
export interface AnalysisRiskSummary {
  /** Analysis session ID */
  analysisId: string;
  /** Analysis session name */
  analysisName: string;
  /** Analysis status */
  status: string;
  /** Lead analyst ID */
  leadAnalystId: string;
  /** Lead analyst name */
  leadAnalystName: string;
  /** Total entries in this analysis */
  entryCount: number;
  /** Assessed entries in this analysis */
  assessedEntries: number;
  /** Count of high risk entries */
  highRiskCount: number;
  /** Count of medium risk entries */
  mediumRiskCount: number;
  /** Count of low risk entries */
  lowRiskCount: number;
  /** Maximum risk score in this analysis (null if no assessed entries) */
  maxRiskScore: number | null;
  /** Overall risk level for this analysis (based on max score) */
  overallRiskLevel: RiskLevel | null;
  /** When the analysis was created */
  createdAt: Date;
  /** When the analysis was last updated */
  updatedAt: Date;
}

/**
 * Comprehensive risk dashboard for a project.
 * Aggregates risk data across all analyses in the project.
 */
export interface ProjectRiskDashboard {
  /** Project ID */
  projectId: string;
  /** Project name */
  projectName: string;
  /** Aggregated statistics across all analyses */
  statistics: {
    /** Total number of analyses in the project */
    totalAnalyses: number;
    /** Number of analyses currently in draft status */
    draftAnalyses: number;
    /** Number of analyses in review */
    inReviewAnalyses: number;
    /** Number of approved analyses */
    approvedAnalyses: number;
    /** Total entries across all analyses */
    totalEntries: number;
    /** Entries with risk assessment */
    assessedEntries: number;
    /** Entries without risk assessment */
    unassessedEntries: number;
    /** Count of high risk entries across project */
    highRiskCount: number;
    /** Count of medium risk entries across project */
    mediumRiskCount: number;
    /** Count of low risk entries across project */
    lowRiskCount: number;
    /** Average risk score across project (null if no assessed entries) */
    averageRiskScore: number | null;
    /** Maximum risk score in project (null if no assessed entries) */
    maxRiskScore: number | null;
    /** Minimum risk score in project (null if no assessed entries) */
    minRiskScore: number | null;
  };
  /** Risk level distribution as percentages (null if no assessed entries) */
  distribution: RiskDistribution | null;
  /** Score percentiles across all analyses (null if no assessed entries) */
  percentiles: ScorePercentiles | null;
  /** Per-analysis summaries ordered by max risk score descending */
  analysisSummaries: AnalysisRiskSummary[];
  /** Risk aggregated by node across all analyses */
  byNode: NodeRiskSummary[];
  /** Risk aggregated by guide word across all analyses */
  byGuideWord: GuideWordRiskSummary[];
  /** Top 20 highest risk entries across all analyses */
  highestRiskEntries: ProjectHighRiskEntry[];
  /** Threshold configuration used for classification */
  thresholds: RiskThresholdConfig;
}

/**
 * High risk entry with analysis name for project-level view.
 */
export interface ProjectHighRiskEntry extends HighRiskEntry {
  /** Analysis session ID (inherited from HighRiskEntry as analysisId is on the entry) */
  analysisId: string;
  /** Analysis session name */
  analysisName: string;
}

// ============================================================================
// Project-Level Risk Dashboard Function (RISK-07)
// ============================================================================

/**
 * Database row types for project risk dashboard queries.
 */
interface ProjectAnalysisRow {
  id: string;
  name: string;
  status: string;
  lead_analyst_id: string;
  lead_analyst_name: string;
  created_at: Date;
  updated_at: Date;
}

interface ProjectRiskStatsRow {
  total_entries: string;
  assessed_entries: string;
  high_risk_count: string;
  medium_risk_count: string;
  low_risk_count: string;
  avg_risk_score: string | null;
  max_risk_score: string | null;
  min_risk_score: string | null;
}

interface AnalysisRiskStatsRow {
  analysis_id: string;
  entry_count: string;
  assessed_count: string;
  high_risk_count: string;
  medium_risk_count: string;
  low_risk_count: string;
  max_risk_score: string | null;
}

interface ProjectNodeRiskRow {
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

interface ProjectGuideWordRiskRow {
  guide_word: GuideWord;
  entry_count: string;
  assessed_count: string;
  high_risk_count: string;
  medium_risk_count: string;
  low_risk_count: string;
  avg_risk_score: string | null;
  max_risk_score: string | null;
}

interface ProjectHighRiskEntryRow {
  id: string;
  analysis_id: string;
  analysis_name: string;
  node_id: string;
  node_identifier: string;
  guide_word: GuideWord;
  parameter: string;
  severity: number;
  likelihood: number;
  detectability: number;
  risk_score: number;
  risk_level: RiskLevel;
}

/**
 * Get comprehensive risk dashboard for a project.
 *
 * Aggregates all risk data across all analyses in the project, including:
 * - Overall statistics (counts, averages, min/max)
 * - Risk level distribution
 * - Score percentiles
 * - Per-analysis summaries
 * - Breakdown by node
 * - Breakdown by guide word
 * - List of highest risk entries
 *
 * @param projectId - The project ID
 * @param thresholdConfig - Optional custom threshold configuration (defaults to standard)
 * @returns Comprehensive project risk dashboard, or null if project not found
 */
export async function getProjectRiskDashboard(
  projectId: string,
  thresholdConfig?: RiskThresholdConfig
): Promise<ProjectRiskDashboard | null> {
  const pool = getPool();
  const thresholds = thresholdConfig ?? getDefaultRiskThresholds();

  // Check if project exists and get its name
  const projectResult = await pool.query<{ name: string }>(
    `SELECT name FROM hazop.projects WHERE id = $1`,
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return null;
  }

  const projectName = projectResult.rows[0].name;

  // Execute all queries in parallel for efficiency
  const [
    analysesResult,
    overallStatsResult,
    analysisStatsResult,
    allScoresResult,
    byNodeResult,
    byGuideWordResult,
    highestRiskResult,
  ] = await Promise.all([
    // Get all analyses for the project with lead analyst name
    pool.query<ProjectAnalysisRow>(
      `SELECT
         ha.id,
         ha.name,
         ha.status,
         ha.lead_analyst_id,
         u.name AS lead_analyst_name,
         ha.created_at,
         ha.updated_at
       FROM hazop.hazop_analyses ha
       JOIN hazop.users u ON ha.lead_analyst_id = u.id
       WHERE ha.project_id = $1
       ORDER BY ha.created_at DESC`,
      [projectId]
    ),

    // Overall risk statistics across all analyses
    pool.query<ProjectRiskStatsRow>(
      `SELECT
         COUNT(*) AS total_entries,
         COUNT(ae.risk_score) AS assessed_entries,
         COUNT(*) FILTER (WHERE ae.risk_level = 'high') AS high_risk_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'medium') AS medium_risk_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'low') AS low_risk_count,
         AVG(ae.risk_score) AS avg_risk_score,
         MAX(ae.risk_score) AS max_risk_score,
         MIN(ae.risk_score) AS min_risk_score
       FROM hazop.analysis_entries ae
       JOIN hazop.hazop_analyses ha ON ae.analysis_id = ha.id
       WHERE ha.project_id = $1`,
      [projectId]
    ),

    // Per-analysis statistics
    pool.query<AnalysisRiskStatsRow>(
      `SELECT
         ha.id AS analysis_id,
         COUNT(ae.id) AS entry_count,
         COUNT(ae.risk_score) AS assessed_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'high') AS high_risk_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'medium') AS medium_risk_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'low') AS low_risk_count,
         MAX(ae.risk_score) AS max_risk_score
       FROM hazop.hazop_analyses ha
       LEFT JOIN hazop.analysis_entries ae ON ae.analysis_id = ha.id
       WHERE ha.project_id = $1
       GROUP BY ha.id`,
      [projectId]
    ),

    // All risk scores for percentile calculation
    pool.query<{ risk_score: number }>(
      `SELECT ae.risk_score
       FROM hazop.analysis_entries ae
       JOIN hazop.hazop_analyses ha ON ae.analysis_id = ha.id
       WHERE ha.project_id = $1 AND ae.risk_score IS NOT NULL
       ORDER BY ae.risk_score`,
      [projectId]
    ),

    // By node across all analyses
    pool.query<ProjectNodeRiskRow>(
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
       JOIN hazop.pid_documents pd ON an.document_id = pd.id
       LEFT JOIN hazop.analysis_entries ae ON ae.node_id = an.id
       WHERE pd.project_id = $1
       GROUP BY an.id, an.node_identifier, an.description, an.equipment_type
       HAVING COUNT(ae.id) > 0
       ORDER BY MAX(ae.risk_score) DESC NULLS LAST, an.node_identifier`,
      [projectId]
    ),

    // By guide word across all analyses
    pool.query<ProjectGuideWordRiskRow>(
      `SELECT
         ae.guide_word,
         COUNT(*) AS entry_count,
         COUNT(ae.risk_score) AS assessed_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'high') AS high_risk_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'medium') AS medium_risk_count,
         COUNT(*) FILTER (WHERE ae.risk_level = 'low') AS low_risk_count,
         AVG(ae.risk_score) AS avg_risk_score,
         MAX(ae.risk_score) AS max_risk_score
       FROM hazop.analysis_entries ae
       JOIN hazop.hazop_analyses ha ON ae.analysis_id = ha.id
       WHERE ha.project_id = $1
       GROUP BY ae.guide_word
       ORDER BY MAX(ae.risk_score) DESC NULLS LAST`,
      [projectId]
    ),

    // Highest risk entries across project (top 20)
    pool.query<ProjectHighRiskEntryRow>(
      `SELECT
         ae.id,
         ae.analysis_id,
         ha.name AS analysis_name,
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
       JOIN hazop.hazop_analyses ha ON ae.analysis_id = ha.id
       JOIN hazop.analysis_nodes an ON ae.node_id = an.id
       WHERE ha.project_id = $1 AND ae.risk_score IS NOT NULL
       ORDER BY ae.risk_score DESC
       LIMIT 20`,
      [projectId]
    ),
  ]);

  // Build analysis stats lookup map
  const analysisStatsMap = new Map<string, AnalysisRiskStatsRow>();
  for (const row of analysisStatsResult.rows) {
    analysisStatsMap.set(row.analysis_id, row);
  }

  // Count analyses by status
  let draftCount = 0;
  let inReviewCount = 0;
  let approvedCount = 0;
  for (const analysis of analysesResult.rows) {
    switch (analysis.status) {
      case 'draft':
        draftCount++;
        break;
      case 'in_review':
        inReviewCount++;
        break;
      case 'approved':
        approvedCount++;
        break;
    }
  }

  // Parse overall statistics
  const statsRow = overallStatsResult.rows[0];
  const totalEntries = parseInt(statsRow?.total_entries || '0', 10);
  const assessedEntries = parseInt(statsRow?.assessed_entries || '0', 10);
  const unassessedEntries = totalEntries - assessedEntries;
  const highRiskCount = parseInt(statsRow?.high_risk_count || '0', 10);
  const mediumRiskCount = parseInt(statsRow?.medium_risk_count || '0', 10);
  const lowRiskCount = parseInt(statsRow?.low_risk_count || '0', 10);
  const averageRiskScore = statsRow?.avg_risk_score !== null
    ? parseFloat(statsRow.avg_risk_score)
    : null;
  const maxRiskScore = statsRow?.max_risk_score !== null
    ? parseInt(statsRow.max_risk_score, 10)
    : null;
  const minRiskScore = statsRow?.min_risk_score !== null
    ? parseInt(statsRow.min_risk_score, 10)
    : null;

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
  const scores = allScoresResult.rows.map((r) => r.risk_score);
  const percentiles = calculatePercentiles(scores);

  // Build analysis summaries with risk stats
  const analysisSummaries: AnalysisRiskSummary[] = analysesResult.rows.map((analysis) => {
    const stats = analysisStatsMap.get(analysis.id);
    const maxScore = stats?.max_risk_score !== null && stats?.max_risk_score !== undefined
      ? parseInt(stats.max_risk_score, 10)
      : null;

    return {
      analysisId: analysis.id,
      analysisName: analysis.name,
      status: analysis.status,
      leadAnalystId: analysis.lead_analyst_id,
      leadAnalystName: analysis.lead_analyst_name,
      entryCount: parseInt(stats?.entry_count || '0', 10),
      assessedEntries: parseInt(stats?.assessed_count || '0', 10),
      highRiskCount: parseInt(stats?.high_risk_count || '0', 10),
      mediumRiskCount: parseInt(stats?.medium_risk_count || '0', 10),
      lowRiskCount: parseInt(stats?.low_risk_count || '0', 10),
      maxRiskScore: maxScore,
      overallRiskLevel: maxScore !== null
        ? determineRiskLevelWithConfig(maxScore, thresholds)
        : null,
      createdAt: analysis.created_at,
      updatedAt: analysis.updated_at,
    };
  });

  // Sort analysis summaries by max risk score descending, nulls last
  analysisSummaries.sort((a, b) => {
    if (a.maxRiskScore === null && b.maxRiskScore === null) return 0;
    if (a.maxRiskScore === null) return 1;
    if (b.maxRiskScore === null) return -1;
    return b.maxRiskScore - a.maxRiskScore;
  });

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
  const highestRiskEntries: ProjectHighRiskEntry[] = highestRiskResult.rows.map((row) => ({
    entryId: row.id,
    analysisId: row.analysis_id,
    analysisName: row.analysis_name,
    nodeId: row.node_id,
    nodeIdentifier: row.node_identifier,
    guideWord: row.guide_word,
    parameter: row.parameter,
    riskRanking: {
      severity: row.severity as 1 | 2 | 3 | 4 | 5,
      likelihood: row.likelihood as 1 | 2 | 3 | 4 | 5,
      detectability: row.detectability as 1 | 2 | 3 | 4 | 5,
      riskScore: row.risk_score,
      riskLevel: row.risk_level,
    },
  }));

  return {
    projectId,
    projectName,
    statistics: {
      totalAnalyses: analysesResult.rows.length,
      draftAnalyses: draftCount,
      inReviewAnalyses: inReviewCount,
      approvedAnalyses: approvedCount,
      totalEntries,
      assessedEntries,
      unassessedEntries,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      averageRiskScore,
      maxRiskScore,
      minRiskScore,
    },
    distribution,
    percentiles,
    analysisSummaries,
    byNode,
    byGuideWord,
    highestRiskEntries,
    thresholds,
  };
}
