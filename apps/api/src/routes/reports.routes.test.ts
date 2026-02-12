/**
 * API integration tests for report endpoints.
 *
 * Tests the full API flow through routes with mocked database services.
 * All report endpoints require authentication.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import type { UserRole, ReportFormat, ReportStatus, ReportParameters } from '@hazop/types';

// Service result types for testing
interface ReportWithDetails {
  id: string;
  hazopAnalysisId: string;
  name: string;
  format: ReportFormat;
  templateUsed: string;
  status: ReportStatus;
  filePath: string | null;
  fileSize: number | null;
  generatedById: string;
  requestedAt: Date;
  generatedAt: Date | null;
  parameters: ReportParameters;
  errorMessage: string | null;
  analysisName: string;
  projectName: string;
  projectId: string;
  generatedByName: string;
  generatedByEmail: string;
}

interface Report {
  id: string;
  hazopAnalysisId: string;
  name: string;
  format: ReportFormat;
  templateUsed: string;
  status: ReportStatus;
  filePath: string | null;
  fileSize: number | null;
  generatedById: string;
  requestedAt: Date;
  generatedAt: Date | null;
  parameters: ReportParameters;
  errorMessage: string | null;
}

// Mock implementations - must be declared before jest.unstable_mockModule
let mockFindReportByIdWithDetails: jest.Mock<() => Promise<ReportWithDetails | null>>;
let mockUserHasProjectAccess: jest.Mock<() => Promise<boolean>>;
let mockFindProjectById: jest.Mock<() => Promise<{ id: string; name: string } | null>>;
let mockGetSignedUrl: jest.Mock<() => Promise<string>>;
let mockGetSignedDownloadUrl: jest.Mock<() => Promise<string>>;

// Current authenticated user for tests
let mockCurrentUser: { id: string; email: string; role: UserRole; organization: string } | null =
  null;

// Set up mocks before importing modules that depend on them

// Mock report-queue.service to avoid RabbitMQ connection
jest.unstable_mockModule('../services/report-queue.service.js', () => {
  const mockEnqueue = jest.fn<() => Promise<void>>();
  mockEnqueue.mockResolvedValue(undefined);
  const mockConsume = jest.fn<() => Promise<void>>();
  mockConsume.mockResolvedValue(undefined);
  const mockClose = jest.fn<() => Promise<void>>();
  mockClose.mockResolvedValue(undefined);

  return {
    getReportQueueService: jest.fn(() => ({
      enqueue: mockEnqueue,
      consume: mockConsume,
      ack: jest.fn(),
      nack: jest.fn(),
      close: mockClose,
    })),
    createReportJobMessage: jest.fn((input: Record<string, unknown>) => ({
      ...input,
      messageId: 'test-message-id',
    })),
  };
});

// Mock report-template.service
jest.unstable_mockModule('../services/report-template.service.js', () => {
  const mockTemplateIsActive = jest.fn<() => Promise<boolean>>();
  mockTemplateIsActive.mockResolvedValue(true);
  const mockTemplateSupportsFormat = jest.fn<() => Promise<boolean>>();
  mockTemplateSupportsFormat.mockResolvedValue(true);
  const mockListTemplates = jest.fn<() => Promise<{ templates: unknown[]; total: number }>>();
  mockListTemplates.mockResolvedValue({ templates: [], total: 0 });

  return {
    templateIsActive: mockTemplateIsActive,
    templateSupportsFormat: mockTemplateSupportsFormat,
    listTemplates: mockListTemplates,
  };
});

// Mock hazop-analysis.service
jest.unstable_mockModule('../services/hazop-analysis.service.js', () => {
  const mockFindAnalysisById = jest.fn<() => Promise<null>>();
  mockFindAnalysisById.mockResolvedValue(null);

  return {
    findAnalysisById: mockFindAnalysisById,
  };
});

jest.unstable_mockModule('../services/reports.service.js', () => {
  mockFindReportByIdWithDetails = jest.fn<() => Promise<ReportWithDetails | null>>();

  return {
    findReportByIdWithDetails: mockFindReportByIdWithDetails,
    createReport: jest.fn(),
    listProjectReports: jest.fn(),
    getProjectIdForAnalysis: jest.fn(),
    analysisExists: jest.fn(),
  };
});

jest.unstable_mockModule('../services/project.service.js', () => {
  mockUserHasProjectAccess = jest.fn<() => Promise<boolean>>();
  mockFindProjectById = jest.fn<() => Promise<{ id: string; name: string } | null>>();

  return {
    userHasProjectAccess: mockUserHasProjectAccess,
    findProjectById: mockFindProjectById,
  };
});

jest.unstable_mockModule('../services/storage.service.js', () => {
  mockGetSignedUrl = jest.fn<() => Promise<string>>();
  mockGetSignedDownloadUrl = jest.fn<() => Promise<string>>();

  return {
    getSignedUrl: mockGetSignedUrl,
    getSignedDownloadUrl: mockGetSignedDownloadUrl,
  };
});

// Mock the auth middleware to allow testing without actual JWT
jest.unstable_mockModule('../middleware/auth.middleware.js', () => ({
  authenticate: (_req: Request, _res: Response, next: NextFunction) => {
    if (mockCurrentUser) {
      (_req as Request & { user?: typeof mockCurrentUser }).user = mockCurrentUser;
    }
    next();
  },
  requireAuth: (_req: Request, res: Response, next: NextFunction) => {
    if (!mockCurrentUser) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }
    next();
  },
}));

// Import routes after setting up mocks
const { default: reportRoutes } = await import('./reports.routes.js');

/**
 * Create a mock report with details for testing.
 */
function createMockReportWithDetails(overrides?: Partial<ReportWithDetails>): ReportWithDetails {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    hazopAnalysisId: '660e8400-e29b-41d4-a716-446655440001',
    name: 'Test Report',
    format: 'pdf',
    templateUsed: 'standard',
    status: 'completed',
    filePath: 'reports/test-report.pdf',
    fileSize: 12345,
    generatedById: '770e8400-e29b-41d4-a716-446655440002',
    requestedAt: new Date('2026-02-01T00:00:00Z'),
    generatedAt: new Date('2026-02-01T00:05:00Z'),
    parameters: {},
    errorMessage: null,
    analysisName: 'Test Analysis',
    projectName: 'Test Project',
    projectId: '880e8400-e29b-41d4-a716-446655440003',
    generatedByName: 'Test User',
    generatedByEmail: 'test@example.com',
    ...overrides,
  };
}

/**
 * Create an authenticated user for testing.
 */
function createAuthenticatedUser(
  overrides?: Partial<{ id: string; email: string; role: UserRole; organization: string }>
): { id: string; email: string; role: UserRole; organization: string } {
  return {
    id: '770e8400-e29b-41d4-a716-446655440002',
    email: 'user@example.com',
    role: 'analyst',
    organization: 'Acme Corp',
    ...overrides,
  };
}

describe('Report Routes API Tests', () => {
  let app: Express;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Default to authenticated user
    mockCurrentUser = createAuthenticatedUser();

    // Create fresh Express app
    app = express();
    app.use(express.json());
    app.use('/reports', reportRoutes);
  });

  describe('GET /reports/:id/status', () => {
    const validReportId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful retrieval', () => {
      it('should return report status with status 200', async () => {
        const mockReport = createMockReportWithDetails();

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedUrl.mockResolvedValue('https://storage.example.com/signed-url');

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.reportId).toBe(validReportId);
        expect(response.body.data.status).toBe('completed');
      });

      it('should return progress 100 for completed reports', async () => {
        const mockReport = createMockReportWithDetails({ status: 'completed' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedUrl.mockResolvedValue('https://storage.example.com/signed-url');

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(200);
        expect(response.body.data.progress).toBe(100);
      });

      it('should return progress 0 for pending reports', async () => {
        const mockReport = createMockReportWithDetails({ status: 'pending', filePath: null });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(200);
        expect(response.body.data.progress).toBe(0);
      });

      it('should return progress 50 for generating reports', async () => {
        const mockReport = createMockReportWithDetails({ status: 'generating', filePath: null });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(200);
        expect(response.body.data.progress).toBe(50);
      });

      it('should return undefined progress for failed reports', async () => {
        const mockReport = createMockReportWithDetails({
          status: 'failed',
          filePath: null,
          errorMessage: 'Generation failed',
        });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(200);
        expect(response.body.data.progress).toBeUndefined();
        expect(response.body.data.errorMessage).toBe('Generation failed');
      });

      it('should include download URL for completed reports', async () => {
        const mockReport = createMockReportWithDetails({ status: 'completed' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedUrl.mockResolvedValue('https://storage.example.com/signed-url');

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(200);
        expect(response.body.data.downloadUrl).toBe('https://storage.example.com/signed-url');
      });

      it('should not include download URL for pending reports', async () => {
        const mockReport = createMockReportWithDetails({ status: 'pending', filePath: null });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(200);
        expect(response.body.data.downloadUrl).toBeNull();
      });

      it('should include completedAt for completed reports', async () => {
        const generatedAt = new Date('2026-02-01T00:05:00Z');
        const mockReport = createMockReportWithDetails({ status: 'completed', generatedAt });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedUrl.mockResolvedValue('https://storage.example.com/signed-url');

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(200);
        expect(response.body.data.completedAt).toBe(generatedAt.toISOString());
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).get('/reports/invalid-uuid/status');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'id', code: 'INVALID_FORMAT' }),
          ])
        );
      });
    });

    describe('authorization', () => {
      it('should return 404 when report does not exist', async () => {
        mockFindReportByIdWithDetails.mockResolvedValue(null);

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Report not found');
      });

      it('should return 403 when user does not have project access', async () => {
        const mockReport = createMockReportWithDetails();

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
        expect(response.body.error.message).toContain('do not have access');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors', async () => {
        mockFindReportByIdWithDetails.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should handle URL generation errors gracefully', async () => {
        const mockReport = createMockReportWithDetails({ status: 'completed' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedUrl.mockRejectedValue(new Error('Storage error'));

        const response = await request(app).get(`/reports/${validReportId}/status`);

        // Should still return 200, just with null downloadUrl
        expect(response.status).toBe(200);
        expect(response.body.data.downloadUrl).toBeNull();
      });
    });
  });

  describe('GET /reports/:id/download', () => {
    const validReportId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful download', () => {
      it('should return download URL with status 200', async () => {
        const mockReport = createMockReportWithDetails({ status: 'completed' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.downloadUrl).toBe('https://storage.example.com/download-url');
      });

      it('should return correct filename', async () => {
        const mockReport = createMockReportWithDetails({
          name: 'My Report',
          format: 'pdf',
        });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.data.filename).toContain('My Report');
        expect(response.body.data.filename).toContain('.pdf');
      });

      it('should return correct MIME type for PDF', async () => {
        const mockReport = createMockReportWithDetails({ format: 'pdf' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.data.mimeType).toBe('application/pdf');
      });

      it('should return correct MIME type for Word', async () => {
        const mockReport = createMockReportWithDetails({ format: 'word' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.data.mimeType).toBe(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
      });

      it('should return correct MIME type for Excel', async () => {
        const mockReport = createMockReportWithDetails({ format: 'excel' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.data.mimeType).toBe(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      });

      it('should return correct MIME type for PowerPoint', async () => {
        const mockReport = createMockReportWithDetails({ format: 'powerpoint' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.data.mimeType).toBe(
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        );
      });

      it('should return file size', async () => {
        const mockReport = createMockReportWithDetails({ fileSize: 54321 });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.data.fileSize).toBe(54321);
      });

      it('should return format', async () => {
        const mockReport = createMockReportWithDetails({ format: 'excel' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.data.format).toBe('excel');
      });

      it('should accept custom expiresIn parameter', async () => {
        const mockReport = createMockReportWithDetails();

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

        const response = await request(app)
          .get(`/reports/${validReportId}/download`)
          .query({ expiresIn: '7200' });

        expect(response.status).toBe(200);
        expect(response.body.data.expiresIn).toBe(7200);
        expect(mockGetSignedDownloadUrl).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          7200
        );
      });

      it('should use default expiresIn when not provided', async () => {
        const mockReport = createMockReportWithDetails();

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.data.expiresIn).toBe(3600);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).get('/reports/invalid-uuid/download');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'id', code: 'INVALID_FORMAT' }),
          ])
        );
      });

      it('should return 400 for invalid expiresIn (too small)', async () => {
        const response = await request(app)
          .get(`/reports/${validReportId}/download`)
          .query({ expiresIn: '0' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'expiresIn', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid expiresIn (too large)', async () => {
        const response = await request(app)
          .get(`/reports/${validReportId}/download`)
          .query({ expiresIn: '1000000' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'expiresIn', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for non-numeric expiresIn', async () => {
        const response = await request(app)
          .get(`/reports/${validReportId}/download`)
          .query({ expiresIn: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('report not ready', () => {
      it('should return 409 for pending reports', async () => {
        const mockReport = createMockReportWithDetails({ status: 'pending' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('REPORT_NOT_READY');
        expect(response.body.error.message).toContain('pending');
        expect(response.body.error.status).toBe('pending');
      });

      it('should return 409 for generating reports', async () => {
        const mockReport = createMockReportWithDetails({ status: 'generating' });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('REPORT_NOT_READY');
        expect(response.body.error.message).toContain('being generated');
        expect(response.body.error.status).toBe('generating');
      });

      it('should return 409 for failed reports with error message', async () => {
        const mockReport = createMockReportWithDetails({
          status: 'failed',
          errorMessage: 'Template not found',
        });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('REPORT_NOT_READY');
        expect(response.body.error.message).toContain('failed');
        expect(response.body.error.status).toBe('failed');
        expect(response.body.error.errorMessage).toBe('Template not found');
      });
    });

    describe('missing file path', () => {
      it('should return 500 when completed report has no file path', async () => {
        const mockReport = createMockReportWithDetails({
          status: 'completed',
          filePath: null,
        });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
        expect(response.body.error.message).toContain('file path');
      });
    });

    describe('authorization', () => {
      it('should return 404 when report does not exist', async () => {
        mockFindReportByIdWithDetails.mockResolvedValue(null);

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Report not found');
      });

      it('should return 403 when user does not have project access', async () => {
        const mockReport = createMockReportWithDetails();

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors', async () => {
        mockFindReportByIdWithDetails.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should return 500 on storage errors', async () => {
        const mockReport = createMockReportWithDetails();

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockRejectedValue(new Error('Storage error'));

        const response = await request(app).get(`/reports/${validReportId}/download`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  describe('Edge Cases', () => {
    const validReportId = '550e8400-e29b-41d4-a716-446655440000';

    it('should sanitize special characters in filename', async () => {
      const mockReport = createMockReportWithDetails({
        name: 'Test/Report:With*Special?Chars',
        format: 'pdf',
      });

      mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
      mockUserHasProjectAccess.mockResolvedValue(true);
      mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

      const response = await request(app).get(`/reports/${validReportId}/download`);

      expect(response.status).toBe(200);
      // Filename should not contain special characters
      expect(response.body.data.filename).not.toContain('/');
      expect(response.body.data.filename).not.toContain(':');
      expect(response.body.data.filename).not.toContain('*');
      expect(response.body.data.filename).not.toContain('?');
    });

    it('should handle report name already ending with extension', async () => {
      const mockReport = createMockReportWithDetails({
        name: 'Test Report.pdf',
        format: 'pdf',
      });

      mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
      mockUserHasProjectAccess.mockResolvedValue(true);
      mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/download-url');

      const response = await request(app).get(`/reports/${validReportId}/download`);

      expect(response.status).toBe(200);
      // Should not double the extension
      expect(response.body.data.filename).not.toMatch(/\.pdf\.pdf$/);
    });

    it('should handle all report status types in status endpoint', async () => {
      const statuses: ReportStatus[] = ['pending', 'generating', 'completed', 'failed'];

      for (const status of statuses) {
        jest.clearAllMocks();

        const mockReport = createMockReportWithDetails({
          status,
          filePath: status === 'completed' ? 'reports/test.pdf' : null,
          errorMessage: status === 'failed' ? 'Test error' : null,
        });

        mockFindReportByIdWithDetails.mockResolvedValue(mockReport);
        mockUserHasProjectAccess.mockResolvedValue(true);
        if (status === 'completed') {
          mockGetSignedUrl.mockResolvedValue('https://storage.example.com/signed-url');
        }

        const response = await request(app).get(`/reports/${validReportId}/status`);

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe(status);
      }
    });
  });
});
