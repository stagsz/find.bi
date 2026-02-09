/**
 * API request/response type definitions for HazOp Assistant.
 *
 * These types define the standard API contract used across all endpoints,
 * including:
 * - Standard response wrappers (success/error)
 * - Pagination request/response types
 * - Authentication request/response types
 * - Common query parameters
 * - Error handling types
 *
 * All API endpoints follow RESTful conventions and use these standardized
 * types to ensure consistency across the application.
 */

import type { User, UserRole } from './user.js';

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * Common HTTP status codes used in API responses.
 */
export type HttpStatusCode =
  | 200 // OK
  | 201 // Created
  | 204 // No Content
  | 400 // Bad Request
  | 401 // Unauthorized
  | 403 // Forbidden
  | 404 // Not Found
  | 409 // Conflict
  | 422 // Unprocessable Entity
  | 429 // Too Many Requests
  | 500 // Internal Server Error
  | 503; // Service Unavailable

// ============================================================================
// API Error Types
// ============================================================================

/**
 * Error codes for categorizing API errors.
 * Used for programmatic error handling on the client side.
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

/**
 * All API error codes as a constant array.
 * Useful for validation and iteration.
 */
export const API_ERROR_CODES: readonly ApiErrorCode[] = [
  'VALIDATION_ERROR',
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const;

/**
 * Validation error for a specific field.
 */
export interface FieldError {
  /** The field that has the error */
  field: string;

  /** Human-readable error message */
  message: string;

  /** Machine-readable error code for the field */
  code?: string;
}

/**
 * Standard API error response structure.
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: ApiErrorCode;

  /** Human-readable error message */
  message: string;

  /** Field-level validation errors (for VALIDATION_ERROR) */
  errors?: FieldError[];

  /** Request ID for support/debugging purposes */
  requestId?: string;
}

// ============================================================================
// API Response Wrappers
// ============================================================================

/**
 * Standard success response wrapper.
 * All successful API responses follow this structure.
 */
export interface ApiResponse<T> {
  /** Whether the request was successful */
  success: true;

  /** The response data */
  data: T;

  /** Optional metadata (e.g., pagination info) */
  meta?: Record<string, unknown>;
}

/**
 * Standard error response wrapper.
 * All error responses follow this structure.
 */
export interface ApiErrorResponse {
  /** Whether the request was successful */
  success: false;

  /** Error details */
  error: ApiError;
}

/**
 * Union type for all API responses.
 */
export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Sort direction for paginated queries.
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Standard pagination query parameters.
 * Used in GET requests for listing resources.
 */
export interface PaginationParams {
  /** Page number (1-based). Defaults to 1. */
  page?: number;

  /** Number of items per page. Defaults to 20. */
  limit?: number;

  /** Field to sort by (resource-specific) */
  sortBy?: string;

  /** Sort direction. Defaults to 'desc'. */
  sortOrder?: SortOrder;
}

/**
 * Default pagination values.
 */
export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100,
  sortOrder: 'desc' as SortOrder,
} as const;

/**
 * Pagination metadata included in list responses.
 */
export interface PaginationMeta {
  /** Current page number (1-based) */
  page: number;

  /** Number of items per page */
  limit: number;

  /** Total number of items across all pages */
  total: number;

  /** Total number of pages */
  totalPages: number;

  /** Whether there is a next page */
  hasNextPage: boolean;

  /** Whether there is a previous page */
  hasPrevPage: boolean;
}

/**
 * Paginated response wrapper.
 * Used for all list endpoints.
 */
export interface PaginatedResponse<T> {
  /** Whether the request was successful */
  success: true;

  /** Array of items for the current page */
  data: T[];

  /** Pagination metadata */
  meta: PaginationMeta;
}

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * Payload for user login request.
 * POST /auth/login
 */
export interface LoginRequest {
  /** User's email address */
  email: string;

  /** User's password */
  password: string;

  /** Whether to remember the user (extends token expiry) */
  rememberMe?: boolean;
}

/**
 * Payload for user registration request.
 * POST /auth/register
 */
export interface RegisterRequest {
  /** User's email address */
  email: string;

  /** User's password */
  password: string;

  /** User's display name */
  name: string;

  /** User's organization */
  organization: string;

  /** Requested role (may require admin approval) */
  role?: UserRole;
}

/**
 * Payload for token refresh request.
 * POST /auth/refresh
 */
export interface RefreshTokenRequest {
  /** The refresh token */
  refreshToken: string;
}

/**
 * Payload for password reset request.
 * POST /auth/forgot-password
 */
export interface ForgotPasswordRequest {
  /** User's email address */
  email: string;
}

/**
 * Payload for password reset confirmation.
 * POST /auth/reset-password
 */
export interface ResetPasswordRequest {
  /** Password reset token from email */
  token: string;

  /** New password */
  newPassword: string;
}

/**
 * Payload for password change (authenticated user).
 * POST /auth/change-password
 */
export interface ChangePasswordRequest {
  /** Current password for verification */
  currentPassword: string;

  /** New password */
  newPassword: string;
}

/**
 * JWT token pair returned on successful authentication.
 */
export interface TokenPair {
  /** Short-lived access token for API requests */
  accessToken: string;

  /** Long-lived refresh token for obtaining new access tokens */
  refreshToken: string;

  /** Access token expiry time in seconds */
  expiresIn: number;

  /** Token type (always 'Bearer') */
  tokenType: 'Bearer';
}

/**
 * Response for successful login/registration.
 */
export interface AuthResponse {
  /** The authenticated user */
  user: User;

  /** JWT tokens */
  tokens: TokenPair;
}

/**
 * Response for token refresh.
 */
export interface RefreshTokenResponse {
  /** New access token */
  accessToken: string;

  /** Access token expiry time in seconds */
  expiresIn: number;

  /** Token type (always 'Bearer') */
  tokenType: 'Bearer';
}

/**
 * Decoded JWT payload structure.
 */
export interface JwtPayload {
  /** User ID (subject) */
  sub: string;

  /** User email */
  email: string;

  /** User role */
  role: UserRole;

  /** Token issued at timestamp */
  iat: number;

  /** Token expiry timestamp */
  exp: number;

  /** Token type ('access' or 'refresh') */
  type: 'access' | 'refresh';
}

// ============================================================================
// Common Query Parameters
// ============================================================================

/**
 * Common search/filter parameters.
 */
export interface SearchParams {
  /** Search query string */
  q?: string;

  /** Date range start (ISO 8601) */
  from?: string;

  /** Date range end (ISO 8601) */
  to?: string;
}

/**
 * Combined pagination and search parameters.
 */
export interface ListParams extends PaginationParams, SearchParams {}

// ============================================================================
// Request Context Types
// ============================================================================

/**
 * Authenticated request context.
 * Available in request handlers after authentication middleware.
 */
export interface AuthContext {
  /** Authenticated user ID */
  userId: string;

  /** User's email */
  email: string;

  /** User's role */
  role: UserRole;
}

/**
 * Request metadata for logging and tracing.
 */
export interface RequestMeta {
  /** Unique request ID */
  requestId: string;

  /** Request timestamp (ISO 8601) */
  timestamp: string;

  /** Client IP address */
  clientIp?: string;

  /** User agent string */
  userAgent?: string;
}

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Service health status.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * All health statuses as a constant array.
 */
export const HEALTH_STATUSES: readonly HealthStatus[] = [
  'healthy',
  'degraded',
  'unhealthy',
] as const;

/**
 * Individual service health check result.
 */
export interface ServiceHealth {
  /** Service name */
  name: string;

  /** Current status */
  status: HealthStatus;

  /** Response time in milliseconds */
  responseTime?: number;

  /** Optional status message */
  message?: string;
}

/**
 * Overall health check response.
 * GET /health
 */
export interface HealthCheckResponse {
  /** Overall system status */
  status: HealthStatus;

  /** Application version */
  version: string;

  /** Server timestamp (ISO 8601) */
  timestamp: string;

  /** Individual service health checks */
  services: ServiceHealth[];

  /** System uptime in seconds */
  uptime: number;
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

/**
 * Base WebSocket message structure.
 */
export interface WebSocketMessage<T = unknown> {
  /** Event type/name */
  event: string;

  /** Message payload */
  payload: T;

  /** Timestamp (ISO 8601) */
  timestamp: string;
}

/**
 * WebSocket error message.
 */
export interface WebSocketError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;
}

// ============================================================================
// File Upload Types
// ============================================================================

/**
 * File upload metadata.
 */
export interface FileUploadMeta {
  /** Original filename */
  filename: string;

  /** MIME type */
  mimeType: string;

  /** File size in bytes */
  size: number;
}

/**
 * Response for successful file upload.
 */
export interface FileUploadResponse {
  /** Unique file ID */
  fileId: string;

  /** Storage path/key */
  path: string;

  /** Public URL (if applicable) */
  url?: string;

  /** File metadata */
  meta: FileUploadMeta;
}

/**
 * Signed URL for file download.
 */
export interface SignedUrlResponse {
  /** The signed URL */
  url: string;

  /** URL expiry timestamp (ISO 8601) */
  expiresAt: string;
}
