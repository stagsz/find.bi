/**
 * File upload middleware for P&ID document handling.
 *
 * Uses multer for multipart form data processing with validation
 * for supported file types: PDF, PNG, JPG, and DWG.
 *
 * Usage:
 * ```ts
 * import { uploadPID, validatePIDUpload, handleMulterError } from './middleware/upload.middleware.js';
 *
 * // Single P&ID document upload
 * router.post('/documents',
 *   uploadPID.single('file'),
 *   handleMulterError,
 *   validatePIDUpload,
 *   controller.uploadDocument
 * );
 * ```
 */

import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { VALID_PID_MIME_TYPES } from '@hazop/types';

/**
 * File extension to MIME type mapping for P&ID documents.
 */
const EXTENSION_TO_MIME: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.dwg': ['application/acad', 'application/x-acad', 'application/dwg', 'image/vnd.dwg'],
};

/**
 * Valid file extensions for P&ID documents.
 */
export const VALID_EXTENSIONS = Object.keys(EXTENSION_TO_MIME);

/**
 * Maximum file size for P&ID uploads (50MB).
 * Large P&ID documents can be several megabytes.
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Check if a MIME type is valid for P&ID documents.
 *
 * @param mimeType - The MIME type to check
 * @returns True if the MIME type is valid
 */
export function isValidMimeType(mimeType: string): boolean {
  return VALID_PID_MIME_TYPES.includes(mimeType as typeof VALID_PID_MIME_TYPES[number]);
}

/**
 * Get the file extension from a filename.
 *
 * @param filename - The filename to extract extension from
 * @returns The lowercase file extension including the dot (e.g., '.pdf')
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return '';
  }
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if a file extension is valid for P&ID documents.
 *
 * @param extension - The file extension to check (including dot)
 * @returns True if the extension is valid
 */
export function isValidExtension(extension: string): boolean {
  return VALID_EXTENSIONS.includes(extension.toLowerCase());
}

/**
 * Validate that the MIME type matches the file extension.
 * Some browsers may not correctly identify DWG files, so this
 * provides a fallback validation based on extension.
 *
 * @param mimeType - The detected MIME type
 * @param extension - The file extension
 * @returns True if the combination is valid
 */
export function validateMimeTypeMatchesExtension(
  mimeType: string,
  extension: string
): boolean {
  const ext = extension.toLowerCase();
  const expectedMimes = EXTENSION_TO_MIME[ext];

  if (!expectedMimes) {
    return false;
  }

  // Accept if MIME type matches expected types for the extension
  if (expectedMimes.includes(mimeType)) {
    return true;
  }

  // DWG files may come with application/octet-stream from some browsers
  if (ext === '.dwg' && mimeType === 'application/octet-stream') {
    return true;
  }

  return false;
}

/**
 * Multer file filter for P&ID documents.
 * Validates both MIME type and file extension.
 */
const pidFileFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  const extension = getFileExtension(file.originalname);

  // Check extension first
  if (!isValidExtension(extension)) {
    callback(
      new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname)
    );
    return;
  }

  // Check MIME type matches extension (with DWG fallback)
  if (!validateMimeTypeMatchesExtension(file.mimetype, extension)) {
    callback(
      new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname)
    );
    return;
  }

  callback(null, true);
};

/**
 * Multer memory storage configuration.
 * Files are stored in memory buffer for streaming to MinIO.
 */
const memoryStorage = multer.memoryStorage();

/**
 * Configured multer instance for P&ID document uploads.
 *
 * Features:
 * - Memory storage (for streaming to MinIO)
 * - 50MB file size limit
 * - File type validation (PDF, PNG, JPG, DWG)
 */
export const uploadPID = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: pidFileFilter,
});

/**
 * Error messages for multer errors.
 */
const MULTER_ERROR_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: `File size exceeds the maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
  LIMIT_FILE_COUNT: 'Only one file can be uploaded at a time',
  LIMIT_FIELD_KEY: 'Field name is too long',
  LIMIT_FIELD_VALUE: 'Field value is too long',
  LIMIT_FIELD_COUNT: 'Too many fields',
  LIMIT_UNEXPECTED_FILE: `Invalid file type. Supported formats: PDF, PNG, JPG, DWG`,
  LIMIT_PART_COUNT: 'Too many parts',
};

/**
 * Middleware to handle multer errors with user-friendly messages.
 *
 * @param err - The error object (may be MulterError or generic Error)
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function handleMulterError(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    const message = MULTER_ERROR_MESSAGES[err.code] || 'File upload error';
    res.status(400).json({
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message,
        details: {
          field: err.field,
          type: err.code,
        },
      },
    });
    return;
  }

  // Pass other errors to the next error handler
  next(err);
}

/**
 * Middleware to validate that a file was uploaded.
 * Should be used after multer.single() middleware.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function validatePIDUpload(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: {
        code: 'FILE_REQUIRED',
        message: 'A file is required for this request',
      },
    });
    return;
  }

  // Attach normalized file info to request for downstream handlers
  const extension = getFileExtension(req.file.originalname);

  // Normalize MIME type for DWG files that came as octet-stream
  let normalizedMimeType = req.file.mimetype;
  if (extension === '.dwg' && req.file.mimetype === 'application/octet-stream') {
    normalizedMimeType = 'application/acad';
  }

  // Store normalized data on request for later use
  req.body._uploadMeta = {
    originalFilename: req.file.originalname,
    mimeType: normalizedMimeType,
    fileSize: req.file.size,
    extension: extension,
  };

  next();
}

/**
 * Get the file buffer from the uploaded file.
 * Helper function for use in controllers.
 *
 * @param req - Express request with uploaded file
 * @returns The file buffer or null if no file
 */
export function getUploadedFileBuffer(req: Request): Buffer | null {
  return req.file?.buffer ?? null;
}

/**
 * Get upload metadata from the request.
 * Available after validatePIDUpload middleware.
 *
 * @param req - Express request object
 * @returns Upload metadata or undefined
 */
export function getUploadMeta(
  req: Request
): { originalFilename: string; mimeType: string; fileSize: number; extension: string } | undefined {
  return req.body?._uploadMeta;
}
