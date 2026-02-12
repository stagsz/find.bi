/**
 * Reports service for database operations.
 *
 * Handles report CRUD operations for generated HazOps reports.
 * Reports are generated asynchronously via a message queue (RabbitMQ)
 * and stored in file storage (MinIO/S3).
 */

import { getPool } from '../config/database.config.js';
import { randomUUID } from 'crypto';
import type {
  Report,
  ReportFormat,
  ReportStatus,
  ReportParameters,
  ReportWithDetails,
} from '@hazop/types';

// ============================================================================
// Database Row Types (snake_case matching PostgreSQL schema)
// ============================================================================

/**
 * Report row from the database.
 */
interface ReportRow {
  id: string;
  hazop_analysis_id: string;
  name: string;
  format: ReportFormat;
  template_used: string;
  status: ReportStatus;
  file_path: string | null;
  file_size: string | null;
  generated_by_id: string;
  requested_at: Date;
  generated_at: Date | null;
  parameters: ReportParameters;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Report row with analysis and user details.
 */
interface ReportRowWithDetails extends ReportRow {
  analysis_name: string;
  project_name: string;
  project_id: string;
  generated_by_name: string;
  generated_by_email: string;
}

// ============================================================================
// Row Converters
// ============================================================================

/**
 * Convert a database row to a Report object.
 * Maps snake_case columns to camelCase properties.
 */
function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    hazopAnalysisId: row.hazop_analysis_id,
    name: row.name,
    format: row.format,
    templateUsed: row.template_used,
    status: row.status,
    filePath: row.file_path,
    fileSize: row.file_size ? parseInt(row.file_size, 10) : null,
    generatedById: row.generated_by_id,
    requestedAt: row.requested_at,
    generatedAt: row.generated_at,
    parameters: row.parameters,
    errorMessage: row.error_message,
  };
}

/**
 * Convert a database row with details to ReportWithDetails object.
 */
function rowToReportWithDetails(row: ReportRowWithDetails): ReportWithDetails {
  return {
    ...rowToReport(row),
    analysisName: row.analysis_name,
    projectName: row.project_name,
    projectId: row.project_id,
    generatedByName: row.generated_by_name,
    generatedByEmail: row.generated_by_email,
  };
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Input for creating a new report.
 */
export interface CreateReportInput {
  /** ID of the analysis to generate report from */
  analysisId: string;
  /** Output format */
  format: ReportFormat;
  /** Template identifier */
  template: string;
  /** Report name */
  name: string;
  /** Generation parameters */
  parameters: ReportParameters;
  /** ID of the user requesting the report */
  requestedById: string;
}

/**
 * Result from listing reports.
 */
export interface ListReportsResult {
  /** Array of reports with details */
  reports: ReportWithDetails[];
  /** Total count matching filters */
  total: number;
}

// ============================================================================
// Report CRUD Operations
// ============================================================================

/**
 * Create a new report record in the database.
 * The report is created with 'pending' status.
 *
 * @param input - The report creation input
 * @returns The created report record
 */
export async function createReport(input: CreateReportInput): Promise<Report> {
  const pool = getPool();
  const id = randomUUID();

  const result = await pool.query<ReportRow>(
    `INSERT INTO hazop.reports
       (id, hazop_analysis_id, name, format, template_used, status, generated_by_id, parameters)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
     RETURNING
       id, hazop_analysis_id, name, format, template_used, status,
       file_path, file_size, generated_by_id, requested_at, generated_at,
       parameters, error_message, created_at, updated_at`,
    [
      id,
      input.analysisId,
      input.name,
      input.format,
      input.template,
      input.requestedById,
      JSON.stringify(input.parameters),
    ]
  );

  return rowToReport(result.rows[0]);
}

/**
 * Find a report by ID.
 *
 * @param id - The report ID
 * @returns The report or null if not found
 */
export async function findReportById(id: string): Promise<Report | null> {
  const pool = getPool();
  const result = await pool.query<ReportRow>(
    `SELECT
       id, hazop_analysis_id, name, format, template_used, status,
       file_path, file_size, generated_by_id, requested_at, generated_at,
       parameters, error_message, created_at, updated_at
     FROM hazop.reports
     WHERE id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToReport(result.rows[0]);
}

/**
 * Find a report by ID with full details.
 *
 * @param id - The report ID
 * @returns The report with details or null if not found
 */
export async function findReportByIdWithDetails(id: string): Promise<ReportWithDetails | null> {
  const pool = getPool();
  const result = await pool.query<ReportRowWithDetails>(
    `SELECT
       r.id, r.hazop_analysis_id, r.name, r.format, r.template_used, r.status,
       r.file_path, r.file_size, r.generated_by_id, r.requested_at, r.generated_at,
       r.parameters, r.error_message, r.created_at, r.updated_at,
       ha.name AS analysis_name,
       p.name AS project_name,
       p.id AS project_id,
       u.name AS generated_by_name,
       u.email AS generated_by_email
     FROM hazop.reports r
     INNER JOIN hazop.hazop_analyses ha ON r.hazop_analysis_id = ha.id
     INNER JOIN hazop.projects p ON ha.project_id = p.id
     INNER JOIN hazop.users u ON r.generated_by_id = u.id
     WHERE r.id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToReportWithDetails(result.rows[0]);
}

/**
 * Update a report's status.
 *
 * @param id - The report ID
 * @param status - The new status
 * @param updates - Optional additional updates (filePath, fileSize, errorMessage, generatedAt)
 * @returns True if updated, false if not found
 */
export async function updateReportStatus(
  id: string,
  status: ReportStatus,
  updates?: {
    filePath?: string;
    fileSize?: number;
    errorMessage?: string;
    generatedAt?: Date;
  }
): Promise<boolean> {
  const pool = getPool();

  const setClauses = ['status = $2'];
  const values: unknown[] = [id, status];
  let paramIndex = 3;

  if (updates?.filePath !== undefined) {
    setClauses.push(`file_path = $${paramIndex}`);
    values.push(updates.filePath);
    paramIndex++;
  }

  if (updates?.fileSize !== undefined) {
    setClauses.push(`file_size = $${paramIndex}`);
    values.push(updates.fileSize);
    paramIndex++;
  }

  if (updates?.errorMessage !== undefined) {
    setClauses.push(`error_message = $${paramIndex}`);
    values.push(updates.errorMessage);
    paramIndex++;
  }

  if (updates?.generatedAt !== undefined) {
    setClauses.push(`generated_at = $${paramIndex}`);
    values.push(updates.generatedAt);
    paramIndex++;
  }

  const result = await pool.query(
    `UPDATE hazop.reports SET ${setClauses.join(', ')} WHERE id = $1`,
    values
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Get the project ID for an analysis.
 * Used to validate analysis belongs to project.
 *
 * @param analysisId - The analysis ID
 * @returns The project ID or null if analysis not found
 */
export async function getProjectIdForAnalysis(analysisId: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ project_id: string }>(
    `SELECT project_id FROM hazop.hazop_analyses WHERE id = $1`,
    [analysisId]
  );

  return result.rows[0]?.project_id ?? null;
}

/**
 * Check if an analysis exists.
 *
 * @param analysisId - The analysis ID
 * @returns True if analysis exists
 */
export async function analysisExists(analysisId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hazop.hazop_analyses WHERE id = $1) AS exists`,
    [analysisId]
  );

  return result.rows[0]?.exists ?? false;
}

// ============================================================================
// List Reports for Project
// ============================================================================

/**
 * Filters for listing reports.
 */
export interface ListReportsFilters {
  /** Filter by analysis ID */
  analysisId?: string;
  /** Filter by report format */
  format?: ReportFormat;
  /** Filter by report status */
  status?: ReportStatus;
  /** Search by report name */
  search?: string;
}

/**
 * Pagination options for listing reports.
 */
export interface ListReportsPagination {
  /** Page number (1-based) */
  page?: number;
  /** Items per page (default 20, max 100) */
  limit?: number;
  /** Sort field */
  sortBy?: 'requested_at' | 'generated_at' | 'name' | 'status';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Valid sort fields for reports (prevents SQL injection).
 */
const VALID_REPORT_SORT_FIELDS = ['requested_at', 'generated_at', 'name', 'status'];

/**
 * List reports for a project with filtering and pagination.
 *
 * Returns reports for all analyses within the project, with full details
 * including analysis name, project name, and generator user info.
 *
 * @param projectId - The project ID to list reports for
 * @param filters - Optional filters for analysis, format, status, search
 * @param pagination - Optional pagination options
 * @returns Reports array and total count
 */
export async function listProjectReports(
  projectId: string,
  filters?: ListReportsFilters,
  pagination?: ListReportsPagination
): Promise<ListReportsResult> {
  const pool = getPool();

  // Build WHERE clauses
  const whereClauses = ['p.id = $1'];
  const values: unknown[] = [projectId];
  let paramIndex = 2;

  // Filter by analysis ID
  if (filters?.analysisId) {
    whereClauses.push(`r.hazop_analysis_id = $${paramIndex}`);
    values.push(filters.analysisId);
    paramIndex++;
  }

  // Filter by format
  if (filters?.format) {
    whereClauses.push(`r.format = $${paramIndex}`);
    values.push(filters.format);
    paramIndex++;
  }

  // Filter by status
  if (filters?.status) {
    whereClauses.push(`r.status = $${paramIndex}`);
    values.push(filters.status);
    paramIndex++;
  }

  // Search by name (case-insensitive)
  if (filters?.search) {
    whereClauses.push(`r.name ILIKE $${paramIndex}`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = whereClauses.join(' AND ');

  // Get total count
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM hazop.reports r
     INNER JOIN hazop.hazop_analyses ha ON r.hazop_analysis_id = ha.id
     INNER JOIN hazop.projects p ON ha.project_id = p.id
     WHERE ${whereClause}`,
    values
  );

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  // Build ORDER BY clause with validated sort field
  const sortBy = pagination?.sortBy && VALID_REPORT_SORT_FIELDS.includes(pagination.sortBy)
    ? pagination.sortBy
    : 'requested_at';
  const sortOrder = pagination?.sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Build LIMIT and OFFSET
  const page = pagination?.page ?? 1;
  const limit = Math.min(pagination?.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  // Fetch reports with details
  const result = await pool.query<ReportRowWithDetails>(
    `SELECT
       r.id, r.hazop_analysis_id, r.name, r.format, r.template_used, r.status,
       r.file_path, r.file_size, r.generated_by_id, r.requested_at, r.generated_at,
       r.parameters, r.error_message, r.created_at, r.updated_at,
       ha.name AS analysis_name,
       p.name AS project_name,
       p.id AS project_id,
       u.name AS generated_by_name,
       u.email AS generated_by_email
     FROM hazop.reports r
     INNER JOIN hazop.hazop_analyses ha ON r.hazop_analysis_id = ha.id
     INNER JOIN hazop.projects p ON ha.project_id = p.id
     INNER JOIN hazop.users u ON r.generated_by_id = u.id
     WHERE ${whereClause}
     ORDER BY r.${sortBy} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  const reports = result.rows.map(rowToReportWithDetails);

  return { reports, total };
}
