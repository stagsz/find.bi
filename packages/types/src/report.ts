/**
 * Report type definitions for HazOp Assistant.
 *
 * These types define report generation, templates, and export functionality
 * for HazOps analyses. The system supports multiple output formats including
 * PDF, Word, Excel, and PowerPoint for different use cases:
 *
 * - PDF/Word: Formal documentation for regulatory compliance
 * - Excel: Data tables for analysis and further processing
 * - PowerPoint: Presentations for stakeholder communication
 *
 * Reports are generated asynchronously via a message queue (RabbitMQ)
 * and stored in file storage (MinIO/S3).
 */

// ============================================================================
// Report Formats
// ============================================================================

/**
 * Supported report output formats.
 *
 * - pdf: Portable Document Format for formal documentation
 * - word: Microsoft Word format (docx) for editable reports
 * - excel: Microsoft Excel format (xlsx) for data tables
 * - powerpoint: Microsoft PowerPoint format (pptx) for presentations
 */
export type ReportFormat = 'pdf' | 'word' | 'excel' | 'powerpoint';

/**
 * All available report formats as a constant array.
 * Useful for validation, iteration, and UI dropdowns.
 */
export const REPORT_FORMATS: readonly ReportFormat[] = [
  'pdf',
  'word',
  'excel',
  'powerpoint',
] as const;

/**
 * Human-readable labels for report formats.
 */
export const REPORT_FORMAT_LABELS: Record<ReportFormat, string> = {
  pdf: 'PDF Document',
  word: 'Word Document',
  excel: 'Excel Spreadsheet',
  powerpoint: 'PowerPoint Presentation',
};

/**
 * File extensions for each report format.
 */
export const REPORT_FORMAT_EXTENSIONS: Record<ReportFormat, string> = {
  pdf: '.pdf',
  word: '.docx',
  excel: '.xlsx',
  powerpoint: '.pptx',
};

/**
 * MIME types for each report format.
 */
export const REPORT_FORMAT_MIME_TYPES: Record<ReportFormat, string> = {
  pdf: 'application/pdf',
  word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// ============================================================================
// Report Generation Status
// ============================================================================

/**
 * Status of a report generation job.
 *
 * - pending: Job is queued and waiting to be processed
 * - generating: Report is currently being generated
 * - completed: Report generation finished successfully
 * - failed: Report generation failed with an error
 */
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

/**
 * All report statuses as a constant array.
 */
export const REPORT_STATUSES: readonly ReportStatus[] = [
  'pending',
  'generating',
  'completed',
  'failed',
] as const;

/**
 * Human-readable labels for report statuses.
 */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending',
  generating: 'Generating',
  completed: 'Completed',
  failed: 'Failed',
};

// ============================================================================
// Report Generation Parameters
// ============================================================================

/**
 * Parameters for customizing report generation.
 * Stored as JSONB in the database for flexibility.
 */
export interface ReportParameters {
  /** Include the risk matrix visualization in the report */
  includeRiskMatrix?: boolean;

  /** Include compliance validation results in the report */
  includeCompliance?: boolean;

  /** Include LOPA analysis results in the report */
  includeLopa?: boolean;

  /** Include P&ID images in the report */
  includePidImages?: boolean;

  /** Include node coordinates and positions in the report */
  includeNodeCoordinates?: boolean;

  /** Include analysis entry notes in the report */
  includeNotes?: boolean;

  /** Include recommendation details in the report */
  includeRecommendations?: boolean;

  /** Filter by specific risk levels (empty = include all) */
  riskLevelFilter?: ('low' | 'medium' | 'high')[];

  /** Filter by specific nodes (empty = include all) */
  nodeFilter?: string[];

  /** Custom report title (overrides default) */
  customTitle?: string;

  /** Custom footer text for the report */
  customFooter?: string;
}

// ============================================================================
// Report Entity
// ============================================================================

/**
 * Report entity representing a generated report.
 * Maps to the reports database table.
 */
export interface Report {
  /** Unique identifier (UUID) */
  id: string;

  /** ID of the HazOps analysis this report was generated from */
  hazopAnalysisId: string;

  /** Name/title of the report */
  name: string;

  /** Output format of the report */
  format: ReportFormat;

  /** Name/identifier of the template used */
  templateUsed: string;

  /** Current status of the report generation */
  status: ReportStatus;

  /** Path to the generated file in storage (null if not yet generated) */
  filePath: string | null;

  /** Size of the generated file in bytes (null if not yet generated) */
  fileSize: number | null;

  /** ID of the user who requested the report */
  generatedById: string;

  /** Timestamp when the report generation was requested */
  requestedAt: Date;

  /** Timestamp when the report generation completed (null if not completed) */
  generatedAt: Date | null;

  /** Generation parameters used for this report */
  parameters: ReportParameters;

  /** Error message if generation failed (null if no error) */
  errorMessage: string | null;
}

/**
 * Report with analysis details for display.
 */
export interface ReportWithAnalysis extends Report {
  /** Name of the HazOps analysis */
  analysisName: string;

  /** Name of the project */
  projectName: string;

  /** ID of the project */
  projectId: string;
}

/**
 * Report with generator user details.
 */
export interface ReportWithGenerator extends Report {
  /** Name of the user who generated the report */
  generatedByName: string;

  /** Email of the user who generated the report */
  generatedByEmail: string;
}

/**
 * Report with all related details.
 */
export interface ReportWithDetails extends Report {
  /** Name of the HazOps analysis */
  analysisName: string;

  /** Name of the project */
  projectName: string;

  /** ID of the project */
  projectId: string;

  /** Name of the user who generated the report */
  generatedByName: string;

  /** Email of the user who generated the report */
  generatedByEmail: string;
}

// ============================================================================
// Report Template Entity
// ============================================================================

/**
 * Report template entity for customizing report output.
 * Maps to the report_templates database table.
 */
export interface ReportTemplate {
  /** Unique identifier (UUID) */
  id: string;

  /** Name of the template */
  name: string;

  /** Description of what this template produces */
  description: string | null;

  /** Path to the template file in storage */
  templatePath: string;

  /** Output formats this template supports */
  supportedFormats: ReportFormat[];

  /** Whether this template is available for use */
  isActive: boolean;

  /** ID of the user who created this template */
  createdById: string;

  /** Timestamp when the template was created */
  createdAt: Date;
}

/**
 * Report template with creator details.
 */
export interface ReportTemplateWithCreator extends ReportTemplate {
  /** Name of the user who created the template */
  createdByName: string;

  /** Email of the user who created the template */
  createdByEmail: string;
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

/**
 * Payload for requesting report generation.
 * This is the main request body for POST /projects/:id/reports.
 */
export interface CreateReportPayload {
  /** ID of the analysis to generate a report for */
  analysisId: string;

  /** Desired output format */
  format: ReportFormat;

  /** Template to use for generation */
  template: string;

  /** Optional custom name for the report */
  name?: string;

  /** Optional generation parameters */
  parameters?: ReportParameters;
}

/**
 * Response for a report generation request.
 * Returns immediately with job ID for status polling.
 */
export interface ReportJobResponse {
  /** ID of the report (also serves as job ID) */
  reportId: string;

  /** Current status (will be 'pending' initially) */
  status: ReportStatus;

  /** Estimated time for generation in seconds (optional) */
  estimatedSeconds?: number;

  /** URL to poll for status updates */
  statusUrl: string;
}

/**
 * Response for checking report generation status.
 */
export interface ReportStatusResponse {
  /** ID of the report */
  reportId: string;

  /** Current status */
  status: ReportStatus;

  /** Progress percentage (0-100) if available */
  progress?: number;

  /** Download URL if completed (null otherwise) */
  downloadUrl: string | null;

  /** Error message if failed (null otherwise) */
  errorMessage: string | null;

  /** Timestamp when generation completed (null if not complete) */
  completedAt: Date | null;
}

/**
 * Payload for creating a new report template.
 */
export interface CreateReportTemplatePayload {
  /** Name of the template */
  name: string;

  /** Description of what this template produces */
  description?: string;

  /** Path to the template file in storage */
  templatePath: string;

  /** Output formats this template supports */
  supportedFormats: ReportFormat[];
}

/**
 * Payload for updating a report template.
 * All fields are optional - only provided fields are updated.
 */
export interface UpdateReportTemplatePayload {
  /** Name of the template */
  name?: string;

  /** Description of what this template produces */
  description?: string | null;

  /** Path to the template file in storage */
  templatePath?: string;

  /** Output formats this template supports */
  supportedFormats?: ReportFormat[];

  /** Whether this template is available for use */
  isActive?: boolean;
}

/**
 * Query parameters for listing reports.
 */
export interface ListReportsQuery {
  /** Filter by project ID */
  projectId?: string;

  /** Filter by analysis ID */
  analysisId?: string;

  /** Filter by format */
  format?: ReportFormat;

  /** Filter by status */
  status?: ReportStatus;

  /** Page number for pagination (1-based) */
  page?: number;

  /** Number of items per page */
  limit?: number;

  /** Sort field */
  sortBy?: 'requestedAt' | 'generatedAt' | 'name';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Query parameters for listing report templates.
 */
export interface ListReportTemplatesQuery {
  /** Filter by supported format */
  format?: ReportFormat;

  /** Filter by active status */
  isActive?: boolean;

  /** Page number for pagination (1-based) */
  page?: number;

  /** Number of items per page */
  limit?: number;
}
