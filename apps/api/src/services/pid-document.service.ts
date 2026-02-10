/**
 * P&ID Document service for database operations.
 *
 * Handles document CRUD operations, status updates, and queries.
 */

import { getPool } from '../config/database.config.js';
import type { PIDDocumentStatus } from '@hazop/types';

/**
 * P&ID document row from the database.
 * Uses snake_case column names matching PostgreSQL schema.
 */
export interface PIDDocumentRow {
  id: string;
  project_id: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  file_size: string; // BIGINT comes as string from pg
  status: PIDDocumentStatus;
  error_message: string | null;
  width: number | null;
  height: number | null;
  uploaded_by_id: string;
  uploaded_at: Date;
  processed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * P&ID document row with uploader info joined from users table.
 */
export interface PIDDocumentRowWithUploader extends PIDDocumentRow {
  uploaded_by_name: string;
  uploaded_by_email: string;
}

/**
 * P&ID document object (API response format).
 */
export interface PIDDocument {
  id: string;
  projectId: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  status: PIDDocumentStatus;
  errorMessage: string | null;
  width: number | null;
  height: number | null;
  uploadedById: string;
  uploadedAt: Date;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * P&ID document with uploader information (for display purposes).
 */
export interface PIDDocumentWithUploader extends PIDDocument {
  uploadedByName: string;
  uploadedByEmail: string;
}

/**
 * Convert a database row to a PIDDocument object.
 * Maps snake_case columns to camelCase properties.
 */
function rowToDocument(row: PIDDocumentRow): PIDDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    filename: row.filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSize: parseInt(row.file_size, 10),
    status: row.status,
    errorMessage: row.error_message,
    width: row.width,
    height: row.height,
    uploadedById: row.uploaded_by_id,
    uploadedAt: row.uploaded_at,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert a database row with uploader info to PIDDocumentWithUploader object.
 */
function rowToDocumentWithUploader(row: PIDDocumentRowWithUploader): PIDDocumentWithUploader {
  return {
    ...rowToDocument(row),
    uploadedByName: row.uploaded_by_name,
    uploadedByEmail: row.uploaded_by_email,
  };
}

/**
 * Payload for creating a new P&ID document record.
 */
export interface CreatePIDDocumentData {
  projectId: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  uploadedById: string;
}

/**
 * Create a new P&ID document record in the database.
 * The document is created with 'pending' status.
 *
 * @param data - Document creation data
 * @returns The created document with uploader information
 */
export async function createPIDDocument(
  data: CreatePIDDocumentData
): Promise<PIDDocumentWithUploader> {
  const pool = getPool();

  const result = await pool.query<PIDDocumentRowWithUploader>(
    `INSERT INTO hazop.pid_documents
       (project_id, filename, storage_path, mime_type, file_size, uploaded_by_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING
       id,
       project_id,
       filename,
       storage_path,
       mime_type,
       file_size,
       status,
       error_message,
       width,
       height,
       uploaded_by_id,
       uploaded_at,
       processed_at,
       created_at,
       updated_at,
       (SELECT name FROM hazop.users WHERE id = $6) AS uploaded_by_name,
       (SELECT email FROM hazop.users WHERE id = $6) AS uploaded_by_email`,
    [
      data.projectId,
      data.filename,
      data.storagePath,
      data.mimeType,
      data.fileSize,
      data.uploadedById,
    ]
  );

  return rowToDocumentWithUploader(result.rows[0]);
}

/**
 * Find a P&ID document by ID.
 * Returns null if document not found.
 *
 * @param documentId - The document ID
 * @returns The document with uploader information, or null if not found
 */
export async function findPIDDocumentById(
  documentId: string
): Promise<PIDDocumentWithUploader | null> {
  const pool = getPool();

  const result = await pool.query<PIDDocumentRowWithUploader>(
    `SELECT
       d.id,
       d.project_id,
       d.filename,
       d.storage_path,
       d.mime_type,
       d.file_size,
       d.status,
       d.error_message,
       d.width,
       d.height,
       d.uploaded_by_id,
       d.uploaded_at,
       d.processed_at,
       d.created_at,
       d.updated_at,
       u.name AS uploaded_by_name,
       u.email AS uploaded_by_email
     FROM hazop.pid_documents d
     INNER JOIN hazop.users u ON d.uploaded_by_id = u.id
     WHERE d.id = $1`,
    [documentId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToDocumentWithUploader(result.rows[0]);
}

/**
 * Check if a document belongs to a specific project.
 *
 * @param documentId - The document ID
 * @param projectId - The project ID
 * @returns True if the document belongs to the project
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
 * Filters for listing project documents.
 */
export interface ListDocumentsFilters {
  status?: PIDDocumentStatus;
  search?: string;
}

/**
 * Pagination options for listing project documents.
 */
export interface ListDocumentsPagination {
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'uploaded_at' | 'filename' | 'status' | 'file_size';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Result of listing project documents.
 */
export interface ListDocumentsResult {
  documents: PIDDocumentWithUploader[];
  total: number;
}

/**
 * List all P&ID documents for a project with pagination and filtering.
 *
 * @param projectId - The project ID
 * @param filters - Optional filters (status, search)
 * @param pagination - Optional pagination options
 * @returns Paginated list of documents with uploader info
 */
export async function listProjectDocuments(
  projectId: string,
  filters: ListDocumentsFilters = {},
  pagination: ListDocumentsPagination = {}
): Promise<ListDocumentsResult> {
  const pool = getPool();

  // Set defaults for pagination
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 20;
  const sortBy = pagination.sortBy ?? 'uploaded_at';
  const sortOrder = pagination.sortOrder ?? 'desc';
  const offset = (page - 1) * limit;

  // Build WHERE clause conditions
  const conditions: string[] = ['d.project_id = $1'];
  const params: (string | number)[] = [projectId];
  let paramIndex = 2;

  // Filter by status
  if (filters.status) {
    conditions.push(`d.status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  // Filter by search (filename)
  if (filters.search) {
    conditions.push(`d.filename ILIKE $${paramIndex}`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // Validate and map sort column
  const sortColumnMap: Record<string, string> = {
    created_at: 'd.created_at',
    uploaded_at: 'd.uploaded_at',
    filename: 'd.filename',
    status: 'd.status',
    file_size: 'd.file_size',
  };
  const sortColumn = sortColumnMap[sortBy] || 'd.uploaded_at';
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Count total matching documents
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM hazop.pid_documents d
     WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  // Fetch paginated documents with uploader info
  const result = await pool.query<PIDDocumentRowWithUploader>(
    `SELECT
       d.id,
       d.project_id,
       d.filename,
       d.storage_path,
       d.mime_type,
       d.file_size,
       d.status,
       d.error_message,
       d.width,
       d.height,
       d.uploaded_by_id,
       d.uploaded_at,
       d.processed_at,
       d.created_at,
       d.updated_at,
       u.name AS uploaded_by_name,
       u.email AS uploaded_by_email
     FROM hazop.pid_documents d
     INNER JOIN hazop.users u ON d.uploaded_by_id = u.id
     WHERE ${whereClause}
     ORDER BY ${sortColumn} ${order}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  const documents = result.rows.map(rowToDocumentWithUploader);

  return { documents, total };
}

/**
 * Delete a P&ID document by ID.
 * Returns the deleted document (for cleanup operations like file deletion).
 *
 * @param documentId - The document ID
 * @returns The deleted document, or null if not found
 */
export async function deletePIDDocument(
  documentId: string
): Promise<PIDDocument | null> {
  const pool = getPool();

  const result = await pool.query<PIDDocumentRow>(
    `DELETE FROM hazop.pid_documents
     WHERE id = $1
     RETURNING
       id,
       project_id,
       filename,
       storage_path,
       mime_type,
       file_size,
       status,
       error_message,
       width,
       height,
       uploaded_by_id,
       uploaded_at,
       processed_at,
       created_at,
       updated_at`,
    [documentId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToDocument(result.rows[0]);
}
