/**
 * API integration tests for project document endpoints.
 *
 * Tests the document endpoints nested under /projects/:id/documents:
 * - GET /projects/:id/documents - List P&ID documents for a project
 *
 * Note: POST /projects/:id/documents (upload) tests are in upload.middleware.test.ts
 * and test the full middleware chain separately.
 *
 * All endpoints require authentication and project access.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import type { UserRole, PIDDocumentStatus, ProjectStatus } from '@hazop/types';
import type {
  PIDDocumentWithUploader,
  ListDocumentsResult,
} from '../services/pid-document.service.js';
import type { ProjectWithCreator } from '../services/project.service.js';

// Mock implementations - must be declared before jest.unstable_mockModule
let mockListProjectDocuments: jest.Mock<() => Promise<ListDocumentsResult>>;

let mockUserHasProjectAccess: jest.Mock<() => Promise<boolean>>;
let mockFindProjectById: jest.Mock<() => Promise<ProjectWithCreator | null>>;

// Current authenticated user for tests
let mockCurrentUser: { id: string; email: string; role: UserRole; organization: string } | null =
  null;

// Set up mocks before importing modules that depend on them
jest.unstable_mockModule('../services/pid-document.service.js', () => {
  mockListProjectDocuments = jest.fn<() => Promise<ListDocumentsResult>>();

  return {
    listProjectDocuments: mockListProjectDocuments,
    createPIDDocument: jest.fn(),
    findPIDDocumentById: jest.fn(),
    deletePIDDocument: jest.fn(),
    createAnalysisNode: jest.fn(),
    listDocumentNodes: jest.fn(),
    nodeIdExistsForDocument: jest.fn(),
    nodeIdExistsForDocumentExcluding: jest.fn(),
    updateAnalysisNode: jest.fn(),
    deleteAnalysisNode: jest.fn(),
    findAnalysisNodeById: jest.fn(),
    updatePIDDocumentStatus: jest.fn(),
  };
});

jest.unstable_mockModule('../services/project.service.js', () => {
  mockUserHasProjectAccess = jest.fn<() => Promise<boolean>>();
  mockFindProjectById = jest.fn<() => Promise<ProjectWithCreator | null>>();

  return {
    userHasProjectAccess: mockUserHasProjectAccess,
    getUserProjectRole: jest.fn(),
    findProjectById: mockFindProjectById,
    // Other exports required for projects.routes.ts
    listUserProjects: jest.fn(),
    createProject: jest.fn(),
    updateProject: jest.fn(),
    userExists: jest.fn(),
    isProjectMember: jest.fn(),
    addProjectMember: jest.fn(),
    removeProjectMember: jest.fn(),
    getProjectCreatorId: jest.fn(),
    listProjectMembers: jest.fn(),
  };
});

jest.unstable_mockModule('../services/storage.service.js', () => ({
  uploadFile: jest.fn(),
  generateStoragePath: jest.fn(),
  deleteFile: jest.fn(),
  getSignedViewUrl: jest.fn(),
  getSignedDownloadUrl: jest.fn(),
  getSignedUrl: jest.fn(),
  fileExists: jest.fn(),
}));

// Mock the auth middleware to allow testing without actual JWT
jest.unstable_mockModule('../middleware/auth.middleware.js', () => ({
  authenticate: (_req: Request, _res: Response, next: NextFunction) => {
    if (mockCurrentUser) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_req as any).user = mockCurrentUser;
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

// Mock project-compliance service (loaded transitively via projects/analyses controllers)
jest.unstable_mockModule('../services/project-compliance.service.js', () => ({
  getProjectComplianceStatus: jest.fn(),
  getAnalysisComplianceStatus: jest.fn(),
}));

// Mock controllers loaded by projects.routes (not under test here)
jest.unstable_mockModule('../controllers/analyses.controller.js', () => ({
  createAnalysis: jest.fn(),
  listAnalyses: jest.fn(),
}));

jest.unstable_mockModule('../controllers/reports.controller.js', () => ({
  createReport: jest.fn(),
  listReports: jest.fn(),
}));

jest.unstable_mockModule('../controllers/projects.controller.js', () => ({
  listProjects: jest.fn(),
  createProject: jest.fn(),
  getProjectById: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
  listMembers: jest.fn(),
  getProjectRiskDashboardController: jest.fn(),
  getProjectComplianceController: jest.fn(),
}));

// Mock upload middleware - not testing upload here, just list documents
jest.unstable_mockModule('../middleware/upload.middleware.js', () => ({
  uploadPID: {
    single: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  },
  handleMulterError: (_req: Request, _res: Response, next: NextFunction) => next(),
  validatePIDUpload: (_req: Request, _res: Response, next: NextFunction) => next(),
  getUploadedFileBuffer: () => null,
  getUploadMeta: () => null,
}));

// Import project routes after setting up mocks
const { default: projectRoutes } = await import('./projects.routes.js');

/**
 * Create a mock document for testing.
 */
function createMockDocument(overrides?: Partial<PIDDocumentWithUploader>): PIDDocumentWithUploader {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    projectId: '660e8400-e29b-41d4-a716-446655440001',
    filename: 'test-pid.pdf',
    storagePath: 'projects/660e8400-e29b-41d4-a716-446655440001/abc123.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024000,
    status: 'pending' as PIDDocumentStatus,
    errorMessage: null,
    width: null,
    height: null,
    uploadedById: '770e8400-e29b-41d4-a716-446655440002',
    uploadedAt: new Date('2025-01-01T00:00:00Z'),
    processedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    uploadedByName: 'Test User',
    uploadedByEmail: 'test@example.com',
    ...overrides,
  };
}

/**
 * Create a mock project for testing.
 */
function createMockProject(overrides?: Partial<ProjectWithCreator>): ProjectWithCreator {
  return {
    id: '660e8400-e29b-41d4-a716-446655440001',
    name: 'Test Project',
    description: 'A test project description',
    status: 'planning' as ProjectStatus,
    createdById: '770e8400-e29b-41d4-a716-446655440002',
    organization: 'Acme Corp',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    createdByName: 'Test User',
    createdByEmail: 'test@example.com',
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

describe('Project Document Routes API Tests', () => {
  let app: Express;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Default to authenticated user
    mockCurrentUser = createAuthenticatedUser();

    // Create fresh Express app
    app = express();
    app.use(express.json());
    app.use('/projects', projectRoutes);
  });

  describe('GET /projects/:id/documents', () => {
    const validProjectId = '660e8400-e29b-41d4-a716-446655440001';

    describe('successful listing', () => {
      it('should return paginated list of documents with status 200', async () => {
        const mockDocuments = [
          createMockDocument({ id: 'doc-1', filename: 'document1.pdf' }),
          createMockDocument({ id: 'doc-2', filename: 'document2.pdf' }),
        ];

        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({
          documents: mockDocuments,
          total: 2,
        });

        const response = await request(app).get(`/projects/${validProjectId}/documents`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.meta.total).toBe(2);
        expect(response.body.meta.page).toBe(1);
        expect(response.body.meta.limit).toBe(20);
      });

      it('should pass query parameters to service', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({ documents: [], total: 0 });

        await request(app).get(`/projects/${validProjectId}/documents`).query({
          page: '2',
          limit: '10',
          sortBy: 'filename',
          sortOrder: 'asc',
          search: 'test',
          status: 'pending',
        });

        expect(mockListProjectDocuments).toHaveBeenCalledWith(
          validProjectId,
          { search: 'test', status: 'pending' },
          { page: 2, limit: 10, sortBy: 'filename', sortOrder: 'asc' }
        );
      });

      it('should calculate pagination metadata correctly', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({
          documents: [createMockDocument()],
          total: 50,
        });

        const response = await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ page: '2', limit: '10' });

        expect(response.status).toBe(200);
        expect(response.body.meta.page).toBe(2);
        expect(response.body.meta.limit).toBe(10);
        expect(response.body.meta.total).toBe(50);
        expect(response.body.meta.totalPages).toBe(5);
        expect(response.body.meta.hasNextPage).toBe(true);
        expect(response.body.meta.hasPrevPage).toBe(true);
      });

      it('should handle empty results', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({
          documents: [],
          total: 0,
        });

        const response = await request(app).get(`/projects/${validProjectId}/documents`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(0);
        expect(response.body.meta.total).toBe(0);
        expect(response.body.meta.totalPages).toBe(0);
      });

      it('should include uploader information in documents', async () => {
        const mockDocument = createMockDocument({
          uploadedByName: 'John Doe',
          uploadedByEmail: 'john@example.com',
        });

        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({
          documents: [mockDocument],
          total: 1,
        });

        const response = await request(app).get(`/projects/${validProjectId}/documents`);

        expect(response.status).toBe(200);
        expect(response.body.data[0].uploadedByName).toBe('John Doe');
        expect(response.body.data[0].uploadedByEmail).toBe('john@example.com');
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid project UUID format', async () => {
        const response = await request(app).get('/projects/invalid-uuid/documents');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'id', code: 'INVALID_FORMAT' })])
        );
      });

      it('should return 400 for invalid page parameter', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ page: '0' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'page', code: 'INVALID_VALUE' })])
        );
      });

      it('should return 400 for non-numeric page parameter', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ page: 'abc' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'page', code: 'INVALID_VALUE' })])
        );
      });

      it('should return 400 for invalid limit parameter (too high)', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ limit: '200' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'limit', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid limit parameter (too low)', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ limit: '0' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'limit', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid sortBy parameter', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ sortBy: 'invalid_field' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'sortBy', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid sortOrder parameter', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ sortOrder: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'sortOrder', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid status filter', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ status: 'invalid_status' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'status', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should accept valid PID document statuses', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({ documents: [], total: 0 });

        // Test with valid status values
        for (const status of ['pending', 'processing', 'processed', 'failed']) {
          const response = await request(app)
            .get(`/projects/${validProjectId}/documents`)
            .query({ status });

          expect(response.status).toBe(200);
        }
      });
    });

    describe('authorization', () => {
      it('should return 404 when project does not exist', async () => {
        mockUserHasProjectAccess.mockResolvedValue(false);
        mockFindProjectById.mockResolvedValue(null);

        const response = await request(app).get(`/projects/${validProjectId}/documents`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Project not found');
      });

      it('should return 403 when user does not have access', async () => {
        mockUserHasProjectAccess.mockResolvedValue(false);
        mockFindProjectById.mockResolvedValue(createMockProject());

        const response = await request(app).get(`/projects/${validProjectId}/documents`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
        expect(response.body.error.message).toContain('do not have access');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).get(`/projects/${validProjectId}/documents`);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors', async () => {
        mockUserHasProjectAccess.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get(`/projects/${validProjectId}/documents`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should return 500 on service errors during listing', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockRejectedValue(new Error('Service error'));

        const response = await request(app).get(`/projects/${validProjectId}/documents`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });

    describe('sorting', () => {
      it('should support sorting by created_at', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({ documents: [], total: 0 });

        await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ sortBy: 'created_at', sortOrder: 'desc' });

        expect(mockListProjectDocuments).toHaveBeenCalledWith(
          validProjectId,
          expect.any(Object),
          expect.objectContaining({ sortBy: 'created_at', sortOrder: 'desc' })
        );
      });

      it('should support sorting by uploaded_at', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({ documents: [], total: 0 });

        await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ sortBy: 'uploaded_at', sortOrder: 'asc' });

        expect(mockListProjectDocuments).toHaveBeenCalledWith(
          validProjectId,
          expect.any(Object),
          expect.objectContaining({ sortBy: 'uploaded_at', sortOrder: 'asc' })
        );
      });

      it('should support sorting by filename', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({ documents: [], total: 0 });

        await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ sortBy: 'filename' });

        expect(mockListProjectDocuments).toHaveBeenCalledWith(
          validProjectId,
          expect.any(Object),
          expect.objectContaining({ sortBy: 'filename' })
        );
      });

      it('should support sorting by status', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({ documents: [], total: 0 });

        await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ sortBy: 'status' });

        expect(mockListProjectDocuments).toHaveBeenCalledWith(
          validProjectId,
          expect.any(Object),
          expect.objectContaining({ sortBy: 'status' })
        );
      });

      it('should support sorting by file_size', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({ documents: [], total: 0 });

        await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ sortBy: 'file_size' });

        expect(mockListProjectDocuments).toHaveBeenCalledWith(
          validProjectId,
          expect.any(Object),
          expect.objectContaining({ sortBy: 'file_size' })
        );
      });
    });

    describe('filtering', () => {
      it('should support search filter', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({ documents: [], total: 0 });

        await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ search: 'pump' });

        expect(mockListProjectDocuments).toHaveBeenCalledWith(
          validProjectId,
          expect.objectContaining({ search: 'pump' }),
          expect.any(Object)
        );
      });

      it('should support status filter', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({ documents: [], total: 0 });

        await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ status: 'processed' });

        expect(mockListProjectDocuments).toHaveBeenCalledWith(
          validProjectId,
          expect.objectContaining({ status: 'processed' }),
          expect.any(Object)
        );
      });

      it('should support combining search and status filters', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectDocuments.mockResolvedValue({ documents: [], total: 0 });

        await request(app)
          .get(`/projects/${validProjectId}/documents`)
          .query({ search: 'diagram', status: 'pending' });

        expect(mockListProjectDocuments).toHaveBeenCalledWith(
          validProjectId,
          { search: 'diagram', status: 'pending' },
          expect.any(Object)
        );
      });
    });
  });
});
