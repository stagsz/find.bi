/**
 * API integration tests for LOPA endpoints.
 *
 * Tests the full API flow through routes with mocked database services.
 * All LOPA endpoints require authentication and project access.
 *
 * Endpoints tested:
 * - POST /entries/:id/lopa - Create LOPA analysis for an entry
 * - GET /entries/:id/lopa - Get LOPA analysis for an entry
 *
 * Note: Tests for GET /analyses/:id/compliance and GET /projects/:id/compliance
 * are pending resolution of pre-existing type conflicts with the multer middleware.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import type {
  UserRole,
  AnalysisStatus,
  LOPAStatus,
  IPLType,
  InitiatingEventCategory,
  SafetyIntegrityLevel,
} from '@hazop/types';

// ============================================================================
// Type Definitions for Mocks
// ============================================================================

interface EntryWithAnalysisInfo {
  id: string;
  analysisId: string;
  projectId: string;
  analysisStatus: AnalysisStatus;
  severity: number | null;
}

interface LOPA {
  id: string;
  analysisEntryId: string;
  scenarioDescription: string;
  consequence: string;
  initiatingEventCategory: InitiatingEventCategory;
  initiatingEventDescription: string;
  initiatingEventFrequency: number;
  ipls: IPL[];
  targetFrequency: number;
  mitigatedEventFrequency: number;
  riskReductionRequired: number;
  riskReductionAchieved: number;
  isSufficient: boolean;
  safeguardGap: number;
  notes?: string;
  status: LOPAStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IPL {
  id: string;
  type: IPLType;
  name: string;
  description: string;
  pfd: number;
  independentOfInitiator: boolean;
  independentOfOtherIPLs: boolean;
  sil?: SafetyIntegrityLevel;
  notes?: string;
}

// ============================================================================
// Mock Declarations
// ============================================================================

// Entry LOPA mocks
let mockGetEntryWithAnalysisInfo: jest.Mock<() => Promise<EntryWithAnalysisInfo | null>>;
let mockLopaExistsForEntry: jest.Mock<() => Promise<boolean>>;
let mockCreateLOPAAnalysis: jest.Mock<() => Promise<LOPA>>;
let mockFindLOPAByEntryId: jest.Mock<() => Promise<LOPA | null>>;

// Project service mocks
let mockUserHasProjectAccess: jest.Mock<() => Promise<boolean>>;

// Current authenticated user
let mockCurrentUser: { id: string; email: string; role: UserRole; organization: string } | null =
  null;

// ============================================================================
// Mock Setup
// ============================================================================

// Mock LOPA analysis service
jest.unstable_mockModule('../services/lopa-analysis.service.js', () => {
  mockGetEntryWithAnalysisInfo = jest.fn<() => Promise<EntryWithAnalysisInfo | null>>();
  mockLopaExistsForEntry = jest.fn<() => Promise<boolean>>();
  mockCreateLOPAAnalysis = jest.fn<() => Promise<LOPA>>();
  mockFindLOPAByEntryId = jest.fn<() => Promise<LOPA | null>>();

  return {
    getEntryWithAnalysisInfo: mockGetEntryWithAnalysisInfo,
    lopaExistsForEntry: mockLopaExistsForEntry,
    createLOPAAnalysis: mockCreateLOPAAnalysis,
    findLOPAByEntryId: mockFindLOPAByEntryId,
  };
});

// Mock LOPA calculation service
jest.unstable_mockModule('../services/lopa-calculation.service.js', () => ({
  isValidInitiatingEventFrequency: jest.fn((freq: number) => freq > 0 && freq <= 100),
  isValidTargetFrequency: jest.fn((freq: number) => freq > 0 && freq <= 1),
  isValidPFD: jest.fn((pfd: number) => pfd >= 1e-5 && pfd <= 1.0),
  performLOPACalculation: jest.fn(),
  calculateTotalRRF: jest.fn(),
  calculateMitigatedEventLikelihood: jest.fn(),
  validateIPL: jest.fn(() => ({ valid: true })),
}));

// Mock hazop analysis service
jest.unstable_mockModule('../services/hazop-analysis.service.js', () => ({
  findAnalysisById: jest.fn(),
  findAnalysisEntryById: jest.fn(),
  updateAnalysisEntry: jest.fn(),
  deleteAnalysisEntry: jest.fn(),
  updateEntryRisk: jest.fn(),
  clearEntryRisk: jest.fn(),
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
}));

// Mock project service
jest.unstable_mockModule('../services/project.service.js', () => {
  mockUserHasProjectAccess = jest.fn<() => Promise<boolean>>();

  return {
    userHasProjectAccess: mockUserHasProjectAccess,
    findProjectById: jest.fn(),
    getUserProjectRole: jest.fn(),
  };
});

// Mock risk calculation service (needed by routes)
jest.unstable_mockModule('../services/risk-calculation.service.js', () => ({
  calculateRiskRanking: jest.fn((severity: number, likelihood: number, detectability: number) => ({
    severity,
    likelihood,
    detectability,
    riskScore: severity * likelihood * detectability,
    riskLevel:
      severity * likelihood * detectability <= 20
        ? 'low'
        : severity * likelihood * detectability <= 60
          ? 'medium'
          : 'high',
  })),
  validateRiskFactors: jest.fn(() => ({ valid: true })),
  calculateRiskStatistics: jest.fn(() => ({
    count: 10,
    min: 1,
    max: 125,
    mean: 50,
    median: 45,
    standardDeviation: 20,
    percentiles: { p25: 20, p50: 45, p75: 70, p90: 100, p95: 115 },
  })),
  getRiskDistribution: jest.fn(() => ({ low: 40, medium: 35, high: 25 })),
}));

// Mock auth middleware
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

// ============================================================================
// Test Helpers
// ============================================================================

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

function createMockEntryInfo(overrides?: Partial<EntryWithAnalysisInfo>): EntryWithAnalysisInfo {
  return {
    id: '990e8400-e29b-41d4-a716-446655440004',
    analysisId: '550e8400-e29b-41d4-a716-446655440000',
    projectId: '660e8400-e29b-41d4-a716-446655440001',
    analysisStatus: 'draft' as AnalysisStatus,
    severity: 4,
    ...overrides,
  };
}

function createMockLOPA(overrides?: Partial<LOPA>): LOPA {
  return {
    id: 'aa0e8400-e29b-41d4-a716-446655440010',
    analysisEntryId: '990e8400-e29b-41d4-a716-446655440004',
    scenarioDescription: 'High pressure scenario in reactor vessel',
    consequence: 'Equipment rupture and potential release',
    initiatingEventCategory: 'equipment_failure' as InitiatingEventCategory,
    initiatingEventDescription: 'Pressure relief valve fails to open',
    initiatingEventFrequency: 0.01,
    ipls: [
      {
        id: 'ipl-001',
        type: 'safety_instrumented_function' as IPLType,
        name: 'High pressure trip',
        description: 'SIS trips on high pressure',
        pfd: 0.01,
        independentOfInitiator: true,
        independentOfOtherIPLs: true,
        sil: 2 as SafetyIntegrityLevel,
      },
    ],
    targetFrequency: 1e-4,
    mitigatedEventFrequency: 0.0001,
    riskReductionRequired: 100,
    riskReductionAchieved: 100,
    isSufficient: true,
    safeguardGap: 0,
    status: 'draft' as LOPAStatus,
    createdById: '880e8400-e29b-41d4-a716-446655440003',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function createValidLOPARequest() {
  return {
    scenarioDescription: 'High pressure scenario in reactor vessel',
    consequence: 'Equipment rupture and potential release',
    initiatingEventCategory: 'equipment_failure',
    initiatingEventDescription: 'Pressure relief valve fails to open',
    initiatingEventFrequency: 0.01,
    ipls: [
      {
        type: 'safety_instrumented_function',
        name: 'High pressure trip',
        description: 'SIS trips on high pressure',
        pfd: 0.01,
        independentOfInitiator: true,
        independentOfOtherIPLs: true,
        sil: 2,
      },
    ],
    targetFrequency: 1e-4,
    notes: 'Test LOPA analysis',
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('LOPA Routes API Tests', () => {
  let entriesApp: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = createAuthenticatedUser();

    // Create fresh Express app
    entriesApp = express();
    entriesApp.use(express.json());
    entriesApp.use('/entries', entriesRoutes);
  });

  // ==========================================================================
  // POST /entries/:id/lopa - Create LOPA analysis
  // ==========================================================================

  describe('POST /entries/:id/lopa', () => {
    const validEntryId = '990e8400-e29b-41d4-a716-446655440004';

    describe('successful creation', () => {
      it('should create LOPA and return with status 201', async () => {
        const entryInfo = createMockEntryInfo();
        const lopa = createMockLOPA();

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockLopaExistsForEntry.mockResolvedValue(false);
        mockCreateLOPAAnalysis.mockResolvedValue(lopa);

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(createValidLOPARequest());

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.lopa).toBeDefined();
        expect(response.body.data.lopa.scenarioDescription).toBe(
          'High pressure scenario in reactor vessel'
        );
        expect(response.body.data.lopa.isSufficient).toBe(true);
      });

      it('should create LOPA without optional notes', async () => {
        const entryInfo = createMockEntryInfo();
        const lopa = createMockLOPA({ notes: undefined });
        const requestBody = createValidLOPARequest();
        delete (requestBody as Record<string, unknown>).notes;

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockLopaExistsForEntry.mockResolvedValue(false);
        mockCreateLOPAAnalysis.mockResolvedValue(lopa);

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(requestBody);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      it('should create LOPA with multiple IPLs', async () => {
        const entryInfo = createMockEntryInfo();
        const multipleIPLs: IPL[] = [
          {
            id: 'ipl-001',
            type: 'safety_instrumented_function' as IPLType,
            name: 'High pressure trip',
            description: 'SIS trips on high pressure',
            pfd: 0.01,
            independentOfInitiator: true,
            independentOfOtherIPLs: true,
            sil: 2 as SafetyIntegrityLevel,
          },
          {
            id: 'ipl-002',
            type: 'relief_device' as IPLType,
            name: 'Pressure relief valve',
            description: 'Spring-loaded relief valve',
            pfd: 0.001,
            independentOfInitiator: true,
            independentOfOtherIPLs: true,
          },
        ];
        const lopa = createMockLOPA({ ipls: multipleIPLs });

        const requestBody = {
          ...createValidLOPARequest(),
          ipls: [
            {
              type: 'safety_instrumented_function',
              name: 'High pressure trip',
              description: 'SIS trips on high pressure',
              pfd: 0.01,
              independentOfInitiator: true,
              independentOfOtherIPLs: true,
              sil: 2,
            },
            {
              type: 'relief_device',
              name: 'Pressure relief valve',
              description: 'Spring-loaded relief valve',
              pfd: 0.001,
              independentOfInitiator: true,
              independentOfOtherIPLs: true,
            },
          ],
        };

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockLopaExistsForEntry.mockResolvedValue(false);
        mockCreateLOPAAnalysis.mockResolvedValue(lopa);

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(requestBody);

        expect(response.status).toBe(201);
        expect(response.body.data.lopa.ipls).toHaveLength(2);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(entriesApp)
          .post('/entries/invalid-uuid/lopa')
          .send(createValidLOPARequest());

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toBe('Invalid entry ID format');
      });

      it('should return 400 when scenarioDescription is missing', async () => {
        const requestBody = createValidLOPARequest();
        delete (requestBody as Record<string, unknown>).scenarioDescription;

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(requestBody);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when consequence is missing', async () => {
        const requestBody = createValidLOPARequest();
        delete (requestBody as Record<string, unknown>).consequence;

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(requestBody);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when initiatingEventFrequency is negative', async () => {
        const requestBody = {
          ...createValidLOPARequest(),
          initiatingEventFrequency: -0.01,
        };

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(requestBody);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when targetFrequency is negative', async () => {
        const requestBody = {
          ...createValidLOPARequest(),
          targetFrequency: -1e-4,
        };

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(requestBody);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when ipls is not an array', async () => {
        const requestBody = {
          ...createValidLOPARequest(),
          ipls: 'not an array',
        };

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(requestBody);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 when IPL is missing pfd', async () => {
        const requestBody = {
          ...createValidLOPARequest(),
          ipls: [
            {
              type: 'safety_instrumented_function',
              name: 'High pressure trip',
              description: 'SIS trips on high pressure',
              independentOfInitiator: true,
              independentOfOtherIPLs: true,
            },
          ],
        };

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(requestBody);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('status constraints', () => {
      it('should return 400 when analysis is not in draft status', async () => {
        const entryInfo = createMockEntryInfo({ analysisStatus: 'in_review' });

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(createValidLOPARequest());

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
        expect(response.body.error.message).toContain('draft analyses');
      });

      it('should return 400 when analysis is approved', async () => {
        const entryInfo = createMockEntryInfo({ analysisStatus: 'approved' });

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(createValidLOPARequest());

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
      });

      it('should return 400 when entry has no risk assessment', async () => {
        const entryInfo = createMockEntryInfo({ severity: null });

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(createValidLOPARequest());

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain('risk assessment');
      });

      it('should return 409 when LOPA already exists for entry', async () => {
        const entryInfo = createMockEntryInfo();

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockLopaExistsForEntry.mockResolvedValue(true);

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(createValidLOPARequest());

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('CONFLICT');
        expect(response.body.error.message).toContain('already exists');
      });
    });

    describe('authorization', () => {
      it('should return 404 when entry not found', async () => {
        mockGetEntryWithAnalysisInfo.mockResolvedValue(null);

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(createValidLOPARequest());

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Analysis entry not found');
      });

      it('should return 403 when user has no project access', async () => {
        const entryInfo = createMockEntryInfo();

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(createValidLOPARequest());

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(createValidLOPARequest());

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });
    });

    describe('error handling', () => {
      it('should return 500 on unexpected errors', async () => {
        const entryInfo = createMockEntryInfo();

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockLopaExistsForEntry.mockResolvedValue(false);
        mockCreateLOPAAnalysis.mockRejectedValue(new Error('Unexpected database error'));

        const response = await request(entriesApp)
          .post(`/entries/${validEntryId}/lopa`)
          .send(createValidLOPARequest());

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  // ==========================================================================
  // GET /entries/:id/lopa - Get LOPA analysis
  // ==========================================================================

  describe('GET /entries/:id/lopa', () => {
    const validEntryId = '990e8400-e29b-41d4-a716-446655440004';

    describe('successful retrieval', () => {
      it('should return LOPA with status 200', async () => {
        const entryInfo = createMockEntryInfo();
        const lopa = createMockLOPA();

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockFindLOPAByEntryId.mockResolvedValue(lopa);

        const response = await request(entriesApp).get(`/entries/${validEntryId}/lopa`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.lopa).toBeDefined();
        expect(response.body.data.lopa.id).toBe(lopa.id);
        expect(response.body.data.lopa.scenarioDescription).toBe(lopa.scenarioDescription);
      });

      it('should return LOPA with all calculated fields', async () => {
        const entryInfo = createMockEntryInfo();
        const lopa = createMockLOPA({
          mitigatedEventFrequency: 0.0001,
          riskReductionRequired: 100,
          riskReductionAchieved: 100,
          isSufficient: true,
          safeguardGap: 0,
        });

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockFindLOPAByEntryId.mockResolvedValue(lopa);

        const response = await request(entriesApp).get(`/entries/${validEntryId}/lopa`);

        expect(response.status).toBe(200);
        expect(response.body.data.lopa.mitigatedEventFrequency).toBe(0.0001);
        expect(response.body.data.lopa.riskReductionRequired).toBe(100);
        expect(response.body.data.lopa.riskReductionAchieved).toBe(100);
        expect(response.body.data.lopa.isSufficient).toBe(true);
        expect(response.body.data.lopa.safeguardGap).toBe(0);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(entriesApp).get('/entries/invalid-uuid/lopa');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toBe('Invalid entry ID format');
      });
    });

    describe('authorization', () => {
      it('should return 404 when entry not found', async () => {
        mockGetEntryWithAnalysisInfo.mockResolvedValue(null);

        const response = await request(entriesApp).get(`/entries/${validEntryId}/lopa`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('Analysis entry not found');
      });

      it('should return 403 when user has no project access', async () => {
        const entryInfo = createMockEntryInfo();

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(false);

        const response = await request(entriesApp).get(`/entries/${validEntryId}/lopa`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should return 404 when LOPA does not exist for entry', async () => {
        const entryInfo = createMockEntryInfo();

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockFindLOPAByEntryId.mockResolvedValue(null);

        const response = await request(entriesApp).get(`/entries/${validEntryId}/lopa`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('LOPA analysis not found for this entry');
      });
    });

    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(entriesApp).get(`/entries/${validEntryId}/lopa`);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });
    });

    describe('error handling', () => {
      it('should return 500 on unexpected errors', async () => {
        const entryInfo = createMockEntryInfo();

        mockGetEntryWithAnalysisInfo.mockResolvedValue(entryInfo);
        mockUserHasProjectAccess.mockResolvedValue(true);
        mockFindLOPAByEntryId.mockRejectedValue(new Error('Unexpected database error'));

        const response = await request(entriesApp).get(`/entries/${validEntryId}/lopa`);

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });
});
