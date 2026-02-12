/**
 * Report template management service.
 *
 * Provides CRUD operations for report templates including file storage in MinIO
 * and metadata management in PostgreSQL. Templates allow customization of
 * report output formats (PDF, Word, Excel, PowerPoint).
 */

import { getPool } from '../config/database.config.js';
import { randomUUID } from 'crypto';
import type {
  ReportTemplate,
  ReportTemplateWithCreator,
  CreateReportTemplatePayload,
  UpdateReportTemplatePayload,
  ListReportTemplatesQuery,
  ReportFormat,
  REPORT_FORMATS,
} from '@hazop/types';

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Report template row from the database.
 * Uses snake_case column names matching PostgreSQL schema.
 */
interface ReportTemplateRow {
  id: string;
  name: string;
  description: string | null;
  template_path: string;
  supported_formats: ReportFormat[];
  is_active: boolean;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Report template row with creator info joined from users table.
 */
interface ReportTemplateRowWithCreator extends ReportTemplateRow {
  created_by_name: string;
  created_by_email: string;
}

// ============================================================================
// Row Conversion Functions
// ============================================================================

/**
 * Convert a database row to a ReportTemplate object.
 * Maps snake_case columns to camelCase properties.
 */
function rowToTemplate(row: ReportTemplateRow): ReportTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    templatePath: row.template_path,
    supportedFormats: row.supported_formats,
    isActive: row.is_active,
    createdById: row.created_by_id,
    createdAt: row.created_at,
  };
}

/**
 * Convert a database row with creator info to ReportTemplateWithCreator object.
 */
function rowToTemplateWithCreator(row: ReportTemplateRowWithCreator): ReportTemplateWithCreator {
  return {
    ...rowToTemplate(row),
    createdByName: row.created_by_name,
    createdByEmail: row.created_by_email,
  };
}

// ============================================================================
// Service Result Types
// ============================================================================

/**
 * Result from listing templates.
 */
export interface ListTemplatesResult {
  /** Array of templates with creator info */
  templates: ReportTemplateWithCreator[];
  /** Total number of templates matching the filters */
  total: number;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that the supported formats array contains valid format values.
 *
 * @param formats - Array of format strings to validate
 * @returns True if all formats are valid
 */
export function validateSupportedFormats(formats: string[]): formats is ReportFormat[] {
  const validFormats: readonly string[] = ['pdf', 'word', 'excel', 'powerpoint'];
  return formats.every((format) => validFormats.includes(format));
}

/**
 * Validate that the supported formats array is non-empty.
 *
 * @param formats - Array of formats to check
 * @returns True if array has at least one element
 */
export function validateNonEmptyFormats(formats: unknown[]): boolean {
  return formats.length > 0;
}

// ============================================================================
// Template CRUD Operations
// ============================================================================

/**
 * Create a new report template.
 *
 * @param createdById - The ID of the user creating the template
 * @param data - Template creation data
 * @returns The created template with creator information
 * @throws Error if validation fails or database insert fails
 */
export async function createTemplate(
  createdById: string,
  data: CreateReportTemplatePayload
): Promise<ReportTemplateWithCreator> {
  const pool = getPool();

  // Validate supported formats
  if (!validateNonEmptyFormats(data.supportedFormats)) {
    throw new Error('Supported formats cannot be empty');
  }
  if (!validateSupportedFormats(data.supportedFormats)) {
    throw new Error('Invalid format in supported formats');
  }

  // Validate name is not empty
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Template name cannot be empty');
  }

  // Validate template path is not empty
  if (!data.templatePath || data.templatePath.trim().length === 0) {
    throw new Error('Template path cannot be empty');
  }

  const id = randomUUID();

  const result = await pool.query<ReportTemplateRow>(
    `INSERT INTO hazop.report_templates
       (id, name, description, template_path, supported_formats, is_active, created_by_id)
     VALUES ($1, $2, $3, $4, $5, true, $6)
     RETURNING id, name, description, template_path, supported_formats, is_active, created_by_id, created_at, updated_at`,
    [
      id,
      data.name.trim(),
      data.description?.trim() || null,
      data.templatePath.trim(),
      JSON.stringify(data.supportedFormats),
      createdById,
    ]
  );

  // Fetch with creator info
  const template = await findTemplateById(result.rows[0].id);
  if (!template) {
    throw new Error('Failed to fetch created template');
  }

  return template;
}

/**
 * Find a template by ID.
 * Returns null if template not found.
 *
 * @param id - The template ID
 * @returns The template with creator info, or null if not found
 */
export async function findTemplateById(id: string): Promise<ReportTemplateWithCreator | null> {
  const pool = getPool();
  const result = await pool.query<ReportTemplateRowWithCreator>(
    `SELECT
       t.id,
       t.name,
       t.description,
       t.template_path,
       t.supported_formats,
       t.is_active,
       t.created_by_id,
       t.created_at,
       t.updated_at,
       u.name AS created_by_name,
       u.email AS created_by_email
     FROM hazop.report_templates t
     INNER JOIN hazop.users u ON t.created_by_id = u.id
     WHERE t.id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToTemplateWithCreator(result.rows[0]);
}

/**
 * List templates with optional filtering and pagination.
 *
 * @param query - Query parameters for filtering and pagination
 * @returns Paginated list of templates with creator info
 */
export async function listTemplates(
  query?: ListReportTemplatesQuery
): Promise<ListTemplatesResult> {
  const pool = getPool();

  // Build WHERE clause
  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Filter by active status
  if (query?.isActive !== undefined) {
    whereClauses.push(`t.is_active = $${paramIndex}`);
    values.push(query.isActive);
    paramIndex++;
  }

  // Filter by format - use JSONB containment operator
  if (query?.format) {
    whereClauses.push(`t.supported_formats @> $${paramIndex}::jsonb`);
    values.push(JSON.stringify([query.format]));
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Pagination
  const page = Math.max(query?.page ?? 1, 1);
  const limit = Math.min(Math.max(query?.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM hazop.report_templates t
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get templates with creator info
  const templatesResult = await pool.query<ReportTemplateRowWithCreator>(
    `SELECT
       t.id,
       t.name,
       t.description,
       t.template_path,
       t.supported_formats,
       t.is_active,
       t.created_by_id,
       t.created_at,
       t.updated_at,
       u.name AS created_by_name,
       u.email AS created_by_email
     FROM hazop.report_templates t
     INNER JOIN hazop.users u ON t.created_by_id = u.id
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  return {
    templates: templatesResult.rows.map(rowToTemplateWithCreator),
    total,
  };
}

/**
 * Update a template by ID.
 * Only updates the fields provided in the data object.
 *
 * @param id - The template ID
 * @param data - Update data (all fields optional)
 * @returns The updated template with creator info, or null if not found
 * @throws Error if validation fails
 */
export async function updateTemplate(
  id: string,
  data: UpdateReportTemplatePayload
): Promise<ReportTemplateWithCreator | null> {
  const pool = getPool();

  // Build dynamic SET clause based on provided fields
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Template name cannot be empty');
    }
    setClauses.push(`name = $${paramIndex}`);
    values.push(data.name.trim());
    paramIndex++;
  }

  if (data.description !== undefined) {
    setClauses.push(`description = $${paramIndex}`);
    values.push(data.description?.trim() || null);
    paramIndex++;
  }

  if (data.templatePath !== undefined) {
    if (!data.templatePath || data.templatePath.trim().length === 0) {
      throw new Error('Template path cannot be empty');
    }
    setClauses.push(`template_path = $${paramIndex}`);
    values.push(data.templatePath.trim());
    paramIndex++;
  }

  if (data.supportedFormats !== undefined) {
    if (!validateNonEmptyFormats(data.supportedFormats)) {
      throw new Error('Supported formats cannot be empty');
    }
    if (!validateSupportedFormats(data.supportedFormats)) {
      throw new Error('Invalid format in supported formats');
    }
    setClauses.push(`supported_formats = $${paramIndex}`);
    values.push(JSON.stringify(data.supportedFormats));
    paramIndex++;
  }

  if (data.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex}`);
    values.push(data.isActive);
    paramIndex++;
  }

  // If no fields to update, just return the existing template
  if (setClauses.length === 0) {
    return findTemplateById(id);
  }

  // Add template ID as the last parameter
  values.push(id);

  const result = await pool.query<ReportTemplateRow>(
    `UPDATE hazop.report_templates
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, name, description, template_path, supported_formats, is_active, created_by_id, created_at, updated_at`,
    values
  );

  if (!result.rows[0]) {
    return null;
  }

  // Fetch the updated template with creator info
  return findTemplateById(result.rows[0].id);
}

/**
 * Delete (archive) a template by setting is_active to false.
 * Templates are soft-deleted to preserve referential integrity with existing reports.
 *
 * @param id - The template ID
 * @returns True if template was archived, false if not found
 */
export async function archiveTemplate(id: string): Promise<boolean> {
  const pool = getPool();

  const result = await pool.query(
    `UPDATE hazop.report_templates
     SET is_active = false
     WHERE id = $1 AND is_active = true`,
    [id]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Permanently delete a template from the database.
 * Use with caution - prefer archiveTemplate for normal operations.
 *
 * @param id - The template ID
 * @returns True if template was deleted, false if not found
 */
export async function deleteTemplate(id: string): Promise<boolean> {
  const pool = getPool();

  const result = await pool.query(
    `DELETE FROM hazop.report_templates WHERE id = $1`,
    [id]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Get all active templates.
 * Returns templates ordered by name for UI display.
 *
 * @returns Array of active templates with creator info
 */
export async function getActiveTemplates(): Promise<ReportTemplateWithCreator[]> {
  const result = await listTemplates({ isActive: true, limit: 100 });
  return result.templates;
}

/**
 * Get active templates that support a specific format.
 *
 * @param format - The report format to filter by
 * @returns Array of templates supporting the format
 */
export async function getTemplatesByFormat(
  format: ReportFormat
): Promise<ReportTemplateWithCreator[]> {
  const result = await listTemplates({ format, isActive: true, limit: 100 });
  return result.templates;
}

/**
 * Check if a template exists and is active.
 *
 * @param id - The template ID
 * @returns True if template exists and is active
 */
export async function templateIsActive(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ is_active: boolean }>(
    `SELECT is_active FROM hazop.report_templates WHERE id = $1`,
    [id]
  );
  return result.rows[0]?.is_active ?? false;
}

/**
 * Check if a template supports a specific format.
 *
 * @param id - The template ID
 * @param format - The format to check
 * @returns True if template supports the format
 */
export async function templateSupportsFormat(
  id: string,
  format: ReportFormat
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ supports: boolean }>(
    `SELECT supported_formats @> $1::jsonb AS supports
     FROM hazop.report_templates
     WHERE id = $2`,
    [JSON.stringify([format]), id]
  );
  return result.rows[0]?.supports ?? false;
}

/**
 * Count templates by active status.
 *
 * @returns Object with active and inactive counts
 */
export async function countTemplates(): Promise<{ active: number; inactive: number }> {
  const pool = getPool();
  const result = await pool.query<{ is_active: boolean; count: string }>(
    `SELECT is_active, COUNT(*) as count
     FROM hazop.report_templates
     GROUP BY is_active`
  );

  const counts = { active: 0, inactive: 0 };
  for (const row of result.rows) {
    if (row.is_active) {
      counts.active = parseInt(row.count, 10);
    } else {
      counts.inactive = parseInt(row.count, 10);
    }
  }

  return counts;
}

/**
 * Generate a storage path for a template file.
 * Format: templates/{uuid}.{extension}
 *
 * @param originalFilename - The original filename to extract extension
 * @returns A unique storage path for the template
 */
export function generateTemplateStoragePath(originalFilename: string): string {
  const uuid = randomUUID();
  const lastDot = originalFilename.lastIndexOf('.');
  const extension = lastDot !== -1 ? originalFilename.slice(lastDot + 1).toLowerCase() : '';

  if (extension) {
    return `templates/${uuid}.${extension}`;
  }
  return `templates/${uuid}`;
}
