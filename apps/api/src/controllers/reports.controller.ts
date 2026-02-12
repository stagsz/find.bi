/**
 * Reports controller.
 *
 * Handles HTTP requests for report generation and management.
 * Reports are generated asynchronously via RabbitMQ queue.
 */

import type { Request, Response } from 'express';
import type { ReportFormat, ReportParameters, REPORT_FORMATS } from '@hazop/types';
import {
  createReport as createReportService,
  getProjectIdForAnalysis,
  analysisExists,
} from '../services/reports.service.js';
import {
  getReportQueueService,
  createReportJobMessage,
} from '../services/report-queue.service.js';
import {
  templateIsActive,
  templateSupportsFormat,
} from '../services/report-template.service.js';
import {
  userHasProjectAccess,
  findProjectById,
} from '../services/project.service.js';
import { findAnalysisById } from '../services/hazop-analysis.service.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * UUID regex pattern for validation.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valid report formats.
 */
const VALID_FORMATS: readonly ReportFormat[] = ['pdf', 'word', 'excel', 'powerpoint'];

/**
 * Valid risk level filter values.
 */
const VALID_RISK_LEVELS = ['low', 'medium', 'high'] as const;

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Field validation error.
 */
interface FieldError {
  field: string;
  message: string;
  code: string;
}

/**
 * Request body for creating a report.
 */
interface CreateReportBody {
  analysisId?: unknown;
  format?: unknown;
  template?: unknown;
  name?: unknown;
  parameters?: unknown;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate the create report request body.
 *
 * @param body - The request body
 * @returns Array of field errors (empty if valid)
 */
function validateCreateReportRequest(body: CreateReportBody): FieldError[] {
  const errors: FieldError[] = [];

  // Validate analysisId (required, must be UUID)
  if (body.analysisId === undefined || body.analysisId === null) {
    errors.push({
      field: 'analysisId',
      message: 'Analysis ID is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.analysisId !== 'string') {
    errors.push({
      field: 'analysisId',
      message: 'Analysis ID must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (!UUID_REGEX.test(body.analysisId)) {
    errors.push({
      field: 'analysisId',
      message: 'Analysis ID must be a valid UUID',
      code: 'INVALID_FORMAT',
    });
  }

  // Validate format (required, must be valid format)
  if (body.format === undefined || body.format === null) {
    errors.push({
      field: 'format',
      message: 'Format is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.format !== 'string') {
    errors.push({
      field: 'format',
      message: 'Format must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (!VALID_FORMATS.includes(body.format as ReportFormat)) {
    errors.push({
      field: 'format',
      message: `Format must be one of: ${VALID_FORMATS.join(', ')}`,
      code: 'INVALID_VALUE',
    });
  }

  // Validate template (required, non-empty string)
  if (body.template === undefined || body.template === null) {
    errors.push({
      field: 'template',
      message: 'Template is required',
      code: 'REQUIRED',
    });
  } else if (typeof body.template !== 'string') {
    errors.push({
      field: 'template',
      message: 'Template must be a string',
      code: 'INVALID_TYPE',
    });
  } else if (body.template.trim().length === 0) {
    errors.push({
      field: 'template',
      message: 'Template cannot be empty',
      code: 'EMPTY',
    });
  }

  // Validate name (optional, but if provided must be string with max length)
  if (body.name !== undefined && body.name !== null) {
    if (typeof body.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Name must be a string',
        code: 'INVALID_TYPE',
      });
    } else if (body.name.length > 300) {
      errors.push({
        field: 'name',
        message: 'Name must be 300 characters or less',
        code: 'MAX_LENGTH',
      });
    }
  }

  // Validate parameters (optional, but if provided must be object)
  if (body.parameters !== undefined && body.parameters !== null) {
    if (typeof body.parameters !== 'object' || Array.isArray(body.parameters)) {
      errors.push({
        field: 'parameters',
        message: 'Parameters must be an object',
        code: 'INVALID_TYPE',
      });
    } else {
      // Validate individual parameter fields
      const params = body.parameters as Record<string, unknown>;

      // Boolean fields
      const booleanFields = [
        'includeRiskMatrix',
        'includeCompliance',
        'includeLopa',
        'includePidImages',
        'includeNodeCoordinates',
        'includeNotes',
        'includeRecommendations',
      ];

      for (const field of booleanFields) {
        if (params[field] !== undefined && typeof params[field] !== 'boolean') {
          errors.push({
            field: `parameters.${field}`,
            message: `${field} must be a boolean`,
            code: 'INVALID_TYPE',
          });
        }
      }

      // String fields
      if (params.customTitle !== undefined && typeof params.customTitle !== 'string') {
        errors.push({
          field: 'parameters.customTitle',
          message: 'customTitle must be a string',
          code: 'INVALID_TYPE',
        });
      }

      if (params.customFooter !== undefined && typeof params.customFooter !== 'string') {
        errors.push({
          field: 'parameters.customFooter',
          message: 'customFooter must be a string',
          code: 'INVALID_TYPE',
        });
      }

      // Array fields
      if (params.riskLevelFilter !== undefined) {
        if (!Array.isArray(params.riskLevelFilter)) {
          errors.push({
            field: 'parameters.riskLevelFilter',
            message: 'riskLevelFilter must be an array',
            code: 'INVALID_TYPE',
          });
        } else {
          for (const level of params.riskLevelFilter) {
            if (!VALID_RISK_LEVELS.includes(level as typeof VALID_RISK_LEVELS[number])) {
              errors.push({
                field: 'parameters.riskLevelFilter',
                message: `riskLevelFilter values must be one of: ${VALID_RISK_LEVELS.join(', ')}`,
                code: 'INVALID_VALUE',
              });
              break;
            }
          }
        }
      }

      if (params.nodeFilter !== undefined) {
        if (!Array.isArray(params.nodeFilter)) {
          errors.push({
            field: 'parameters.nodeFilter',
            message: 'nodeFilter must be an array',
            code: 'INVALID_TYPE',
          });
        } else {
          for (const nodeId of params.nodeFilter) {
            if (typeof nodeId !== 'string') {
              errors.push({
                field: 'parameters.nodeFilter',
                message: 'nodeFilter values must be strings',
                code: 'INVALID_TYPE',
              });
              break;
            }
          }
        }
      }
    }
  }

  return errors;
}

// ============================================================================
// Controller Functions
// ============================================================================

/**
 * POST /projects/:id/reports
 * Request a report generation for a HazOps analysis.
 *
 * The report is created with 'pending' status and queued for async generation.
 * Returns immediately with job ID for status polling.
 *
 * Path parameters:
 * - id: string (required) - Project UUID
 *
 * Request body:
 * - analysisId: string (required) - ID of the analysis to generate report for
 * - format: ReportFormat (required) - pdf | word | excel | powerpoint
 * - template: string (required) - Template identifier
 * - name: string (optional) - Custom report name
 * - parameters: ReportParameters (optional) - Generation parameters
 *
 * Returns:
 * - 201: Report job created with status URL
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized to access this project
 * - 404: Project, analysis, or template not found
 * - 500: Internal server error
 */
export async function createReport(req: Request, res: Response): Promise<void> {
  try {
    const { id: projectId } = req.params;
    const body = req.body as CreateReportBody;

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
    const validationErrors = validateCreateReportRequest(body);
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

    const analysisId = body.analysisId as string;
    const format = body.format as ReportFormat;
    const template = body.template as string;

    // Check if analysis exists and belongs to this project
    const analysis = await findAnalysisById(analysisId);
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

    if (analysis.projectId !== projectId) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found in this project',
        },
      });
      return;
    }

    // Validate template exists and is active
    const isTemplateActive = await templateIsActive(template);
    if (!isTemplateActive) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Template not found or not active',
        },
      });
      return;
    }

    // Validate template supports the requested format
    const supportsFormat = await templateSupportsFormat(template, format);
    if (!supportsFormat) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Template does not support ${format} format`,
          errors: [
            {
              field: 'format',
              message: `The selected template does not support ${format} format`,
              code: 'UNSUPPORTED_FORMAT',
            },
          ],
        },
      });
      return;
    }

    // Build report name
    const reportName = body.name
      ? (body.name as string).trim()
      : `${analysis.name} - ${format.toUpperCase()}`;

    // Build parameters object
    const parameters: ReportParameters = body.parameters
      ? (body.parameters as ReportParameters)
      : {};

    // Create the report record in the database
    const report = await createReportService({
      analysisId,
      format,
      template,
      name: reportName,
      parameters,
      requestedById: userId,
    });

    // Queue the report generation job
    const queueService = getReportQueueService();
    const jobMessage = createReportJobMessage({
      reportId: report.id,
      analysisId,
      projectId,
      format,
      template,
      name: reportName,
      parameters,
      requestedById: userId,
    });

    await queueService.enqueue(jobMessage);

    // Return success response with job info
    res.status(201).json({
      success: true,
      data: {
        reportId: report.id,
        status: report.status,
        estimatedSeconds: 30, // Rough estimate, depends on report complexity
        statusUrl: `/api/reports/${report.id}/status`,
      },
    });
  } catch (error) {
    console.error('Create report error:', error);

    // Handle foreign key constraint violation
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code: string };
      if (dbError.code === '23503') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid reference: analysis or user does not exist',
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
