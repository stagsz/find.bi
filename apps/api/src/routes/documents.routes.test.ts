/**
 * API integration tests for document endpoints.
 *
 * Tests the full API flow through routes with mocked database services.
 * All document endpoints require authentication, and many require authorization.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import type { UserRole, PIDDocumentStatus, EquipmentType, ProjectMemberRole } from '@hazop/types';
import type {
  PIDDocumentWithUploader,
  AnalysisNodeWithCreator,
  ListNodesResult,
} from '../services/pid-document.service.js';
import type { ProjectWithCreator } from '../services/project.service.js';

// Mock implementations - must be declared before jest.unstable_mockModule
let mockFindPIDDocumentById: jest.Mock<() => Promise<PIDDocumentWithUploader | null>>;
let mockDeletePIDDocument: jest.Mock<() => Promise<{ id: string; storagePath: string } | null>>;
let mockFindAnalysisNodeById: jest.Mock<() => Promise<AnalysisNodeWithCreator | null>>;
let mockCreateAnalysisNode: jest.Mock<() => Promise<AnalysisNodeWithCreator>>;
let mockListDocumentNodes: jest.Mock<() => Promise<ListNodesResult>>;
let mockNodeIdExistsForDocument: jest.Mock<() => Promise<boolean>>;
let mockNodeIdExistsForDocumentExcluding: jest.Mock<() => Promise<boolean>>;
let mockUpdateAnalysisNode: jest.Mock<() => Promise<AnalysisNodeWithCreator | null>>;
let mockDeleteAnalysisNode: jest.Mock<() => Promise<{ id: string } | null>>;

let mockUserHasProjectAccess: jest.Mock<() => Promise<boolean>>;
let mockGetUserProjectRole: jest.Mock<() => Promise<ProjectMemberRole | null>>;
let mockFindProjectById: jest.Mock<() => Promise<ProjectWithCreator | null>>;

let mockDeleteFile: jest.Mock<() => Promise<void>>;
let mockGetSignedDownloadUrl: jest.Mock<() => Promise<string>>;

// Current authenticated user for tests
let mockCurrentUser: { id: string; email: string; role: UserRole; organization: string } | null =
  null;

// Set up mocks before importing modules that depend on them
jest.unstable_mockModule('../services/pid-document.service.js', () => {
  mockFindPIDDocumentById = jest.fn<() => Promise<PIDDocumentWithUploader | null>>();
  mockDeletePIDDocument = jest.fn<() => Promise<{ id: string; storagePath: string } | null>>();
  mockFindAnalysisNodeById = jest.fn<() => Promise<AnalysisNodeWithCreator | null>>();
  mockCreateAnalysisNode = jest.fn<() => Promise<AnalysisNodeWithCreator>>();
  mockListDocumentNodes = jest.fn<() => Promise<ListNodesResult>>();
  mockNodeIdExistsForDocument = jest.fn<() => Promise<boolean>>();
  mockNodeIdExistsForDocumentExcluding = jest.fn<() => Promise<boolean>>();
  mockUpdateAnalysisNode = jest.fn<() => Promise<AnalysisNodeWithCreator | null>>();
  mockDeleteAnalysisNode = jest.fn<() => Promise<{ id: string } | null>>();

  return {
    findPIDDocumentById: mockFindPIDDocumentById,
    deletePIDDocument: mockDeletePIDDocument,
    findAnalysisNodeById: mockFindAnalysisNodeById,
    createAnalysisNode: mockCreateAnalysisNode,
    listDocumentNodes: mockListDocumentNodes,
    nodeIdExistsForDocument: mockNodeIdExistsForDocument,
    nodeIdExistsForDocumentExcluding: mockNodeIdExistsForDocumentExcluding,
    updateAnalysisNode: mockUpdateAnalysisNode,
    deleteAnalysisNode: mockDeleteAnalysisNode,
    // Additional exports required by documents.routes.ts
    createPIDDocument: jest.fn(),
    listProjectDocuments: jest.fn(),
  };
});

jest.unstable_mockModule('../services/project.service.js', () => {
  mockUserHasProjectAccess = jest.fn<() => Promise<boolean>>();
  mockGetUserProjectRole = jest.fn<() => Promise<ProjectMemberRole | null>>();
  mockFindProjectById = jest.fn<() => Promise<ProjectWithCreator | null>>();

  return {
    userHasProjectAccess: mockUserHasProjectAccess,
    getUserProjectRole: mockGetUserProjectRole,
    findProjectById: mockFindProjectById,
  };
});

jest.unstable_mockModule('../services/storage.service.js', () => {
  mockDeleteFile = jest.fn<() => Promise<void>>();
  mockGetSignedDownloadUrl = jest.fn<() => Promise<string>>();

  return {
    deleteFile: mockDeleteFile,
    getSignedDownloadUrl: mockGetSignedDownloadUrl,
    uploadFile: jest.fn(),
    generateStoragePath: jest.fn(),
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

// Import document routes after setting up mocks
const { default: documentRoutes } = await import('./documents.routes.js');

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
 * Create a mock analysis node for testing.
 */
function createMockNode(overrides?: Partial<AnalysisNodeWithCreator>): AnalysisNodeWithCreator {
  return {
    id: '880e8400-e29b-41d4-a716-446655440003',
    documentId: '550e8400-e29b-41d4-a716-446655440000',
    nodeId: 'P-101',
    description: 'Feed Pump',
    equipmentType: 'pump' as EquipmentType,
    x: 25.5,
    y: 30.0,
    createdById: '770e8400-e29b-41d4-a716-446655440002',
    createdAt: new Date('2025-01-02T00:00:00Z'),
    updatedAt: new Date('2025-01-02T00:00:00Z'),
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

describe('Document Routes API Tests', () => {
  let app: Express;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Default to authenticated user
    mockCurrentUser = createAuthenticatedUser();

    // Create fresh Express app
    app = express();
    app.use(express.json());
    app.use('/documents', documentRoutes);
  });

  describe('GET /documents/:id', () => {
    const validDocumentId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful retrieval', () => {
      it('should return document details with status 200', async () => {
        const mockDocument = createMockDocument({ id: validDocumentId });

        mockFindPIDDocumentById.mockResolvedValue(mockDocument);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/documents/${validDocumentId}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.document).toBeDefined();
        expect(response.body.data.document.id).toBe(validDocumentId);
        expect(response.body.data.document.filename).toBe('test-pid.pdf');
      });

      it('should include uploader information', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/documents/${validDocumentId}`);

        expect(response.status).toBe(200);
        expect(response.body.data.document.uploadedByName).toBe('Test User');
        expect(response.body.data.document.uploadedByEmail).toBe('test@example.com');
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).get('/documents/invalid-uuid');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'id', code: 'INVALID_FORMAT' })])
        );
      });
    });

    describe('authorization', () => {
      it('should return 404 when document does not exist', async () => {
        mockFindPIDDocumentById.mockResolvedValue(null);

        const response = await request(app).get(`/documents/${validDocumentId}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Document not found');
      });

      it('should return 403 when user does not have project access', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).get(`/documents/${validDocumentId}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
        expect(response.body.error.message).toContain('do not have access');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).get(`/documents/${validDocumentId}`);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors', async () => {
        mockFindPIDDocumentById.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get(`/documents/${validDocumentId}`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  describe('GET /documents/:id/download', () => {
    const validDocumentId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful download URL generation', () => {
      it('should return signed download URL with status 200', async () => {
        const mockDocument = createMockDocument({ id: validDocumentId });
        const mockUrl = 'https://minio.example.com/signed-url?token=abc123';

        mockFindPIDDocumentById.mockResolvedValue(mockDocument);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue(mockUrl);

        const response = await request(app).get(`/documents/${validDocumentId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.url).toBe(mockUrl);
        expect(response.body.data.filename).toBe('test-pid.pdf');
        expect(response.body.data.mimeType).toBe('application/pdf');
      });

      it('should include file metadata in response', async () => {
        const mockDocument = createMockDocument({ fileSize: 2048000 });

        mockFindPIDDocumentById.mockResolvedValue(mockDocument);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://example.com/url');

        const response = await request(app).get(`/documents/${validDocumentId}/download`);

        expect(response.status).toBe(200);
        expect(response.body.data.fileSize).toBe(2048000);
        expect(response.body.data.expiresIn).toBe(3600); // Default expiration
      });

      it('should respect custom expiresIn parameter', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetSignedDownloadUrl.mockResolvedValue('https://example.com/url');

        const response = await request(app)
          .get(`/documents/${validDocumentId}/download`)
          .query({ expiresIn: '7200' });

        expect(response.status).toBe(200);
        expect(response.body.data.expiresIn).toBe(7200);
        expect(mockGetSignedDownloadUrl).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          7200
        );
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).get('/documents/invalid-uuid/download');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid expiresIn value (too low)', async () => {
        const response = await request(app)
          .get(`/documents/${validDocumentId}/download`)
          .query({ expiresIn: '0' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'expiresIn', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid expiresIn value (too high)', async () => {
        const response = await request(app)
          .get(`/documents/${validDocumentId}/download`)
          .query({ expiresIn: '1000000' }); // > 604800 (7 days)

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'expiresIn', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for non-numeric expiresIn', async () => {
        const response = await request(app)
          .get(`/documents/${validDocumentId}/download`)
          .query({ expiresIn: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('authorization', () => {
      it('should return 404 when document does not exist', async () => {
        mockFindPIDDocumentById.mockResolvedValue(null);

        const response = await request(app).get(`/documents/${validDocumentId}/download`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 403 when user does not have project access', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).get(`/documents/${validDocumentId}/download`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).get(`/documents/${validDocumentId}/download`);

        expect(response.status).toBe(401);
      });
    });
  });

  describe('DELETE /documents/:id', () => {
    const validDocumentId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful deletion', () => {
      it('should delete document and return with status 200', async () => {
        const mockDocument = createMockDocument({ id: validDocumentId });

        mockFindPIDDocumentById.mockResolvedValue(mockDocument);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');
        mockDeletePIDDocument.mockResolvedValue({
          id: validDocumentId,
          storagePath: mockDocument.storagePath,
        });
        mockDeleteFile.mockResolvedValue(undefined);

        const response = await request(app).delete(`/documents/${validDocumentId}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toBe('Document deleted successfully');
        expect(response.body.data.documentId).toBe(validDocumentId);
      });

      it('should delete file from storage', async () => {
        const mockDocument = createMockDocument();

        mockFindPIDDocumentById.mockResolvedValue(mockDocument);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockDeletePIDDocument.mockResolvedValue({
          id: mockDocument.id,
          storagePath: mockDocument.storagePath,
        });
        mockDeleteFile.mockResolvedValue(undefined);

        await request(app).delete(`/documents/${validDocumentId}`);

        expect(mockDeleteFile).toHaveBeenCalledWith(mockDocument.storagePath);
      });

      it('should allow lead to delete documents', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('lead');
        mockDeletePIDDocument.mockResolvedValue({ id: validDocumentId, storagePath: 'path' });

        const response = await request(app).delete(`/documents/${validDocumentId}`);

        expect(response.status).toBe(200);
      });

      it('should allow member to delete documents', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockDeletePIDDocument.mockResolvedValue({ id: validDocumentId, storagePath: 'path' });

        const response = await request(app).delete(`/documents/${validDocumentId}`);

        expect(response.status).toBe(200);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).delete('/documents/invalid-uuid');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('authorization', () => {
      it('should return 404 when document does not exist', async () => {
        mockFindPIDDocumentById.mockResolvedValue(null);

        const response = await request(app).delete(`/documents/${validDocumentId}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 403 when user does not have project access', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).delete(`/documents/${validDocumentId}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should return 403 when user is a viewer', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('viewer');

        const response = await request(app).delete(`/documents/${validDocumentId}`);

        expect(response.status).toBe(403);
        expect(response.body.error.message).toContain('do not have permission');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).delete(`/documents/${validDocumentId}`);

        expect(response.status).toBe(401);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors', async () => {
        mockFindPIDDocumentById.mockRejectedValue(new Error('Database error'));

        const response = await request(app).delete(`/documents/${validDocumentId}`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should succeed even if storage deletion fails', async () => {
        // Logging storage deletion errors but not failing the request
        const mockDocument = createMockDocument();

        mockFindPIDDocumentById.mockResolvedValue(mockDocument);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');
        mockDeletePIDDocument.mockResolvedValue({
          id: validDocumentId,
          storagePath: mockDocument.storagePath,
        });
        mockDeleteFile.mockRejectedValue(new Error('Storage error'));

        const response = await request(app).delete(`/documents/${validDocumentId}`);

        // Should still return 200 - DB record is deleted
        expect(response.status).toBe(200);
      });
    });
  });

  describe('GET /documents/:id/nodes', () => {
    const validDocumentId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful listing', () => {
      it('should return paginated list of nodes with status 200', async () => {
        const mockNodes = [
          createMockNode({ nodeId: 'P-101' }),
          createMockNode({ id: '990e8400-e29b-41d4-a716-446655440004', nodeId: 'V-201' }),
        ];

        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListDocumentNodes.mockResolvedValue({
          nodes: mockNodes,
          total: 2,
        });

        const response = await request(app).get(`/documents/${validDocumentId}/nodes`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.meta.total).toBe(2);
        expect(response.body.meta.page).toBe(1);
        expect(response.body.meta.limit).toBe(50); // Default limit for nodes
      });

      it('should pass query parameters to service', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListDocumentNodes.mockResolvedValue({ nodes: [], total: 0 });

        await request(app).get(`/documents/${validDocumentId}/nodes`).query({
          page: '2',
          limit: '25',
          sortBy: 'node_id',
          sortOrder: 'asc',
          search: 'pump',
          equipmentType: 'pump',
        });

        expect(mockListDocumentNodes).toHaveBeenCalledWith(
          validDocumentId,
          { search: 'pump', equipmentType: 'pump' },
          { page: 2, limit: 25, sortBy: 'node_id', sortOrder: 'asc' }
        );
      });

      it('should calculate pagination metadata correctly', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListDocumentNodes.mockResolvedValue({
          nodes: [createMockNode()],
          total: 75,
        });

        const response = await request(app)
          .get(`/documents/${validDocumentId}/nodes`)
          .query({ page: '2', limit: '25' });

        expect(response.status).toBe(200);
        expect(response.body.meta.page).toBe(2);
        expect(response.body.meta.limit).toBe(25);
        expect(response.body.meta.total).toBe(75);
        expect(response.body.meta.totalPages).toBe(3);
        expect(response.body.meta.hasNextPage).toBe(true);
        expect(response.body.meta.hasPrevPage).toBe(true);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid document UUID format', async () => {
        const response = await request(app).get('/documents/invalid-uuid/nodes');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid page parameter', async () => {
        const response = await request(app)
          .get(`/documents/${validDocumentId}/nodes`)
          .query({ page: '0' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'page', code: 'INVALID_VALUE' })])
        );
      });

      it('should return 400 for invalid limit parameter', async () => {
        const response = await request(app)
          .get(`/documents/${validDocumentId}/nodes`)
          .query({ limit: '200' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'limit', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid sortBy parameter', async () => {
        const response = await request(app)
          .get(`/documents/${validDocumentId}/nodes`)
          .query({ sortBy: 'invalid_field' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'sortBy', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid equipmentType filter', async () => {
        const response = await request(app)
          .get(`/documents/${validDocumentId}/nodes`)
          .query({ equipmentType: 'invalid_type' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'equipmentType', code: 'INVALID_VALUE' }),
          ])
        );
      });
    });

    describe('authorization', () => {
      it('should return 404 when document does not exist', async () => {
        mockFindPIDDocumentById.mockResolvedValue(null);

        const response = await request(app).get(`/documents/${validDocumentId}/nodes`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 403 when user does not have project access', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).get(`/documents/${validDocumentId}/nodes`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).get(`/documents/${validDocumentId}/nodes`);

        expect(response.status).toBe(401);
      });
    });
  });

  describe('POST /documents/:id/nodes', () => {
    const validDocumentId = '550e8400-e29b-41d4-a716-446655440000';
    const validNodeData = {
      nodeId: 'P-101',
      description: 'Main Feed Pump',
      equipmentType: 'pump',
      x: 25.5,
      y: 30.0,
    };

    describe('successful creation', () => {
      it('should create node and return with status 201', async () => {
        const mockNode = createMockNode({
          ...validNodeData,
          equipmentType: validNodeData.equipmentType as EquipmentType,
        });

        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');
        mockNodeIdExistsForDocument.mockResolvedValue(false);
        mockCreateAnalysisNode.mockResolvedValue(mockNode);

        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send(validNodeData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.node).toBeDefined();
        expect(response.body.data.node.nodeId).toBe('P-101');
        expect(response.body.data.node.equipmentType).toBe('pump');
      });

      it('should call service with correct parameters', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockNodeIdExistsForDocument.mockResolvedValue(false);
        mockCreateAnalysisNode.mockResolvedValue(createMockNode());

        await request(app).post(`/documents/${validDocumentId}/nodes`).send(validNodeData);

        expect(mockCreateAnalysisNode).toHaveBeenCalledWith({
          documentId: validDocumentId,
          nodeId: validNodeData.nodeId,
          description: validNodeData.description,
          equipmentType: validNodeData.equipmentType,
          x: validNodeData.x,
          y: validNodeData.y,
          createdById: mockCurrentUser!.id,
        });
      });

      it('should trim nodeId and description', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockNodeIdExistsForDocument.mockResolvedValue(false);
        mockCreateAnalysisNode.mockResolvedValue(createMockNode());

        await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send({
            ...validNodeData,
            nodeId: '  P-101  ',
            description: '  Main Feed Pump  ',
          });

        expect(mockCreateAnalysisNode).toHaveBeenCalledWith(
          expect.objectContaining({
            nodeId: 'P-101',
            description: 'Main Feed Pump',
          })
        );
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid document UUID format', async () => {
        const response = await request(app)
          .post('/documents/invalid-uuid/nodes')
          .send(validNodeData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when nodeId is missing', async () => {
        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send({ ...validNodeData, nodeId: undefined });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'nodeId', code: 'REQUIRED' })])
        );
      });

      it('should return 400 when nodeId is empty', async () => {
        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send({ ...validNodeData, nodeId: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'nodeId', code: 'REQUIRED' })])
        );
      });

      it('should return 400 when nodeId exceeds 50 characters', async () => {
        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send({ ...validNodeData, nodeId: 'a'.repeat(51) });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'nodeId', code: 'MAX_LENGTH' })])
        );
      });

      it('should return 400 when description is missing', async () => {
        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send({ ...validNodeData, description: undefined });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'description', code: 'REQUIRED' }),
          ])
        );
      });

      it('should return 400 when equipmentType is invalid', async () => {
        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send({ ...validNodeData, equipmentType: 'invalid_type' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'equipmentType', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 when x is missing', async () => {
        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send({ ...validNodeData, x: undefined });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'x', code: 'REQUIRED' })])
        );
      });

      it('should return 400 when x is out of range', async () => {
        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send({ ...validNodeData, x: 150 });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'x', code: 'OUT_OF_RANGE' })])
        );
      });

      it('should return 400 when y is out of range', async () => {
        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send({ ...validNodeData, y: -10 });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'y', code: 'OUT_OF_RANGE' })])
        );
      });
    });

    describe('authorization', () => {
      it('should return 404 when document does not exist', async () => {
        mockFindPIDDocumentById.mockResolvedValue(null);

        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send(validNodeData);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 403 when user does not have project access', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send(validNodeData);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should return 403 when user is a viewer', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('viewer');

        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send(validNodeData);

        expect(response.status).toBe(403);
        expect(response.body.error.message).toContain('do not have permission');
      });
    });

    describe('conflict handling', () => {
      it('should return 409 when nodeId already exists', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockNodeIdExistsForDocument.mockResolvedValue(true);

        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send(validNodeData);

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('CONFLICT');
        expect(response.body.error.message).toContain('already exists');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send(validNodeData);

        expect(response.status).toBe(401);
      });
    });

    describe('error handling', () => {
      it('should return 500 on unexpected errors', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockNodeIdExistsForDocument.mockResolvedValue(false);
        mockCreateAnalysisNode.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send(validNodeData);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should return 409 on database unique constraint violation', async () => {
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockNodeIdExistsForDocument.mockResolvedValue(false);

        const dbError = new Error('duplicate key') as Error & { code: string };
        dbError.code = '23505';
        mockCreateAnalysisNode.mockRejectedValue(dbError);

        const response = await request(app)
          .post(`/documents/${validDocumentId}/nodes`)
          .send(validNodeData);

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('CONFLICT');
      });
    });
  });
});
