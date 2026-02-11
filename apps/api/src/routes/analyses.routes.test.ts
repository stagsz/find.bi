/**
 * API integration tests for analysis endpoints.
 *
 * Tests the full API flow through routes with mocked database services.
 * All analysis endpoints require authentication and project access.
 *
 * Endpoints tested:
 * - GET /analyses/:id - Get analysis details
 * - PUT /analyses/:id - Update analysis metadata
 * - POST /analyses/:id/complete - Complete/approve an analysis
 * - POST /analyses/:id/entries - Create analysis entry
 * - GET /analyses/:id/entries - List analysis entries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import type {
  UserRole,
  AnalysisStatus,
  GuideWord,
  RiskLevel,
  ProjectMemberRole,
} from '@hazop/types';

// Mock return types
interface HazopAnalysisWithDetails {
  id: string;
  projectId: string;
  documentId: string;
  name: string;
  description: string | null;
  status: AnalysisStatus;
  leadAnalystId: string;
  createdById: string;
  approvedById: string | null;
  approvalComments: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  documentName: string;
  leadAnalystName: string;
  leadAnalystEmail: string;
  createdByName: string;
  createdByEmail: string;
}

interface HazopAnalysisWithDetailsAndProgress extends HazopAnalysisWithDetails {
  totalNodes: number;
  analyzedNodes: number;
  totalEntries: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
}

interface AnalysisEntry {
  id: string;
  analysisId: string;
  nodeId: string;
  guideWord: GuideWord;
  parameter: string;
  deviation: string;
  causes: string[];
  consequences: string[];
  safeguards: string[];
  recommendations: string[];
  notes: string | null;
  severity: number | null;
  likelihood: number | null;
  detectability: number | null;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ListAnalysesResult {
  analyses: HazopAnalysisWithDetails[];
  total: number;
}

interface ListEntriesResult {
  entries: AnalysisEntry[];
  total: number;
}

// Mock implementations - must be declared before jest.unstable_mockModule
let mockFindAnalysisById: jest.Mock<() => Promise<HazopAnalysisWithDetails | null>>;
let mockFindAnalysisByIdWithProgress: jest.Mock<
  () => Promise<HazopAnalysisWithDetailsAndProgress | null>
>;
let mockListProjectAnalyses: jest.Mock<() => Promise<ListAnalysesResult>>;
let mockUpdateAnalysis: jest.Mock<() => Promise<HazopAnalysisWithDetails | null>>;
let mockApproveAnalysis: jest.Mock<() => Promise<HazopAnalysisWithDetails | null>>;
let mockNodeExistsInDocument: jest.Mock<() => Promise<boolean>>;
let mockCreateAnalysisEntry: jest.Mock<() => Promise<AnalysisEntry>>;
let mockListAnalysisEntries: jest.Mock<() => Promise<ListEntriesResult>>;
let mockCreateAnalysis: jest.Mock<() => Promise<HazopAnalysisWithDetails>>;
let mockDocumentBelongsToProject: jest.Mock<() => Promise<boolean>>;

// Project service mocks
let mockUserHasProjectAccess: jest.Mock<() => Promise<boolean>>;
let mockFindProjectById: jest.Mock<() => Promise<{ id: string } | null>>;
let mockGetUserProjectRole: jest.Mock<() => Promise<ProjectMemberRole | null>>;

// Current authenticated user for tests
let mockCurrentUser: { id: string; email: string; role: UserRole; organization: string } | null =
  null;

// Set up mocks before importing modules that depend on them
jest.unstable_mockModule('../services/hazop-analysis.service.js', () => {
  mockFindAnalysisById = jest.fn<() => Promise<HazopAnalysisWithDetails | null>>();
  mockFindAnalysisByIdWithProgress =
    jest.fn<() => Promise<HazopAnalysisWithDetailsAndProgress | null>>();
  mockListProjectAnalyses = jest.fn<() => Promise<ListAnalysesResult>>();
  mockUpdateAnalysis = jest.fn<() => Promise<HazopAnalysisWithDetails | null>>();
  mockApproveAnalysis = jest.fn<() => Promise<HazopAnalysisWithDetails | null>>();
  mockNodeExistsInDocument = jest.fn<() => Promise<boolean>>();
  mockCreateAnalysisEntry = jest.fn<() => Promise<AnalysisEntry>>();
  mockListAnalysisEntries = jest.fn<() => Promise<ListEntriesResult>>();
  mockCreateAnalysis = jest.fn<() => Promise<HazopAnalysisWithDetails>>();
  mockDocumentBelongsToProject = jest.fn<() => Promise<boolean>>();

  return {
    findAnalysisById: mockFindAnalysisById,
    findAnalysisByIdWithProgress: mockFindAnalysisByIdWithProgress,
    listProjectAnalyses: mockListProjectAnalyses,
    updateAnalysis: mockUpdateAnalysis,
    approveAnalysis: mockApproveAnalysis,
    nodeExistsInDocument: mockNodeExistsInDocument,
    createAnalysisEntry: mockCreateAnalysisEntry,
    listAnalysisEntries: mockListAnalysisEntries,
    createAnalysis: mockCreateAnalysis,
    documentBelongsToProject: mockDocumentBelongsToProject,
    // Stubs for functions used by controller but not directly tested here
    findAnalysisEntryById: jest.fn(),
    updateAnalysisEntry: jest.fn(),
    deleteAnalysisEntry: jest.fn(),
  };
});

jest.unstable_mockModule('../services/project.service.js', () => {
  mockUserHasProjectAccess = jest.fn<() => Promise<boolean>>();
  mockFindProjectById = jest.fn<() => Promise<{ id: string } | null>>();
  mockGetUserProjectRole = jest.fn<() => Promise<ProjectMemberRole | null>>();

  return {
    userHasProjectAccess: mockUserHasProjectAccess,
    findProjectById: mockFindProjectById,
    getUserProjectRole: mockGetUserProjectRole,
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
const { default: analysesRoutes } = await import('./analyses.routes.js');
const { createAnalysis: createAnalysisHandler, listAnalyses: listAnalysesHandler } =
  await import('../controllers/analyses.controller.js');
const { authenticate, requireAuth } = await import('../middleware/auth.middleware.js');
import { Router } from 'express';

// Create a project-scoped analyses route for testing createAnalysis and listAnalyses
function createProjectAnalysesRouter() {
  const router = Router();
  router.post('/:id/analyses', authenticate, requireAuth, createAnalysisHandler);
  router.get('/:id/analyses', authenticate, requireAuth, listAnalysesHandler);
  return router;
}

/**
 * Create a mock analysis for testing.
 */
function createMockAnalysis(
  overrides?: Partial<HazopAnalysisWithDetails>
): HazopAnalysisWithDetails {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    projectId: '660e8400-e29b-41d4-a716-446655440001',
    documentId: '770e8400-e29b-41d4-a716-446655440002',
    name: 'Test Analysis',
    description: 'Test analysis description',
    status: 'draft' as AnalysisStatus,
    leadAnalystId: '880e8400-e29b-41d4-a716-446655440003',
    createdById: '880e8400-e29b-41d4-a716-446655440003',
    approvedById: null,
    approvalComments: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    approvedAt: null,
    documentName: 'Test P&ID Document.pdf',
    leadAnalystName: 'Test Analyst',
    leadAnalystEmail: 'analyst@example.com',
    createdByName: 'Test Analyst',
    createdByEmail: 'analyst@example.com',
    ...overrides,
  };
}

/**
 * Create a mock analysis with progress metrics for testing.
 */
function createMockAnalysisWithProgress(
  overrides?: Partial<HazopAnalysisWithDetailsAndProgress>
): HazopAnalysisWithDetailsAndProgress {
  return {
    ...createMockAnalysis(overrides),
    totalNodes: 10,
    analyzedNodes: 5,
    totalEntries: 15,
    highRiskCount: 2,
    mediumRiskCount: 5,
    lowRiskCount: 8,
    ...overrides,
  };
}

/**
 * Create a mock analysis entry for testing.
 */
function createMockEntry(overrides?: Partial<AnalysisEntry>): AnalysisEntry {
  return {
    id: '990e8400-e29b-41d4-a716-446655440004',
    analysisId: '550e8400-e29b-41d4-a716-446655440000',
    nodeId: 'aa0e8400-e29b-41d4-a716-446655440005',
    guideWord: 'more' as GuideWord,
    parameter: 'flow',
    deviation: 'More flow than intended',
    causes: ['Valve stuck open', 'Control system failure'],
    consequences: ['Equipment damage', 'Process upset'],
    safeguards: ['High flow alarm', 'Relief valve'],
    recommendations: ['Install redundant control'],
    notes: 'Test notes',
    severity: 3,
    likelihood: 2,
    detectability: 2,
    riskScore: 12,
    riskLevel: 'medium' as RiskLevel,
    createdById: '880e8400-e29b-41d4-a716-446655440003',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
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
    id: '880e8400-e29b-41d4-a716-446655440003',
    email: 'user@example.com',
    role: 'analyst',
    organization: 'Acme Corp',
    ...overrides,
  };
}

describe('Analyses Routes API Tests', () => {
  let app: Express;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Default to authenticated user
    mockCurrentUser = createAuthenticatedUser();

    // Create fresh Express app
    app = express();
    app.use(express.json());
    app.use('/analyses', analysesRoutes);
  });

  describe('GET /analyses/:id', () => {
    const validAnalysisId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful retrieval', () => {
      it('should return analysis with progress metrics and status 200', async () => {
        const mockAnalysis = createMockAnalysisWithProgress({ id: validAnalysisId });

        mockFindAnalysisByIdWithProgress.mockResolvedValue(mockAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/analyses/${validAnalysisId}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.analysis).toBeDefined();
        expect(response.body.data.analysis.id).toBe(validAnalysisId);
        expect(response.body.data.analysis.totalNodes).toBe(10);
        expect(response.body.data.analysis.analyzedNodes).toBe(5);
      });

      it('should include risk distribution in response', async () => {
        const mockAnalysis = createMockAnalysisWithProgress({
          highRiskCount: 3,
          mediumRiskCount: 7,
          lowRiskCount: 12,
        });

        mockFindAnalysisByIdWithProgress.mockResolvedValue(mockAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).get(`/analyses/${validAnalysisId}`);

        expect(response.status).toBe(200);
        expect(response.body.data.analysis.highRiskCount).toBe(3);
        expect(response.body.data.analysis.mediumRiskCount).toBe(7);
        expect(response.body.data.analysis.lowRiskCount).toBe(12);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).get('/analyses/invalid-uuid');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toBe('Invalid analysis ID format');
      });
    });

    describe('authorization', () => {
      it('should return 404 when analysis does not exist', async () => {
        mockFindAnalysisByIdWithProgress.mockResolvedValue(null);

        const response = await request(app).get(`/analyses/${validAnalysisId}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Analysis not found');
      });

      it('should return 403 when user does not have project access', async () => {
        const mockAnalysis = createMockAnalysisWithProgress();
        mockFindAnalysisByIdWithProgress.mockResolvedValue(mockAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).get(`/analyses/${validAnalysisId}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
        expect(response.body.error.message).toContain('do not have access');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).get(`/analyses/${validAnalysisId}`);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors', async () => {
        mockFindAnalysisByIdWithProgress.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get(`/analyses/${validAnalysisId}`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  describe('PUT /analyses/:id', () => {
    const validAnalysisId = '550e8400-e29b-41d4-a716-446655440000';
    const updateData = {
      name: 'Updated Analysis Name',
      description: 'Updated description',
    };

    describe('successful update', () => {
      it('should update analysis and return with status 200', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const updatedAnalysis = createMockAnalysis({
          name: updateData.name,
          description: updateData.description,
        });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysis.mockResolvedValue(updatedAnalysis);

        const response = await request(app).put(`/analyses/${validAnalysisId}`).send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.analysis.name).toBe(updateData.name);
      });

      it('should allow updating only name', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const updatedAnalysis = createMockAnalysis({ name: 'New Name Only' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysis.mockResolvedValue(updatedAnalysis);

        const response = await request(app)
          .put(`/analyses/${validAnalysisId}`)
          .send({ name: 'New Name Only' });

        expect(response.status).toBe(200);
        expect(mockUpdateAnalysis).toHaveBeenCalledWith(validAnalysisId, { name: 'New Name Only' });
      });

      it('should allow clearing description with null', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const updatedAnalysis = createMockAnalysis({ description: null });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysis.mockResolvedValue(updatedAnalysis);

        const response = await request(app)
          .put(`/analyses/${validAnalysisId}`)
          .send({ description: null });

        expect(response.status).toBe(200);
        expect(mockUpdateAnalysis).toHaveBeenCalledWith(validAnalysisId, { description: null });
      });

      it('should allow updating leadAnalystId', async () => {
        const newLeadAnalystId = 'bb0e8400-e29b-41d4-a716-446655440006';
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const updatedAnalysis = createMockAnalysis({ leadAnalystId: newLeadAnalystId });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysis.mockResolvedValue(updatedAnalysis);

        const response = await request(app)
          .put(`/analyses/${validAnalysisId}`)
          .send({ leadAnalystId: newLeadAnalystId });

        expect(response.status).toBe(200);
        expect(mockUpdateAnalysis).toHaveBeenCalledWith(validAnalysisId, {
          leadAnalystId: newLeadAnalystId,
        });
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).put('/analyses/invalid-uuid').send(updateData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when name is empty', async () => {
        const response = await request(app)
          .put(`/analyses/${validAnalysisId}`)
          .send({ name: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'name', code: 'EMPTY' })])
        );
      });

      it('should return 400 when name is null', async () => {
        const response = await request(app)
          .put(`/analyses/${validAnalysisId}`)
          .send({ name: null });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'name', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 when name exceeds 255 characters', async () => {
        const response = await request(app)
          .put(`/analyses/${validAnalysisId}`)
          .send({ name: 'a'.repeat(256) });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'name', code: 'MAX_LENGTH' })])
        );
      });

      it('should return 400 when description is not a string', async () => {
        const response = await request(app)
          .put(`/analyses/${validAnalysisId}`)
          .send({ description: 123 });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'description', code: 'INVALID_TYPE' }),
          ])
        );
      });

      it('should return 400 when leadAnalystId is invalid UUID', async () => {
        const response = await request(app)
          .put(`/analyses/${validAnalysisId}`)
          .send({ leadAnalystId: 'not-a-uuid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'leadAnalystId', code: 'INVALID_FORMAT' }),
          ])
        );
      });
    });

    describe('status constraints', () => {
      it('should return 400 when analysis is not in draft status', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'in_review' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).put(`/analyses/${validAnalysisId}`).send(updateData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
        expect(response.body.error.message).toContain('Only draft analyses');
      });

      it('should return 400 when analysis is approved', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'approved' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).put(`/analyses/${validAnalysisId}`).send(updateData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
      });
    });

    describe('authorization', () => {
      it('should return 404 when analysis not found', async () => {
        mockFindAnalysisById.mockResolvedValue(null);

        const response = await request(app).put(`/analyses/${validAnalysisId}`).send(updateData);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 403 when user has no project access', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).put(`/analyses/${validAnalysisId}`).send(updateData);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).put(`/analyses/${validAnalysisId}`).send(updateData);

        expect(response.status).toBe(401);
      });
    });

    describe('error handling', () => {
      it('should return 400 when lead analyst does not exist (FK violation)', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const dbError = new Error('foreign key violation') as Error & { code: string };
        dbError.code = '23503';

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysis.mockRejectedValue(dbError);

        const response = await request(app)
          .put(`/analyses/${validAnalysisId}`)
          .send({ leadAnalystId: 'bb0e8400-e29b-41d4-a716-446655440006' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain('lead analyst does not exist');
      });

      it('should return 500 on unexpected errors', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysis.mockRejectedValue(new Error('Unexpected error'));

        const response = await request(app).put(`/analyses/${validAnalysisId}`).send(updateData);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  describe('POST /analyses/:id/complete', () => {
    const validAnalysisId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful completion', () => {
      it('should complete analysis and return with status 200', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'in_review' });
        const completedAnalysis = createMockAnalysis({
          status: 'approved',
          approvedById: mockCurrentUser!.id,
          approvalComments: 'Approved',
          approvedAt: new Date(),
        });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('lead');
        mockApproveAnalysis.mockResolvedValue(completedAnalysis);

        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/complete`)
          .send({ comments: 'Approved' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.analysis.status).toBe('approved');
      });

      it('should complete analysis without comments', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'in_review' });
        const completedAnalysis = createMockAnalysis({ status: 'approved' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');
        mockApproveAnalysis.mockResolvedValue(completedAnalysis);

        const response = await request(app).post(`/analyses/${validAnalysisId}/complete`).send({});

        expect(response.status).toBe(200);
        expect(mockApproveAnalysis).toHaveBeenCalledWith(validAnalysisId, mockCurrentUser!.id, '');
      });

      it('should allow analyst to complete', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'in_review' });
        const completedAnalysis = createMockAnalysis({ status: 'approved' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockApproveAnalysis.mockResolvedValue(completedAnalysis);

        const response = await request(app).post(`/analyses/${validAnalysisId}/complete`).send({});

        expect(response.status).toBe(200);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).post('/analyses/invalid-uuid/complete').send({});

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when comments is not a string', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/complete`)
          .send({ comments: 123 });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'comments', code: 'INVALID_TYPE' }),
          ])
        );
      });
    });

    describe('status constraints', () => {
      it('should return 400 when analysis is not in review status', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');

        const response = await request(app).post(`/analyses/${validAnalysisId}/complete`).send({});

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
        expect(response.body.error.message).toContain('in review status');
      });

      it('should return 400 when analysis is already approved', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'approved' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');

        const response = await request(app).post(`/analyses/${validAnalysisId}/complete`).send({});

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
      });
    });

    describe('authorization', () => {
      it('should return 404 when analysis not found', async () => {
        mockFindAnalysisById.mockResolvedValue(null);

        const response = await request(app).post(`/analyses/${validAnalysisId}/complete`).send({});

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 403 when user has no project access', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'in_review' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).post(`/analyses/${validAnalysisId}/complete`).send({});

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should return 403 when user is a viewer', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'in_review' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('viewer');

        const response = await request(app).post(`/analyses/${validAnalysisId}/complete`).send({});

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
        expect(response.body.error.message).toContain('permission to complete');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).post(`/analyses/${validAnalysisId}/complete`).send({});

        expect(response.status).toBe(401);
      });
    });

    describe('error handling', () => {
      it('should return 500 on unexpected errors', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'in_review' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');
        mockApproveAnalysis.mockRejectedValue(new Error('Unexpected error'));

        const response = await request(app).post(`/analyses/${validAnalysisId}/complete`).send({});

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  describe('POST /analyses/:id/entries', () => {
    const validAnalysisId = '550e8400-e29b-41d4-a716-446655440000';
    const validEntryData = {
      nodeId: 'aa0e8400-e29b-41d4-a716-446655440005',
      guideWord: 'more',
      parameter: 'flow',
      deviation: 'More flow than intended',
      causes: ['Valve stuck open'],
      consequences: ['Equipment damage'],
      safeguards: ['High flow alarm'],
      recommendations: ['Install redundant control'],
    };

    describe('successful creation', () => {
      it('should create entry and return with status 201', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const mockEntry = createMockEntry();

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockNodeExistsInDocument.mockResolvedValue(true);
        mockCreateAnalysisEntry.mockResolvedValue(mockEntry);

        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send(validEntryData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.entry).toBeDefined();
        expect(response.body.data.entry.guideWord).toBe('more');
      });

      it('should create entry with minimal required fields', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const mockEntry = createMockEntry();

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockNodeExistsInDocument.mockResolvedValue(true);
        mockCreateAnalysisEntry.mockResolvedValue(mockEntry);

        const response = await request(app).post(`/analyses/${validAnalysisId}/entries`).send({
          nodeId: validEntryData.nodeId,
          guideWord: 'no',
          parameter: 'flow',
          deviation: 'No flow',
        });

        expect(response.status).toBe(201);
      });

      it('should pass arrays correctly to service', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const mockEntry = createMockEntry();

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockNodeExistsInDocument.mockResolvedValue(true);
        mockCreateAnalysisEntry.mockResolvedValue(mockEntry);

        await request(app).post(`/analyses/${validAnalysisId}/entries`).send(validEntryData);

        expect(mockCreateAnalysisEntry).toHaveBeenCalledWith(
          mockCurrentUser!.id,
          expect.objectContaining({
            analysisId: validAnalysisId,
            causes: ['Valve stuck open'],
            consequences: ['Equipment damage'],
            safeguards: ['High flow alarm'],
            recommendations: ['Install redundant control'],
          })
        );
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid analysis UUID format', async () => {
        const response = await request(app)
          .post('/analyses/invalid-uuid/entries')
          .send(validEntryData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when nodeId is missing', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, nodeId: undefined });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'nodeId', code: 'REQUIRED' })])
        );
      });

      it('should return 400 when nodeId is invalid UUID', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, nodeId: 'not-a-uuid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'nodeId', code: 'INVALID_FORMAT' }),
          ])
        );
      });

      it('should return 400 when guideWord is missing', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, guideWord: undefined });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'guideWord', code: 'REQUIRED' }),
          ])
        );
      });

      it('should return 400 when guideWord is invalid', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, guideWord: 'invalid_guideword' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'guideWord', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 when parameter is missing', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, parameter: undefined });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'parameter', code: 'REQUIRED' }),
          ])
        );
      });

      it('should return 400 when parameter is empty', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, parameter: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'parameter', code: 'EMPTY' })])
        );
      });

      it('should return 400 when parameter exceeds 100 characters', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, parameter: 'a'.repeat(101) });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'parameter', code: 'MAX_LENGTH' }),
          ])
        );
      });

      it('should return 400 when deviation is missing', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, deviation: undefined });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'deviation', code: 'REQUIRED' }),
          ])
        );
      });

      it('should return 400 when deviation is empty', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, deviation: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'deviation', code: 'EMPTY' })])
        );
      });

      it('should return 400 when causes is not an array', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, causes: 'not an array' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'causes', code: 'INVALID_TYPE' }),
          ])
        );
      });

      it('should return 400 when causes contains non-string', async () => {
        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send({ ...validEntryData, causes: ['valid', 123] });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'causes', code: 'INVALID_TYPE' }),
          ])
        );
      });
    });

    describe('status constraints', () => {
      it('should return 400 when analysis is not in draft status', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'in_review' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send(validEntryData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
        expect(response.body.error.message).toContain('draft analyses');
      });
    });

    describe('authorization', () => {
      it('should return 404 when analysis not found', async () => {
        mockFindAnalysisById.mockResolvedValue(null);

        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send(validEntryData);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Analysis not found');
      });

      it('should return 403 when user has no project access', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send(validEntryData);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should return 404 when node not found in document', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockNodeExistsInDocument.mockResolvedValue(false);

        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send(validEntryData);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toContain('Node not found');
      });
    });

    describe('conflict handling', () => {
      it('should return 409 when entry already exists for node/guideword/parameter', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const dbError = new Error('duplicate key') as Error & { code: string };
        dbError.code = '23505';

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockNodeExistsInDocument.mockResolvedValue(true);
        mockCreateAnalysisEntry.mockRejectedValue(dbError);

        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send(validEntryData);

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('CONFLICT');
        expect(response.body.error.message).toContain('already exists');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send(validEntryData);

        expect(response.status).toBe(401);
      });
    });

    describe('error handling', () => {
      it('should return 500 on unexpected errors', async () => {
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockNodeExistsInDocument.mockResolvedValue(true);
        mockCreateAnalysisEntry.mockRejectedValue(new Error('Unexpected error'));

        const response = await request(app)
          .post(`/analyses/${validAnalysisId}/entries`)
          .send(validEntryData);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  describe('GET /analyses/:id/entries', () => {
    const validAnalysisId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful list', () => {
      it('should return paginated list of entries with status 200', async () => {
        const existingAnalysis = createMockAnalysis();
        const mockEntries = [
          createMockEntry({ id: 'entry-1' }),
          createMockEntry({ id: 'entry-2' }),
        ];

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListAnalysisEntries.mockResolvedValue({
          entries: mockEntries,
          total: 2,
        });

        const response = await request(app).get(`/analyses/${validAnalysisId}/entries`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.entries).toHaveLength(2);
        expect(response.body.meta.total).toBe(2);
        expect(response.body.meta.page).toBe(1);
        expect(response.body.meta.limit).toBe(20);
      });

      it('should pass query parameters to service', async () => {
        const existingAnalysis = createMockAnalysis();

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListAnalysisEntries.mockResolvedValue({ entries: [], total: 0 });

        await request(app).get(`/analyses/${validAnalysisId}/entries`).query({
          page: '2',
          limit: '10',
          sortBy: 'parameter',
          sortOrder: 'asc',
          search: 'flow',
          nodeId: 'aa0e8400-e29b-41d4-a716-446655440005',
          guideWord: 'more',
          riskLevel: 'high',
        });

        expect(mockListAnalysisEntries).toHaveBeenCalledWith(
          validAnalysisId,
          {
            nodeId: 'aa0e8400-e29b-41d4-a716-446655440005',
            guideWord: 'more',
            riskLevel: 'high',
            search: 'flow',
          },
          { page: 2, limit: 10, sortBy: 'parameter', sortOrder: 'asc' }
        );
      });

      it('should calculate pagination metadata correctly', async () => {
        const existingAnalysis = createMockAnalysis();

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListAnalysisEntries.mockResolvedValue({
          entries: [createMockEntry()],
          total: 50,
        });

        const response = await request(app)
          .get(`/analyses/${validAnalysisId}/entries`)
          .query({ page: '2', limit: '10' });

        expect(response.status).toBe(200);
        expect(response.body.meta.page).toBe(2);
        expect(response.body.meta.limit).toBe(10);
        expect(response.body.meta.total).toBe(50);
        expect(response.body.meta.totalPages).toBe(5);
        expect(response.body.meta.hasNextPage).toBe(true);
        expect(response.body.meta.hasPrevPage).toBe(true);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).get('/analyses/invalid-uuid/entries');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid page parameter', async () => {
        const response = await request(app)
          .get(`/analyses/${validAnalysisId}/entries`)
          .query({ page: '0' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'page', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid limit parameter', async () => {
        const response = await request(app)
          .get(`/analyses/${validAnalysisId}/entries`)
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
          .get(`/analyses/${validAnalysisId}/entries`)
          .query({ sortBy: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'sortBy', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid sortOrder parameter', async () => {
        const response = await request(app)
          .get(`/analyses/${validAnalysisId}/entries`)
          .query({ sortOrder: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'sortOrder', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid guideWord filter', async () => {
        const response = await request(app)
          .get(`/analyses/${validAnalysisId}/entries`)
          .query({ guideWord: 'invalid_guideword' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'guideWord', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid riskLevel filter', async () => {
        const response = await request(app)
          .get(`/analyses/${validAnalysisId}/entries`)
          .query({ riskLevel: 'invalid_level' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'riskLevel', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid nodeId filter', async () => {
        const response = await request(app)
          .get(`/analyses/${validAnalysisId}/entries`)
          .query({ nodeId: 'not-a-uuid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'nodeId', code: 'INVALID_FORMAT' }),
          ])
        );
      });
    });

    describe('authorization', () => {
      it('should return 404 when analysis not found', async () => {
        mockFindAnalysisById.mockResolvedValue(null);

        const response = await request(app).get(`/analyses/${validAnalysisId}/entries`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 403 when user has no project access', async () => {
        const existingAnalysis = createMockAnalysis();

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).get(`/analyses/${validAnalysisId}/entries`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).get(`/analyses/${validAnalysisId}/entries`);

        expect(response.status).toBe(401);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors', async () => {
        const existingAnalysis = createMockAnalysis();

        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListAnalysisEntries.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get(`/analyses/${validAnalysisId}/entries`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });
});

/**
 * Tests for project-scoped analysis endpoints.
 * These endpoints are part of /projects/:id/analyses but are tested here
 * because they are related to analysis functionality.
 */
describe('Project Analyses Routes API Tests', () => {
  let app: Express;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Default to authenticated user
    mockCurrentUser = createAuthenticatedUser();

    // Create fresh Express app with project-scoped routes
    app = express();
    app.use(express.json());
    app.use('/projects', createProjectAnalysesRouter());
  });

  describe('POST /projects/:id/analyses', () => {
    const validProjectId = '660e8400-e29b-41d4-a716-446655440001';
    const validAnalysisData = {
      documentId: '770e8400-e29b-41d4-a716-446655440002',
      name: 'New Analysis Session',
      description: 'Analysis description',
    };

    describe('successful creation', () => {
      it('should create analysis and return with status 201', async () => {
        const mockAnalysis = createMockAnalysis({
          name: validAnalysisData.name,
          description: validAnalysisData.description,
        });

        mockUserHasProjectAccess.mockResolvedValue(true);
        mockDocumentBelongsToProject.mockResolvedValue(true);
        mockCreateAnalysis.mockResolvedValue(mockAnalysis);

        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send(validAnalysisData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.analysis).toBeDefined();
        expect(response.body.data.analysis.name).toBe(validAnalysisData.name);
      });

      it('should create analysis with minimal required fields', async () => {
        const mockAnalysis = createMockAnalysis({ name: 'Minimal Analysis' });

        mockUserHasProjectAccess.mockResolvedValue(true);
        mockDocumentBelongsToProject.mockResolvedValue(true);
        mockCreateAnalysis.mockResolvedValue(mockAnalysis);

        const response = await request(app).post(`/projects/${validProjectId}/analyses`).send({
          documentId: validAnalysisData.documentId,
          name: 'Minimal Analysis',
        });

        expect(response.status).toBe(201);
      });

      it('should pass leadAnalystId to service when provided', async () => {
        const leadAnalystId = 'cc0e8400-e29b-41d4-a716-446655440007';
        const mockAnalysis = createMockAnalysis({ leadAnalystId });

        mockUserHasProjectAccess.mockResolvedValue(true);
        mockDocumentBelongsToProject.mockResolvedValue(true);
        mockCreateAnalysis.mockResolvedValue(mockAnalysis);

        await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send({
            ...validAnalysisData,
            leadAnalystId,
          });

        expect(mockCreateAnalysis).toHaveBeenCalledWith(
          mockCurrentUser!.id,
          expect.objectContaining({
            leadAnalystId,
          })
        );
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid project UUID format', async () => {
        const response = await request(app)
          .post('/projects/invalid-uuid/analyses')
          .send(validAnalysisData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toBe('Invalid project ID format');
      });

      it('should return 400 when documentId is missing', async () => {
        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send({ name: 'Analysis Name' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'documentId', code: 'REQUIRED' }),
          ])
        );
      });

      it('should return 400 when documentId is invalid UUID', async () => {
        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send({ ...validAnalysisData, documentId: 'not-a-uuid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'documentId', code: 'INVALID_FORMAT' }),
          ])
        );
      });

      it('should return 400 when name is missing', async () => {
        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send({ documentId: validAnalysisData.documentId });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'name', code: 'REQUIRED' })])
        );
      });

      it('should return 400 when name is empty', async () => {
        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send({ ...validAnalysisData, name: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'name', code: 'EMPTY' })])
        );
      });

      it('should return 400 when name exceeds 255 characters', async () => {
        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send({ ...validAnalysisData, name: 'a'.repeat(256) });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'name', code: 'MAX_LENGTH' })])
        );
      });

      it('should return 400 when description is not a string', async () => {
        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send({ ...validAnalysisData, description: 123 });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'description', code: 'INVALID_TYPE' }),
          ])
        );
      });

      it('should return 400 when leadAnalystId is invalid UUID', async () => {
        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send({ ...validAnalysisData, leadAnalystId: 'not-a-uuid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'leadAnalystId', code: 'INVALID_FORMAT' }),
          ])
        );
      });
    });

    describe('authorization', () => {
      it('should return 404 when project does not exist', async () => {
        mockUserHasProjectAccess.mockResolvedValue(false);
        mockFindProjectById.mockResolvedValue(null);

        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send(validAnalysisData);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Project not found');
      });

      it('should return 403 when user does not have project access', async () => {
        mockUserHasProjectAccess.mockResolvedValue(false);
        mockFindProjectById.mockResolvedValue({ id: validProjectId });

        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send(validAnalysisData);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should return 404 when document does not belong to project', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockDocumentBelongsToProject.mockResolvedValue(false);

        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send(validAnalysisData);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toContain('Document not found');
      });
    });

    describe('foreign key errors', () => {
      it('should return 400 when lead analyst does not exist', async () => {
        const dbError = new Error('foreign key violation') as Error & { code: string };
        dbError.code = '23503';

        mockUserHasProjectAccess.mockResolvedValue(true);
        mockDocumentBelongsToProject.mockResolvedValue(true);
        mockCreateAnalysis.mockRejectedValue(dbError);

        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send({
            ...validAnalysisData,
            leadAnalystId: 'cc0e8400-e29b-41d4-a716-446655440007',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain('lead analyst does not exist');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send(validAnalysisData);

        expect(response.status).toBe(401);
      });
    });

    describe('error handling', () => {
      it('should return 500 on unexpected errors', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockDocumentBelongsToProject.mockResolvedValue(true);
        mockCreateAnalysis.mockRejectedValue(new Error('Unexpected error'));

        const response = await request(app)
          .post(`/projects/${validProjectId}/analyses`)
          .send(validAnalysisData);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  describe('GET /projects/:id/analyses', () => {
    const validProjectId = '660e8400-e29b-41d4-a716-446655440001';

    describe('successful list', () => {
      it('should return paginated list of analyses with status 200', async () => {
        const mockAnalyses = [
          createMockAnalysis({ id: 'analysis-1', name: 'Analysis 1' }),
          createMockAnalysis({ id: 'analysis-2', name: 'Analysis 2' }),
        ];

        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectAnalyses.mockResolvedValue({
          analyses: mockAnalyses,
          total: 2,
        });

        const response = await request(app).get(`/projects/${validProjectId}/analyses`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.meta.total).toBe(2);
        expect(response.body.meta.page).toBe(1);
        expect(response.body.meta.limit).toBe(20);
      });

      it('should pass query parameters to service', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectAnalyses.mockResolvedValue({ analyses: [], total: 0 });

        await request(app).get(`/projects/${validProjectId}/analyses`).query({
          page: '2',
          limit: '10',
          sortBy: 'name',
          sortOrder: 'asc',
          search: 'test',
          status: 'draft',
          leadAnalystId: '880e8400-e29b-41d4-a716-446655440003',
          documentId: '770e8400-e29b-41d4-a716-446655440002',
        });

        expect(mockListProjectAnalyses).toHaveBeenCalledWith(
          validProjectId,
          {
            status: 'draft',
            leadAnalystId: '880e8400-e29b-41d4-a716-446655440003',
            documentId: '770e8400-e29b-41d4-a716-446655440002',
            search: 'test',
          },
          { page: 2, limit: 10, sortBy: 'name', sortOrder: 'asc' }
        );
      });

      it('should calculate pagination metadata correctly', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectAnalyses.mockResolvedValue({
          analyses: [createMockAnalysis()],
          total: 50,
        });

        const response = await request(app)
          .get(`/projects/${validProjectId}/analyses`)
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
        mockListProjectAnalyses.mockResolvedValue({ analyses: [], total: 0 });

        const response = await request(app).get(`/projects/${validProjectId}/analyses`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(0);
        expect(response.body.meta.total).toBe(0);
        expect(response.body.meta.totalPages).toBe(0);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid project UUID format', async () => {
        const response = await request(app).get('/projects/invalid-uuid/analyses');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid page parameter', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/analyses`)
          .query({ page: '0' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'page', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid limit parameter', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/analyses`)
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
          .get(`/projects/${validProjectId}/analyses`)
          .query({ sortBy: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'sortBy', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid sortOrder parameter', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/analyses`)
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
          .get(`/projects/${validProjectId}/analyses`)
          .query({ status: 'invalid_status' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'status', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid leadAnalystId format', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/analyses`)
          .query({ leadAnalystId: 'not-a-uuid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'leadAnalystId', code: 'INVALID_FORMAT' }),
          ])
        );
      });

      it('should return 400 for invalid documentId format', async () => {
        const response = await request(app)
          .get(`/projects/${validProjectId}/analyses`)
          .query({ documentId: 'not-a-uuid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'documentId', code: 'INVALID_FORMAT' }),
          ])
        );
      });
    });

    describe('authorization', () => {
      it('should return 404 when project does not exist', async () => {
        mockUserHasProjectAccess.mockResolvedValue(false);
        mockFindProjectById.mockResolvedValue(null);

        const response = await request(app).get(`/projects/${validProjectId}/analyses`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });

      it('should return 403 when user does not have project access', async () => {
        mockUserHasProjectAccess.mockResolvedValue(false);
        mockFindProjectById.mockResolvedValue({ id: validProjectId });

        const response = await request(app).get(`/projects/${validProjectId}/analyses`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).get(`/projects/${validProjectId}/analyses`);

        expect(response.status).toBe(401);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors', async () => {
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockListProjectAnalyses.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get(`/projects/${validProjectId}/analyses`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });
});
