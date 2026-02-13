/**
 * Documents controller for handling P&ID document operations.
 *
 * Handles:
 * - GET /projects/:id/documents - List P&ID documents for a project
 * - POST /projects/:id/documents - Upload a P&ID document
 * - GET /documents/:id - Get a single document by ID
 * - DELETE /documents/:id - Delete a document
 * - GET /documents/:id/download - Get a signed download URL for a document
 */

import type { Request, Response } from 'express';
import {
  userHasProjectAccess,
  getUserProjectRole,
  findProjectById as findProjectByIdService,
} from '../services/project.service.js';
import { createPIDDocument, listProjectDocuments, findPIDDocumentById, deletePIDDocument, updatePIDDocumentStatus, createAnalysisNode, nodeIdExistsForDocument, listDocumentNodes, findAnalysisNodeById, updateAnalysisNode, nodeIdExistsForDocumentExcluding, deleteAnalysisNode } from '../services/pid-document.service.js';
import { uploadFile, generateStoragePath, deleteFile, getSignedDownloadUrl } from '../services/storage.service.js';
import { getUploadedFileBuffer, getUploadMeta } from '../middleware/upload.middleware.js';
import { PID_DOCUMENT_STATUSES, EQUIPMENT_TYPES } from '@hazop/types';
import type { PIDDocumentStatus, EquipmentType } from '@hazop/types';
import { createLogger } from '../utils/logger.js';

const log = createLogger({ service: 'documents-controller' });

/**
 * Validation error for a specific field.
 */
interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Query parameters for listing documents.
 */
interface ListDocumentsQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
  status?: string;
}

/**
 * Valid sort fields for documents.
 */
const validDocumentSortFields = ['created_at', 'uploaded_at', 'filename', 'status', 'file_size'];

/**
 * Validate list documents query parameters.
 * Returns an array of field errors if validation fails.
 */
function validateListDocumentsQuery(query: ListDocumentsQuery): FieldError[] {
  const errors: FieldError[] = [];

  // Validate page
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) {
      errors.push({
        field: 'page',
        message: 'Page must be a positive integer',
        code: 'INVALID_VALUE',
      });
    }
  }

  // Validate limit
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({
        field: 'limit',
        message: 'Limit must be between 1 and 100',
        code: 'INVALID_VALUE',
      });
    }
  }

  // Validate sortBy
  if (query.sortBy !== undefined && !validDocumentSortFields.includes(query.sortBy)) {
    errors.push({
      field: 'sortBy',
      message: `sortBy must be one of: ${validDocumentSortFields.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // Validate sortOrder
  if (query.sortOrder !== undefined && !['asc', 'desc'].includes(query.sortOrder)) {
    errors.push({
      field: 'sortOrder',
      message: 'sortOrder must be "asc" or "desc"',
      code: 'INVALID_VALUE',
    });
  }

  // Validate status filter
  if (query.status !== undefined && !PID_DOCUMENT_STATUSES.includes(query.status as PIDDocumentStatus)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${PID_DOCUMENT_STATUSES.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  return errors;
}

/**
 * GET /projects/:id/documents
 * List P&ID documents for a project with pagination and filtering.
 * All project members can view documents.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Query parameters:
 * - page: number (1-based, default 1)
 * - limit: number (default 20, max 100)
 * - sortBy: 'created_at' | 'uploaded_at' | 'filename' | 'status' | 'file_size' (default 'uploaded_at')
 * - sortOrder: 'asc' | 'desc' (default 'desc')
 * - search: string (searches filename)
 * - status: PIDDocumentStatus (filter by status)
 *
 * Returns:
 * - 200: Paginated list of documents
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized to access this project
 * - 404: Project not found
 * - 500: Internal server error
 */
export async function listDocuments(req: Request, res: Response): Promise<void> {
  try {
    const { id: projectId } = req.params;
    const query = req.query as ListDocumentsQuery;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project ID format',
          errors: [
            {
              field: 'id',
              message: 'Project ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate query parameters
    const validationErrors = validateListDocumentsQuery(query);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          errors: validationErrors,
        },
      });
      return;
    }

    // Check if user has access to the project
    const hasAccess = await userHasProjectAccess(userId, projectId);
    if (!hasAccess) {
      // Check if project exists to return appropriate error
      const project = await findProjectByIdService(projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
        return;
      }

      // Project exists but user doesn't have access
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        },
      });
      return;
    }

    // Parse query parameters
    const page = query.page ? parseInt(query.page, 10) : undefined;
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const sortBy = query.sortBy as 'created_at' | 'uploaded_at' | 'filename' | 'status' | 'file_size' | undefined;
    const sortOrder = query.sortOrder as 'asc' | 'desc' | undefined;
    const search = query.search;
    const status = query.status as PIDDocumentStatus | undefined;

    // Fetch documents
    const result = await listProjectDocuments(
      projectId,
      { status, search },
      { page, limit, sortBy, sortOrder }
    );

    // Calculate pagination metadata
    const currentPage = page ?? 1;
    const currentLimit = limit ?? 20;
    const totalPages = Math.ceil(result.total / currentLimit);

    res.status(200).json({
      success: true,
      data: result.documents,
      meta: {
        page: currentPage,
        limit: currentLimit,
        total: result.total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    });
  } catch (error) {
    log.error('List documents error:', { error: error instanceof Error ? error.message : String(error) });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * POST /projects/:id/documents
 * Upload a P&ID document to a project.
 * Only project members with appropriate roles can upload documents.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Body (multipart/form-data):
 * - file: The P&ID document file (PDF, PNG, JPG, or DWG)
 *
 * Returns:
 * - 201: Created document with uploader info
 * - 400: Validation error (no file, invalid format)
 * - 401: Not authenticated
 * - 403: Not authorized to upload to this project
 * - 404: Project not found
 * - 500: Internal server error
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id: projectId } = req.params;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project ID format',
          errors: [
            {
              field: 'id',
              message: 'Project ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Check if user has access to the project
    const hasAccess = await userHasProjectAccess(userId, projectId);
    if (!hasAccess) {
      // Check if project exists to return appropriate error
      const project = await findProjectByIdService(projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
        return;
      }

      // Project exists but user doesn't have access
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        },
      });
      return;
    }

    // Get user's role - only owner, lead, and member can upload documents
    // Viewers cannot upload
    const userRole = await getUserProjectRole(userId, projectId);
    if (!userRole || userRole === 'viewer') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to upload documents to this project',
        },
      });
      return;
    }

    // Get uploaded file buffer and metadata
    const fileBuffer = getUploadedFileBuffer(req);
    const uploadMeta = getUploadMeta(req);

    if (!fileBuffer || !uploadMeta) {
      res.status(400).json({
        success: false,
        error: {
          code: 'FILE_REQUIRED',
          message: 'A file is required for this request',
        },
      });
      return;
    }

    // Generate storage path and upload to MinIO
    const storagePath = generateStoragePath(projectId, uploadMeta.originalFilename);

    await uploadFile(fileBuffer, storagePath, uploadMeta.mimeType);

    // Create database record
    const document = await createPIDDocument({
      projectId,
      filename: uploadMeta.originalFilename,
      storagePath,
      mimeType: uploadMeta.mimeType,
      fileSize: uploadMeta.fileSize,
      uploadedById: userId,
    });

    // Auto-process image files (PNG, JPG)
    // PDFs would require background processing with pdf.js or similar
    const isImage = uploadMeta.mimeType.startsWith('image/');
    if (isImage) {
      await updatePIDDocumentStatus(document.id, {
        status: 'processed',
        processedAt: new Date(),
      });
      // Refresh document to get updated status
      const processedDoc = await findPIDDocumentById(document.id);
      res.status(201).json({
        success: true,
        data: { document: processedDoc || document },
      });
    } else {
      res.status(201).json({
        success: true,
        data: { document },
      });
    }
  } catch (error) {
    log.error('Upload document error:', { error: error instanceof Error ? error.message : String(error) });

    // Handle storage path conflict (shouldn't happen with UUID-based paths, but just in case)
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code: string };
      if (dbError.code === '23505') {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A document with this storage path already exists',
          },
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while uploading the document',
      },
    });
  }
}

/**
 * GET /documents/:id
 * Get a P&ID document by ID.
 * User must have access to the project that owns the document.
 *
 * Path parameters:
 * - id: string (required) - Document UUID
 *
 * Returns:
 * - 200: Document with uploader info
 * - 400: Invalid document ID format
 * - 401: Not authenticated
 * - 403: Not authorized to access this document
 * - 404: Document not found
 * - 500: Internal server error
 */
export async function getDocumentById(req: Request, res: Response): Promise<void> {
  try {
    const { id: documentId } = req.params;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid document ID format',
          errors: [
            {
              field: 'id',
              message: 'Document ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Find the document
    const document = await findPIDDocumentById(documentId);
    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this document
    const hasAccess = await userHasProjectAccess(userId, document.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this document',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { document },
    });
  } catch (error) {
    log.error('Get document by ID error:', { error: error instanceof Error ? error.message : String(error) });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * DELETE /documents/:id
 * Delete a P&ID document by ID.
 * User must have appropriate role on the project that owns the document.
 * Viewers cannot delete documents.
 *
 * Path parameters:
 * - id: string (required) - Document UUID
 *
 * Returns:
 * - 200: Document deleted successfully
 * - 400: Invalid document ID format
 * - 401: Not authenticated
 * - 403: Not authorized to delete this document
 * - 404: Document not found
 * - 500: Internal server error
 */
export async function deleteDocumentById(req: Request, res: Response): Promise<void> {
  try {
    const { id: documentId } = req.params;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid document ID format',
          errors: [
            {
              field: 'id',
              message: 'Document ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Find the document
    const document = await findPIDDocumentById(documentId);
    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this document
    const hasAccess = await userHasProjectAccess(userId, document.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this document',
        },
      });
      return;
    }

    // Get user's role - only owner, lead, and member can delete documents
    // Viewers cannot delete
    const userRole = await getUserProjectRole(userId, document.projectId);
    if (!userRole || userRole === 'viewer') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete documents in this project',
        },
      });
      return;
    }

    // Delete the document from database
    const deletedDocument = await deletePIDDocument(documentId);
    if (!deletedDocument) {
      // Document was deleted between findById and delete (race condition)
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Delete the file from storage
    // Note: deleteFile does not throw if file doesn't exist
    try {
      await deleteFile(deletedDocument.storagePath);
    } catch (storageError) {
      // Log but don't fail the request - DB record is already deleted
      log.warn('Failed to delete file from storage', { storagePath: deletedDocument.storagePath, error: storageError instanceof Error ? storageError.message : String(storageError) });
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Document deleted successfully',
        documentId: deletedDocument.id,
      },
    });
  } catch (error) {
    log.error('Delete document by ID error:', { error: error instanceof Error ? error.message : String(error) });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * GET /documents/:id/download
 * Get a signed download URL for a P&ID document.
 * User must have access to the project that owns the document.
 *
 * Path parameters:
 * - id: string (required) - Document UUID
 *
 * Query parameters:
 * - expiresIn: number (optional) - URL expiration time in seconds (default: 3600, max: 604800)
 *
 * Returns:
 * - 200: Signed download URL
 * - 400: Invalid document ID format or invalid expiresIn
 * - 401: Not authenticated
 * - 403: Not authorized to access this document
 * - 404: Document not found
 * - 500: Internal server error
 */
export async function downloadDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id: documentId } = req.params;
    const expiresInParam = req.query.expiresIn as string | undefined;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid document ID format',
          errors: [
            {
              field: 'id',
              message: 'Document ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate expiresIn if provided
    let expiresIn: number | undefined;
    if (expiresInParam !== undefined) {
      expiresIn = parseInt(expiresInParam, 10);
      if (isNaN(expiresIn) || expiresIn < 1 || expiresIn > 604800) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid expiresIn parameter',
            errors: [
              {
                field: 'expiresIn',
                message: 'expiresIn must be a number between 1 and 604800 seconds',
                code: 'INVALID_VALUE',
              },
            ],
          },
        });
        return;
      }
    }

    // Find the document
    const document = await findPIDDocumentById(documentId);
    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this document
    const hasAccess = await userHasProjectAccess(userId, document.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this document',
        },
      });
      return;
    }

    // Generate signed download URL
    const downloadUrl = await getSignedDownloadUrl(
      document.storagePath,
      document.filename,
      expiresIn
    );

    res.status(200).json({
      success: true,
      data: {
        downloadUrl,
        filename: document.filename,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        expiresIn: expiresIn ?? 3600,
      },
    });
  } catch (error) {
    log.error('Download document error:', { error: error instanceof Error ? error.message : String(error) });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * Request body for creating an analysis node.
 */
interface CreateNodeBody {
  nodeId?: string;
  description?: string;
  equipmentType?: string;
  x?: number;
  y?: number;
}

/**
 * POST /documents/:id/nodes
 * Create a new analysis node on a P&ID document.
 * User must have appropriate role on the project that owns the document.
 * Viewers cannot create nodes.
 *
 * Path parameters:
 * - id: string (required) - Document UUID
 *
 * Body:
 * - nodeId: string (required) - User-defined node identifier (e.g., "P-101")
 * - description: string (required) - Description of the node/equipment
 * - equipmentType: EquipmentType (required) - Type of equipment
 * - x: number (required) - X coordinate as percentage (0-100)
 * - y: number (required) - Y coordinate as percentage (0-100)
 *
 * Returns:
 * - 201: Created node with creator info
 * - 400: Validation error (missing fields, invalid format, duplicate nodeId)
 * - 401: Not authenticated
 * - 403: Not authorized to add nodes to this document
 * - 404: Document not found
 * - 409: Node ID already exists in this document
 * - 500: Internal server error
 */
export async function createNode(req: Request, res: Response): Promise<void> {
  try {
    const { id: documentId } = req.params;
    const body = req.body as CreateNodeBody;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid document ID format',
          errors: [
            {
              field: 'id',
              message: 'Document ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate request body
    const errors: FieldError[] = [];

    // Validate nodeId
    if (!body.nodeId || typeof body.nodeId !== 'string' || body.nodeId.trim().length === 0) {
      errors.push({
        field: 'nodeId',
        message: 'Node ID is required',
        code: 'REQUIRED',
      });
    } else if (body.nodeId.length > 50) {
      errors.push({
        field: 'nodeId',
        message: 'Node ID must be 50 characters or less',
        code: 'MAX_LENGTH',
      });
    }

    // Validate description
    if (!body.description || typeof body.description !== 'string' || body.description.trim().length === 0) {
      errors.push({
        field: 'description',
        message: 'Description is required',
        code: 'REQUIRED',
      });
    } else if (body.description.length > 500) {
      errors.push({
        field: 'description',
        message: 'Description must be 500 characters or less',
        code: 'MAX_LENGTH',
      });
    }

    // Validate equipmentType
    if (!body.equipmentType || typeof body.equipmentType !== 'string') {
      errors.push({
        field: 'equipmentType',
        message: 'Equipment type is required',
        code: 'REQUIRED',
      });
    } else if (!EQUIPMENT_TYPES.includes(body.equipmentType as EquipmentType)) {
      errors.push({
        field: 'equipmentType',
        message: `Equipment type must be one of: ${EQUIPMENT_TYPES.join(', ')}`,
        code: 'INVALID_VALUE',
      });
    }

    // Validate x coordinate
    if (body.x === undefined || body.x === null) {
      errors.push({
        field: 'x',
        message: 'X coordinate is required',
        code: 'REQUIRED',
      });
    } else if (typeof body.x !== 'number' || isNaN(body.x)) {
      errors.push({
        field: 'x',
        message: 'X coordinate must be a number',
        code: 'INVALID_TYPE',
      });
    } else if (body.x < 0 || body.x > 100) {
      errors.push({
        field: 'x',
        message: 'X coordinate must be between 0 and 100',
        code: 'OUT_OF_RANGE',
      });
    }

    // Validate y coordinate
    if (body.y === undefined || body.y === null) {
      errors.push({
        field: 'y',
        message: 'Y coordinate is required',
        code: 'REQUIRED',
      });
    } else if (typeof body.y !== 'number' || isNaN(body.y)) {
      errors.push({
        field: 'y',
        message: 'Y coordinate must be a number',
        code: 'INVALID_TYPE',
      });
    } else if (body.y < 0 || body.y > 100) {
      errors.push({
        field: 'y',
        message: 'Y coordinate must be between 0 and 100',
        code: 'OUT_OF_RANGE',
      });
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          errors,
        },
      });
      return;
    }

    // Find the document
    const document = await findPIDDocumentById(documentId);
    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this document
    const hasAccess = await userHasProjectAccess(userId, document.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this document',
        },
      });
      return;
    }

    // Get user's role - only owner, lead, and member can create nodes
    // Viewers cannot create nodes
    const userRole = await getUserProjectRole(userId, document.projectId);
    if (!userRole || userRole === 'viewer') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to add nodes to this document',
        },
      });
      return;
    }

    // Check if nodeId already exists for this document
    const nodeIdExists = await nodeIdExistsForDocument(documentId, body.nodeId!.trim());
    if (nodeIdExists) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `Node ID "${body.nodeId}" already exists in this document`,
          errors: [
            {
              field: 'nodeId',
              message: 'This node ID is already in use for this document',
              code: 'DUPLICATE',
            },
          ],
        },
      });
      return;
    }

    // Create the node
    const node = await createAnalysisNode({
      documentId,
      nodeId: body.nodeId!.trim(),
      description: body.description!.trim(),
      equipmentType: body.equipmentType as EquipmentType,
      x: body.x!,
      y: body.y!,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      data: { node },
    });
  } catch (error) {
    log.error('Create node error:', { error: error instanceof Error ? error.message : String(error) });

    // Handle duplicate constraint violation (belt and suspenders)
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code: string };
      if (dbError.code === '23505') {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A node with this ID already exists in this document',
          },
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * Query parameters for listing nodes.
 */
interface ListNodesQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
  equipmentType?: string;
}

/**
 * Valid sort fields for nodes.
 */
const validNodeSortFields = ['created_at', 'node_id', 'equipment_type'];

/**
 * Validate list nodes query parameters.
 * Returns an array of field errors if validation fails.
 */
function validateListNodesQuery(query: ListNodesQuery): FieldError[] {
  const errors: FieldError[] = [];

  // Validate page
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) {
      errors.push({
        field: 'page',
        message: 'Page must be a positive integer',
        code: 'INVALID_VALUE',
      });
    }
  }

  // Validate limit
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({
        field: 'limit',
        message: 'Limit must be between 1 and 100',
        code: 'INVALID_VALUE',
      });
    }
  }

  // Validate sortBy
  if (query.sortBy !== undefined && !validNodeSortFields.includes(query.sortBy)) {
    errors.push({
      field: 'sortBy',
      message: `sortBy must be one of: ${validNodeSortFields.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // Validate sortOrder
  if (query.sortOrder !== undefined && !['asc', 'desc'].includes(query.sortOrder)) {
    errors.push({
      field: 'sortOrder',
      message: 'sortOrder must be "asc" or "desc"',
      code: 'INVALID_VALUE',
    });
  }

  // Validate equipment type filter
  if (query.equipmentType !== undefined && !EQUIPMENT_TYPES.includes(query.equipmentType as EquipmentType)) {
    errors.push({
      field: 'equipmentType',
      message: `equipmentType must be one of: ${EQUIPMENT_TYPES.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  return errors;
}

/**
 * GET /documents/:id/nodes
 * List all analysis nodes for a P&ID document with pagination and filtering.
 * All project members can view nodes.
 *
 * Path parameters:
 * - id: string (required) - Document UUID
 *
 * Query parameters:
 * - page: number (1-based, default 1)
 * - limit: number (default 50, max 100)
 * - sortBy: 'created_at' | 'node_id' | 'equipment_type' (default 'node_id')
 * - sortOrder: 'asc' | 'desc' (default 'asc')
 * - search: string (searches node_id and description)
 * - equipmentType: EquipmentType (filter by equipment type)
 *
 * Returns:
 * - 200: Paginated list of nodes with creator info
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized to access this document
 * - 404: Document not found
 * - 500: Internal server error
 */
export async function listNodes(req: Request, res: Response): Promise<void> {
  try {
    const { id: documentId } = req.params;
    const query = req.query as ListNodesQuery;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid document ID format',
          errors: [
            {
              field: 'id',
              message: 'Document ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate query parameters
    const validationErrors = validateListNodesQuery(query);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          errors: validationErrors,
        },
      });
      return;
    }

    // Find the document
    const document = await findPIDDocumentById(documentId);
    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this document
    const hasAccess = await userHasProjectAccess(userId, document.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this document',
        },
      });
      return;
    }

    // Parse query parameters
    const page = query.page ? parseInt(query.page, 10) : undefined;
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const sortBy = query.sortBy as 'created_at' | 'node_id' | 'equipment_type' | undefined;
    const sortOrder = query.sortOrder as 'asc' | 'desc' | undefined;
    const search = query.search;
    const equipmentType = query.equipmentType as EquipmentType | undefined;

    // Fetch nodes
    const result = await listDocumentNodes(
      documentId,
      { equipmentType, search },
      { page, limit, sortBy, sortOrder }
    );

    // Calculate pagination metadata
    const currentPage = page ?? 1;
    const currentLimit = limit ?? 50;
    const totalPages = Math.ceil(result.total / currentLimit);

    res.status(200).json({
      success: true,
      data: result.nodes,
      meta: {
        page: currentPage,
        limit: currentLimit,
        total: result.total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    });
  } catch (error) {
    log.error('List nodes error:', { error: error instanceof Error ? error.message : String(error) });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * Request body for updating an analysis node.
 */
interface UpdateNodeBody {
  nodeId?: string;
  description?: string;
  equipmentType?: string;
  x?: number;
  y?: number;
}

/**
 * PUT /nodes/:id
 * Update an existing analysis node.
 * User must have appropriate role on the project that owns the document.
 * Viewers cannot update nodes.
 *
 * Path parameters:
 * - id: string (required) - Node UUID
 *
 * Body (all fields optional):
 * - nodeId: string - User-defined node identifier (e.g., "P-101")
 * - description: string - Description of the node/equipment
 * - equipmentType: EquipmentType - Type of equipment
 * - x: number - X coordinate as percentage (0-100)
 * - y: number - Y coordinate as percentage (0-100)
 *
 * Returns:
 * - 200: Updated node with creator info
 * - 400: Validation error (invalid format, empty body)
 * - 401: Not authenticated
 * - 403: Not authorized to update this node
 * - 404: Node not found
 * - 409: Node ID already exists in this document
 * - 500: Internal server error
 */
export async function updateNode(req: Request, res: Response): Promise<void> {
  try {
    const { id: nodeUuid } = req.params;
    const body = req.body as UpdateNodeBody;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(nodeUuid)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid node ID format',
          errors: [
            {
              field: 'id',
              message: 'Node ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Check if body has at least one field to update
    const hasUpdates = body.nodeId !== undefined ||
      body.description !== undefined ||
      body.equipmentType !== undefined ||
      body.x !== undefined ||
      body.y !== undefined;

    if (!hasUpdates) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one field must be provided for update',
          errors: [
            {
              field: 'body',
              message: 'Request body must contain at least one field to update',
              code: 'EMPTY_BODY',
            },
          ],
        },
      });
      return;
    }

    // Validate request body fields
    const errors: FieldError[] = [];

    // Validate nodeId if provided
    if (body.nodeId !== undefined) {
      if (typeof body.nodeId !== 'string' || body.nodeId.trim().length === 0) {
        errors.push({
          field: 'nodeId',
          message: 'Node ID must be a non-empty string',
          code: 'INVALID_VALUE',
        });
      } else if (body.nodeId.length > 50) {
        errors.push({
          field: 'nodeId',
          message: 'Node ID must be 50 characters or less',
          code: 'MAX_LENGTH',
        });
      }
    }

    // Validate description if provided
    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || body.description.trim().length === 0) {
        errors.push({
          field: 'description',
          message: 'Description must be a non-empty string',
          code: 'INVALID_VALUE',
        });
      } else if (body.description.length > 500) {
        errors.push({
          field: 'description',
          message: 'Description must be 500 characters or less',
          code: 'MAX_LENGTH',
        });
      }
    }

    // Validate equipmentType if provided
    if (body.equipmentType !== undefined) {
      if (typeof body.equipmentType !== 'string') {
        errors.push({
          field: 'equipmentType',
          message: 'Equipment type must be a string',
          code: 'INVALID_TYPE',
        });
      } else if (!EQUIPMENT_TYPES.includes(body.equipmentType as EquipmentType)) {
        errors.push({
          field: 'equipmentType',
          message: `Equipment type must be one of: ${EQUIPMENT_TYPES.join(', ')}`,
          code: 'INVALID_VALUE',
        });
      }
    }

    // Validate x coordinate if provided
    if (body.x !== undefined) {
      if (typeof body.x !== 'number' || isNaN(body.x)) {
        errors.push({
          field: 'x',
          message: 'X coordinate must be a number',
          code: 'INVALID_TYPE',
        });
      } else if (body.x < 0 || body.x > 100) {
        errors.push({
          field: 'x',
          message: 'X coordinate must be between 0 and 100',
          code: 'OUT_OF_RANGE',
        });
      }
    }

    // Validate y coordinate if provided
    if (body.y !== undefined) {
      if (typeof body.y !== 'number' || isNaN(body.y)) {
        errors.push({
          field: 'y',
          message: 'Y coordinate must be a number',
          code: 'INVALID_TYPE',
        });
      } else if (body.y < 0 || body.y > 100) {
        errors.push({
          field: 'y',
          message: 'Y coordinate must be between 0 and 100',
          code: 'OUT_OF_RANGE',
        });
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          errors,
        },
      });
      return;
    }

    // Find the node
    const existingNode = await findAnalysisNodeById(nodeUuid);
    if (!existingNode) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Node not found',
        },
      });
      return;
    }

    // Find the document to get the project ID
    const document = await findPIDDocumentById(existingNode.documentId);
    if (!document) {
      // Document was deleted - node should have been cascade deleted too
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Node not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this document
    const hasAccess = await userHasProjectAccess(userId, document.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this node',
        },
      });
      return;
    }

    // Get user's role - only owner, lead, and member can update nodes
    // Viewers cannot update nodes
    const userRole = await getUserProjectRole(userId, document.projectId);
    if (!userRole || userRole === 'viewer') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to update nodes in this project',
        },
      });
      return;
    }

    // If nodeId is being updated, check for duplicates
    if (body.nodeId !== undefined && body.nodeId.trim() !== existingNode.nodeId) {
      const nodeIdExists = await nodeIdExistsForDocumentExcluding(
        existingNode.documentId,
        body.nodeId.trim(),
        nodeUuid
      );
      if (nodeIdExists) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Node ID "${body.nodeId}" already exists in this document`,
            errors: [
              {
                field: 'nodeId',
                message: 'This node ID is already in use for this document',
                code: 'DUPLICATE',
              },
            ],
          },
        });
        return;
      }
    }

    // Update the node
    const updatedNode = await updateAnalysisNode(nodeUuid, {
      nodeId: body.nodeId?.trim(),
      description: body.description?.trim(),
      equipmentType: body.equipmentType as EquipmentType | undefined,
      x: body.x,
      y: body.y,
    });

    if (!updatedNode) {
      // Node was deleted between findById and update (race condition)
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Node not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { node: updatedNode },
    });
  } catch (error) {
    log.error('Update node error:', { error: error instanceof Error ? error.message : String(error) });

    // Handle duplicate constraint violation (belt and suspenders)
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code: string };
      if (dbError.code === '23505') {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A node with this ID already exists in this document',
          },
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

/**
 * DELETE /nodes/:id
 * Delete an analysis node.
 * User must have appropriate role on the project that owns the document.
 * Viewers cannot delete nodes.
 *
 * Path parameters:
 * - id: string (required) - Node UUID
 *
 * Returns:
 * - 200: Node deleted successfully
 * - 400: Invalid node ID format
 * - 401: Not authenticated
 * - 403: Not authorized to delete this node
 * - 404: Node not found
 * - 500: Internal server error
 */
export async function deleteNode(req: Request, res: Response): Promise<void> {
  try {
    const { id: nodeUuid } = req.params;

    // Get authenticated user ID
    const userId = (req.user as { id: string } | undefined)?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(nodeUuid)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid node ID format',
          errors: [
            {
              field: 'id',
              message: 'Node ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Find the node
    const existingNode = await findAnalysisNodeById(nodeUuid);
    if (!existingNode) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Node not found',
        },
      });
      return;
    }

    // Find the document to get the project ID
    const document = await findPIDDocumentById(existingNode.documentId);
    if (!document) {
      // Document was deleted - node should have been cascade deleted too
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Node not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this document
    const hasAccess = await userHasProjectAccess(userId, document.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this node',
        },
      });
      return;
    }

    // Get user's role - only owner, lead, and member can delete nodes
    // Viewers cannot delete nodes
    const userRole = await getUserProjectRole(userId, document.projectId);
    if (!userRole || userRole === 'viewer') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete nodes in this project',
        },
      });
      return;
    }

    // Delete the node
    const deletedNode = await deleteAnalysisNode(nodeUuid);
    if (!deletedNode) {
      // Node was deleted between findById and delete (race condition)
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Node not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Node deleted successfully',
        nodeId: deletedNode.id,
      },
    });
  } catch (error) {
    log.error('Delete node error:', { error: error instanceof Error ? error.message : String(error) });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}
