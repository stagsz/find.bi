/**
 * @hazop/types - Shared TypeScript type definitions for HazOp Assistant
 *
 * This package contains all shared type definitions used across the
 * HazOp Assistant monorepo, including types for:
 * - User management and authentication
 * - Projects and project members
 * - P&ID documents and analysis nodes
 * - HazOps analysis and risk assessment
 * - Reports and compliance
 */

// User and authentication types
export type {
  UserRole,
  User,
  UserWithPassword,
  CreateUserPayload,
  UpdateUserPayload,
  UpdateUserRolePayload,
  UpdateUserStatusPayload,
} from './user.js';

export { USER_ROLES } from './user.js';

// Project types
export type {
  ProjectStatus,
  Project,
  ProjectWithCreator,
  ProjectMemberRole,
  ProjectMember,
  ProjectMemberWithUser,
  CreateProjectPayload,
  UpdateProjectPayload,
  AddProjectMemberPayload,
  UpdateProjectMemberRolePayload,
} from './project.js';

export { PROJECT_STATUSES, PROJECT_MEMBER_ROLES } from './project.js';

// P&ID Document types
export type {
  PIDDocumentStatus,
  PIDMimeType,
  PIDDocument,
  PIDDocumentWithUploader,
  PIDDocumentWithNodeCount,
  CreatePIDDocumentPayload,
  UpdatePIDDocumentPayload,
  UpdatePIDDocumentStatusPayload,
} from './pid-document.js';

export { PID_DOCUMENT_STATUSES, VALID_PID_MIME_TYPES } from './pid-document.js';

// Analysis Node types
export type {
  EquipmentType,
  AnalysisNode,
  AnalysisNodeWithCreator,
  AnalysisNodeWithAnalysisCount,
  CreateAnalysisNodePayload,
  UpdateAnalysisNodePayload,
} from './analysis-node.js';

export { EQUIPMENT_TYPES, EQUIPMENT_TYPE_LABELS } from './analysis-node.js';

// HazOps Analysis types
export type {
  GuideWord,
  SeverityLevel,
  LikelihoodLevel,
  DetectabilityLevel,
  RiskLevel,
  RiskLevelFilter,
  RiskRanking,
  AnalysisStatus,
  HazopsAnalysis,
  HazopsAnalysisWithDetails,
  HazopsAnalysisWithProgress,
  HazopsAnalysisWithDetailsAndProgress,
  AnalysisEntry,
  AnalysisEntryWithNode,
  AnalysisEntryWithCreator,
  CreateHazopsAnalysisPayload,
  UpdateHazopsAnalysisPayload,
  SubmitAnalysisForReviewPayload,
  ReviewAnalysisPayload,
  CreateAnalysisEntryPayload,
  UpdateAnalysisEntryPayload,
  UpdateRiskRankingPayload,
  // 5x5 Risk Matrix types
  RiskMatrixCell,
  RiskMatrixRow,
  RiskMatrix,
  // Risk Dashboard types (RISK-13)
  RiskDistribution,
  ScorePercentiles,
  RiskThresholdConfig,
  NodeRiskSummary,
  GuideWordRiskSummary,
  HighRiskEntry,
  ProjectHighRiskEntry,
  AnalysisRiskSummary,
  ProjectRiskDashboard,
} from './hazop-analysis.js';

export {
  GUIDE_WORDS,
  GUIDE_WORD_LABELS,
  GUIDE_WORD_DESCRIPTIONS,
  SEVERITY_LEVELS,
  SEVERITY_LABELS,
  SEVERITY_DESCRIPTIONS,
  LIKELIHOOD_LEVELS,
  LIKELIHOOD_LABELS,
  LIKELIHOOD_DESCRIPTIONS,
  DETECTABILITY_LEVELS,
  DETECTABILITY_LABELS,
  DETECTABILITY_DESCRIPTIONS,
  RISK_LEVELS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_FILTER_OPTIONS,
  RISK_LEVEL_FILTER_LABELS,
  RISK_THRESHOLDS,
  ANALYSIS_STATUSES,
  ANALYSIS_STATUS_LABELS,
  // 5x5 Risk Matrix constants
  RISK_MATRIX_THRESHOLDS,
  RISK_MATRIX_MAPPING,
} from './hazop-analysis.js';

// Report types
export type {
  ReportFormat,
  ReportStatus,
  ReportParameters,
  Report,
  ReportWithAnalysis,
  ReportWithGenerator,
  ReportWithDetails,
  ReportTemplate,
  ReportTemplateWithCreator,
  CreateReportPayload,
  ReportJobResponse,
  ReportStatusResponse,
  CreateReportTemplatePayload,
  UpdateReportTemplatePayload,
  ListReportsQuery,
  ListReportTemplatesQuery,
} from './report.js';

export {
  REPORT_FORMATS,
  REPORT_FORMAT_LABELS,
  REPORT_FORMAT_EXTENSIONS,
  REPORT_FORMAT_MIME_TYPES,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
} from './report.js';

// API request/response types
export type {
  HttpStatusCode,
  ApiErrorCode,
  FieldError,
  ApiError,
  ApiResponse,
  ApiErrorResponse,
  ApiResult,
  SortOrder,
  PaginationParams,
  PaginationMeta,
  PaginatedResponse,
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  TokenPair,
  AuthResponse,
  RefreshTokenResponse,
  JwtPayload,
  SearchParams,
  ListParams,
  AuthContext,
  RequestMeta,
  HealthStatus,
  ServiceHealth,
  HealthCheckResponse,
  WebSocketMessage,
  WebSocketError,
  FileUploadMeta,
  FileUploadResponse,
  SignedUrlResponse,
} from './api.js';

export {
  API_ERROR_CODES,
  PAGINATION_DEFAULTS,
  HEALTH_STATUSES,
} from './api.js';

// Prepared Answers types
export type {
  PreparedAnswerCategory,
  PreparedAnswer,
  PreparedAnswersResponse,
  PreparedAnswersFilteredResponse,
  PreparedAnswersQuery,
  PreparedAnswerTemplate,
} from './prepared-answers.js';

export {
  PREPARED_ANSWER_CATEGORIES,
  PREPARED_ANSWER_CATEGORY_LABELS,
} from './prepared-answers.js';

// LOPA (Layers of Protection Analysis) types
export type {
  SafetyIntegrityLevel,
  IPLType,
  IPL,
  IPLSummary,
  InitiatingEventCategory,
  TargetFrequencyCategory,
  LOPAStatus,
  LOPAGapStatus,
  LOPAAnalysis,
  LOPAAnalysisWithEntry,
  LOPAAnalysisSummary,
  LOPACalculationInput,
  LOPACalculationResult,
  LOPAValidationResult,
  LOPATriggerConfig,
  LOPATriggerResult,
  CreateLOPAAnalysisPayload,
  UpdateLOPAAnalysisPayload,
  AddIPLPayload,
} from './lopa.js';

export {
  SAFETY_INTEGRITY_LEVELS,
  SIL_LABELS,
  SIL_DESCRIPTIONS,
  SIL_PFD_RANGES,
  SIL_TYPICAL_PFD,
  IPL_TYPES,
  IPL_TYPE_LABELS,
  IPL_TYPE_DESCRIPTIONS,
  IPL_TYPICAL_PFD,
  INITIATING_EVENT_CATEGORIES,
  INITIATING_EVENT_CATEGORY_LABELS,
  TYPICAL_INITIATING_EVENT_FREQUENCIES,
  TARGET_FREQUENCY_CATEGORIES,
  TARGET_FREQUENCY_LABELS,
  TYPICAL_TARGET_FREQUENCIES,
  SEVERITY_TO_TARGET_FREQUENCY,
  LOPA_STATUSES,
  LOPA_STATUS_LABELS,
  LOPA_GAP_STATUSES,
  LOPA_GAP_STATUS_LABELS,
  LOPA_GAP_STATUS_COLORS,
  DEFAULT_LOPA_TRIGGER_CONFIG,
} from './lopa.js';
