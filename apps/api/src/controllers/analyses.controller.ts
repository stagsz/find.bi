/**
 * Analyses controller for handling HazOps analysis operations.
 *
 * Handles:
 * - POST /projects/:id/analyses - Create a new analysis session
 */

import type { Request, Response } from 'express';
import {
  createAnalysis as createAnalysisService,
  documentBelongsToProject,
} from '../services/hazop-analysis.service.js';
import { userHasProjectAccess, findProjectById } from '../services/project.service.js';

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
