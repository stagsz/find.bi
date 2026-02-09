/**
 * API integration tests for admin endpoints.
 *
 * Tests the full API flow through routes with mocked database services.
 * All admin endpoints require administrator role authentication.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import type { User, ListUsersResult } from '../services/user.service.js';
import type { UserRole } from '@hazop/types';

// Mock implementations - must be declared before jest.unstable_mockModule
let mockListAllUsers: jest.Mock<() => Promise<ListUsersResult>>;
let mockFindUserById: jest.Mock<() => Promise<User | null>>;
let mockUpdateUserRole: jest.Mock<() => Promise<User>>;
let mockUpdateUserStatus: jest.Mock<() => Promise<User>>;

// Current authenticated user for tests
let mockCurrentUser: { id: string; email: string; role: UserRole } | null = null;

// Set up mocks before importing modules that depend on them
jest.unstable_mockModule('../services/user.service.js', () => {
  mockListAllUsers = jest.fn<() => Promise<ListUsersResult>>();
  mockFindUserById = jest.fn<() => Promise<User | null>>();
  mockUpdateUserRole = jest.fn<() => Promise<User>>();
  mockUpdateUserStatus = jest.fn<() => Promise<User>>();

  return {
    listAllUsers: mockListAllUsers,
    findUserById: mockFindUserById,
    updateUserRole: mockUpdateUserRole,
    updateUserStatus: mockUpdateUserStatus,
    // Re-export any other functions the module might need
    emailExists: jest.fn(),
    createUser: jest.fn(),
    findUserByEmail: jest.fn(),
    verifyPassword: jest.fn(),
    hashPassword: jest.fn(),
    updateUserProfile: jest.fn(),
    emailExistsForOtherUser: jest.fn(),
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

// Mock the rbac middleware
jest.unstable_mockModule('../middleware/rbac.middleware.js', () => ({
  requireRole: (role: UserRole) => (_req: Request, res: Response, next: NextFunction) => {
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
    if (mockCurrentUser.role !== role) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${role}`,
        },
      });
      return;
    }
    next();
  },
  requireAnyRole: jest.fn(),
  requireMinimumRole: jest.fn(),
}));

// Import admin routes after setting up mocks
const { default: adminRoutes } = await import('./admin.routes.js');

/**
 * Create a mock user for testing.
 */
function createMockUser(overrides?: Partial<User>): User {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test User',
    role: 'analyst' as UserRole,
    organization: 'Acme Corp',
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Create an admin user for authentication.
 */
function createAdminUser(): { id: string; email: string; role: UserRole } {
  return {
    id: '660e8400-e29b-41d4-a716-446655440001',
    email: 'admin@example.com',
    role: 'administrator',
  };
}

describe('Admin Routes API Tests', () => {
  let app: Express;

  beforeAll(() => {
    // No JWT keys needed since we're mocking auth
  });

  afterAll(() => {
    // Clean up
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Default to authenticated admin user
    mockCurrentUser = createAdminUser();

    // Create fresh Express app
    app = express();
    app.use(express.json());
    app.use('/admin', adminRoutes);
  });

  describe('GET /admin/users', () => {
    describe('successful list users', () => {
      it('should return paginated list of users with status 200', async () => {
        const mockUsers = [
          createMockUser({ id: 'user-1', email: 'user1@example.com' }),
          createMockUser({ id: 'user-2', email: 'user2@example.com' }),
        ];

        mockListAllUsers.mockResolvedValue({
          users: mockUsers,
          total: 2,
        });

        const response = await request(app).get('/admin/users');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.meta).toBeDefined();
        expect(response.body.meta.total).toBe(2);
        expect(response.body.meta.page).toBe(1);
        expect(response.body.meta.limit).toBe(20);
      });

      it('should pass query parameters to service', async () => {
        mockListAllUsers.mockResolvedValue({
          users: [],
          total: 0,
        });

        await request(app)
          .get('/admin/users')
          .query({
            page: '2',
            limit: '10',
            sortBy: 'name',
            sortOrder: 'asc',
            search: 'test',
            role: 'analyst',
            isActive: 'true',
          });

        expect(mockListAllUsers).toHaveBeenCalledWith(
          { search: 'test', role: 'analyst', isActive: true },
          { page: 2, limit: 10, sortBy: 'name', sortOrder: 'asc' }
        );
      });

      it('should calculate pagination metadata correctly', async () => {
        mockListAllUsers.mockResolvedValue({
          users: [createMockUser()],
          total: 50,
        });

        const response = await request(app).get('/admin/users').query({ page: '2', limit: '10' });

        expect(response.status).toBe(200);
        expect(response.body.meta.page).toBe(2);
        expect(response.body.meta.limit).toBe(10);
        expect(response.body.meta.total).toBe(50);
        expect(response.body.meta.totalPages).toBe(5);
        expect(response.body.meta.hasNextPage).toBe(true);
        expect(response.body.meta.hasPrevPage).toBe(true);
      });

      it('should handle empty results', async () => {
        mockListAllUsers.mockResolvedValue({
          users: [],
          total: 0,
        });

        const response = await request(app).get('/admin/users');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(0);
        expect(response.body.meta.total).toBe(0);
        expect(response.body.meta.totalPages).toBe(0);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid page parameter', async () => {
        const response = await request(app).get('/admin/users').query({ page: '0' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'page', code: 'INVALID_VALUE' })])
        );
      });

      it('should return 400 for invalid limit parameter', async () => {
        const response = await request(app).get('/admin/users').query({ limit: '200' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'limit', code: 'INVALID_VALUE' })])
        );
      });

      it('should return 400 for invalid sortBy parameter', async () => {
        const response = await request(app).get('/admin/users').query({ sortBy: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'sortBy', code: 'INVALID_VALUE' })])
        );
      });

      it('should return 400 for invalid sortOrder parameter', async () => {
        const response = await request(app).get('/admin/users').query({ sortOrder: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'sortOrder', code: 'INVALID_VALUE' }),
          ])
        );
      });

      it('should return 400 for invalid role filter', async () => {
        const response = await request(app).get('/admin/users').query({ role: 'invalid_role' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'role', code: 'INVALID_VALUE' })])
        );
      });

      it('should return 400 for invalid isActive filter', async () => {
        const response = await request(app).get('/admin/users').query({ isActive: 'maybe' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'isActive', code: 'INVALID_VALUE' }),
          ])
        );
      });
    });

    describe('authentication and authorization', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app).get('/admin/users');

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });

      it('should return 403 when user is not an administrator', async () => {
        mockCurrentUser = { id: 'user-1', email: 'analyst@example.com', role: 'analyst' };

        const response = await request(app).get('/admin/users');

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors', async () => {
        mockListAllUsers.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app).get('/admin/users');

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
        expect(response.body.error.message).toBe('An unexpected error occurred');
      });
    });
  });

  describe('PUT /admin/users/:id/role', () => {
    const validUserId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful role change', () => {
      it('should update user role and return updated user with status 200', async () => {
        const existingUser = createMockUser({ id: validUserId, role: 'analyst' });
        const updatedUser = createMockUser({ id: validUserId, role: 'lead_analyst' });

        mockFindUserById.mockResolvedValue(existingUser);
        mockUpdateUserRole.mockResolvedValue(updatedUser);

        const response = await request(app)
          .put(`/admin/users/${validUserId}/role`)
          .send({ role: 'lead_analyst' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.user.role).toBe('lead_analyst');
      });

      it('should call service functions with correct parameters', async () => {
        const existingUser = createMockUser({ id: validUserId });
        mockFindUserById.mockResolvedValue(existingUser);
        mockUpdateUserRole.mockResolvedValue({ ...existingUser, role: 'administrator' });

        await request(app).put(`/admin/users/${validUserId}/role`).send({ role: 'administrator' });

        expect(mockFindUserById).toHaveBeenCalledWith(validUserId);
        expect(mockUpdateUserRole).toHaveBeenCalledWith(validUserId, 'administrator');
      });

      it('should allow changing to any valid role', async () => {
        const validRoles: UserRole[] = ['administrator', 'lead_analyst', 'analyst', 'viewer'];
        const existingUser = createMockUser({ id: validUserId });

        for (const role of validRoles) {
          mockFindUserById.mockResolvedValue(existingUser);
          mockUpdateUserRole.mockResolvedValue({ ...existingUser, role });

          const response = await request(app)
            .put(`/admin/users/${validUserId}/role`)
            .send({ role });

          expect(response.status).toBe(200);
          expect(response.body.data.user.role).toBe(role);
        }
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid user ID format', async () => {
        const response = await request(app)
          .put('/admin/users/invalid-uuid/role')
          .send({ role: 'analyst' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toBe('Invalid user ID format');
      });

      it('should return 400 when role is missing', async () => {
        const response = await request(app).put(`/admin/users/${validUserId}/role`).send({});

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'role', code: 'REQUIRED' })])
        );
      });

      it('should return 400 when role is not a string', async () => {
        const response = await request(app)
          .put(`/admin/users/${validUserId}/role`)
          .send({ role: 123 });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'role', code: 'INVALID_TYPE' })])
        );
      });

      it('should return 400 for invalid role value', async () => {
        const response = await request(app)
          .put(`/admin/users/${validUserId}/role`)
          .send({ role: 'superadmin' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'role', code: 'INVALID_VALUE' })])
        );
      });
    });

    describe('user not found', () => {
      it('should return 404 when user does not exist', async () => {
        mockFindUserById.mockResolvedValue(null);

        const response = await request(app)
          .put(`/admin/users/${validUserId}/role`)
          .send({ role: 'analyst' });

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('User not found');
      });
    });

    describe('self-role-change prevention', () => {
      it('should return 403 when trying to change own role', async () => {
        // Set the current admin user ID to match the target user
        mockCurrentUser = { id: validUserId, email: 'admin@example.com', role: 'administrator' };

        const response = await request(app)
          .put(`/admin/users/${validUserId}/role`)
          .send({ role: 'viewer' });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
        expect(response.body.error.message).toBe('Cannot change your own role');
      });
    });

    describe('authentication and authorization', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app)
          .put(`/admin/users/${validUserId}/role`)
          .send({ role: 'analyst' });

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });

      it('should return 403 when user is not an administrator', async () => {
        mockCurrentUser = { id: 'user-1', email: 'analyst@example.com', role: 'analyst' };

        const response = await request(app)
          .put(`/admin/users/${validUserId}/role`)
          .send({ role: 'analyst' });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors during findUserById', async () => {
        mockFindUserById.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app)
          .put(`/admin/users/${validUserId}/role`)
          .send({ role: 'analyst' });

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should return 500 on database errors during updateUserRole', async () => {
        mockFindUserById.mockResolvedValue(createMockUser({ id: validUserId }));
        mockUpdateUserRole.mockRejectedValue(new Error('Update failed'));

        const response = await request(app)
          .put(`/admin/users/${validUserId}/role`)
          .send({ role: 'analyst' });

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });

  describe('PUT /admin/users/:id/status', () => {
    const validUserId = '550e8400-e29b-41d4-a716-446655440000';

    describe('successful status change', () => {
      it('should deactivate user and return updated user with status 200', async () => {
        const existingUser = createMockUser({ id: validUserId, isActive: true });
        const updatedUser = createMockUser({ id: validUserId, isActive: false });

        mockFindUserById.mockResolvedValue(existingUser);
        mockUpdateUserStatus.mockResolvedValue(updatedUser);

        const response = await request(app)
          .put(`/admin/users/${validUserId}/status`)
          .send({ isActive: false });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.user.isActive).toBe(false);
      });

      it('should activate user and return updated user with status 200', async () => {
        const existingUser = createMockUser({ id: validUserId, isActive: false });
        const updatedUser = createMockUser({ id: validUserId, isActive: true });

        mockFindUserById.mockResolvedValue(existingUser);
        mockUpdateUserStatus.mockResolvedValue(updatedUser);

        const response = await request(app)
          .put(`/admin/users/${validUserId}/status`)
          .send({ isActive: true });

        expect(response.status).toBe(200);
        expect(response.body.data.user.isActive).toBe(true);
      });

      it('should call service functions with correct parameters', async () => {
        const existingUser = createMockUser({ id: validUserId });
        mockFindUserById.mockResolvedValue(existingUser);
        mockUpdateUserStatus.mockResolvedValue({ ...existingUser, isActive: false });

        await request(app).put(`/admin/users/${validUserId}/status`).send({ isActive: false });

        expect(mockFindUserById).toHaveBeenCalledWith(validUserId);
        expect(mockUpdateUserStatus).toHaveBeenCalledWith(validUserId, false);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid user ID format', async () => {
        const response = await request(app)
          .put('/admin/users/invalid-uuid/status')
          .send({ isActive: true });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toBe('Invalid user ID format');
      });

      it('should return 400 when isActive is missing', async () => {
        const response = await request(app).put(`/admin/users/${validUserId}/status`).send({});

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'isActive', code: 'REQUIRED' })])
        );
      });

      it('should return 400 when isActive is not a boolean', async () => {
        const response = await request(app)
          .put(`/admin/users/${validUserId}/status`)
          .send({ isActive: 'yes' });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'isActive', code: 'INVALID_TYPE' }),
          ])
        );
      });

      it('should return 400 when isActive is null', async () => {
        const response = await request(app)
          .put(`/admin/users/${validUserId}/status`)
          .send({ isActive: null });

        expect(response.status).toBe(400);
        expect(response.body.error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'isActive', code: 'REQUIRED' })])
        );
      });
    });

    describe('user not found', () => {
      it('should return 404 when user does not exist', async () => {
        mockFindUserById.mockResolvedValue(null);

        const response = await request(app)
          .put(`/admin/users/${validUserId}/status`)
          .send({ isActive: false });

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toBe('User not found');
      });
    });

    describe('self-status-change prevention', () => {
      it('should return 403 when trying to change own status', async () => {
        // Set the current admin user ID to match the target user
        mockCurrentUser = { id: validUserId, email: 'admin@example.com', role: 'administrator' };

        const response = await request(app)
          .put(`/admin/users/${validUserId}/status`)
          .send({ isActive: false });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
        expect(response.body.error.message).toBe('Cannot change your own status');
      });
    });

    describe('authentication and authorization', () => {
      it('should return 401 when not authenticated', async () => {
        mockCurrentUser = null;

        const response = await request(app)
          .put(`/admin/users/${validUserId}/status`)
          .send({ isActive: false });

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      });

      it('should return 403 when user is not an administrator', async () => {
        mockCurrentUser = { id: 'user-1', email: 'analyst@example.com', role: 'analyst' };

        const response = await request(app)
          .put(`/admin/users/${validUserId}/status`)
          .send({ isActive: false });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database errors during findUserById', async () => {
        mockFindUserById.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app)
          .put(`/admin/users/${validUserId}/status`)
          .send({ isActive: false });

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });

      it('should return 500 on database errors during updateUserStatus', async () => {
        mockFindUserById.mockResolvedValue(createMockUser({ id: validUserId }));
        mockUpdateUserStatus.mockRejectedValue(new Error('Update failed'));

        const response = await request(app)
          .put(`/admin/users/${validUserId}/status`)
          .send({ isActive: false });

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_ERROR');
      });
    });
  });
});
