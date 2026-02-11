/**
 * Analyses controller for handling HazOps analysis operations.
 *
 * Handles:
 * - POST /projects/:id/analyses - Create a new analysis session
 * - GET /projects/:id/analyses - List analysis sessions
 * - GET /analyses/:id - Get analysis session details
 * - PUT /analyses/:id - Update analysis session metadata
 * - POST /analyses/:id/complete - Finalize/complete an analysis
 * - POST /analyses/:id/entries - Create analysis entry for node/guideword
 * - GET /analyses/:id/entries - List analysis entries
 * - PUT /entries/:id - Update analysis entry
 * - DELETE /entries/:id - Delete analysis entry
 */

import type { Request, Response } from 'express';
import {
  createAnalysis as createAnalysisService,
  documentBelongsToProject,
  listProjectAnalyses,
  findAnalysisByIdWithProgress,
  updateAnalysis as updateAnalysisService,
  findAnalysisById,
  approveAnalysis as approveAnalysisService,
  createAnalysisEntry as createAnalysisEntryService,
  nodeExistsInDocument,
  listAnalysisEntries,
  findAnalysisEntryById,
  updateAnalysisEntry as updateAnalysisEntryService,
  deleteAnalysisEntry as deleteAnalysisEntryService,
  updateEntryRisk as updateEntryRiskService,
  clearEntryRisk as clearEntryRiskService,
} from '../services/hazop-analysis.service.js';
import { getAnalysisRiskAggregation } from '../services/risk-aggregation.service.js';
import {
  calculateRiskRanking,
  validateRiskFactors,
} from '../services/risk-calculation.service.js';
import {
  userHasProjectAccess,
  findProjectById,
  getUserProjectRole,
} from '../services/project.service.js';
import { ANALYSIS_STATUSES, GUIDE_WORDS, RISK_LEVEL_FILTER_OPTIONS } from '@hazop/types';
import type { AnalysisStatus, GuideWord, RiskLevelFilter } from '@hazop/types';

/**
 * Validation error for a specific field.
 */
interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Request body for creating an analysis.
 */
interface CreateAnalysisBody {
  documentId?: unknown;
  name?: unknown;
  description?: unknown;
  leadAnalystId?: unknown;
}

/**
 * Request body for updating an analysis.
 */
interface UpdateAnalysisBody {
  name?: unknown;
  description?: unknown;
  leadAnalystId?: unknown;
}

/**
 * Request body for creating an analysis entry.
 */
interface CreateAnalysisEntryBody {
  nodeId?: unknown;
  guideWord?: unknown;
  parameter?: unknown;
  deviation?: unknown;
  causes?: unknown;
  consequences?: unknown;
  safeguards?: unknown;
  recommendations?: unknown;
  notes?: unknown;
}

/**
 * Request body for updating an analysis entry.
 * Note: nodeId, guideWord, and parameter cannot be updated as they form the unique constraint.
 */
interface UpdateAnalysisEntryBody {
  deviation?: unknown;
  causes?: unknown;
  consequences?: unknown;
  safeguards?: unknown;
  recommendations?: unknown;
  notes?: unknown;
}

/**
 * Request body for updating the risk ranking of an analysis entry.
 * All three factors are required. Setting clear=true will remove the risk assessment.
 */
interface UpdateEntryRiskBody {
  severity?: unknown;
  likelihood?: unknown;
  detectability?: unknown;
  clear?: unknown;
}

/**
 * UUID validation regex.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate create analysis request body.
 * Returns an array of field errors if validation fails.
 */
function validateCreateAnalysisRequest(body: CreateAnalysisBody): FieldError[] {
  const errors: FieldError[] = [];

  // Validate documentId (required, must be a valid UUID)
  if (body.documentId === undefined || body.documentId === null) {
    errors.push({
      field: 'documentId',
      message: 'Document ID is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.documentId !== 'string') {
    errors.push({
      field: 'documentId',
      message: 'Document ID must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (!UUID_REGEX.test(body.documentId)) {
    errors.push({
      field: 'documentId',
      message: 'Document ID must be a valid UUID',
      code: 'INVALID_FORMAT',
    });
  }

  // Validate name (required, non-empty string, max 255 chars)
  if (body.name === undefined || body.name === null) {
    errors.push({
      field: 'name',
      message: 'Name is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Name must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (body.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Name cannot be empty',
      code: 'EMPTY',
    });
  } else if (body.name.length > 255) {
    errors.push({
      field: 'name',
      message: 'Name must be 255 characters or less',
      code: 'MAX_LENGTH',
    });
  }

  // Validate description (optional, but if provided must be string)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Description must be a string',
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate leadAnalystId (optional, but if provided must be valid UUID)
  if (body.leadAnalystId !== undefined && body.leadAnalystId !== null) {
    if (typeof body.leadAnalystId !== 'string') {
      errors.push({
        field: 'leadAnalystId',
        message: 'Lead analyst ID must be a string',
        code: 'INVALID_TYPE',
      });
    } else if (!UUID_REGEX.test(body.leadAnalystId)) {
      errors.push({
        field: 'leadAnalystId',
        message: 'Lead analyst ID must be a valid UUID',
        code: 'INVALID_FORMAT',
      });
    }
  }

  return errors;
}

/**
 * Validate update analysis request body.
 * Returns an array of field errors if validation fails.
 * All fields are optional - only validates fields that are provided.
 */
function validateUpdateAnalysisRequest(body: UpdateAnalysisBody): FieldError[] {
  const errors: FieldError[] = [];

  // Validate name (optional, but if provided: non-empty string, max 255 chars)
  if (body.name !== undefined) {
    if (body.name === null) {
      errors.push({
        field: 'name',
        message: 'Name cannot be null',
        code: 'INVALID_VALUE',
      });
    } else if (typeof body.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Name must be a string',
        code: 'INVALID_TYPE',
      });
    } else if (body.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Name cannot be empty',
        code: 'EMPTY',
      });
    } else if (body.name.length > 255) {
      errors.push({
        field: 'name',
        message: 'Name must be 255 characters or less',
        code: 'MAX_LENGTH',
      });
    }
  }

  // Validate description (optional, can be null to clear, but if provided must be string)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Description must be a string',
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate leadAnalystId (optional, but if provided must be valid UUID)
  if (body.leadAnalystId !== undefined && body.leadAnalystId !== null) {
    if (typeof body.leadAnalystId !== 'string') {
      errors.push({
        field: 'leadAnalystId',
        message: 'Lead analyst ID must be a string',
        code: 'INVALID_TYPE',
      });
    } else if (!UUID_REGEX.test(body.leadAnalystId)) {
      errors.push({
        field: 'leadAnalystId',
        message: 'Lead analyst ID must be a valid UUID',
        code: 'INVALID_FORMAT',
      });
    }
  }

  return errors;
}

/**
 * Validate a string array field.
 * Returns null if valid, or an error message if invalid.
 */
function validateStringArray(value: unknown, fieldName: string): string | null {
  if (!Array.isArray(value)) {
    return `${fieldName} must be an array`;
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      return `${fieldName}[${i}] must be a string`;
    }
  }
  return null;
}

/**
 * Validate create analysis entry request body.
 * Returns an array of field errors if validation fails.
 */
function validateCreateAnalysisEntryRequest(body: CreateAnalysisEntryBody): FieldError[] {
  const errors: FieldError[] = [];

  // Validate nodeId (required, must be a valid UUID)
  if (body.nodeId === undefined || body.nodeId === null) {
    errors.push({
      field: 'nodeId',
      message: 'Node ID is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.nodeId !== 'string') {
    errors.push({
      field: 'nodeId',
      message: 'Node ID must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (!UUID_REGEX.test(body.nodeId)) {
    errors.push({
      field: 'nodeId',
      message: 'Node ID must be a valid UUID',
      code: 'INVALID_FORMAT',
    });
  }

  // Validate guideWord (required, must be a valid guide word)
  if (body.guideWord === undefined || body.guideWord === null) {
    errors.push({
      field: 'guideWord',
      message: 'Guide word is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.guideWord !== 'string') {
    errors.push({
      field: 'guideWord',
      message: 'Guide word must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (!GUIDE_WORDS.includes(body.guideWord as GuideWord)) {
    errors.push({
      field: 'guideWord',
      message: `Guide word must be one of: ${GUIDE_WORDS.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // Validate parameter (required, non-empty string, max 100 chars)
  if (body.parameter === undefined || body.parameter === null) {
    errors.push({
      field: 'parameter',
      message: 'Parameter is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.parameter !== 'string') {
    errors.push({
      field: 'parameter',
      message: 'Parameter must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (body.parameter.trim().length === 0) {
    errors.push({
      field: 'parameter',
      message: 'Parameter cannot be empty',
      code: 'EMPTY',
    });
  } else if (body.parameter.length > 100) {
    errors.push({
      field: 'parameter',
      message: 'Parameter must be 100 characters or less',
      code: 'MAX_LENGTH',
    });
  }

  // Validate deviation (required, non-empty string)
  if (body.deviation === undefined || body.deviation === null) {
    errors.push({
      field: 'deviation',
      message: 'Deviation is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.deviation !== 'string') {
    errors.push({
      field: 'deviation',
      message: 'Deviation must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (body.deviation.trim().length === 0) {
    errors.push({
      field: 'deviation',
      message: 'Deviation cannot be empty',
      code: 'EMPTY',
    });
  }

  // Validate causes (optional, but if provided must be array of strings)
  if (body.causes !== undefined && body.causes !== null) {
    const causesError = validateStringArray(body.causes, 'causes');
    if (causesError) {
      errors.push({
        field: 'causes',
        message: causesError,
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate consequences (optional, but if provided must be array of strings)
  if (body.consequences !== undefined && body.consequences !== null) {
    const consequencesError = validateStringArray(body.consequences, 'consequences');
    if (consequencesError) {
      errors.push({
        field: 'consequences',
        message: consequencesError,
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate safeguards (optional, but if provided must be array of strings)
  if (body.safeguards !== undefined && body.safeguards !== null) {
    const safeguardsError = validateStringArray(body.safeguards, 'safeguards');
    if (safeguardsError) {
      errors.push({
        field: 'safeguards',
        message: safeguardsError,
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate recommendations (optional, but if provided must be array of strings)
  if (body.recommendations !== undefined && body.recommendations !== null) {
    const recommendationsError = validateStringArray(body.recommendations, 'recommendations');
    if (recommendationsError) {
      errors.push({
        field: 'recommendations',
        message: recommendationsError,
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate notes (optional, but if provided must be string)
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string') {
      errors.push({
        field: 'notes',
        message: 'Notes must be a string',
        code: 'INVALID_TYPE',
      });
    }
  }

  return errors;
}

/**
 * Validate update analysis entry request body.
 * Returns an array of field errors if validation fails.
 * All fields are optional - only validates fields that are provided.
 * Note: nodeId, guideWord, and parameter cannot be updated.
 */
function validateUpdateAnalysisEntryRequest(body: UpdateAnalysisEntryBody): FieldError[] {
  const errors: FieldError[] = [];

  // Validate deviation (optional, but if provided: non-empty string)
  if (body.deviation !== undefined) {
    if (body.deviation === null) {
      errors.push({
        field: 'deviation',
        message: 'Deviation cannot be null',
        code: 'INVALID_VALUE',
      });
    } else if (typeof body.deviation !== 'string') {
      errors.push({
        field: 'deviation',
        message: 'Deviation must be a string',
        code: 'INVALID_TYPE',
      });
    } else if (body.deviation.trim().length === 0) {
      errors.push({
        field: 'deviation',
        message: 'Deviation cannot be empty',
        code: 'EMPTY',
      });
    }
  }

  // Validate causes (optional, but if provided must be array of strings)
  if (body.causes !== undefined && body.causes !== null) {
    const causesError = validateStringArray(body.causes, 'causes');
    if (causesError) {
      errors.push({
        field: 'causes',
        message: causesError,
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate consequences (optional, but if provided must be array of strings)
  if (body.consequences !== undefined && body.consequences !== null) {
    const consequencesError = validateStringArray(body.consequences, 'consequences');
    if (consequencesError) {
      errors.push({
        field: 'consequences',
        message: consequencesError,
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate safeguards (optional, but if provided must be array of strings)
  if (body.safeguards !== undefined && body.safeguards !== null) {
    const safeguardsError = validateStringArray(body.safeguards, 'safeguards');
    if (safeguardsError) {
      errors.push({
        field: 'safeguards',
        message: safeguardsError,
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate recommendations (optional, but if provided must be array of strings)
  if (body.recommendations !== undefined && body.recommendations !== null) {
    const recommendationsError = validateStringArray(body.recommendations, 'recommendations');
    if (recommendationsError) {
      errors.push({
        field: 'recommendations',
        message: recommendationsError,
        code: 'INVALID_TYPE',
      });
    }
  }

  // Validate notes (optional, can be null to clear, but if provided must be string)
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string') {
      errors.push({
        field: 'notes',
        message: 'Notes must be a string',
        code: 'INVALID_TYPE',
      });
    }
  }

  return errors;
}

/**
 * POST /projects/:id/analyses
 * Create a new HazOps analysis session for a project.
 * The analysis is created in 'draft' status.
 * If leadAnalystId is not provided, defaults to the creator.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Request body:
 * - documentId: string (required) - P&ID Document UUID to analyze
 * - name: string (required) - Analysis session name
 * - description: string (optional) - Analysis description
 * - leadAnalystId: string (optional) - Lead analyst UUID (defaults to creator)
 *
 * Returns:
 * - 201: Created analysis with details
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized to access this project
 * - 404: Project or document not found
 * - 409: Document does not belong to project
 * - 500: Internal server error
 */
export async function createAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const { id: projectId } = req.params;
    const body = req.body as CreateAnalysisBody;

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

    // Validate project ID format
    if (!UUID_REGEX.test(projectId)) {
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

    // Validate request body
    const validationErrors = validateCreateAnalysisRequest(body);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: validationErrors,
        },
      });
      return;
    }

    // Check if user has access to the project
    const hasAccess = await userHasProjectAccess(userId, projectId);
    if (!hasAccess) {
      // Check if project exists to return appropriate error
      const project = await findProjectById(projectId);
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

    const documentId = body.documentId as string;

    // Check if document belongs to the project
    const docBelongsToProject = await documentBelongsToProject(documentId, projectId);
    if (!docBelongsToProject) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found in this project',
        },
      });
      return;
    }

    // Create the analysis
    const analysis = await createAnalysisService(userId, {
      projectId,
      documentId,
      name: (body.name as string).trim(),
      description: typeof body.description === 'string' ? body.description : undefined,
      leadAnalystId: typeof body.leadAnalystId === 'string' ? body.leadAnalystId : undefined,
    });

    res.status(201).json({
      success: true,
      data: { analysis },
    });
  } catch (error) {
    console.error('Create analysis error:', error);

    // Handle foreign key constraint violation (e.g., lead analyst doesn't exist)
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code: string };
      if (dbError.code === '23503') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid reference: lead analyst does not exist',
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

// ============================================================================
// List Analyses
// ============================================================================

/**
 * Query parameters for listing analyses.
 */
interface ListAnalysesQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
  status?: string;
  leadAnalystId?: string;
  documentId?: string;
}

/**
 * Valid sort fields for analyses.
 */
const validAnalysisSortFields = ['created_at', 'updated_at', 'name', 'status'];

/**
 * Validate list analyses query parameters.
 * Returns an array of field errors if validation fails.
 */
function validateListAnalysesQuery(query: ListAnalysesQuery): FieldError[] {
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
  if (query.sortBy !== undefined && !validAnalysisSortFields.includes(query.sortBy)) {
    errors.push({
      field: 'sortBy',
      message: `sortBy must be one of: ${validAnalysisSortFields.join(', ')}`,
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
  if (query.status !== undefined && !ANALYSIS_STATUSES.includes(query.status as AnalysisStatus)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${ANALYSIS_STATUSES.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // Validate leadAnalystId (if provided, must be valid UUID)
  if (query.leadAnalystId !== undefined && !UUID_REGEX.test(query.leadAnalystId)) {
    errors.push({
      field: 'leadAnalystId',
      message: 'leadAnalystId must be a valid UUID',
      code: 'INVALID_FORMAT',
    });
  }

  // Validate documentId (if provided, must be valid UUID)
  if (query.documentId !== undefined && !UUID_REGEX.test(query.documentId)) {
    errors.push({
      field: 'documentId',
      message: 'documentId must be a valid UUID',
      code: 'INVALID_FORMAT',
    });
  }

  return errors;
}

/**
 * GET /projects/:id/analyses
 * List HazOps analysis sessions for a project with pagination and filtering.
 * All project members can view analyses.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Query parameters:
 * - page: number (1-based, default 1)
 * - limit: number (default 20, max 100)
 * - sortBy: 'created_at' | 'updated_at' | 'name' | 'status' (default 'created_at')
 * - sortOrder: 'asc' | 'desc' (default 'desc')
 * - search: string (searches name and description)
 * - status: AnalysisStatus (filter by analysis status)
 * - leadAnalystId: string (filter by lead analyst UUID)
 * - documentId: string (filter by document UUID)
 *
 * Returns:
 * - 200: Paginated list of analyses with details
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized to access this project
 * - 404: Project not found
 * - 500: Internal server error
 */
export async function listAnalyses(req: Request, res: Response): Promise<void> {
  try {
    const { id: projectId } = req.params;
    const query = req.query as ListAnalysesQuery;

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

    // Validate project ID format
    if (!UUID_REGEX.test(projectId)) {
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
    const validationErrors = validateListAnalysesQuery(query);
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
      const project = await findProjectById(projectId);
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
    const sortBy = query.sortBy as 'created_at' | 'updated_at' | 'name' | 'status' | undefined;
    const sortOrder = query.sortOrder as 'asc' | 'desc' | undefined;
    const search = query.search;
    const status = query.status as AnalysisStatus | undefined;
    const leadAnalystId = query.leadAnalystId;
    const documentId = query.documentId;

    // Fetch analyses
    const result = await listProjectAnalyses(
      projectId,
      { status, leadAnalystId, documentId, search },
      { page, limit, sortBy, sortOrder }
    );

    // Calculate pagination metadata
    const currentPage = page ?? 1;
    const currentLimit = limit ?? 20;
    const totalPages = Math.ceil(result.total / currentLimit);

    res.status(200).json({
      success: true,
      data: result.analyses,
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
    console.error('List analyses error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

// ============================================================================
// Get Analysis By ID
// ============================================================================

/**
 * GET /analyses/:id
 * Get a HazOps analysis session by ID.
 * User must have access to the project that owns the analysis.
 * Returns the analysis with progress metrics (node counts, entry counts, risk distribution).
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Returns:
 * - 200: Analysis with progress metrics
 * - 400: Invalid analysis ID format
 * - 401: Not authenticated
 * - 403: Not authorized to access this analysis
 * - 404: Analysis not found
 * - 500: Internal server error
 */
export async function getAnalysisById(req: Request, res: Response): Promise<void> {
  try {
    const { id: analysisId } = req.params;

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
    if (!UUID_REGEX.test(analysisId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid analysis ID format',
          errors: [
            {
              field: 'id',
              message: 'Analysis ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Find the analysis with progress metrics
    const analysis = await findAnalysisByIdWithProgress(analysisId);
    if (!analysis) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this analysis
    const hasAccess = await userHasProjectAccess(userId, analysis.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this analysis',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { analysis },
    });
  } catch (error) {
    console.error('Get analysis by ID error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

// ============================================================================
// Update Analysis
// ============================================================================

/**
 * PUT /analyses/:id
 * Update a HazOps analysis session metadata.
 * User must have access to the project that owns the analysis.
 * Only draft analyses can have their metadata updated.
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Request body (all fields optional):
 * - name: string - Analysis session name (max 255 chars)
 * - description: string | null - Analysis description (null to clear)
 * - leadAnalystId: string - Lead analyst UUID
 *
 * Returns:
 * - 200: Updated analysis with details
 * - 400: Validation error or analysis not in draft status
 * - 401: Not authenticated
 * - 403: Not authorized to access this analysis
 * - 404: Analysis not found
 * - 500: Internal server error
 */
export async function updateAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const { id: analysisId } = req.params;
    const body = req.body as UpdateAnalysisBody;

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
    if (!UUID_REGEX.test(analysisId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid analysis ID format',
          errors: [
            {
              field: 'id',
              message: 'Analysis ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate request body
    const validationErrors = validateUpdateAnalysisRequest(body);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: validationErrors,
        },
      });
      return;
    }

    // Find the analysis to check status and project access
    const existingAnalysis = await findAnalysisById(analysisId);
    if (!existingAnalysis) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this analysis
    const hasAccess = await userHasProjectAccess(userId, existingAnalysis.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this analysis',
        },
      });
      return;
    }

    // Only allow updates to draft analyses
    if (existingAnalysis.status !== 'draft') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Only draft analyses can be updated. Current status: ' + existingAnalysis.status,
        },
      });
      return;
    }

    // Build update data from validated fields
    const updateData: {
      name?: string;
      description?: string | null;
      leadAnalystId?: string;
    } = {};

    if (body.name !== undefined && typeof body.name === 'string') {
      updateData.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updateData.description = typeof body.description === 'string' ? body.description : null;
    }

    if (body.leadAnalystId !== undefined && typeof body.leadAnalystId === 'string') {
      updateData.leadAnalystId = body.leadAnalystId;
    }

    // Update the analysis
    const updatedAnalysis = await updateAnalysisService(analysisId, updateData);
    if (!updatedAnalysis) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { analysis: updatedAnalysis },
    });
  } catch (error) {
    console.error('Update analysis error:', error);

    // Handle foreign key constraint violation (e.g., lead analyst doesn't exist)
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code: string };
      if (dbError.code === '23503') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid reference: lead analyst does not exist',
            errors: [
              {
                field: 'leadAnalystId',
                message: 'Lead analyst does not exist',
                code: 'INVALID_REFERENCE',
              },
            ],
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

// ============================================================================
// Complete Analysis
// ============================================================================

/**
 * Request body for completing an analysis.
 */
interface CompleteAnalysisBody {
  comments?: unknown;
}

/**
 * POST /analyses/:id/complete
 * Finalize/complete a HazOps analysis session.
 * Changes the analysis status from 'in_review' to 'approved'.
 *
 * User must have access to the project that owns the analysis.
 * Only lead analysts, analysts with non-viewer roles, or administrators can complete analyses.
 * The analysis must be in 'in_review' status.
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Request body (optional):
 * - comments: string - Approval/completion comments
 *
 * Returns:
 * - 200: Completed analysis with details
 * - 400: Validation error or analysis not in review status
 * - 401: Not authenticated
 * - 403: Not authorized to complete this analysis
 * - 404: Analysis not found
 * - 500: Internal server error
 */
export async function completeAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const { id: analysisId } = req.params;
    const body = req.body as CompleteAnalysisBody;

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
    if (!UUID_REGEX.test(analysisId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid analysis ID format',
          errors: [
            {
              field: 'id',
              message: 'Analysis ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate comments field if provided
    if (body.comments !== undefined && body.comments !== null) {
      if (typeof body.comments !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: [
              {
                field: 'comments',
                message: 'Comments must be a string',
                code: 'INVALID_TYPE',
              },
            ],
          },
        });
        return;
      }
    }

    // Find the analysis to check status and project access
    const existingAnalysis = await findAnalysisById(analysisId);
    if (!existingAnalysis) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this analysis
    const hasAccess = await userHasProjectAccess(userId, existingAnalysis.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this analysis',
        },
      });
      return;
    }

    // Get user's role - viewers cannot complete analyses
    const userRole = await getUserProjectRole(userId, existingAnalysis.projectId);
    if (!userRole || userRole === 'viewer') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to complete analyses in this project',
        },
      });
      return;
    }

    // Only allow completing analyses that are in_review status
    if (existingAnalysis.status !== 'in_review') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message:
            'Only analyses in review status can be completed. Current status: ' +
            existingAnalysis.status,
        },
      });
      return;
    }

    // Complete (approve) the analysis
    const comments = typeof body.comments === 'string' ? body.comments : '';
    const completedAnalysis = await approveAnalysisService(analysisId, userId, comments);

    if (!completedAnalysis) {
      // This shouldn't happen if status check passed, but handle it gracefully
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Unable to complete analysis. Status may have changed.',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { analysis: completedAnalysis },
    });
  } catch (error) {
    console.error('Complete analysis error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

// ============================================================================
// Create Analysis Entry
// ============================================================================

/**
 * POST /analyses/:id/entries
 * Create a new analysis entry for a node/guideword combination.
 * User must have access to the project that owns the analysis.
 * Only draft analyses can have entries added.
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Request body:
 * - nodeId: string (required) - Analysis node UUID
 * - guideWord: GuideWord (required) - Guide word to apply
 * - parameter: string (required) - Parameter being analyzed (e.g., "flow", "pressure")
 * - deviation: string (required) - Description of the deviation
 * - causes: string[] (optional) - Possible causes (default [])
 * - consequences: string[] (optional) - Potential consequences (default [])
 * - safeguards: string[] (optional) - Existing safeguards (default [])
 * - recommendations: string[] (optional) - Recommended actions (default [])
 * - notes: string (optional) - Additional notes
 *
 * Returns:
 * - 201: Created entry with details
 * - 400: Validation error or analysis not in draft status
 * - 401: Not authenticated
 * - 403: Not authorized to access this analysis
 * - 404: Analysis or node not found
 * - 409: Entry already exists for this node/guideword/parameter combination
 * - 500: Internal server error
 */
export async function createAnalysisEntry(req: Request, res: Response): Promise<void> {
  try {
    const { id: analysisId } = req.params;
    const body = req.body as CreateAnalysisEntryBody;

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
    if (!UUID_REGEX.test(analysisId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid analysis ID format',
          errors: [
            {
              field: 'id',
              message: 'Analysis ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate request body
    const validationErrors = validateCreateAnalysisEntryRequest(body);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: validationErrors,
        },
      });
      return;
    }

    // Find the analysis to check status and project access
    const existingAnalysis = await findAnalysisById(analysisId);
    if (!existingAnalysis) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this analysis
    const hasAccess = await userHasProjectAccess(userId, existingAnalysis.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this analysis',
        },
      });
      return;
    }

    // Only allow adding entries to draft analyses
    if (existingAnalysis.status !== 'draft') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message:
            'Can only add entries to draft analyses. Current status: ' + existingAnalysis.status,
        },
      });
      return;
    }

    const nodeId = body.nodeId as string;

    // Verify the node exists and belongs to the analysis document
    const nodeExists = await nodeExistsInDocument(nodeId, existingAnalysis.documentId);
    if (!nodeExists) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Node not found in the analysis document',
        },
      });
      return;
    }

    // Create the entry
    const entry = await createAnalysisEntryService(userId, {
      analysisId,
      nodeId,
      guideWord: body.guideWord as GuideWord,
      parameter: (body.parameter as string).trim(),
      deviation: (body.deviation as string).trim(),
      causes: Array.isArray(body.causes) ? (body.causes as string[]) : undefined,
      consequences: Array.isArray(body.consequences) ? (body.consequences as string[]) : undefined,
      safeguards: Array.isArray(body.safeguards) ? (body.safeguards as string[]) : undefined,
      recommendations: Array.isArray(body.recommendations)
        ? (body.recommendations as string[])
        : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });

    res.status(201).json({
      success: true,
      data: { entry },
    });
  } catch (error) {
    console.error('Create analysis entry error:', error);

    // Handle constraint violations
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code: string };

      // Foreign key constraint violation (node or analysis doesn't exist)
      if (dbError.code === '23503') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid reference: node or analysis does not exist',
          },
        });
        return;
      }

      // Unique constraint violation (entry already exists)
      if (dbError.code === '23505') {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'An entry already exists for this node, guide word, and parameter combination',
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

// ============================================================================
// List Analysis Entries
// ============================================================================

/**
 * Query parameters for listing analysis entries.
 */
interface ListEntriesQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
  nodeId?: string;
  guideWord?: string;
  riskLevel?: string;
}

/**
 * Valid sort fields for analysis entries.
 */
const validEntrySortFields = ['created_at', 'updated_at', 'parameter', 'guide_word', 'risk_score'];

/**
 * Validate list entries query parameters.
 * Returns an array of field errors if validation fails.
 */
function validateListEntriesQuery(query: ListEntriesQuery): FieldError[] {
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
  if (query.sortBy !== undefined && !validEntrySortFields.includes(query.sortBy)) {
    errors.push({
      field: 'sortBy',
      message: `sortBy must be one of: ${validEntrySortFields.join(', ')}`,
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

  // Validate nodeId (if provided, must be valid UUID)
  if (query.nodeId !== undefined && !UUID_REGEX.test(query.nodeId)) {
    errors.push({
      field: 'nodeId',
      message: 'nodeId must be a valid UUID',
      code: 'INVALID_FORMAT',
    });
  }

  // Validate guideWord filter
  if (query.guideWord !== undefined && !GUIDE_WORDS.includes(query.guideWord as GuideWord)) {
    errors.push({
      field: 'guideWord',
      message: `guideWord must be one of: ${GUIDE_WORDS.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // Validate riskLevel filter (includes 'not_assessed' option)
  if (query.riskLevel !== undefined && !RISK_LEVEL_FILTER_OPTIONS.includes(query.riskLevel as RiskLevelFilter)) {
    errors.push({
      field: 'riskLevel',
      message: `riskLevel must be one of: ${RISK_LEVEL_FILTER_OPTIONS.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  return errors;
}

/**
 * GET /analyses/:id/entries
 * List analysis entries for an analysis with pagination and filtering.
 * All project members can view entries.
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Query parameters:
 * - page: number (1-based, default 1)
 * - limit: number (default 20, max 100)
 * - sortBy: 'created_at' | 'updated_at' | 'parameter' | 'guide_word' | 'risk_score' (default 'created_at')
 * - sortOrder: 'asc' | 'desc' (default 'asc')
 * - search: string (searches parameter and deviation)
 * - nodeId: string (filter by node UUID)
 * - guideWord: GuideWord (filter by guide word)
 * - riskLevel: RiskLevel (filter by risk level)
 *
 * Returns:
 * - 200: Paginated list of analysis entries
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized to access this analysis
 * - 404: Analysis not found
 * - 500: Internal server error
 */
export async function listEntries(req: Request, res: Response): Promise<void> {
  try {
    const { id: analysisId } = req.params;
    const query = req.query as ListEntriesQuery;

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

    // Validate analysis ID format
    if (!UUID_REGEX.test(analysisId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid analysis ID format',
          errors: [
            {
              field: 'id',
              message: 'Analysis ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate query parameters
    const validationErrors = validateListEntriesQuery(query);
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

    // Find the analysis to check existence and project access
    const existingAnalysis = await findAnalysisById(analysisId);
    if (!existingAnalysis) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this analysis
    const hasAccess = await userHasProjectAccess(userId, existingAnalysis.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this analysis',
        },
      });
      return;
    }

    // Parse query parameters
    const page = query.page ? parseInt(query.page, 10) : undefined;
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const sortBy = query.sortBy as
      | 'created_at'
      | 'updated_at'
      | 'parameter'
      | 'guide_word'
      | 'risk_score'
      | undefined;
    const sortOrder = query.sortOrder as 'asc' | 'desc' | undefined;
    const search = query.search;
    const nodeId = query.nodeId;
    const guideWord = query.guideWord as GuideWord | undefined;
    const riskLevel = query.riskLevel as RiskLevelFilter | undefined;

    // Fetch entries
    const result = await listAnalysisEntries(
      analysisId,
      { nodeId, guideWord, riskLevel, search },
      { page, limit, sortBy, sortOrder }
    );

    // Calculate pagination metadata
    const currentPage = page ?? 1;
    const currentLimit = limit ?? 20;
    const totalPages = Math.ceil(result.total / currentLimit);

    res.status(200).json({
      success: true,
      data: { entries: result.entries },
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
    console.error('List analysis entries error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

// ============================================================================
// Update Analysis Entry
// ============================================================================

/**
 * PUT /entries/:id
 * Update an existing analysis entry.
 * User must have access to the project that owns the analysis.
 * Only draft analyses can have their entries updated.
 * Note: nodeId, guideWord, and parameter cannot be updated as they form the unique constraint.
 *
 * Path parameters:
 * - id: string (required) - Entry UUID
 *
 * Request body (all fields optional):
 * - deviation: string - Description of the deviation
 * - causes: string[] - Possible causes
 * - consequences: string[] - Potential consequences
 * - safeguards: string[] - Existing safeguards
 * - recommendations: string[] - Recommended actions
 * - notes: string | null - Additional notes (null to clear)
 *
 * Returns:
 * - 200: Updated entry
 * - 400: Validation error or analysis not in draft status
 * - 401: Not authenticated
 * - 403: Not authorized to access this analysis
 * - 404: Entry or analysis not found
 * - 500: Internal server error
 */
export async function updateEntry(req: Request, res: Response): Promise<void> {
  try {
    const { id: entryId } = req.params;
    const body = req.body as UpdateAnalysisEntryBody;

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
    if (!UUID_REGEX.test(entryId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid entry ID format',
          errors: [
            {
              field: 'id',
              message: 'Entry ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate request body
    const validationErrors = validateUpdateAnalysisEntryRequest(body);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: validationErrors,
        },
      });
      return;
    }

    // Find the entry to check existence
    const existingEntry = await findAnalysisEntryById(entryId);
    if (!existingEntry) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis entry not found',
        },
      });
      return;
    }

    // Find the analysis to check status and project access
    const existingAnalysis = await findAnalysisById(existingEntry.analysisId);
    if (!existingAnalysis) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this analysis
    const hasAccess = await userHasProjectAccess(userId, existingAnalysis.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this analysis',
        },
      });
      return;
    }

    // Only allow updates to entries in draft analyses
    if (existingAnalysis.status !== 'draft') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message:
            'Can only update entries in draft analyses. Current status: ' + existingAnalysis.status,
        },
      });
      return;
    }

    // Build update data from validated fields
    const updateData: {
      deviation?: string;
      causes?: string[];
      consequences?: string[];
      safeguards?: string[];
      recommendations?: string[];
      notes?: string | null;
    } = {};

    if (body.deviation !== undefined && typeof body.deviation === 'string') {
      updateData.deviation = body.deviation.trim();
    }

    if (body.causes !== undefined) {
      updateData.causes = Array.isArray(body.causes) ? (body.causes as string[]) : [];
    }

    if (body.consequences !== undefined) {
      updateData.consequences = Array.isArray(body.consequences)
        ? (body.consequences as string[])
        : [];
    }

    if (body.safeguards !== undefined) {
      updateData.safeguards = Array.isArray(body.safeguards) ? (body.safeguards as string[]) : [];
    }

    if (body.recommendations !== undefined) {
      updateData.recommendations = Array.isArray(body.recommendations)
        ? (body.recommendations as string[])
        : [];
    }

    if (body.notes !== undefined) {
      updateData.notes = typeof body.notes === 'string' ? body.notes : null;
    }

    // Update the entry
    const updatedEntry = await updateAnalysisEntryService(entryId, updateData);
    if (!updatedEntry) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis entry not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { entry: updatedEntry },
    });
  } catch (error) {
    console.error('Update analysis entry error:', error);

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
 * DELETE /entries/:id
 * Delete an existing analysis entry.
 *
 * Only entries in draft analyses can be deleted.
 * Viewers cannot delete entries.
 */
export async function deleteEntry(req: Request, res: Response): Promise<void> {
  try {
    const { id: entryId } = req.params;

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
    if (!UUID_REGEX.test(entryId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid entry ID format',
          errors: [
            {
              field: 'id',
              message: 'Entry ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Find the entry to check existence
    const existingEntry = await findAnalysisEntryById(entryId);
    if (!existingEntry) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis entry not found',
        },
      });
      return;
    }

    // Find the analysis to check status and project access
    const existingAnalysis = await findAnalysisById(existingEntry.analysisId);
    if (!existingAnalysis) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this analysis
    const hasAccess = await userHasProjectAccess(userId, existingAnalysis.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this analysis',
        },
      });
      return;
    }

    // Get user's role - viewers cannot delete entries
    const userRole = await getUserProjectRole(userId, existingAnalysis.projectId);
    if (!userRole || userRole === 'viewer') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete entries in this project',
        },
      });
      return;
    }

    // Only allow deletion of entries in draft analyses
    if (existingAnalysis.status !== 'draft') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message:
            'Can only delete entries in draft analyses. Current status: ' + existingAnalysis.status,
        },
      });
      return;
    }

    // Delete the entry
    const deletedEntry = await deleteAnalysisEntryService(entryId);
    if (!deletedEntry) {
      // Entry was deleted between findById and delete (race condition)
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis entry not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Analysis entry deleted successfully',
        entryId: deletedEntry.id,
      },
    });
  } catch (error) {
    console.error('Delete analysis entry error:', error);

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
 * PUT /entries/:id/risk
 * Update the risk ranking for an analysis entry.
 *
 * Risk assessment uses severity × likelihood × detectability methodology:
 * - Severity (1-5): Impact of consequence
 * - Likelihood (1-5): Probability of occurrence
 * - Detectability (1-5): Ability to detect before impact
 * - Risk Score is calculated automatically (1-125)
 * - Risk Level is determined automatically (low, medium, high)
 *
 * To clear the risk assessment, set clear=true in the request body.
 *
 * Only entries in draft analyses can have their risk updated.
 */
export async function updateEntryRisk(req: Request, res: Response): Promise<void> {
  try {
    const { id: entryId } = req.params;
    const body = req.body as UpdateEntryRiskBody;

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
    if (!UUID_REGEX.test(entryId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid entry ID format',
          errors: [
            {
              field: 'id',
              message: 'Entry ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Find the entry to check existence
    const existingEntry = await findAnalysisEntryById(entryId);
    if (!existingEntry) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis entry not found',
        },
      });
      return;
    }

    // Find the analysis to check status and project access
    const existingAnalysis = await findAnalysisById(existingEntry.analysisId);
    if (!existingAnalysis) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this analysis
    const hasAccess = await userHasProjectAccess(userId, existingAnalysis.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this analysis',
        },
      });
      return;
    }

    // Only allow updates to entries in draft analyses
    if (existingAnalysis.status !== 'draft') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message:
            'Can only update risk in draft analyses. Current status: ' + existingAnalysis.status,
        },
      });
      return;
    }

    // Handle clear request - remove risk assessment
    if (body.clear === true) {
      const clearedEntry = await clearEntryRiskService(entryId);
      if (!clearedEntry) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Analysis entry not found',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { entry: clearedEntry },
      });
      return;
    }

    // Validate required fields for risk assessment
    const errors: FieldError[] = [];

    // Validate severity (required, must be 1-5)
    if (body.severity === undefined || body.severity === null) {
      errors.push({
        field: 'severity',
        message: 'Severity is required',
        code: 'REQUIRED',
      });
    } else if (typeof body.severity !== 'number' || !Number.isInteger(body.severity)) {
      errors.push({
        field: 'severity',
        message: 'Severity must be an integer',
        code: 'INVALID_TYPE',
      });
    } else if (body.severity < 1 || body.severity > 5) {
      errors.push({
        field: 'severity',
        message: 'Severity must be between 1 and 5',
        code: 'OUT_OF_RANGE',
      });
    }

    // Validate likelihood (required, must be 1-5)
    if (body.likelihood === undefined || body.likelihood === null) {
      errors.push({
        field: 'likelihood',
        message: 'Likelihood is required',
        code: 'REQUIRED',
      });
    } else if (typeof body.likelihood !== 'number' || !Number.isInteger(body.likelihood)) {
      errors.push({
        field: 'likelihood',
        message: 'Likelihood must be an integer',
        code: 'INVALID_TYPE',
      });
    } else if (body.likelihood < 1 || body.likelihood > 5) {
      errors.push({
        field: 'likelihood',
        message: 'Likelihood must be between 1 and 5',
        code: 'OUT_OF_RANGE',
      });
    }

    // Validate detectability (required, must be 1-5)
    if (body.detectability === undefined || body.detectability === null) {
      errors.push({
        field: 'detectability',
        message: 'Detectability is required',
        code: 'REQUIRED',
      });
    } else if (typeof body.detectability !== 'number' || !Number.isInteger(body.detectability)) {
      errors.push({
        field: 'detectability',
        message: 'Detectability must be an integer',
        code: 'INVALID_TYPE',
      });
    } else if (body.detectability < 1 || body.detectability > 5) {
      errors.push({
        field: 'detectability',
        message: 'Detectability must be between 1 and 5',
        code: 'OUT_OF_RANGE',
      });
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors,
        },
      });
      return;
    }

    // Validate risk factors using the risk calculation service
    const severity = body.severity as 1 | 2 | 3 | 4 | 5;
    const likelihood = body.likelihood as 1 | 2 | 3 | 4 | 5;
    const detectability = body.detectability as 1 | 2 | 3 | 4 | 5;

    const validation = validateRiskFactors(severity, likelihood, detectability);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error || 'Invalid risk factors',
        },
      });
      return;
    }

    // Calculate the risk ranking
    const riskRanking = calculateRiskRanking(severity, likelihood, detectability);

    // Update the entry with the risk data
    const updatedEntry = await updateEntryRiskService(entryId, {
      severity: riskRanking.severity,
      likelihood: riskRanking.likelihood,
      detectability: riskRanking.detectability,
      riskScore: riskRanking.riskScore,
      riskLevel: riskRanking.riskLevel,
    });

    if (!updatedEntry) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis entry not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { entry: updatedEntry },
    });
  } catch (error) {
    console.error('Update entry risk error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

// ============================================================================
// Get Risk Summary
// ============================================================================

/**
 * GET /analyses/:id/risk-summary
 * Get aggregated risk summary for a HazOps analysis session.
 *
 * Returns comprehensive risk aggregation including:
 * - Overall statistics (total entries, assessed entries, counts by risk level)
 * - Risk level distribution percentages
 * - Score percentiles (p25, p50, p75, p90, p95)
 * - Breakdown by node (risk summary per node)
 * - Breakdown by guide word (risk summary per guide word)
 * - List of highest risk entries (top 10)
 * - Threshold configuration used for classification
 *
 * Path parameters:
 * - id: string (required) - Analysis UUID
 *
 * Returns:
 * - 200: Aggregated risk summary
 * - 400: Invalid analysis ID format
 * - 401: Not authenticated
 * - 403: Not authorized to access this analysis
 * - 404: Analysis not found
 * - 500: Internal server error
 */
export async function getRiskSummary(req: Request, res: Response): Promise<void> {
  try {
    const { id: analysisId } = req.params;

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
    if (!UUID_REGEX.test(analysisId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid analysis ID format',
          errors: [
            {
              field: 'id',
              message: 'Analysis ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Find the analysis to check project access
    const existingAnalysis = await findAnalysisById(analysisId);
    if (!existingAnalysis) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    // Check if user has access to the project that owns this analysis
    const hasAccess = await userHasProjectAccess(userId, existingAnalysis.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this analysis',
        },
      });
      return;
    }

    // Get the comprehensive risk aggregation
    const riskAggregation = await getAnalysisRiskAggregation(analysisId);
    if (!riskAggregation) {
      // This should not happen since we already checked the analysis exists
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: riskAggregation,
    });
  } catch (error) {
    console.error('Get risk summary error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}

// ============================================================================
// Create Entry LOPA Analysis
// ============================================================================

import {
  createLOPAAnalysis,
  getEntryWithAnalysisInfo,
  lopaExistsForEntry,
} from '../services/lopa-analysis.service.js';
import {
  isValidInitiatingEventFrequency,
  isValidTargetFrequency,
  isValidPFD,
} from '../services/lopa-calculation.service.js';
import {
  INITIATING_EVENT_CATEGORIES,
  IPL_TYPES,
  SAFETY_INTEGRITY_LEVELS,
} from '@hazop/types';
import type {
  InitiatingEventCategory,
  IPLType,
  SafetyIntegrityLevel,
} from '@hazop/types';

/**
 * Request body for creating a LOPA analysis.
 */
interface CreateLOPABody {
  scenarioDescription?: unknown;
  consequence?: unknown;
  initiatingEventCategory?: unknown;
  initiatingEventDescription?: unknown;
  initiatingEventFrequency?: unknown;
  ipls?: unknown;
  targetFrequency?: unknown;
  notes?: unknown;
}

/**
 * IPL input from request body.
 */
interface IPLInput {
  type?: unknown;
  name?: unknown;
  description?: unknown;
  pfd?: unknown;
  independentOfInitiator?: unknown;
  independentOfOtherIPLs?: unknown;
  sil?: unknown;
  notes?: unknown;
}

/**
 * Validate create LOPA request body.
 * Returns an array of field errors if validation fails.
 */
function validateCreateLOPARequest(body: CreateLOPABody): FieldError[] {
  const errors: FieldError[] = [];

  // Validate scenarioDescription (required, non-empty string)
  if (body.scenarioDescription === undefined || body.scenarioDescription === null) {
    errors.push({
      field: 'scenarioDescription',
      message: 'Scenario description is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.scenarioDescription !== 'string') {
    errors.push({
      field: 'scenarioDescription',
      message: 'Scenario description must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (body.scenarioDescription.trim().length === 0) {
    errors.push({
      field: 'scenarioDescription',
      message: 'Scenario description cannot be empty',
      code: 'EMPTY',
    });
  }

  // Validate consequence (required, non-empty string)
  if (body.consequence === undefined || body.consequence === null) {
    errors.push({
      field: 'consequence',
      message: 'Consequence is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.consequence !== 'string') {
    errors.push({
      field: 'consequence',
      message: 'Consequence must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (body.consequence.trim().length === 0) {
    errors.push({
      field: 'consequence',
      message: 'Consequence cannot be empty',
      code: 'EMPTY',
    });
  }

  // Validate initiatingEventCategory (required, must be valid category)
  if (body.initiatingEventCategory === undefined || body.initiatingEventCategory === null) {
    errors.push({
      field: 'initiatingEventCategory',
      message: 'Initiating event category is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.initiatingEventCategory !== 'string') {
    errors.push({
      field: 'initiatingEventCategory',
      message: 'Initiating event category must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (
    !INITIATING_EVENT_CATEGORIES.includes(body.initiatingEventCategory as InitiatingEventCategory)
  ) {
    errors.push({
      field: 'initiatingEventCategory',
      message: `Initiating event category must be one of: ${INITIATING_EVENT_CATEGORIES.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // Validate initiatingEventDescription (required, non-empty string)
  if (body.initiatingEventDescription === undefined || body.initiatingEventDescription === null) {
    errors.push({
      field: 'initiatingEventDescription',
      message: 'Initiating event description is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.initiatingEventDescription !== 'string') {
    errors.push({
      field: 'initiatingEventDescription',
      message: 'Initiating event description must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (body.initiatingEventDescription.trim().length === 0) {
    errors.push({
      field: 'initiatingEventDescription',
      message: 'Initiating event description cannot be empty',
      code: 'EMPTY',
    });
  }

  // Validate initiatingEventFrequency (required, positive number)
  if (body.initiatingEventFrequency === undefined || body.initiatingEventFrequency === null) {
    errors.push({
      field: 'initiatingEventFrequency',
      message: 'Initiating event frequency is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.initiatingEventFrequency !== 'number') {
    errors.push({
      field: 'initiatingEventFrequency',
      message: 'Initiating event frequency must be a number',
      code: 'INVALID_TYPE',
    });
  } else if (!isValidInitiatingEventFrequency(body.initiatingEventFrequency)) {
    errors.push({
      field: 'initiatingEventFrequency',
      message: 'Initiating event frequency must be between 1e-8 and 100 per year',
      code: 'OUT_OF_RANGE',
    });
  }

  // Validate targetFrequency (required, positive number)
  if (body.targetFrequency === undefined || body.targetFrequency === null) {
    errors.push({
      field: 'targetFrequency',
      message: 'Target frequency is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.targetFrequency !== 'number') {
    errors.push({
      field: 'targetFrequency',
      message: 'Target frequency must be a number',
      code: 'INVALID_TYPE',
    });
  } else if (!isValidTargetFrequency(body.targetFrequency)) {
    errors.push({
      field: 'targetFrequency',
      message: 'Target frequency must be greater than 0 and at most 1 per year',
      code: 'OUT_OF_RANGE',
    });
  }

  // Validate frequency ordering
  if (
    typeof body.initiatingEventFrequency === 'number' &&
    typeof body.targetFrequency === 'number' &&
    body.targetFrequency >= body.initiatingEventFrequency
  ) {
    errors.push({
      field: 'targetFrequency',
      message: 'Target frequency must be less than initiating event frequency',
      code: 'INVALID_VALUE',
    });
  }

  // Validate ipls (required, must be array)
  if (body.ipls === undefined || body.ipls === null) {
    errors.push({
      field: 'ipls',
      message: 'IPLs array is required',
      code: 'REQUIRED',
    });
  } else if (!Array.isArray(body.ipls)) {
    errors.push({
      field: 'ipls',
      message: 'IPLs must be an array',
      code: 'INVALID_TYPE',
    });
  } else {
    // Validate each IPL
    const iplArray = body.ipls as IPLInput[];
    for (let i = 0; i < iplArray.length; i++) {
      const ipl = iplArray[i];
      const prefix = `ipls[${i}]`;

      // Validate type
      if (ipl.type === undefined || ipl.type === null) {
        errors.push({
          field: `${prefix}.type`,
          message: 'IPL type is required',
          code: 'REQUIRED',
        });
      } else if (typeof ipl.type !== 'string') {
        errors.push({
          field: `${prefix}.type`,
          message: 'IPL type must be a string',
          code: 'INVALID_TYPE',
        });
      } else if (!IPL_TYPES.includes(ipl.type as IPLType)) {
        errors.push({
          field: `${prefix}.type`,
          message: `IPL type must be one of: ${IPL_TYPES.join(', ')}`,
          code: 'INVALID_VALUE',
        });
      }

      // Validate name
      if (ipl.name === undefined || ipl.name === null) {
        errors.push({
          field: `${prefix}.name`,
          message: 'IPL name is required',
          code: 'REQUIRED',
        });
      } else if (typeof ipl.name !== 'string') {
        errors.push({
          field: `${prefix}.name`,
          message: 'IPL name must be a string',
          code: 'INVALID_TYPE',
        });
      } else if ((ipl.name as string).trim().length === 0) {
        errors.push({
          field: `${prefix}.name`,
          message: 'IPL name cannot be empty',
          code: 'EMPTY',
        });
      }

      // Validate description
      if (ipl.description === undefined || ipl.description === null) {
        errors.push({
          field: `${prefix}.description`,
          message: 'IPL description is required',
          code: 'REQUIRED',
        });
      } else if (typeof ipl.description !== 'string') {
        errors.push({
          field: `${prefix}.description`,
          message: 'IPL description must be a string',
          code: 'INVALID_TYPE',
        });
      } else if ((ipl.description as string).trim().length === 0) {
        errors.push({
          field: `${prefix}.description`,
          message: 'IPL description cannot be empty',
          code: 'EMPTY',
        });
      }

      // Validate pfd
      if (ipl.pfd === undefined || ipl.pfd === null) {
        errors.push({
          field: `${prefix}.pfd`,
          message: 'IPL PFD is required',
          code: 'REQUIRED',
        });
      } else if (typeof ipl.pfd !== 'number') {
        errors.push({
          field: `${prefix}.pfd`,
          message: 'IPL PFD must be a number',
          code: 'INVALID_TYPE',
        });
      } else if (!isValidPFD(ipl.pfd)) {
        errors.push({
          field: `${prefix}.pfd`,
          message: 'IPL PFD must be between 1e-5 and 1.0',
          code: 'OUT_OF_RANGE',
        });
      }

      // Validate independentOfInitiator
      if (ipl.independentOfInitiator === undefined || ipl.independentOfInitiator === null) {
        errors.push({
          field: `${prefix}.independentOfInitiator`,
          message: 'IPL independence of initiator is required',
          code: 'REQUIRED',
        });
      } else if (typeof ipl.independentOfInitiator !== 'boolean') {
        errors.push({
          field: `${prefix}.independentOfInitiator`,
          message: 'IPL independence of initiator must be a boolean',
          code: 'INVALID_TYPE',
        });
      }

      // Validate independentOfOtherIPLs
      if (ipl.independentOfOtherIPLs === undefined || ipl.independentOfOtherIPLs === null) {
        errors.push({
          field: `${prefix}.independentOfOtherIPLs`,
          message: 'IPL independence of other IPLs is required',
          code: 'REQUIRED',
        });
      } else if (typeof ipl.independentOfOtherIPLs !== 'boolean') {
        errors.push({
          field: `${prefix}.independentOfOtherIPLs`,
          message: 'IPL independence of other IPLs must be a boolean',
          code: 'INVALID_TYPE',
        });
      }

      // Validate sil (optional, but if provided must be 1-4)
      if (ipl.sil !== undefined && ipl.sil !== null) {
        if (typeof ipl.sil !== 'number' || !Number.isInteger(ipl.sil)) {
          errors.push({
            field: `${prefix}.sil`,
            message: 'IPL SIL must be an integer',
            code: 'INVALID_TYPE',
          });
        } else if (!SAFETY_INTEGRITY_LEVELS.includes(ipl.sil as SafetyIntegrityLevel)) {
          errors.push({
            field: `${prefix}.sil`,
            message: 'IPL SIL must be 1, 2, 3, or 4',
            code: 'INVALID_VALUE',
          });
        }
      }

      // Validate notes (optional, but if provided must be string)
      if (ipl.notes !== undefined && ipl.notes !== null) {
        if (typeof ipl.notes !== 'string') {
          errors.push({
            field: `${prefix}.notes`,
            message: 'IPL notes must be a string',
            code: 'INVALID_TYPE',
          });
        }
      }
    }
  }

  // Validate notes (optional, but if provided must be string)
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string') {
      errors.push({
        field: 'notes',
        message: 'Notes must be a string',
        code: 'INVALID_TYPE',
      });
    }
  }

  return errors;
}

/**
 * POST /entries/:id/lopa
 * Create a LOPA (Layers of Protection Analysis) for an analysis entry.
 *
 * The entry must have a risk assessment with severity defined.
 * The analysis must be in 'draft' status.
 * Only one LOPA can exist per entry.
 *
 * Path parameters:
 * - id: string (required) - Entry UUID
 *
 * Request body:
 * - scenarioDescription: string (required) - Description of the scenario
 * - consequence: string (required) - Description of the consequence
 * - initiatingEventCategory: string (required) - Category of initiating event
 * - initiatingEventDescription: string (required) - Description of initiating event
 * - initiatingEventFrequency: number (required) - Frequency per year
 * - ipls: array (required) - Array of IPL objects
 * - targetFrequency: number (required) - Target frequency per year
 * - notes: string (optional) - Additional notes
 *
 * Returns:
 * - 201: Created LOPA analysis
 * - 400: Validation error, entry not risk-assessed, or analysis not in draft
 * - 401: Not authenticated
 * - 403: Not authorized to access this entry's project
 * - 404: Entry not found
 * - 409: LOPA already exists for this entry
 * - 500: Internal server error
 */
export async function createEntryLOPA(req: Request, res: Response): Promise<void> {
  try {
    const { id: entryId } = req.params;
    const body = req.body as CreateLOPABody;

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
    if (!UUID_REGEX.test(entryId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid entry ID format',
          errors: [
            {
              field: 'id',
              message: 'Entry ID must be a valid UUID',
              code: 'INVALID_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Validate request body
    const validationErrors = validateCreateLOPARequest(body);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: validationErrors,
        },
      });
      return;
    }

    // Get entry info with project access check
    const entryInfo = await getEntryWithAnalysisInfo(entryId);
    if (!entryInfo) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis entry not found',
        },
      });
      return;
    }

    // Check if user has access to the project
    const hasAccess = await userHasProjectAccess(userId, entryInfo.projectId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this entry',
        },
      });
      return;
    }

    // Check if analysis is in draft status
    if (entryInfo.analysisStatus !== 'draft') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Can only create LOPA for draft analyses. Current status: ${entryInfo.analysisStatus}`,
        },
      });
      return;
    }

    // Check if entry has severity assessed
    if (entryInfo.severity === null) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Entry must have risk assessment with severity before creating LOPA',
        },
      });
      return;
    }

    // Check if LOPA already exists for this entry
    const exists = await lopaExistsForEntry(entryId);
    if (exists) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'LOPA analysis already exists for this entry',
        },
      });
      return;
    }

    // Build IPL array from request body
    const iplArray = body.ipls as IPLInput[];
    const ipls = iplArray.map((ipl) => ({
      type: ipl.type as IPLType,
      name: (ipl.name as string).trim(),
      description: (ipl.description as string).trim(),
      pfd: ipl.pfd as number,
      independentOfInitiator: ipl.independentOfInitiator as boolean,
      independentOfOtherIPLs: ipl.independentOfOtherIPLs as boolean,
      sil: ipl.sil as SafetyIntegrityLevel | undefined,
      notes: typeof ipl.notes === 'string' ? ipl.notes : undefined,
    }));

    // Create the LOPA analysis
    const lopa = await createLOPAAnalysis(userId, {
      analysisEntryId: entryId,
      scenarioDescription: (body.scenarioDescription as string).trim(),
      consequence: (body.consequence as string).trim(),
      initiatingEventCategory: body.initiatingEventCategory as InitiatingEventCategory,
      initiatingEventDescription: (body.initiatingEventDescription as string).trim(),
      initiatingEventFrequency: body.initiatingEventFrequency as number,
      ipls,
      targetFrequency: body.targetFrequency as number,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });

    res.status(201).json({
      success: true,
      data: { lopa },
    });
  } catch (error) {
    console.error('Create entry LOPA error:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === 'Analysis entry not found') {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Analysis entry not found',
          },
        });
        return;
      }

      if (error.message.includes('Invalid LOPA input')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
          },
        });
        return;
      }

      if (error.message === 'LOPA analysis already exists for this entry') {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'LOPA analysis already exists for this entry',
          },
        });
        return;
      }

      if (error.message.includes('must have risk assessment')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
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
