/**
 * Tests for role-based access control (RBAC) middleware.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import express, { type Request, type Response, type NextFunction, type Express } from 'express';
import request from 'supertest';
import {
  configurePassport,
  initializePassport,
  type AuthenticatedUser,
} from '../config/passport.config.js';
import { createJwtService, type JwtService, type TokenUser } from '../services/jwt.service.js';
import type { JwtConfig } from '../config/jwt.config.js';
import { authenticate, requireAuth } from './auth.middleware.js';
import {
  requireRole,
  requireAnyRole,
  requireMinimumRole,
  hasRole,
  hasAnyRole,
  hasMinimumRole,
  isAdmin,
} from './rbac.middleware.js';

/**
 * Generate RSA key pair for testing.
 */
async function generateTestKeys(): Promise<{ privateKey: string; publicKey: string }> {
  const { generateKeyPair, exportPKCS8, exportSPKI } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });

  const privateKeyPem = await exportPKCS8(privateKey);
  const publicKeyPem = await exportSPKI(publicKey);

  return { privateKey: privateKeyPem, publicKey: publicKeyPem };
}

describe('RBAC Middleware', () => {
  let app: Express;
  let jwtService: JwtService;
  let testConfig: JwtConfig;
  let originalEnv: NodeJS.ProcessEnv;

  const testUsers: Record<string, TokenUser> = {
    admin: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'admin@example.com',
      role: 'administrator',
    },
    lead: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      email: 'lead@example.com',
      role: 'lead_analyst',
    },
    analyst: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      email: 'analyst@example.com',
      role: 'analyst',
    },
    viewer: {
      id: '550e8400-e29b-41d4-a716-446655440004',
      email: 'viewer@example.com',
      role: 'viewer',
    },
  };

  beforeAll(async () => {
    const keys = await generateTestKeys();

    testConfig = {
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'hazop-assistant',
      audience: 'hazop-api',
    };
  });

  beforeEach(async () => {
    originalEnv = { ...process.env };

    process.env.JWT_PRIVATE_KEY = testConfig.privateKey;
    process.env.JWT_PUBLIC_KEY = testConfig.publicKey;
    process.env.JWT_ISSUER = testConfig.issuer;
    process.env.JWT_AUDIENCE = testConfig.audience;

    jwtService = createJwtService(testConfig);
    await jwtService.initialize();

    app = express();
    app.use(express.json());

    configurePassport();
    app.use(initializePassport());

    // Routes for testing different RBAC middleware
    app.get('/admin-only', authenticate, requireAuth, requireRole('administrator'), (_req: Request, res: Response) => {
      res.json({ success: true, data: { access: 'admin-only' } });
    });

    app.get('/lead-only', authenticate, requireAuth, requireRole('lead_analyst'), (_req: Request, res: Response) => {
      res.json({ success: true, data: { access: 'lead-only' } });
    });

    app.get('/analyst-only', authenticate, requireAuth, requireRole('analyst'), (_req: Request, res: Response) => {
      res.json({ success: true, data: { access: 'analyst-only' } });
    });

    app.get('/viewer-only', authenticate, requireAuth, requireRole('viewer'), (_req: Request, res: Response) => {
      res.json({ success: true, data: { access: 'viewer-only' } });
    });

    app.get(
      '/management',
      authenticate,
      requireAuth,
      requireAnyRole(['administrator', 'lead_analyst']),
      (_req: Request, res: Response) => {
        res.json({ success: true, data: { access: 'management' } });
      }
    );

    app.get(
      '/analysts-up',
      authenticate,
      requireAuth,
      requireMinimumRole('analyst'),
      (_req: Request, res: Response) => {
        res.json({ success: true, data: { access: 'analysts-up' } });
      }
    );

    app.get(
      '/leads-up',
      authenticate,
      requireAuth,
      requireMinimumRole('lead_analyst'),
      (_req: Request, res: Response) => {
        res.json({ success: true, data: { access: 'leads-up' } });
      }
    );

    app.get(
      '/anyone-authenticated',
      authenticate,
      requireAuth,
      requireMinimumRole('viewer'),
      (_req: Request, res: Response) => {
        res.json({ success: true, data: { access: 'anyone-authenticated' } });
      }
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('requireRole', () => {
    it('should allow administrator to access admin-only route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.admin);

      const response = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.access).toBe('admin-only');
    });

    it('should deny lead_analyst from admin-only route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.lead);

      const response = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('administrator');
    });

    it('should deny analyst from admin-only route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.analyst);

      const response = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('should deny viewer from admin-only route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.viewer);

      const response = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('should allow lead_analyst to access lead-only route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.lead);

      const response = await request(app).get('/lead-only').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.access).toBe('lead-only');
    });

    it('should allow analyst to access analyst-only route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.analyst);

      const response = await request(app).get('/analyst-only').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.access).toBe('analyst-only');
    });

    it('should allow viewer to access viewer-only route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.viewer);

      const response = await request(app).get('/viewer-only').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.access).toBe('viewer-only');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/admin-only');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('requireAnyRole', () => {
    it('should allow administrator to access management route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.admin);

      const response = await request(app).get('/management').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.access).toBe('management');
    });

    it('should allow lead_analyst to access management route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.lead);

      const response = await request(app).get('/management').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.access).toBe('management');
    });

    it('should deny analyst from management route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.analyst);

      const response = await request(app).get('/management').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('administrator');
      expect(response.body.error.message).toContain('lead_analyst');
    });

    it('should deny viewer from management route', async () => {
      const token = await jwtService.generateAccessToken(testUsers.viewer);

      const response = await request(app).get('/management').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('requireMinimumRole', () => {
    describe('analyst minimum', () => {
      it('should allow administrator access', async () => {
        const token = await jwtService.generateAccessToken(testUsers.admin);

        const response = await request(app).get('/analysts-up').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
      });

      it('should allow lead_analyst access', async () => {
        const token = await jwtService.generateAccessToken(testUsers.lead);

        const response = await request(app).get('/analysts-up').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
      });

      it('should allow analyst access', async () => {
        const token = await jwtService.generateAccessToken(testUsers.analyst);

        const response = await request(app).get('/analysts-up').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
      });

      it('should deny viewer access', async () => {
        const token = await jwtService.generateAccessToken(testUsers.viewer);

        const response = await request(app).get('/analysts-up').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error.message).toContain('analyst');
      });
    });

    describe('lead_analyst minimum', () => {
      it('should allow administrator access', async () => {
        const token = await jwtService.generateAccessToken(testUsers.admin);

        const response = await request(app).get('/leads-up').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
      });

      it('should allow lead_analyst access', async () => {
        const token = await jwtService.generateAccessToken(testUsers.lead);

        const response = await request(app).get('/leads-up').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
      });

      it('should deny analyst access', async () => {
        const token = await jwtService.generateAccessToken(testUsers.analyst);

        const response = await request(app).get('/leads-up').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
      });

      it('should deny viewer access', async () => {
        const token = await jwtService.generateAccessToken(testUsers.viewer);

        const response = await request(app).get('/leads-up').set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
      });
    });

    describe('viewer minimum (all authenticated)', () => {
      it('should allow all authenticated roles', async () => {
        for (const [roleName, user] of Object.entries(testUsers)) {
          const token = await jwtService.generateAccessToken(user);

          const response = await request(app).get('/anyone-authenticated').set('Authorization', `Bearer ${token}`);

          expect(response.status).toBe(200);
        }
      });
    });
  });

  describe('standalone requireRole without auth', () => {
    it('should return 401 when user is not set', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/test', (req: Request, res: Response, next: NextFunction) => {
        requireRole('administrator')(req, res, next);
      });

      testApp.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(testApp).get('/test');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('standalone requireAnyRole without auth', () => {
    it('should return 401 when user is not set', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/test', (req: Request, res: Response, next: NextFunction) => {
        requireAnyRole(['administrator', 'lead_analyst'])(req, res, next);
      });

      testApp.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(testApp).get('/test');

      expect(response.status).toBe(401);
    });
  });

  describe('standalone requireMinimumRole without auth', () => {
    it('should return 401 when user is not set', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/test', (req: Request, res: Response, next: NextFunction) => {
        requireMinimumRole('analyst')(req, res, next);
      });

      testApp.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(testApp).get('/test');

      expect(response.status).toBe(401);
    });
  });

  describe('utility functions', () => {
    describe('hasRole', () => {
      it('should return true when user has the specified role', () => {
        const user: AuthenticatedUser = { id: '1', email: 'test@example.com', role: 'administrator' };
        expect(hasRole(user, 'administrator')).toBe(true);
      });

      it('should return false when user has a different role', () => {
        const user: AuthenticatedUser = { id: '1', email: 'test@example.com', role: 'viewer' };
        expect(hasRole(user, 'administrator')).toBe(false);
      });

      it('should return false when user is undefined', () => {
        expect(hasRole(undefined, 'administrator')).toBe(false);
      });
    });

    describe('hasAnyRole', () => {
      it('should return true when user has one of the specified roles', () => {
        const user: AuthenticatedUser = { id: '1', email: 'test@example.com', role: 'lead_analyst' };
        expect(hasAnyRole(user, ['administrator', 'lead_analyst'])).toBe(true);
      });

      it('should return false when user has none of the specified roles', () => {
        const user: AuthenticatedUser = { id: '1', email: 'test@example.com', role: 'viewer' };
        expect(hasAnyRole(user, ['administrator', 'lead_analyst'])).toBe(false);
      });

      it('should return false when user is undefined', () => {
        expect(hasAnyRole(undefined, ['administrator', 'lead_analyst'])).toBe(false);
      });
    });

    describe('hasMinimumRole', () => {
      it('should return true for administrator with any minimum', () => {
        const user: AuthenticatedUser = { id: '1', email: 'test@example.com', role: 'administrator' };
        expect(hasMinimumRole(user, 'viewer')).toBe(true);
        expect(hasMinimumRole(user, 'analyst')).toBe(true);
        expect(hasMinimumRole(user, 'lead_analyst')).toBe(true);
        expect(hasMinimumRole(user, 'administrator')).toBe(true);
      });

      it('should return true for lead_analyst with analyst minimum or lower', () => {
        const user: AuthenticatedUser = { id: '1', email: 'test@example.com', role: 'lead_analyst' };
        expect(hasMinimumRole(user, 'viewer')).toBe(true);
        expect(hasMinimumRole(user, 'analyst')).toBe(true);
        expect(hasMinimumRole(user, 'lead_analyst')).toBe(true);
        expect(hasMinimumRole(user, 'administrator')).toBe(false);
      });

      it('should return true for analyst with viewer minimum or analyst', () => {
        const user: AuthenticatedUser = { id: '1', email: 'test@example.com', role: 'analyst' };
        expect(hasMinimumRole(user, 'viewer')).toBe(true);
        expect(hasMinimumRole(user, 'analyst')).toBe(true);
        expect(hasMinimumRole(user, 'lead_analyst')).toBe(false);
        expect(hasMinimumRole(user, 'administrator')).toBe(false);
      });

      it('should return true for viewer only with viewer minimum', () => {
        const user: AuthenticatedUser = { id: '1', email: 'test@example.com', role: 'viewer' };
        expect(hasMinimumRole(user, 'viewer')).toBe(true);
        expect(hasMinimumRole(user, 'analyst')).toBe(false);
        expect(hasMinimumRole(user, 'lead_analyst')).toBe(false);
        expect(hasMinimumRole(user, 'administrator')).toBe(false);
      });

      it('should return false when user is undefined', () => {
        expect(hasMinimumRole(undefined, 'viewer')).toBe(false);
      });
    });

    describe('isAdmin', () => {
      it('should return true for administrator', () => {
        const user: AuthenticatedUser = { id: '1', email: 'test@example.com', role: 'administrator' };
        expect(isAdmin(user)).toBe(true);
      });

      it('should return false for non-administrator roles', () => {
        const lead: AuthenticatedUser = { id: '1', email: 'test@example.com', role: 'lead_analyst' };
        const analyst: AuthenticatedUser = { id: '2', email: 'test2@example.com', role: 'analyst' };
        const viewer: AuthenticatedUser = { id: '3', email: 'test3@example.com', role: 'viewer' };

        expect(isAdmin(lead)).toBe(false);
        expect(isAdmin(analyst)).toBe(false);
        expect(isAdmin(viewer)).toBe(false);
      });

      it('should return false when user is undefined', () => {
        expect(isAdmin(undefined)).toBe(false);
      });
    });
  });
});
