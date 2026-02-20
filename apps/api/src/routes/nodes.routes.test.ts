/**
 * API integration tests for node endpoints.
 *
 * Tests the full API flow through routes with mocked database services.
 * All node endpoints require authentication and authorization.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import type { UserRole, EquipmentType, ProjectMemberRole } from '@hazop/types';
import type {
  PIDDocumentWithUploader,
  AnalysisNodeWithCreator,
  AnalysisNode,
} from '../services/pid-document.service.js';

// Mock implementations - must be declared before jest.unstable_mockModule
let mockFindPIDDocumentById: jest.Mock<() => Promise<PIDDocumentWithUploader | null>>;
let mockFindAnalysisNodeById: jest.Mock<() => Promise<AnalysisNodeWithCreator | null>>;
let mockNodeIdExistsForDocumentExcluding: jest.Mock<() => Promise<boolean>>;
let mockUpdateAnalysisNode: jest.Mock<() => Promise<AnalysisNodeWithCreator | null>>;
let mockDeleteAnalysisNode: jest.Mock<() => Promise<AnalysisNode | null>>;

let mockUserHasProjectAccess: jest.Mock<() => Promise<boolean>>;
let mockGetUserProjectRole: jest.Mock<() => Promise<ProjectMemberRole | null>>;

// Current authenticated user for tests
let mockCurrentUser: { id: string; email: string; role: UserRole; organization: string } | null =
  null;

// Set up mocks before importing modules that depend on them
jest.unstable_mockModule('../services/pid-document.service.js', () => {
  mockFindPIDDocumentById = jest.fn<() => Promise<PIDDocumentWithUploader | null>>();
  mockFindAnalysisNodeById = jest.fn<() => Promise<AnalysisNodeWithCreator | null>>();
  mockNodeIdExistsForDocumentExcluding = jest.fn<() => Promise<boolean>>();
  mockUpdateAnalysisNode = jest.fn<() => Promise<AnalysisNodeWithCreator | null>>();
  mockDeleteAnalysisNode = jest.fn<() => Promise<AnalysisNode | null>>();

  return {
    findPIDDocumentById: mockFindPIDDocumentById,
    findAnalysisNodeById: mockFindAnalysisNodeById,
    nodeIdExistsForDocumentExcluding: mockNodeIdExistsForDocumentExcluding,
    updateAnalysisNode: mockUpdateAnalysisNode,
    deleteAnalysisNode: mockDeleteAnalysisNode,
    // Not used in nodes routes but required for import
    createPIDDocument: jest.fn(),
    deletePIDDocument: jest.fn(),
    listProjectDocuments: jest.fn(),
    createAnalysisNode: jest.fn(),
    listDocumentNodes: jest.fn(),
    nodeIdExistsForDocument: jest.fn(),
    updatePIDDocumentStatus: jest.fn(),
  };
});

jest.unstable_mockModule('../services/project.service.js', () => {
  mockUserHasProjectAccess = jest.fn<() => Promise<boolean>>();
  mockGetUserProjectRole = jest.fn<() => Promise<ProjectMemberRole | null>>();

  return {
    userHasProjectAccess: mockUserHasProjectAccess,
    getUserProjectRole: mockGetUserProjectRole,
    findProjectById: jest.fn(),
  };
});

// Mock storage service (not used in nodes routes but may be imported)
jest.unstable_mockModule('../services/storage.service.js', () => ({
  deleteFile: jest.fn(),
  getSignedDownloadUrl: jest.fn(),
  getSignedViewUrl: jest.fn(),
  getSignedUrl: jest.fn(),
  uploadFile: jest.fn(),
  generateStoragePath: jest.fn(),
}));

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

// Import node routes after setting up mocks
const { default: nodeRoutes } = await import('./nodes.routes.js');

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
    status: 'pending',
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

describe('Node Routes API Tests', () => {
  let app: Express;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Default to authenticated user
    mockCurrentUser = createAuthenticatedUser();

    // Create fresh Express app
    app = express();
    app.use(express.json());
    app.use('/nodes', nodeRoutes);
  });

  describe('PUT /nodes/:id', () => {
    const validNodeId = '880e8400-e29b-41d4-a716-446655440003';
    const updateData = {
      nodeId: 'P-102',
      description: 'Updated Pump Description',
      equipmentType: 'valve',
      x: 50.0,
      y: 60.0,
    };

    describe('successful update', () => {
      it('should update node and return with status 200', async () => {
        const existingNode = createMockNode();
        const updatedNode = createMockNode({
          ...updateData,
          equipmentType: updateData.equipmentType as EquipmentType,
        });

        mockFindAnalysisNodeById.mockResolvedValue(existingNode);
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');
        mockNodeIdExistsForDocumentExcluding.mockResolvedValue(false);
        mockUpdateAnalysisNode.mockResolvedValue(updatedNode);

        const response = await request(app).put(`/nodes/${validNodeId}`).send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.node.nodeId).toBe('P-102');
        expect(response.body.data.node.description).toBe('Updated Pump Description');
      });

      it('should update only provided fields', async () => {
        const existingNode = createMockNode();

        mockFindAnalysisNodeById.mockResolvedValue(existingNode);
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockUpdateAnalysisNode.mockResolvedValue(
          createMockNode({ description: 'New Description Only' })
        );

        await request(app).put(`/nodes/${validNodeId}`).send({ description: 'New Description Only' });

        expect(mockUpdateAnalysisNode).toHaveBeenCalledWith(validNodeId, {
          description: 'New Description Only',
        });
      });

      it('should allow lead to update nodes', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('lead');
        mockUpdateAnalysisNode.mockResolvedValue(createMockNode());

        const response = await request(app)
          .put(`/nodes/${validNodeId}`)
          .send({ description: 'Updated' });

        expect(response.status).toBe(200);
      });

      it('should trim nodeId and description', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockNodeIdExistsForDocumentExcluding.mockResolvedValue(false);
        mockUpdateAnalysisNode.mockResolvedValue(createMockNode());

        await request(app)
          .put(`/nodes/${validNodeId}`)
          .send({ nodeId: '  P-102  ', description: '  Trimmed  ' });

        expect(mockUpdateAnalysisNode).toHaveBeenCalledWith(validNodeId, {
          nodeId: 'P-102',
          description: 'Trimmed',
        });
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).put('/nodes/invalid-uuid').send(updateData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'id', code: 'INVALID_FORMAT' })])
        );
      });

      it('should return 400 when body is empty', async () => {
        const response = await request(app).put(`/nodes/${validNodeId}`).send({});

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'body', code: 'EMPTY_BODY' })])
        );
      });

      it('should return 400 when nodeId is empty string', async () => {
        const response = await request(app).put(`/nodes/${validNodeId}`).send({ nodeId: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'nodeId', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 when nodeId exceeds 50 characters', async () => {
        const response = await request(app)
          .put(`/nodes/${validNodeId}`)
          .send({ nodeId: 'a'.repeat(51) });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'nodeId', code: 'MAX_LENGTH' })])
        );
      });

      it('should return 400 when equipmentType is invalid', async () => {
        const response = await request(app)
          .put(`/nodes/${validNodeId}`)
          .send({ equipmentType: 'invalid_type' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'equipmentType', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 when x is out of range', async () => {
        const response = await request(app).put(`/nodes/${validNodeId}`).send({ x: 150 });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'x', code: 'OUT_OF_RANGE' })])
        );
      });

      it('should return 400 when y is negative', async () => {
        const response = await request(app).put(`/nodes/${validNodeId}`).send({ y: -5 });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'y', code: 'OUT_OF_RANGE' })])
        );
      });
    });

    describe('authorization', () => {
      it('should return 404 when node does not exist', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(null);

        const response = await request(app).put(`/nodes/${validNodeId}`).send(updateData);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Node not found');
      });

      it('should return 404 when document does not exist', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(null);

        const response = await request(app).put(`/nodes/${validNodeId}`).send(updateData);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 403 when user does not have project access', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).put(`/nodes/${validNodeId}`).send(updateData);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should return 403 when user is a viewer', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('viewer');

        const response = await request(app).put(`/nodes/${validNodeId}`).send(updateData);

        expect(response.status).toBe(403);
        expect(response.body.error.message).toContain('do not have permission');
      });
    });

    describe('conflict handling', () => {
      it('should return 409 when nodeId already exists', async () => {
        const existingNode = createMockNode();

        mockFindAnalysisNodeById.mockResolvedValue(existingNode);
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockNodeIdExistsForDocumentExcluding.mockResolvedValue(true);

        const response = await request(app)
          .put(`/nodes/${validNodeId}`)
          .send({ nodeId: 'EXISTING-ID' });

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('CONFLICT');
        expect(response.body.error.message).toContain('already exists');
      });

      it('should not check for duplicates if nodeId unchanged', async () => {
        const existingNode = createMockNode({ nodeId: 'P-101' });

        mockFindAnalysisNodeById.mockResolvedValue(existingNode);
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockUpdateAnalysisNode.mockResolvedValue(existingNode);

        await request(app).put(`/nodes/${validNodeId}`).send({ nodeId: 'P-101' });

        // Should not check for duplicates since nodeId is same
        expect(mockNodeIdExistsForDocumentExcluding).not.toHaveBeenCalled();
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).put(`/nodes/${validNodeId}`).send(updateData);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });
    });

    describe('error handling', () => {
      it('should return 500 on unexpected errors', async () => {
        mockFindAnalysisNodeById.mockRejectedValue(new Error('Database error'));

        const response = await request(app).put(`/nodes/${validNodeId}`).send(updateData);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should return 409 on database unique constraint violation', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockNodeIdExistsForDocumentExcluding.mockResolvedValue(false);

        const dbError = new Error('duplicate key') as Error & { code: string };
        dbError.code = '23505';
        mockUpdateAnalysisNode.mockRejectedValue(dbError);

        const response = await request(app)
          .put(`/nodes/${validNodeId}`)
          .send({ nodeId: 'NEW-ID' });

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('CONFLICT');
      });
    });
  });

  describe('DELETE /nodes/:id', () => {
    const validNodeId = '880e8400-e29b-41d4-a716-446655440003';

    describe('successful deletion', () => {
      it('should delete node and return with status 200', async () => {
        const existingNode = createMockNode({ id: validNodeId });

        mockFindAnalysisNodeById.mockResolvedValue(existingNode);
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');
        mockDeleteAnalysisNode.mockResolvedValue({
          id: validNodeId,
          documentId: existingNode.documentId,
          nodeId: existingNode.nodeId,
          description: existingNode.description,
          equipmentType: existingNode.equipmentType,
          x: existingNode.x,
          y: existingNode.y,
          createdById: existingNode.createdById,
          createdAt: existingNode.createdAt,
          updatedAt: existingNode.updatedAt,
        });

        const response = await request(app).delete(`/nodes/${validNodeId}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toBe('Node deleted successfully');
        expect(response.body.data.nodeId).toBe(validNodeId);
      });

      it('should allow lead to delete nodes', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('lead');
        mockDeleteAnalysisNode.mockResolvedValue({
          id: validNodeId,
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          nodeId: 'P-101',
          description: 'Feed Pump',
          equipmentType: 'pump' as EquipmentType,
          x: 25.5,
          y: 30.0,
          createdById: '770e8400-e29b-41d4-a716-446655440002',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await request(app).delete(`/nodes/${validNodeId}`);

        expect(response.status).toBe(200);
      });

      it('should allow member to delete nodes', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockDeleteAnalysisNode.mockResolvedValue({
          id: validNodeId,
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          nodeId: 'P-101',
          description: 'Feed Pump',
          equipmentType: 'pump' as EquipmentType,
          x: 25.5,
          y: 30.0,
          createdById: '770e8400-e29b-41d4-a716-446655440002',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await request(app).delete(`/nodes/${validNodeId}`);

        expect(response.status).toBe(200);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).delete('/nodes/invalid-uuid');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'id', code: 'INVALID_FORMAT' })])
        );
      });
    });

    describe('authorization', () => {
      it('should return 404 when node does not exist', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(null);

        const response = await request(app).delete(`/nodes/${validNodeId}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Node not found');
      });

      it('should return 404 when document does not exist', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(null);

        const response = await request(app).delete(`/nodes/${validNodeId}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 403 when user does not have project access', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).delete(`/nodes/${validNodeId}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should return 403 when user is a viewer', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('viewer');

        const response = await request(app).delete(`/nodes/${validNodeId}`);

        expect(response.status).toBe(403);
        expect(response.body.error.message).toContain('do not have permission');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).delete(`/nodes/${validNodeId}`);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });
    });

    describe('error handling', () => {
      it('should return 500 on unexpected errors', async () => {
        mockFindAnalysisNodeById.mockRejectedValue(new Error('Database error'));

        const response = await request(app).delete(`/nodes/${validNodeId}`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should return 404 if node deleted between find and delete (race condition)', async () => {
        mockFindAnalysisNodeById.mockResolvedValue(createMockNode());
        mockFindPIDDocumentById.mockResolvedValue(createMockDocument());
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockDeleteAnalysisNode.mockResolvedValue(null);

        const response = await request(app).delete(`/nodes/${validNodeId}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });
  });
});
