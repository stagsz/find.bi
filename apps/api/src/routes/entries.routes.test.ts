/**
 * API integration tests for entry endpoints.
 *
 * Tests the full API flow through routes with mocked database services.
 * All entry endpoints require authentication and project access.
 *
 * Endpoints tested:
 * - PUT /entries/:id - Update an existing analysis entry
 * - DELETE /entries/:id - Delete an existing analysis entry
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

// Mock implementations - must be declared before jest.unstable_mockModule
let mockFindAnalysisById: jest.Mock<() => Promise<HazopAnalysisWithDetails | null>>;
let mockFindAnalysisEntryById: jest.Mock<() => Promise<AnalysisEntry | null>>;
let mockUpdateAnalysisEntry: jest.Mock<() => Promise<AnalysisEntry | null>>;
let mockDeleteAnalysisEntry: jest.Mock<() => Promise<AnalysisEntry | null>>;

// Project service mocks
let mockUserHasProjectAccess: jest.Mock<() => Promise<boolean>>;
let mockGetUserProjectRole: jest.Mock<() => Promise<ProjectMemberRole | null>>;

// Current authenticated user for tests
let mockCurrentUser: { id: string; email: string; role: UserRole; organization: string } | null =
  null;

// Set up mocks before importing modules that depend on them
jest.unstable_mockModule('../services/hazop-analysis.service.js', () => {
  mockFindAnalysisById = jest.fn<() => Promise<HazopAnalysisWithDetails | null>>();
  mockFindAnalysisEntryById = jest.fn<() => Promise<AnalysisEntry | null>>();
  mockUpdateAnalysisEntry = jest.fn<() => Promise<AnalysisEntry | null>>();
  mockDeleteAnalysisEntry = jest.fn<() => Promise<AnalysisEntry | null>>();

  return {
    findAnalysisById: mockFindAnalysisById,
    findAnalysisEntryById: mockFindAnalysisEntryById,
    updateAnalysisEntry: mockUpdateAnalysisEntry,
    deleteAnalysisEntry: mockDeleteAnalysisEntry,
    // Stubs for functions not directly used by entries routes
    getEntryAnalysisId: jest.fn(),
    createAnalysis: jest.fn(),
    documentBelongsToProject: jest.fn(),
    findAnalysisByIdWithProgress: jest.fn(),
    listProjectAnalyses: jest.fn(),
    updateAnalysis: jest.fn(),
    approveAnalysis: jest.fn(),
    nodeExistsInDocument: jest.fn(),
    createAnalysisEntry: jest.fn(),
    listAnalysisEntries: jest.fn(),
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
const { default: entriesRoutes } = await import('./entries.routes.js');

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

describe('Entries Routes API Tests', () => {
  let app: Express;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Default to authenticated user
    mockCurrentUser = createAuthenticatedUser();

    // Create fresh Express app
    app = express();
    app.use(express.json());
    app.use('/entries', entriesRoutes);
  });

  describe('PUT /entries/:id', () => {
    const validEntryId = '990e8400-e29b-41d4-a716-446655440004';
    const updateData = {
      deviation: 'Updated deviation description',
      causes: ['New cause 1', 'New cause 2'],
      consequences: ['New consequence'],
      safeguards: ['New safeguard'],
      recommendations: ['New recommendation'],
      notes: 'Updated notes',
    };

    describe('successful update', () => {
      it('should update entry and return with status 200', async () => {
        const existingEntry = createMockEntry({ id: validEntryId });
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const updatedEntry = createMockEntry({
          ...updateData,
          id: validEntryId,
        });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysisEntry.mockResolvedValue(updatedEntry);

        const response = await request(app).put(`/entries/${validEntryId}`).send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.entry).toBeDefined();
        expect(response.body.data.entry.deviation).toBe(updateData.deviation);
      });

      it('should allow updating only deviation', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const updatedEntry = createMockEntry({ deviation: 'New deviation only' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysisEntry.mockResolvedValue(updatedEntry);

        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ deviation: 'New deviation only' });

        expect(response.status).toBe(200);
        expect(mockUpdateAnalysisEntry).toHaveBeenCalledWith(validEntryId, {
          deviation: 'New deviation only',
        });
      });

      it('should allow clearing notes with null', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const updatedEntry = createMockEntry({ notes: null });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysisEntry.mockResolvedValue(updatedEntry);

        const response = await request(app).put(`/entries/${validEntryId}`).send({ notes: null });

        expect(response.status).toBe(200);
        expect(mockUpdateAnalysisEntry).toHaveBeenCalledWith(validEntryId, { notes: null });
      });

      it('should allow updating arrays', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });
        const updatedEntry = createMockEntry({
          causes: ['Cause A', 'Cause B'],
          safeguards: [],
        });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysisEntry.mockResolvedValue(updatedEntry);

        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ causes: ['Cause A', 'Cause B'], safeguards: [] });

        expect(response.status).toBe(200);
        expect(mockUpdateAnalysisEntry).toHaveBeenCalledWith(validEntryId, {
          causes: ['Cause A', 'Cause B'],
          safeguards: [],
        });
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).put('/entries/invalid-uuid').send(updateData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toBe('Invalid entry ID format');
      });

      it('should return 400 when deviation is empty', async () => {
        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ deviation: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'deviation', code: 'EMPTY' })])
        );
      });

      it('should return 400 when deviation is null', async () => {
        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ deviation: null });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'deviation', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 when deviation is not a string', async () => {
        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ deviation: 123 });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'deviation', code: 'INVALID_TYPE' }),
          ])
        );
      });

      it('should return 400 when causes is not an array', async () => {
        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ causes: 'not an array' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'causes', code: 'INVALID_TYPE' }),
          ])
        );
      });

      it('should return 400 when causes contains non-string', async () => {
        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ causes: ['valid', 123, 'also valid'] });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'causes', code: 'INVALID_TYPE' }),
          ])
        );
      });

      it('should return 400 when consequences is not an array', async () => {
        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ consequences: { not: 'array' } });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'consequences', code: 'INVALID_TYPE' }),
          ])
        );
      });

      it('should return 400 when safeguards is not an array', async () => {
        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ safeguards: 42 });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'safeguards', code: 'INVALID_TYPE' }),
          ])
        );
      });

      it('should return 400 when recommendations is not an array', async () => {
        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ recommendations: true });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'recommendations', code: 'INVALID_TYPE' }),
          ])
        );
      });

      it('should return 400 when notes is not a string', async () => {
        const response = await request(app)
          .put(`/entries/${validEntryId}`)
          .send({ notes: ['array', 'not', 'string'] });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'notes', code: 'INVALID_TYPE' }),
          ])
        );
      });
    });

    describe('status constraints', () => {
      it('should return 400 when analysis is not in draft status', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'in_review' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).put(`/entries/${validEntryId}`).send(updateData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
        expect(response.body.error.message).toContain('draft analyses');
      });

      it('should return 400 when analysis is approved', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'approved' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(app).put(`/entries/${validEntryId}`).send(updateData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
      });
    });

    describe('authorization', () => {
      it('should return 404 when entry not found', async () => {
        mockFindAnalysisEntryById.mockResolvedValue(null);

        const response = await request(app).put(`/entries/${validEntryId}`).send(updateData);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Analysis entry not found');
      });

      it('should return 404 when analysis not found', async () => {
        const existingEntry = createMockEntry();

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(null);

        const response = await request(app).put(`/entries/${validEntryId}`).send(updateData);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Analysis not found');
      });

      it('should return 403 when user has no project access', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).put(`/entries/${validEntryId}`).send(updateData);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).put(`/entries/${validEntryId}`).send(updateData);

        expect(response.status).toBe(401);
      });
    });

    describe('error handling', () => {
      it('should return 500 on unexpected errors', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockUpdateAnalysisEntry.mockRejectedValue(new Error('Unexpected error'));

        const response = await request(app).put(`/entries/${validEntryId}`).send(updateData);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  describe('DELETE /entries/:id', () => {
    const validEntryId = '990e8400-e29b-41d4-a716-446655440004';

    describe('successful deletion', () => {
      it('should delete entry and return with status 200', async () => {
        const existingEntry = createMockEntry({ id: validEntryId });
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('member');
        mockDeleteAnalysisEntry.mockResolvedValue(existingEntry);

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toBe('Analysis entry deleted successfully');
        expect(response.body.data.entryId).toBe(validEntryId);
      });

      it('should allow owner to delete', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');
        mockDeleteAnalysisEntry.mockResolvedValue(existingEntry);

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(200);
      });

      it('should allow lead to delete', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('lead');
        mockDeleteAnalysisEntry.mockResolvedValue(existingEntry);

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(200);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app).delete('/entries/invalid-uuid');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toBe('Invalid entry ID format');
      });
    });

    describe('status constraints', () => {
      it('should return 400 when analysis is not in draft status', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'in_review' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
        expect(response.body.error.message).toContain('draft analyses');
      });

      it('should return 400 when analysis is approved', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'approved' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
      });
    });

    describe('authorization', () => {
      it('should return 404 when entry not found', async () => {
        mockFindAnalysisEntryById.mockResolvedValue(null);

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Analysis entry not found');
      });

      it('should return 404 when analysis not found', async () => {
        const existingEntry = createMockEntry();

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(null);

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Analysis not found');
      });

      it('should return 403 when user has no project access', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should return 403 when user is a viewer', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('viewer');

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
        expect(response.body.error.message).toContain('permission to delete');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(401);
      });
    });

    describe('error handling', () => {
      it('should return 500 on unexpected errors', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');
        mockDeleteAnalysisEntry.mockRejectedValue(new Error('Unexpected error'));

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should return 404 if entry deleted between find and delete (race condition)', async () => {
        const existingEntry = createMockEntry();
        const existingAnalysis = createMockAnalysis({ status: 'draft' });

        mockFindAnalysisEntryById.mockResolvedValue(existingEntry);
        mockFindAnalysisById.mockResolvedValue(existingAnalysis);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockGetUserProjectRole.mockResolvedValue('owner');
        mockDeleteAnalysisEntry.mockResolvedValue(null);

        const response = await request(app).delete(`/entries/${validEntryId}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });
  });
});
