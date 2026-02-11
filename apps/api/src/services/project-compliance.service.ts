/**
 * Compliance Service.
 *
 * Provides functions for retrieving project-level and analysis-level compliance status
 * by aggregating analysis entries and validating against regulatory standards.
 *
 * Task: COMP-10, COMP-11
 */

import { getPool } from '../config/database.config.js';
import type {
  RegulatoryStandardId,
  ComplianceStatus,
  StandardComplianceSummary,
  AnalysisEntry,
  RiskRanking,
  GuideWord,
  RiskLevel,
  SeverityLevel,
  LikelihoodLevel,
  DetectabilityLevel,
} from '@hazop/types';
import { REGULATORY_STANDARD_IDS } from '@hazop/types';
import {
  validateCompliance,
  generateComplianceReport,
} from './compliance-validation.service.js';

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Raw analysis entry row from database.
 */
interface AnalysisEntryRow {
  id: string;
  analysis_id: string;
  node_id: string;
  guide_word: GuideWord;
  parameter: string;
  deviation: string;
  causes: string[];
  consequences: string[];
  safeguards: string[];
  recommendations: string[];
  notes: string | null;
  severity: number | null;
  likelihood: number | null;
  detectability: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * LOPA count result.
 */
interface LOPACountRow {
  count: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Project-level compliance status response.
 */
export interface ProjectComplianceStatus {
  /** Project ID */
  projectId: string;

  /** Project name */
  projectName: string;

  /** Total number of analyses in project */
  analysisCount: number;

  /** Total number of entries across all analyses */
  entryCount: number;

  /** Whether any entries have LOPA analysis */
  hasLOPA: boolean;

  /** Number of entries with LOPA */
  lopaCount: number;

  /** Standards that were checked */
  standardsChecked: RegulatoryStandardId[];

  /** Overall compliance status */
  overallStatus: ComplianceStatus;

  /** Overall compliance percentage (0-100) */
  overallPercentage: number;

  /** Summary per regulatory standard */
  summaries: StandardComplianceSummary[];

  /** Timestamp of compliance check */
  checkedAt: Date;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert database row to AnalysisEntry type.
 */
function rowToAnalysisEntry(row: AnalysisEntryRow): AnalysisEntry {
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

  return {
    id: row.id,
    analysisId: row.analysis_id,
    nodeId: row.node_id,
    guideWord: row.guide_word,
    parameter: row.parameter,
    deviation: row.deviation,
    causes: row.causes || [],
    consequences: row.consequences || [],
    safeguards: row.safeguards || [],
    recommendations: row.recommendations || [],
    riskRanking,
    notes: row.notes,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Get project compliance status by validating all entries against regulatory standards.
 *
 * Fetches all analysis entries for a project, checks LOPA coverage, and
 * validates against the specified regulatory standards.
 *
 * @param projectId - Project ID
 * @param standards - Standards to validate against (defaults to all available)
 * @returns Project compliance status, or null if project not found
 */
export async function getProjectComplianceStatus(
  projectId: string,
  standards?: RegulatoryStandardId[]
): Promise<ProjectComplianceStatus | null> {
  const pool = getPool();

  // Check if project exists and get its name
  const projectResult = await pool.query<{ name: string }>(
    `SELECT name FROM hazop.projects WHERE id = $1`,
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return null;
  }

  const projectName = projectResult.rows[0].name;

  // Execute queries in parallel for efficiency
  const [analysisCountResult, entriesResult, lopaCountResult] = await Promise.all([
    // Count analyses in project
    pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM hazop.hazop_analyses
       WHERE project_id = $1`,
      [projectId]
    ),

    // Get all analysis entries for the project
    pool.query<AnalysisEntryRow>(
      `SELECT ae.*
       FROM hazop.analysis_entries ae
       JOIN hazop.hazop_analyses ha ON ae.analysis_id = ha.id
       WHERE ha.project_id = $1
       ORDER BY ae.created_at`,
      [projectId]
    ),

    // Count entries with LOPA analyses
    pool.query<LOPACountRow>(
      `SELECT COUNT(*) AS count
       FROM hazop.lopa_analyses la
       JOIN hazop.analysis_entries ae ON la.analysis_entry_id = ae.id
       JOIN hazop.hazop_analyses ha ON ae.analysis_id = ha.id
       WHERE ha.project_id = $1`,
      [projectId]
    ),
  ]);

  const analysisCount = parseInt(analysisCountResult.rows[0].count, 10);
  const entries = entriesResult.rows.map(rowToAnalysisEntry);
  const lopaCount = parseInt(lopaCountResult.rows[0].count, 10);
  const hasLOPA = lopaCount > 0;

  // Default to all available standards if not specified
  const standardsToCheck = standards ?? [...REGULATORY_STANDARD_IDS];

  // Handle empty entries case
  if (entries.length === 0) {
    return {
      projectId,
      projectName,
      analysisCount,
      entryCount: 0,
      hasLOPA: false,
      lopaCount: 0,
      standardsChecked: standardsToCheck,
      overallStatus: 'not_assessed',
      overallPercentage: 0,
      summaries: [],
      checkedAt: new Date(),
    };
  }

  // Validate compliance against standards
  const validationResult = validateCompliance(entries, standardsToCheck, {
    includeRecommendations: true,
    hasLOPA,
  });

  return {
    projectId,
    projectName,
    analysisCount,
    entryCount: entries.length,
    hasLOPA,
    lopaCount,
    standardsChecked: standardsToCheck,
    overallStatus: validationResult.overallStatus,
    overallPercentage: validationResult.summaries.length > 0
      ? Math.round(
          validationResult.summaries.reduce((sum, s) => sum + s.compliancePercentage, 0) /
            validationResult.summaries.length
        )
      : 0,
    summaries: validationResult.summaries,
    checkedAt: new Date(),
  };
}

/**
 * Get detailed compliance report for a project.
 *
 * Generates a comprehensive compliance report with check results,
 * critical gaps, and remediation recommendations.
 *
 * @param projectId - Project ID
 * @param userId - ID of user generating the report
 * @param standards - Standards to validate against (defaults to all available)
 * @returns Compliance report, or null if project not found
 */
export async function getProjectComplianceReport(
  projectId: string,
  userId: string,
  standards?: RegulatoryStandardId[]
): Promise<ReturnType<typeof generateComplianceReport> | null> {
  const pool = getPool();

  // Check if project exists
  const projectResult = await pool.query<{ id: string }>(
    `SELECT id FROM hazop.projects WHERE id = $1`,
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return null;
  }

  // Get all analysis entries for the project
  const entriesResult = await pool.query<AnalysisEntryRow>(
    `SELECT ae.*
     FROM hazop.analysis_entries ae
     JOIN hazop.hazop_analyses ha ON ae.analysis_id = ha.id
     WHERE ha.project_id = $1
     ORDER BY ae.created_at`,
    [projectId]
  );

  const entries = entriesResult.rows.map(rowToAnalysisEntry);

  // Check for LOPA
  const lopaResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM hazop.lopa_analyses la
     JOIN hazop.analysis_entries ae ON la.analysis_entry_id = ae.id
     JOIN hazop.hazop_analyses ha ON ae.analysis_id = ha.id
     WHERE ha.project_id = $1`,
    [projectId]
  );
  const hasLOPA = parseInt(lopaResult.rows[0].count, 10) > 0;

  // Default to all available standards if not specified
  const standardsToCheck = standards ?? [...REGULATORY_STANDARD_IDS];

  // Generate compliance report
  return generateComplianceReport(
    projectId,
    undefined, // No specific analysis - project-level
    entries,
    standardsToCheck,
    userId,
    { hasLOPA }
  );
}

// ============================================================================
// Analysis-Level Compliance Types
// ============================================================================

/**
 * Analysis-level compliance status response.
 */
export interface AnalysisComplianceStatus {
  /** Analysis ID */
  analysisId: string;

  /** Analysis name */
  analysisName: string;

  /** Project ID */
  projectId: string;

  /** Analysis status */
  analysisStatus: string;

  /** Total number of entries in the analysis */
  entryCount: number;

  /** Whether any entries have LOPA analysis */
  hasLOPA: boolean;

  /** Number of entries with LOPA */
  lopaCount: number;

  /** Standards that were checked */
  standardsChecked: RegulatoryStandardId[];

  /** Overall compliance status */
  overallStatus: ComplianceStatus;

  /** Overall compliance percentage (0-100) */
  overallPercentage: number;

  /** Summary per regulatory standard */
  summaries: StandardComplianceSummary[];

  /** Timestamp of compliance check */
  checkedAt: Date;
}

// ============================================================================
// Analysis-Level Compliance Functions
// ============================================================================

/**
 * Get analysis compliance status by validating all entries against regulatory standards.
 *
 * Fetches all entries for a specific analysis session, checks LOPA coverage, and
 * validates against the specified regulatory standards.
 *
 * @param analysisId - Analysis ID
 * @param standards - Standards to validate against (defaults to all available)
 * @returns Analysis compliance status, or null if analysis not found
 */
export async function getAnalysisComplianceStatus(
  analysisId: string,
  standards?: RegulatoryStandardId[]
): Promise<AnalysisComplianceStatus | null> {
  const pool = getPool();

  // Check if analysis exists and get its details
  const analysisResult = await pool.query<{
    id: string;
    name: string;
    project_id: string;
    status: string;
  }>(
    `SELECT id, name, project_id, status
     FROM hazop.hazop_analyses
     WHERE id = $1`,
    [analysisId]
  );

  if (analysisResult.rows.length === 0) {
    return null;
  }

  const analysis = analysisResult.rows[0];

  // Execute queries in parallel for efficiency
  const [entriesResult, lopaCountResult] = await Promise.all([
    // Get all entries for this analysis
    pool.query<AnalysisEntryRow>(
      `SELECT *
       FROM hazop.analysis_entries
       WHERE analysis_id = $1
       ORDER BY created_at`,
      [analysisId]
    ),

    // Count entries with LOPA analyses
    pool.query<LOPACountRow>(
      `SELECT COUNT(*) AS count
       FROM hazop.lopa_analyses la
       JOIN hazop.analysis_entries ae ON la.analysis_entry_id = ae.id
       WHERE ae.analysis_id = $1`,
      [analysisId]
    ),
  ]);

  const entries = entriesResult.rows.map(rowToAnalysisEntry);
  const lopaCount = parseInt(lopaCountResult.rows[0].count, 10);
  const hasLOPA = lopaCount > 0;

  // Default to all available standards if not specified
  const standardsToCheck = standards ?? [...REGULATORY_STANDARD_IDS];

  // Handle empty entries case
  if (entries.length === 0) {
    return {
      analysisId,
      analysisName: analysis.name,
      projectId: analysis.project_id,
      analysisStatus: analysis.status,
      entryCount: 0,
      hasLOPA: false,
      lopaCount: 0,
      standardsChecked: standardsToCheck,
      overallStatus: 'not_assessed',
      overallPercentage: 0,
      summaries: [],
      checkedAt: new Date(),
    };
  }

  // Validate compliance against standards
  const validationResult = validateCompliance(entries, standardsToCheck, {
    includeRecommendations: true,
    hasLOPA,
  });

  return {
    analysisId,
    analysisName: analysis.name,
    projectId: analysis.project_id,
    analysisStatus: analysis.status,
    entryCount: entries.length,
    hasLOPA,
    lopaCount,
    standardsChecked: standardsToCheck,
    overallStatus: validationResult.overallStatus,
    overallPercentage: validationResult.summaries.length > 0
      ? Math.round(
          validationResult.summaries.reduce((sum, s) => sum + s.compliancePercentage, 0) /
            validationResult.summaries.length
        )
      : 0,
    summaries: validationResult.summaries,
    checkedAt: new Date(),
  };
}

/**
 * Get detailed compliance report for an analysis.
 *
 * Generates a comprehensive compliance report with check results,
 * critical gaps, and remediation recommendations.
 *
 * @param analysisId - Analysis ID
 * @param userId - ID of user generating the report
 * @param standards - Standards to validate against (defaults to all available)
 * @returns Compliance report, or null if analysis not found
 */
export async function getAnalysisComplianceReport(
  analysisId: string,
  userId: string,
  standards?: RegulatoryStandardId[]
): Promise<ReturnType<typeof generateComplianceReport> | null> {
  const pool = getPool();

  // Check if analysis exists
  const analysisResult = await pool.query<{ id: string; project_id: string }>(
    `SELECT id, project_id FROM hazop.hazop_analyses WHERE id = $1`,
    [analysisId]
  );

  if (analysisResult.rows.length === 0) {
    return null;
  }

  const projectId = analysisResult.rows[0].project_id;

  // Get all entries for this analysis
  const entriesResult = await pool.query<AnalysisEntryRow>(
    `SELECT *
     FROM hazop.analysis_entries
     WHERE analysis_id = $1
     ORDER BY created_at`,
    [analysisId]
  );

  const entries = entriesResult.rows.map(rowToAnalysisEntry);

  // Check for LOPA
  const lopaResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM hazop.lopa_analyses la
     JOIN hazop.analysis_entries ae ON la.analysis_entry_id = ae.id
     WHERE ae.analysis_id = $1`,
    [analysisId]
  );
  const hasLOPA = parseInt(lopaResult.rows[0].count, 10) > 0;

  // Default to all available standards if not specified
  const standardsToCheck = standards ?? [...REGULATORY_STANDARD_IDS];

  // Generate compliance report
  return generateComplianceReport(
    projectId,
    analysisId,
    entries,
    standardsToCheck,
    userId,
    { hasLOPA }
  );
}
