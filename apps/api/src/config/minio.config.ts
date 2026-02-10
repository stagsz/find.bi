/**
 * MinIO configuration for S3-compatible object storage.
 *
 * Uses the 'minio' library for storing P&ID documents.
 * Configured via environment variables.
 */

import * as Minio from 'minio';

/**
 * MinIO configuration loaded from environment variables.
 */
export interface MinIOConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

/**
 * Load MinIO configuration from environment variables.
 */
export function loadMinIOConfig(): MinIOConfig {
  return {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
    secretKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'hazop-documents',
  };
}

/**
 * MinIO client instance.
 * Singleton instance for application-wide use.
 */
let client: Minio.Client | null = null;

/**
 * Get or create the MinIO client instance.
 */
export function getMinIOClient(): Minio.Client {
  if (!client) {
    const config = loadMinIOConfig();
    client = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
  }

  return client;
}

/**
 * Get the configured bucket name.
 */
export function getBucketName(): string {
  return loadMinIOConfig().bucket;
}

/**
 * Ensure the configured bucket exists.
 * Creates the bucket if it doesn't exist.
 */
export async function ensureBucket(): Promise<void> {
  const minioClient = getMinIOClient();
  const bucketName = getBucketName();

  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName);
      console.log(`MinIO bucket '${bucketName}' created`);
    }
  } catch (error) {
    console.error('Failed to ensure MinIO bucket exists:', error);
    throw error;
  }
}

/**
 * Test the MinIO connection.
 * Returns true if connection is successful.
 */
export async function testMinIOConnection(): Promise<boolean> {
  try {
    const minioClient = getMinIOClient();
    // List buckets as a connection test
    await minioClient.listBuckets();
    return true;
  } catch (error) {
    console.error('MinIO connection test failed:', error);
    return false;
  }
}

/**
 * Reset the MinIO client instance.
 * Useful for testing or reconnection scenarios.
 */
export function resetMinIOClient(): void {
  client = null;
}
