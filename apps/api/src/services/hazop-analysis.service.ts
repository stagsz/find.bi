/**
 * HazOps Analysis service for database operations.
 *
 * Handles HazOps analysis session CRUD operations, filtering, and pagination.
 * Analysis sessions track the progress of HazOps methodology applied to P&ID documents.
 */

import { getPool } from '../config/database.config.js';
import type { AnalysisStatus, GuideWord, RiskRanking, RiskLevel } from '@hazop/types';

// ============================================================================
// Database Row Types (snake_case matching PostgreSQL schema)
// ============================================================================

/**
 * HazOps analysis row from the database.
 */
export interface HazopAnalysisRow {
  id: string;
  project_id: string;
  document_id: string;
  name: string;
  description: string | null;
  status: AnalysisStatus;
  lead_analyst_id: string;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
  submitted_at: Date | null;
  approved_at: Date | null;
  approved_by_id: string | null;
  review_notes: string | null;
  approval_comments: string | null;
}

/**
 * HazOps analysis row with document and user details.
 */
export interface HazopAnalysisRowWithDetails extends HazopAnalysisRow {
  document_name: string;
  lead_analyst_name: string;
  lead_analyst_email: string;
  created_by_name: string;
}

/**
 * HazOps analysis row with progress metrics.
 */
export interface HazopAnalysisRowWithProgress extends HazopAnalysisRow {
  total_nodes: string;
  analyzed_nodes: string;
  total_entries: string;
  high_risk_count: string;
  medium_risk_count: string;
  low_risk_count: string;
}

/**
 * Analysis entry row from the database.
 */
export interface AnalysisEntryRow {
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
  severity: number | null;
  likelihood: number | null;
  detectability: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  notes: string | null;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// API Response Types (camelCase for JavaScript)
// ============================================================================

/**
 * HazOps analysis object (API response format).
 */
export interface HazopAnalysis {
  id: string;
  projectId: string;
  documentId: string;
  name: string;
  description: string | null;
  status: AnalysisStatus;
  leadAnalystId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvedById: string | null;
  reviewNotes: string | null;
  approvalComments: string | null;
}

/**
 * HazOps analysis with document and user details.
 */
export interface HazopAnalysisWithDetails extends HazopAnalysis {
  documentName: string;
  leadAnalystName: string;
  leadAnalystEmail: string;
  createdByName: string;
}

/**
 * HazOps analysis with progress metrics.
 */
export interface HazopAnalysisWithProgress extends HazopAnalysis {
  totalNodes: number;
  analyzedNodes: number;
  totalEntries: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
}

/**
 * Analysis entry object (API response format).
 */
export interface AnalysisEntry {
  id: string;
  analysisId: string;
  nodeId: string;
  guideWord: GuideWord;
  parameter: string;
  deviation: string;
  causes: string[];
  consequences: string[];
  safeguards: string[];
  recommendations: string[];
  riskRanking: RiskRanking | null;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Row Converters
// ============================================================================

/**
 * Convert a database row to a HazopAnalysis object.
 * Maps snake_case columns to camelCase properties.
 */
function rowToHazopAnalysis(row: HazopAnalysisRow): HazopAnalysis {
  return {
    id: row.id,
    projectId: row.project_id,
    documentId: row.document_id,
    name: row.name,
    description: row.description,
    status: row.status,
    leadAnalystId: row.lead_analyst_id,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedById: row.approved_by_id,
    reviewNotes: row.review_notes,
    approvalComments: row.approval_comments,
  };
}

/**
 * Convert a database row with details to HazopAnalysisWithDetails object.
 */
function rowToHazopAnalysisWithDetails(row: HazopAnalysisRowWithDetails): HazopAnalysisWithDetails {
  return {
    ...rowToHazopAnalysis(row),
    documentName: row.document_name,
    leadAnalystName: row.lead_analyst_name,
    leadAnalystEmail: row.lead_analyst_email,
    createdByName: row.created_by_name,
  };
}

/**
 * Convert a database row with progress to HazopAnalysisWithProgress object.
 */
function rowToHazopAnalysisWithProgress(row: HazopAnalysisRowWithProgress): HazopAnalysisWithProgress {
  return {
    ...rowToHazopAnalysis(row),
    totalNodes: parseInt(row.total_nodes, 10),
    analyzedNodes: parseInt(row.analyzed_nodes, 10),
    totalEntries: parseInt(row.total_entries, 10),
    highRiskCount: parseInt(row.high_risk_count, 10),
    mediumRiskCount: parseInt(row.medium_risk_count, 10),
    lowRiskCount: parseInt(row.low_risk_count, 10),
  };
}

/**
 * Convert a database row to an AnalysisEntry object.
 * Maps snake_case columns to camelCase properties.
 */
function rowToAnalysisEntry(row: AnalysisEntryRow): AnalysisEntry {
  // Build risk ranking if all risk fields are present
  let riskRanking: RiskRanking | null = null;
  if (
    row.severity !== null &&
    row.likelihood !== null &&
    row.detectability !== null &&
    row.risk_score !== null &&
    row.risk_level !== null
  ) {
    riskRanking = {
      severity: row.severity as 1 | 2 | 3 | 4 | 5,
      likelihood: row.likelihood as 1 | 2 | 3 | 4 | 5,
      detectability: row.detectability as 1 | 2 | 3 | 4 | 5,
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
    causes: row.causes,
    consequences: row.consequences,
    safeguards: row.safeguards,
    recommendations: row.recommendations,
    riskRanking,
    notes: row.notes,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Filter and Pagination Types
// ============================================================================

/**
 * Filter options for listing analyses.
 */
export interface ListAnalysesFilters {
  /** Filter by analysis status */
  status?: AnalysisStatus;
  /** Filter by lead analyst ID */
  leadAnalystId?: string;
  /** Filter by document ID */
  documentId?: string;
  /** Search query for name or description */
  search?: string;
}

/**
 * Pagination options for listing analyses.
 */
export interface ListAnalysesPagination {
  /** Page number (1-based). Defaults to 1. */
  page?: number;
  /** Number of items per page. Defaults to 20, max 100. */
  limit?: number;
  /** Field to sort by. Defaults to 'created_at'. */
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'status';
  /** Sort direction. Defaults to 'desc'. */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Result from listing analyses.
 */
export interface ListAnalysesResult {
  /** Array of analyses with details */
  analyses: HazopAnalysisWithDetails[];
  /** Total number of analyses matching the filters */
  total: number;
}

// ============================================================================
// Create/Update Payloads
// ============================================================================

/**
 * Payload for creating a new HazOps analysis session.
 */
export interface CreateAnalysisData {
  projectId: string;
  documentId: string;
  name: string;
  description?: string;
  leadAnalystId?: string;
}

/**
 * Payload for updating a HazOps analysis session.
 * All fields are optional - only provided fields are updated.
 */
export interface UpdateAnalysisData {
  name?: string;
  description?: string | null;
  leadAnalystId?: string;
}

/**
 * Payload for creating a new analysis entry.
 */
export interface CreateAnalysisEntryData {
  analysisId: string;
  nodeId: string;
  guideWord: GuideWord;
  parameter: string;
  deviation: string;
  causes?: string[];
  consequences?: string[];
  safeguards?: string[];
  recommendations?: string[];
  notes?: string;
}

/**
 * Payload for updating an analysis entry.
 * All fields are optional - only provided fields are updated.
 * Note: nodeId, guideWord, and parameter cannot be updated as they form the unique constraint.
 */
export interface UpdateAnalysisEntryData {
  deviation?: string;
  causes?: string[];
  consequences?: string[];
  safeguards?: string[];
  recommendations?: string[];
  notes?: string | null;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new HazOps analysis session.
 *
 * @param userId - The ID of the user creating the analysis
 * @param data - Analysis creation data
 * @returns The created analysis with details
 * @throws Error with code '23503' if project or document doesn't exist (FK violation)
 */
export async function createAnalysis(
  userId: string,
  data: CreateAnalysisData
): Promise<HazopAnalysisWithDetails> {
  const pool = getPool();

  // Lead analyst defaults to creator if not specified
  const leadAnalystId = data.leadAnalystId ?? userId;

  const result = await pool.query<HazopAnalysisRow>(
    `INSERT INTO hazop.hazop_analyses
       (project_id, document_id, name, description, status, lead_analyst_id, created_by_id)
     VALUES ($1, $2, $3, $4, 'draft', $5, $6)
     RETURNING *`,
    [data.projectId, data.documentId, data.name, data.description ?? null, leadAnalystId, userId]
  );

  const row = result.rows[0];

  // Fetch the analysis with full details
  const analysisWithDetails = await findAnalysisById(row.id);
  if (!analysisWithDetails) {
    throw new Error('Failed to fetch created analysis');
  }

  return analysisWithDetails;
}

/**
 * Find a HazOps analysis by ID.
 * Returns null if analysis not found.
 */
export async function findAnalysisById(id: string): Promise<HazopAnalysisWithDetails | null> {
  const pool = getPool();
  const result = await pool.query<HazopAnalysisRowWithDetails>(
    `SELECT
       ha.*,
       pd.name AS document_name,
       la.name AS lead_analyst_name,
       la.email AS lead_analyst_email,
       cb.name AS created_by_name
     FROM hazop.hazop_analyses ha
     INNER JOIN hazop.pid_documents pd ON ha.document_id = pd.id
     INNER JOIN hazop.users la ON ha.lead_analyst_id = la.id
     INNER JOIN hazop.users cb ON ha.created_by_id = cb.id
     WHERE ha.id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToHazopAnalysisWithDetails(result.rows[0]);
}

/**
 * Find a HazOps analysis by ID with progress metrics.
 * Returns null if analysis not found.
 */
export async function findAnalysisByIdWithProgress(id: string): Promise<HazopAnalysisWithProgress | null> {
  const pool = getPool();
  const result = await pool.query<HazopAnalysisRowWithProgress>(
    `SELECT
       ha.*,
       (SELECT COUNT(*) FROM hazop.analysis_nodes an WHERE an.document_id = ha.document_id) AS total_nodes,
       (SELECT COUNT(DISTINCT ae.node_id) FROM hazop.analysis_entries ae WHERE ae.analysis_id = ha.id) AS analyzed_nodes,
       (SELECT COUNT(*) FROM hazop.analysis_entries ae WHERE ae.analysis_id = ha.id) AS total_entries,
       (SELECT COUNT(*) FROM hazop.analysis_entries ae WHERE ae.analysis_id = ha.id AND ae.risk_level = 'high') AS high_risk_count,
       (SELECT COUNT(*) FROM hazop.analysis_entries ae WHERE ae.analysis_id = ha.id AND ae.risk_level = 'medium') AS medium_risk_count,
       (SELECT COUNT(*) FROM hazop.analysis_entries ae WHERE ae.analysis_id = ha.id AND ae.risk_level = 'low') AS low_risk_count
     FROM hazop.hazop_analyses ha
     WHERE ha.id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToHazopAnalysisWithProgress(result.rows[0]);
}

/**
 * List HazOps analyses for a project with optional filtering and pagination.
 *
 * @param projectId - The ID of the project
 * @param filters - Optional filters (status, leadAnalystId, documentId, search)
 * @param pagination - Optional pagination options
 * @returns Paginated list of analyses with details
 */
export async function listProjectAnalyses(
  projectId: string,
  filters?: ListAnalysesFilters,
  pagination?: ListAnalysesPagination
): Promise<ListAnalysesResult> {
  const pool = getPool();

  // Build WHERE clause
  const whereClauses: string[] = ['ha.project_id = $1'];
  const values: unknown[] = [projectId];
  let paramIndex = 2;

  // Filter by status
  if (filters?.status) {
    whereClauses.push(`ha.status = $${paramIndex}`);
    values.push(filters.status);
    paramIndex++;
  }

  // Filter by lead analyst
  if (filters?.leadAnalystId) {
    whereClauses.push(`ha.lead_analyst_id = $${paramIndex}`);
    values.push(filters.leadAnalystId);
    paramIndex++;
  }

  // Filter by document
  if (filters?.documentId) {
    whereClauses.push(`ha.document_id = $${paramIndex}`);
    values.push(filters.documentId);
    paramIndex++;
  }

  // Search by name or description
  if (filters?.search) {
    whereClauses.push(
      `(LOWER(ha.name) LIKE $${paramIndex} OR LOWER(ha.description) LIKE $${paramIndex})`
    );
    values.push(`%${filters.search.toLowerCase()}%`);
    paramIndex++;
  }

  const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

  // Pagination
  const page = Math.max(pagination?.page ?? 1, 1);
  const limit = Math.min(Math.max(pagination?.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;

  // Sorting - use allowlist to prevent SQL injection
  const allowedSortFields = ['created_at', 'updated_at', 'name', 'status'];
  const sortBy = allowedSortFields.includes(pagination?.sortBy ?? '')
    ? pagination!.sortBy
    : 'created_at';
  const sortOrder = pagination?.sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Get total count
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM hazop.hazop_analyses ha
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get analyses with details
  const analysesResult = await pool.query<HazopAnalysisRowWithDetails>(
    `SELECT
       ha.*,
       pd.name AS document_name,
       la.name AS lead_analyst_name,
       la.email AS lead_analyst_email,
       cb.name AS created_by_name
     FROM hazop.hazop_analyses ha
     INNER JOIN hazop.pid_documents pd ON ha.document_id = pd.id
     INNER JOIN hazop.users la ON ha.lead_analyst_id = la.id
     INNER JOIN hazop.users cb ON ha.created_by_id = cb.id
     ${whereClause}
     ORDER BY ha.${sortBy} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  return {
    analyses: analysesResult.rows.map(rowToHazopAnalysisWithDetails),
    total,
  };
}

/**
 * Update a HazOps analysis by ID.
 * Only updates the fields provided in the data object.
 *
 * @param analysisId - The ID of the analysis to update
 * @param data - Update data (name, description, leadAnalystId - all optional)
 * @returns The updated analysis with details, or null if not found
 */
export async function updateAnalysis(
  analysisId: string,
  data: UpdateAnalysisData
): Promise<HazopAnalysisWithDetails | null> {
  const pool = getPool();

  // Build dynamic SET clause based on provided fields
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIndex}`);
    values.push(data.name);
    paramIndex++;
  }

  if (data.description !== undefined) {
    setClauses.push(`description = $${paramIndex}`);
    values.push(data.description);
    paramIndex++;
  }

  if (data.leadAnalystId !== undefined) {
    setClauses.push(`lead_analyst_id = $${paramIndex}`);
    values.push(data.leadAnalystId);
    paramIndex++;
  }

  // If no fields to update, just return the existing analysis
  if (setClauses.length === 0) {
    return findAnalysisById(analysisId);
  }

  // Add analysis ID as the last parameter
  values.push(analysisId);

  const result = await pool.query<HazopAnalysisRow>(
    `UPDATE hazop.hazop_analyses
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (!result.rows[0]) {
    return null;
  }

  // Fetch the updated analysis with details
  return findAnalysisById(result.rows[0].id);
}

/**
 * Delete a HazOps analysis by ID.
 * This will cascade delete all related analysis entries.
 *
 * @param analysisId - The ID of the analysis to delete
 * @returns True if the analysis was deleted, false if not found
 */
export async function deleteAnalysis(analysisId: string): Promise<boolean> {
  const pool = getPool();

  const result = await pool.query(
    `DELETE FROM hazop.hazop_analyses WHERE id = $1`,
    [analysisId]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Check if a document exists.
 *
 * @param documentId - The document ID to check
 * @returns True if the document exists, false otherwise
 */
export async function documentExists(documentId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hazop.pid_documents WHERE id = $1) AS exists`,
    [documentId]
  );
  return result.rows[0]?.exists ?? false;
}

/**
 * Check if a document belongs to a project.
 *
 * @param documentId - The document ID to check
 * @param projectId - The project ID to check
 * @returns True if the document belongs to the project, false otherwise
 */
export async function documentBelongsToProject(
  documentId: string,
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM hazop.pid_documents
       WHERE id = $1 AND project_id = $2
     ) AS exists`,
    [documentId, projectId]
  );
  return result.rows[0]?.exists ?? false;
}

/**
 * Check if an analysis belongs to a project.
 *
 * @param analysisId - The analysis ID to check
 * @param projectId - The project ID to check
 * @returns True if the analysis belongs to the project, false otherwise
 */
export async function analysisBelongsToProject(
  analysisId: string,
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM hazop.hazop_analyses
       WHERE id = $1 AND project_id = $2
     ) AS exists`,
    [analysisId, projectId]
  );
  return result.rows[0]?.exists ?? false;
}

/**
 * Get the project ID for an analysis.
 *
 * @param analysisId - The analysis ID
 * @returns The project ID, or null if analysis not found
 */
export async function getAnalysisProjectId(analysisId: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ project_id: string }>(
    `SELECT project_id FROM hazop.hazop_analyses WHERE id = $1`,
    [analysisId]
  );
  return result.rows[0]?.project_id ?? null;
}

/**
 * Submit an analysis for review.
 * Changes status from 'draft' to 'in_review'.
 *
 * @param analysisId - The analysis ID
 * @param reviewNotes - Optional notes for the reviewer
 * @returns The updated analysis, or null if not found or not in draft status
 */
export async function submitAnalysisForReview(
  analysisId: string,
  reviewNotes?: string
): Promise<HazopAnalysisWithDetails | null> {
  const pool = getPool();

  const result = await pool.query<HazopAnalysisRow>(
    `UPDATE hazop.hazop_analyses
     SET status = 'in_review',
         submitted_at = NOW(),
         review_notes = $2
     WHERE id = $1 AND status = 'draft'
     RETURNING *`,
    [analysisId, reviewNotes ?? null]
  );

  if (!result.rows[0]) {
    return null;
  }

  return findAnalysisById(result.rows[0].id);
}

/**
 * Approve an analysis.
 * Changes status from 'in_review' to 'approved'.
 *
 * @param analysisId - The analysis ID
 * @param approverId - The ID of the user approving the analysis
 * @param comments - Approval comments
 * @returns The updated analysis, or null if not found or not in review status
 */
export async function approveAnalysis(
  analysisId: string,
  approverId: string,
  comments: string
): Promise<HazopAnalysisWithDetails | null> {
  const pool = getPool();

  const result = await pool.query<HazopAnalysisRow>(
    `UPDATE hazop.hazop_analyses
     SET status = 'approved',
         approved_at = NOW(),
         approved_by_id = $2,
         approval_comments = $3
     WHERE id = $1 AND status = 'in_review'
     RETURNING *`,
    [analysisId, approverId, comments]
  );

  if (!result.rows[0]) {
    return null;
  }

  return findAnalysisById(result.rows[0].id);
}

/**
 * Reject an analysis.
 * Changes status from 'in_review' to 'rejected'.
 *
 * @param analysisId - The analysis ID
 * @param approverId - The ID of the user rejecting the analysis
 * @param comments - Rejection comments
 * @returns The updated analysis, or null if not found or not in review status
 */
export async function rejectAnalysis(
  analysisId: string,
  approverId: string,
  comments: string
): Promise<HazopAnalysisWithDetails | null> {
  const pool = getPool();

  const result = await pool.query<HazopAnalysisRow>(
    `UPDATE hazop.hazop_analyses
     SET status = 'rejected',
         approved_at = NOW(),
         approved_by_id = $2,
         approval_comments = $3
     WHERE id = $1 AND status = 'in_review'
     RETURNING *`,
    [analysisId, approverId, comments]
  );

  if (!result.rows[0]) {
    return null;
  }

  return findAnalysisById(result.rows[0].id);
}

/**
 * Revert a rejected analysis back to draft status.
 * Clears approval fields.
 *
 * @param analysisId - The analysis ID
 * @returns The updated analysis, or null if not found or not in rejected status
 */
export async function revertAnalysisToDraft(
  analysisId: string
): Promise<HazopAnalysisWithDetails | null> {
  const pool = getPool();

  const result = await pool.query<HazopAnalysisRow>(
    `UPDATE hazop.hazop_analyses
     SET status = 'draft',
         submitted_at = NULL,
         approved_at = NULL,
         approved_by_id = NULL,
         review_notes = NULL,
         approval_comments = NULL
     WHERE id = $1 AND status = 'rejected'
     RETURNING *`,
    [analysisId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return findAnalysisById(result.rows[0].id);
}

// ============================================================================
// Analysis Entry Service Functions
// ============================================================================

/**
 * Check if a node exists in a document.
 *
 * @param nodeId - The node ID to check
 * @param documentId - The document ID the node should belong to
 * @returns True if the node exists and belongs to the document, false otherwise
 */
export async function nodeExistsInDocument(
  nodeId: string,
  documentId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM hazop.analysis_nodes
       WHERE id = $1 AND document_id = $2
     ) AS exists`,
    [nodeId, documentId]
  );
  return result.rows[0]?.exists ?? false;
}

/**
 * Create a new analysis entry for a node/guideword combination.
 *
 * @param userId - The ID of the user creating the entry
 * @param data - Entry creation data
 * @returns The created analysis entry
 * @throws Error with code '23503' if analysis or node doesn't exist (FK violation)
 * @throws Error with code '23505' if entry with same analysis/node/guideword/parameter already exists
 */
export async function createAnalysisEntry(
  userId: string,
  data: CreateAnalysisEntryData
): Promise<AnalysisEntry> {
  const pool = getPool();

  const result = await pool.query<AnalysisEntryRow>(
    `INSERT INTO hazop.analysis_entries
       (analysis_id, node_id, guide_word, parameter, deviation, causes, consequences, safeguards, recommendations, notes, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      data.analysisId,
      data.nodeId,
      data.guideWord,
      data.parameter,
      data.deviation,
      JSON.stringify(data.causes ?? []),
      JSON.stringify(data.consequences ?? []),
      JSON.stringify(data.safeguards ?? []),
      JSON.stringify(data.recommendations ?? []),
      data.notes ?? null,
      userId,
    ]
  );

  return rowToAnalysisEntry(result.rows[0]);
}

/**
 * Find an analysis entry by ID.
 *
 * @param entryId - The entry ID to find
 * @returns The analysis entry, or null if not found
 */
export async function findAnalysisEntryById(entryId: string): Promise<AnalysisEntry | null> {
  const pool = getPool();
  const result = await pool.query<AnalysisEntryRow>(
    `SELECT * FROM hazop.analysis_entries WHERE id = $1`,
    [entryId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToAnalysisEntry(result.rows[0]);
}

/**
 * Get the analysis ID for an entry.
 *
 * @param entryId - The entry ID
 * @returns The analysis ID, or null if entry not found
 */
export async function getEntryAnalysisId(entryId: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ analysis_id: string }>(
    `SELECT analysis_id FROM hazop.analysis_entries WHERE id = $1`,
    [entryId]
  );
  return result.rows[0]?.analysis_id ?? null;
}

// ============================================================================
// List Analysis Entries
// ============================================================================

/**
 * Filter options for listing analysis entries.
 */
export interface ListEntriesFilters {
  /** Filter by node ID */
  nodeId?: string;
  /** Filter by guide word */
  guideWord?: GuideWord;
  /** Filter by risk level */
  riskLevel?: RiskLevel;
  /** Search query for parameter or deviation */
  search?: string;
}

/**
 * Pagination options for listing analysis entries.
 */
export interface ListEntriesPagination {
  /** Page number (1-based). Defaults to 1. */
  page?: number;
  /** Number of items per page. Defaults to 20, max 100. */
  limit?: number;
  /** Field to sort by. Defaults to 'created_at'. */
  sortBy?: 'created_at' | 'updated_at' | 'parameter' | 'guide_word' | 'risk_score';
  /** Sort direction. Defaults to 'asc'. */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Result from listing analysis entries.
 */
export interface ListEntriesResult {
  /** Array of analysis entries */
  entries: AnalysisEntry[];
  /** Total number of entries matching the filters */
  total: number;
}

/**
 * List analysis entries for an analysis with optional filtering and pagination.
 *
 * @param analysisId - The ID of the analysis
 * @param filters - Optional filters (nodeId, guideWord, riskLevel, search)
 * @param pagination - Optional pagination options
 * @returns Paginated list of analysis entries
 */
export async function listAnalysisEntries(
  analysisId: string,
  filters?: ListEntriesFilters,
  pagination?: ListEntriesPagination
): Promise<ListEntriesResult> {
  const pool = getPool();

  // Build WHERE clause
  const whereClauses: string[] = ['ae.analysis_id = $1'];
  const values: unknown[] = [analysisId];
  let paramIndex = 2;

  // Filter by node ID
  if (filters?.nodeId) {
    whereClauses.push(`ae.node_id = $${paramIndex}`);
    values.push(filters.nodeId);
    paramIndex++;
  }

  // Filter by guide word
  if (filters?.guideWord) {
    whereClauses.push(`ae.guide_word = $${paramIndex}`);
    values.push(filters.guideWord);
    paramIndex++;
  }

  // Filter by risk level
  if (filters?.riskLevel) {
    whereClauses.push(`ae.risk_level = $${paramIndex}`);
    values.push(filters.riskLevel);
    paramIndex++;
  }

  // Search by parameter or deviation
  if (filters?.search) {
    whereClauses.push(
      `(LOWER(ae.parameter) LIKE $${paramIndex} OR LOWER(ae.deviation) LIKE $${paramIndex})`
    );
    values.push(`%${filters.search.toLowerCase()}%`);
    paramIndex++;
  }

  const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

  // Pagination
  const page = Math.max(pagination?.page ?? 1, 1);
  const limit = Math.min(Math.max(pagination?.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;

  // Sorting - use allowlist to prevent SQL injection
  const allowedSortFields = ['created_at', 'updated_at', 'parameter', 'guide_word', 'risk_score'];
  const sortBy = allowedSortFields.includes(pagination?.sortBy ?? '')
    ? pagination!.sortBy
    : 'created_at';
  const sortOrder = pagination?.sortOrder === 'desc' ? 'DESC' : 'ASC';

  // Get total count
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM hazop.analysis_entries ae
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get entries
  const entriesResult = await pool.query<AnalysisEntryRow>(
    `SELECT ae.*
     FROM hazop.analysis_entries ae
     ${whereClause}
     ORDER BY ae.${sortBy} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  return {
    entries: entriesResult.rows.map(rowToAnalysisEntry),
    total,
  };
}

/**
 * Update an analysis entry by ID.
 * Only updates the fields provided in the data object.
 * Note: nodeId, guideWord, and parameter cannot be updated as they form the unique constraint.
 *
 * @param entryId - The ID of the entry to update
 * @param data - Update data (all fields optional)
 * @returns The updated analysis entry, or null if not found
 */
export async function updateAnalysisEntry(
  entryId: string,
  data: UpdateAnalysisEntryData
): Promise<AnalysisEntry | null> {
  const pool = getPool();

  // Build dynamic SET clause based on provided fields
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.deviation !== undefined) {
    setClauses.push(`deviation = $${paramIndex}`);
    values.push(data.deviation);
    paramIndex++;
  }

  if (data.causes !== undefined) {
    setClauses.push(`causes = $${paramIndex}`);
    values.push(JSON.stringify(data.causes));
    paramIndex++;
  }

  if (data.consequences !== undefined) {
    setClauses.push(`consequences = $${paramIndex}`);
    values.push(JSON.stringify(data.consequences));
    paramIndex++;
  }

  if (data.safeguards !== undefined) {
    setClauses.push(`safeguards = $${paramIndex}`);
    values.push(JSON.stringify(data.safeguards));
    paramIndex++;
  }

  if (data.recommendations !== undefined) {
    setClauses.push(`recommendations = $${paramIndex}`);
    values.push(JSON.stringify(data.recommendations));
    paramIndex++;
  }

  if (data.notes !== undefined) {
    setClauses.push(`notes = $${paramIndex}`);
    values.push(data.notes);
    paramIndex++;
  }

  // If no fields to update, just return the existing entry
  if (setClauses.length === 0) {
    return findAnalysisEntryById(entryId);
  }

  // Add entry ID as the last parameter
  values.push(entryId);

  const result = await pool.query<AnalysisEntryRow>(
    `UPDATE hazop.analysis_entries
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToAnalysisEntry(result.rows[0]);
}
