/**
 * LOPA Analysis Service.
 *
 * Provides database operations for LOPA (Layers of Protection Analysis) records.
 * Handles creation, retrieval, and management of LOPA analyses linked to HazOp entries.
 *
 * This service integrates with:
 * - lopa-calculation.service.ts: For performing LOPA calculations
 * - lopa-recommendation.service.ts: For determining when LOPA is needed
 *
 * Reference Standards:
 * - IEC 61511: Functional safety for process industries
 * - CCPS Guidelines for Initiating Events and Independent Protection Layers
 */

import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database.config.js';
import {
  performLOPACalculation,
  generateLOPARecommendations,
} from './lopa-calculation.service.js';
import type {
  LOPAAnalysis,
  LOPAStatus,
  LOPAGapStatus,
  IPL,
  IPLType,
  InitiatingEventCategory,
  SafetyIntegrityLevel,
  SeverityLevel,
} from '@hazop/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for creating a new LOPA analysis.
 */
export interface CreateLOPAInput {
  /** Analysis entry ID to link to */
  analysisEntryId: string;
  /** Scenario description */
  scenarioDescription: string;
  /** Consequence description */
  consequence: string;
  /** Initiating event category */
  initiatingEventCategory: InitiatingEventCategory;
  /** Initiating event description */
  initiatingEventDescription: string;
  /** Initiating event frequency (per year) */
  initiatingEventFrequency: number;
  /** IPLs to credit */
  ipls: CreateIPLInput[];
  /** Target frequency (per year) */
  targetFrequency: number;
  /** Optional notes */
  notes?: string;
}

/**
 * Input for creating an IPL within a LOPA.
 */
export interface CreateIPLInput {
  /** Type of protection layer */
  type: IPLType;
  /** Name/identifier for this specific IPL */
  name: string;
  /** Description of the IPL */
  description: string;
  /** Probability of Failure on Demand (0-1) */
  pfd: number;
  /** Whether this IPL is independent of the initiating event */
  independentOfInitiator: boolean;
  /** Whether this IPL is independent of other IPLs */
  independentOfOtherIPLs: boolean;
  /** For SIF/SIS: the SIL level */
  sil?: SafetyIntegrityLevel;
  /** Additional notes */
  notes?: string;
}

/**
 * Database row structure for LOPA analysis.
 */
interface LOPARow {
  id: string;
  analysis_entry_id: string;
  scenario_description: string;
  consequence: string;
  severity: number;
  initiating_event_category: InitiatingEventCategory;
  initiating_event_description: string;
  initiating_event_frequency: string; // NUMERIC comes as string
  ipls: IPL[];
  target_frequency: string;
  mitigated_event_likelihood: string;
  total_risk_reduction_factor: string;
  required_risk_reduction_factor: string;
  gap_status: LOPAGapStatus;
  gap_ratio: string;
  status: LOPAStatus;
  recommendations: string[];
  required_sil: number | null;
  notes: string | null;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Create Functions
// ============================================================================

/**
 * Create a new LOPA analysis for an entry.
 *
 * Performs the LOPA calculation and stores the results in the database.
 * The entry must have a risk assessment with severity defined.
 *
 * @param userId - ID of the user creating the LOPA
 * @param input - LOPA creation input
 * @returns Created LOPA analysis
 * @throws Error if entry not found, already has LOPA, or input is invalid
 */
export async function createLOPAAnalysis(
  userId: string,
  input: CreateLOPAInput
): Promise<LOPAAnalysis> {
  const pool = getPool();

  // Get the entry and verify it exists with severity assessed
  const entryResult = await pool.query<{
    id: string;
    severity: number | null;
    analysis_id: string;
  }>(
    `SELECT id, severity, analysis_id
     FROM hazop.analysis_entries
     WHERE id = $1`,
    [input.analysisEntryId]
  );

  if (entryResult.rows.length === 0) {
    throw new Error('Analysis entry not found');
  }

  const entry = entryResult.rows[0];

  if (entry.severity === null) {
    throw new Error('Entry must have risk assessment with severity before creating LOPA');
  }

  // Check if LOPA already exists for this entry
  const existingResult = await pool.query<{ id: string }>(
    `SELECT id FROM hazop.lopa_analyses WHERE analysis_entry_id = $1`,
    [input.analysisEntryId]
  );

  if (existingResult.rows.length > 0) {
    throw new Error('LOPA analysis already exists for this entry');
  }

  // Generate IDs for IPLs
  const ipls: IPL[] = input.ipls.map((ipl) => ({
    id: uuidv4(),
    type: ipl.type,
    name: ipl.name,
    description: ipl.description,
    pfd: ipl.pfd,
    independentOfInitiator: ipl.independentOfInitiator,
    independentOfOtherIPLs: ipl.independentOfOtherIPLs,
    sil: ipl.sil,
    notes: ipl.notes,
  }));

  // Perform LOPA calculation
  const calculationInput = {
    initiatingEventFrequency: input.initiatingEventFrequency,
    ipls: ipls.map((ipl) => ({ id: ipl.id, name: ipl.name, pfd: ipl.pfd })),
    targetFrequency: input.targetFrequency,
  };

  const calculationResult = performLOPACalculation(calculationInput);

  // Generate recommendations
  const recommendations = generateLOPARecommendations(calculationResult);

  // Insert into database
  const lopaId = uuidv4();
  const now = new Date();

  const insertResult = await pool.query<LOPARow>(
    `INSERT INTO hazop.lopa_analyses (
       id,
       analysis_entry_id,
       scenario_description,
       consequence,
       severity,
       initiating_event_category,
       initiating_event_description,
       initiating_event_frequency,
       ipls,
       target_frequency,
       mitigated_event_likelihood,
       total_risk_reduction_factor,
       required_risk_reduction_factor,
       gap_status,
       gap_ratio,
       status,
       recommendations,
       required_sil,
       notes,
       created_by_id,
       created_at,
       updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
     )
     RETURNING *`,
    [
      lopaId,
      input.analysisEntryId,
      input.scenarioDescription,
      input.consequence,
      entry.severity,
      input.initiatingEventCategory,
      input.initiatingEventDescription,
      input.initiatingEventFrequency,
      JSON.stringify(ipls),
      input.targetFrequency,
      calculationResult.mitigatedEventLikelihood,
      calculationResult.totalRiskReductionFactor,
      calculationResult.requiredRiskReductionFactor,
      calculationResult.gapStatus,
      calculationResult.gapRatio,
      'draft',
      JSON.stringify(recommendations),
      calculationResult.requiredSIL,
      input.notes ?? null,
      userId,
      now,
      now,
    ]
  );

  return mapRowToLOPA(insertResult.rows[0]);
}

// ============================================================================
// Read Functions
// ============================================================================

/**
 * Find a LOPA analysis by ID.
 *
 * @param lopaId - LOPA analysis ID
 * @returns LOPA analysis or null if not found
 */
export async function findLOPAById(lopaId: string): Promise<LOPAAnalysis | null> {
  const pool = getPool();

  const result = await pool.query<LOPARow>(
    `SELECT * FROM hazop.lopa_analyses WHERE id = $1`,
    [lopaId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToLOPA(result.rows[0]);
}

/**
 * Find a LOPA analysis by analysis entry ID.
 *
 * @param entryId - Analysis entry ID
 * @returns LOPA analysis or null if not found
 */
export async function findLOPAByEntryId(entryId: string): Promise<LOPAAnalysis | null> {
  const pool = getPool();

  const result = await pool.query<LOPARow>(
    `SELECT * FROM hazop.lopa_analyses WHERE analysis_entry_id = $1`,
    [entryId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToLOPA(result.rows[0]);
}

/**
 * Check if a LOPA analysis exists for an entry.
 *
 * @param entryId - Analysis entry ID
 * @returns True if LOPA exists
 */
export async function lopaExistsForEntry(entryId: string): Promise<boolean> {
  const pool = getPool();

  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hazop.lopa_analyses WHERE analysis_entry_id = $1) AS exists`,
    [entryId]
  );

  return result.rows[0]?.exists ?? false;
}

/**
 * Get entry info with analysis project access check.
 *
 * @param entryId - Analysis entry ID
 * @returns Entry info with analysis and project IDs
 */
export async function getEntryWithAnalysisInfo(
  entryId: string
): Promise<{
  entryId: string;
  analysisId: string;
  projectId: string;
  severity: number | null;
  analysisStatus: string;
} | null> {
  const pool = getPool();

  const result = await pool.query<{
    entry_id: string;
    analysis_id: string;
    project_id: string;
    severity: number | null;
    analysis_status: string;
  }>(
    `SELECT
       ae.id AS entry_id,
       ae.analysis_id,
       ha.project_id,
       ae.severity,
       ha.status AS analysis_status
     FROM hazop.analysis_entries ae
     JOIN hazop.hazop_analyses ha ON ae.analysis_id = ha.id
     WHERE ae.id = $1`,
    [entryId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    entryId: row.entry_id,
    analysisId: row.analysis_id,
    projectId: row.project_id,
    severity: row.severity,
    analysisStatus: row.analysis_status,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map a database row to a LOPAAnalysis object.
 */
function mapRowToLOPA(row: LOPARow): LOPAAnalysis {
  return {
    id: row.id,
    analysisEntryId: row.analysis_entry_id,
    scenarioDescription: row.scenario_description,
    consequence: row.consequence,
    severity: row.severity as SeverityLevel,
    initiatingEventCategory: row.initiating_event_category,
    initiatingEventDescription: row.initiating_event_description,
    initiatingEventFrequency: parseFloat(row.initiating_event_frequency),
    ipls: row.ipls,
    targetFrequency: parseFloat(row.target_frequency),
    mitigatedEventLikelihood: parseFloat(row.mitigated_event_likelihood),
    totalRiskReductionFactor: parseFloat(row.total_risk_reduction_factor),
    requiredRiskReductionFactor: parseFloat(row.required_risk_reduction_factor),
    gapStatus: row.gap_status,
    gapRatio: parseFloat(row.gap_ratio),
    status: row.status,
    recommendations: row.recommendations,
    requiredSIL: row.required_sil as SafetyIntegrityLevel | null,
    notes: row.notes,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
