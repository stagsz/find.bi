/**
 * File storage service for MinIO/S3 operations.
 *
 * Provides file upload, retrieval, deletion, and signed URL generation
 * for P&ID documents stored in MinIO (S3-compatible storage).
 */

import { Readable } from 'stream';
import { getMinIOClient, getBucketName, ensureBucket } from '../config/minio.config.js';
import { randomUUID } from 'crypto';

/**
 * Result from uploading a file to storage.
 */
export interface UploadResult {
  /** Storage path/key where the file was saved */
  storagePath: string;
  /** ETag returned by MinIO for verification */
  etag: string;
}

/**
 * Result from retrieving a file from storage.
 */
export interface RetrieveResult {
  /** Readable stream of file content */
  stream: Readable;
  /** File size in bytes */
  size: number;
  /** Content type (MIME type) */
  contentType: string;
  /** Last modified date */
  lastModified: Date;
}

/**
 * Options for generating a signed URL.
 */
export interface SignedUrlOptions {
  /** URL expiration time in seconds (default: 3600 = 1 hour) */
  expiresIn?: number;
  /** Content-Disposition header for downloads (e.g., 'attachment; filename="document.pdf"') */
  contentDisposition?: string;
}

/**
 * Default signed URL expiration time: 1 hour (3600 seconds).
 */
const DEFAULT_SIGNED_URL_EXPIRY = 3600;

/**
 * Maximum signed URL expiration time: 7 days (604800 seconds).
 * MinIO limitation.
 */
const MAX_SIGNED_URL_EXPIRY = 604800;

/**
 * Generate a unique storage path for a file.
 * Format: {projectId}/{uuid}.{extension}
 *
 * @param projectId - The project ID to namespace the file
 * @param originalFilename - The original filename to extract extension
 * @returns A unique storage path
 */
export function generateStoragePath(projectId: string, originalFilename: string): string {
  const uuid = randomUUID();
  const lastDot = originalFilename.lastIndexOf('.');
  const extension = lastDot !== -1 ? originalFilename.slice(lastDot + 1).toLowerCase() : '';

  if (extension) {
    return `${projectId}/${uuid}.${extension}`;
  }
  return `${projectId}/${uuid}`;
}

/**
 * Upload a file buffer to MinIO storage.
 *
 * @param buffer - The file content as a Buffer
 * @param storagePath - The storage path/key for the file
 * @param mimeType - The MIME type of the file
 * @returns Upload result with storage path and etag
 * @throws Error if upload fails
 */
export async function uploadFile(
  buffer: Buffer,
  storagePath: string,
  mimeType: string
): Promise<UploadResult> {
  const client = getMinIOClient();
  const bucketName = getBucketName();

  // Ensure bucket exists before upload
  await ensureBucket();

  // Upload the file
  const result = await client.putObject(bucketName, storagePath, buffer, buffer.length, {
    'Content-Type': mimeType,
  });

  return {
    storagePath,
    etag: result.etag,
  };
}

/**
 * Retrieve a file from MinIO storage.
 *
 * @param storagePath - The storage path/key of the file
 * @returns Retrieve result with stream, size, content type, and last modified date
 * @throws Error if file not found or retrieval fails
 */
export async function retrieveFile(storagePath: string): Promise<RetrieveResult> {
  const client = getMinIOClient();
  const bucketName = getBucketName();

  // Get file metadata first
  const stat = await client.statObject(bucketName, storagePath);

  // Get the file stream
  const stream = await client.getObject(bucketName, storagePath);

  return {
    stream,
    size: stat.size,
    contentType: stat.metaData?.['content-type'] ?? 'application/octet-stream',
    lastModified: stat.lastModified,
  };
}

/**
 * Check if a file exists in MinIO storage.
 *
 * @param storagePath - The storage path/key of the file
 * @returns True if file exists, false otherwise
 */
export async function fileExists(storagePath: string): Promise<boolean> {
  const client = getMinIOClient();
  const bucketName = getBucketName();

  try {
    await client.statObject(bucketName, storagePath);
    return true;
  } catch (error) {
    // MinIO throws an error with code 'NotFound' when object doesn't exist
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'NotFound') {
      return false;
    }
    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * Delete a file from MinIO storage.
 *
 * @param storagePath - The storage path/key of the file
 * @throws Error if deletion fails (note: deleting non-existent file does not throw)
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const client = getMinIOClient();
  const bucketName = getBucketName();

  await client.removeObject(bucketName, storagePath);
}

/**
 * Generate a signed URL for secure, time-limited file access.
 *
 * Signed URLs allow clients to download files directly from MinIO
 * without needing API credentials. The URL expires after the specified
 * time period.
 *
 * @param storagePath - The storage path/key of the file
 * @param options - Options for URL generation (expiration, content disposition)
 * @returns The signed URL for file access
 * @throws Error if URL generation fails
 */
export async function getSignedUrl(
  storagePath: string,
  options?: SignedUrlOptions
): Promise<string> {
  const client = getMinIOClient();
  const bucketName = getBucketName();

  // Validate and set expiration time
  let expiresIn = options?.expiresIn ?? DEFAULT_SIGNED_URL_EXPIRY;
  if (expiresIn < 1) {
    expiresIn = 1;
  }
  if (expiresIn > MAX_SIGNED_URL_EXPIRY) {
    expiresIn = MAX_SIGNED_URL_EXPIRY;
  }

  // Build response headers for the signed URL
  const reqParams: Record<string, string> = {};
  if (options?.contentDisposition) {
    reqParams['response-content-disposition'] = options.contentDisposition;
  }

  // Generate the presigned URL
  const url = await client.presignedGetObject(bucketName, storagePath, expiresIn, reqParams);

  return url;
}

/**
 * Generate a signed URL for file download with filename in Content-Disposition.
 *
 * This is a convenience method that sets the Content-Disposition header
 * to trigger a browser download with the specified filename.
 *
 * @param storagePath - The storage path/key of the file
 * @param filename - The filename to use for the download
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns The signed download URL
 * @throws Error if URL generation fails
 */
export async function getSignedDownloadUrl(
  storagePath: string,
  filename: string,
  expiresIn?: number
): Promise<string> {
  // Sanitize filename for Content-Disposition header
  // RFC 5987 encoding for non-ASCII characters
  const sanitizedFilename = filename.replace(/["\r\n]/g, '_');
  const encodedFilename = encodeURIComponent(filename);

  // Use both filename and filename* for maximum compatibility
  const contentDisposition =
    `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`;

  return getSignedUrl(storagePath, {
    expiresIn,
    contentDisposition,
  });
}

/**
 * Generate a signed URL for inline viewing (e.g., images, PDFs in browser).
 *
 * This sets the Content-Disposition to inline, which suggests the browser
 * display the file instead of downloading it.
 *
 * @param storagePath - The storage path/key of the file
 * @param filename - The filename to use if the user saves the file
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns The signed view URL
 * @throws Error if URL generation fails
 */
export async function getSignedViewUrl(
  storagePath: string,
  filename: string,
  expiresIn?: number
): Promise<string> {
  const sanitizedFilename = filename.replace(/["\r\n]/g, '_');
  const encodedFilename = encodeURIComponent(filename);

  const contentDisposition =
    `inline; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`;

  return getSignedUrl(storagePath, {
    expiresIn,
    contentDisposition,
  });
}
