/**
 * Middleware exports for the HazOp API.
 */

export {
  authenticate,
  requireAuth,
  isAuthenticated,
  getAuthUser,
  getAuthUserId,
} from './auth.middleware.js';

export {
  requireRole,
  requireAnyRole,
  requireMinimumRole,
  hasRole,
  hasAnyRole,
  hasMinimumRole,
  isAdmin,
} from './rbac.middleware.js';

export {
  uploadPID,
  handleMulterError,
  validatePIDUpload,
  getUploadedFileBuffer,
  getUploadMeta,
  isValidMimeType,
  isValidExtension,
  getFileExtension,
  validateMimeTypeMatchesExtension,
  VALID_EXTENSIONS,
  MAX_FILE_SIZE,
} from './upload.middleware.js';
