/**
 * Unit tests for file storage service with MinIO operations.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Readable } from 'stream';

// Create mock functions with explicit types
const mockPutObject = jest.fn<() => Promise<{ etag: string }>>();
const mockGetObject = jest.fn<() => Promise<Readable>>();
const mockStatObject = jest.fn<() => Promise<{ size: number; metaData?: Record<string, string>; lastModified: Date }>>();
const mockRemoveObject = jest.fn<() => Promise<void>>();
const mockPresignedGetObject = jest.fn<() => Promise<string>>();

const mockGetMinIOClient = jest.fn(() => ({
  putObject: mockPutObject,
  getObject: mockGetObject,
  statObject: mockStatObject,
  removeObject: mockRemoveObject,
  presignedGetObject: mockPresignedGetObject,
}));

const mockGetBucketName = jest.fn(() => 'test-bucket');
const mockEnsureBucket = jest.fn<() => Promise<void>>(() => Promise.resolve());

// Mock the minio config module before importing the service
jest.unstable_mockModule('../config/minio.config.js', () => ({
  getMinIOClient: mockGetMinIOClient,
  getBucketName: mockGetBucketName,
  ensureBucket: mockEnsureBucket,
}));

// Import the module under test
const {
  generateStoragePath,
  uploadFile,
  retrieveFile,
  fileExists,
  deleteFile,
  getSignedUrl,
  getSignedDownloadUrl,
  getSignedViewUrl,
} = await import('./storage.service.js');

describe('Storage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBucketName.mockReturnValue('test-bucket');
    mockEnsureBucket.mockResolvedValue(undefined);
  });

  describe('generateStoragePath', () => {
    it('should generate path with project ID and UUID', () => {
      const projectId = 'proj-123';
      const filename = 'document.pdf';

      const path = generateStoragePath(projectId, filename);

      expect(path).toMatch(/^proj-123\/[0-9a-f-]+\.pdf$/);
    });

    it('should preserve file extension', () => {
      const path = generateStoragePath('project-1', 'diagram.dwg');
      expect(path.endsWith('.dwg')).toBe(true);
    });

    it('should handle files without extension', () => {
      const path = generateStoragePath('project-1', 'README');
      expect(path).toMatch(/^project-1\/[0-9a-f-]+$/);
      expect(path.includes('.')).toBe(false);
    });

    it('should lowercase the extension', () => {
      const path = generateStoragePath('project-1', 'document.PDF');
      expect(path.endsWith('.pdf')).toBe(true);
    });

    it('should generate unique paths for same filename', () => {
      const path1 = generateStoragePath('project-1', 'file.pdf');
      const path2 = generateStoragePath('project-1', 'file.pdf');
      expect(path1).not.toBe(path2);
    });
  });

  describe('uploadFile', () => {
    it('should upload file to MinIO', async () => {
      const buffer = Buffer.from('test content');
      const storagePath = 'project-1/test-file.pdf';
      const mimeType = 'application/pdf';

      mockPutObject.mockResolvedValue({ etag: 'abc123' });

      const result = await uploadFile(buffer, storagePath, mimeType);

      expect(mockEnsureBucket).toHaveBeenCalled();
      expect(mockPutObject).toHaveBeenCalledWith(
        'test-bucket',
        storagePath,
        buffer,
        buffer.length,
        { 'Content-Type': mimeType }
      );
      expect(result).toEqual({
        storagePath,
        etag: 'abc123',
      });
    });

    it('should throw error if upload fails', async () => {
      mockPutObject.mockRejectedValue(new Error('Upload failed'));

      await expect(
        uploadFile(Buffer.from('test'), 'path/file.pdf', 'application/pdf')
      ).rejects.toThrow('Upload failed');
    });
  });

  describe('retrieveFile', () => {
    it('should retrieve file from MinIO', async () => {
      const mockStream = new Readable({
        read() {
          this.push('test content');
          this.push(null);
        },
      });

      mockStatObject.mockResolvedValue({
        size: 12,
        metaData: { 'content-type': 'application/pdf' },
        lastModified: new Date('2024-01-01'),
      });
      mockGetObject.mockResolvedValue(mockStream);

      const result = await retrieveFile('project-1/file.pdf');

      expect(mockStatObject).toHaveBeenCalledWith('test-bucket', 'project-1/file.pdf');
      expect(mockGetObject).toHaveBeenCalledWith('test-bucket', 'project-1/file.pdf');
      expect(result.size).toBe(12);
      expect(result.contentType).toBe('application/pdf');
      expect(result.lastModified).toEqual(new Date('2024-01-01'));
    });

    it('should use default content type if not in metadata', async () => {
      mockStatObject.mockResolvedValue({
        size: 100,
        metaData: {},
        lastModified: new Date(),
      });
      mockGetObject.mockResolvedValue(new Readable());

      const result = await retrieveFile('project-1/file');

      expect(result.contentType).toBe('application/octet-stream');
    });

    it('should throw error if file not found', async () => {
      mockStatObject.mockRejectedValue(new Error('Not found'));

      await expect(retrieveFile('nonexistent/file.pdf')).rejects.toThrow('Not found');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      mockStatObject.mockResolvedValue({ size: 100, lastModified: new Date() });

      const exists = await fileExists('project-1/file.pdf');

      expect(exists).toBe(true);
    });

    it('should return false if file not found', async () => {
      const notFoundError = new Error('Not found') as NodeJS.ErrnoException;
      notFoundError.code = 'NotFound';
      mockStatObject.mockRejectedValue(notFoundError);

      const exists = await fileExists('nonexistent/file.pdf');

      expect(exists).toBe(false);
    });

    it('should rethrow unexpected errors', async () => {
      mockStatObject.mockRejectedValue(new Error('Connection error'));

      await expect(fileExists('project-1/file.pdf')).rejects.toThrow('Connection error');
    });
  });

  describe('deleteFile', () => {
    it('should delete file from MinIO', async () => {
      mockRemoveObject.mockResolvedValue(undefined);

      await deleteFile('project-1/file.pdf');

      expect(mockRemoveObject).toHaveBeenCalledWith('test-bucket', 'project-1/file.pdf');
    });

    it('should throw error if deletion fails', async () => {
      mockRemoveObject.mockRejectedValue(new Error('Deletion failed'));

      await expect(deleteFile('project-1/file.pdf')).rejects.toThrow('Deletion failed');
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed URL with default expiry', async () => {
      mockPresignedGetObject.mockResolvedValue('https://minio.example.com/signed-url');

      const url = await getSignedUrl('project-1/file.pdf');

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'project-1/file.pdf',
        3600, // default 1 hour
        {}
      );
      expect(url).toBe('https://minio.example.com/signed-url');
    });

    it('should respect custom expiry time', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/url');

      await getSignedUrl('project-1/file.pdf', { expiresIn: 300 });

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'project-1/file.pdf',
        300,
        {}
      );
    });

    it('should clamp expiry to minimum of 1 second', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/url');

      await getSignedUrl('project-1/file.pdf', { expiresIn: 0 });

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'project-1/file.pdf',
        1,
        {}
      );
    });

    it('should clamp expiry to maximum of 7 days', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/url');

      await getSignedUrl('project-1/file.pdf', { expiresIn: 1000000 });

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'project-1/file.pdf',
        604800, // 7 days
        {}
      );
    });

    it('should include content disposition if provided', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/url');

      await getSignedUrl('project-1/file.pdf', {
        contentDisposition: 'attachment; filename="test.pdf"',
      });

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'project-1/file.pdf',
        3600,
        { 'response-content-disposition': 'attachment; filename="test.pdf"' }
      );
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('should generate download URL with Content-Disposition attachment', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/url');

      await getSignedDownloadUrl('project-1/file.pdf', 'my-document.pdf');

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'project-1/file.pdf',
        3600,
        expect.objectContaining({
          'response-content-disposition': expect.stringContaining('attachment'),
        })
      );
    });

    it('should sanitize filename in Content-Disposition', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/url');

      await getSignedDownloadUrl('project-1/file.pdf', 'file"with\rspecial\nchars.pdf');

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'project-1/file.pdf',
        3600,
        expect.objectContaining({
          'response-content-disposition': expect.stringContaining('file_with_special_chars.pdf'),
        })
      );
    });

    it('should support custom expiry time', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/url');

      await getSignedDownloadUrl('project-1/file.pdf', 'doc.pdf', 7200);

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'project-1/file.pdf',
        7200,
        expect.any(Object)
      );
    });
  });

  describe('getSignedViewUrl', () => {
    it('should generate view URL with Content-Disposition inline', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/url');

      await getSignedViewUrl('project-1/file.pdf', 'document.pdf');

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'project-1/file.pdf',
        3600,
        expect.objectContaining({
          'response-content-disposition': expect.stringContaining('inline'),
        })
      );
    });

    it('should include filename for saving', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/url');

      await getSignedViewUrl('project-1/file.pdf', 'document.pdf');

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'project-1/file.pdf',
        3600,
        expect.objectContaining({
          'response-content-disposition': expect.stringContaining('document.pdf'),
        })
      );
    });
  });
});
