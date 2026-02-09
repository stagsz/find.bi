/**
 * Tests for authentication middleware.
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
import {
  authenticate,
  requireAuth,
  isAuthenticated,
  getAuthUser,
  getAuthUserId,
} from './auth.middleware.js';

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

describe('Auth Middleware', () => {
  let app: Express;
  let jwtService: JwtService;
  let testConfig: JwtConfig;
  let testUser: TokenUser;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    // Generate real test keys
    const keys = await generateTestKeys();

    testConfig = {
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'hazop-assistant',
      audience: 'hazop-api',
    };

    testUser = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      role: 'analyst',
    };
  });

  beforeEach(async () => {
    // Save original env
    originalEnv = { ...process.env };

    // Set JWT env vars for passport config
    process.env.JWT_PRIVATE_KEY = testConfig.privateKey;
    process.env.JWT_PUBLIC_KEY = testConfig.publicKey;
    process.env.JWT_ISSUER = testConfig.issuer;
    process.env.JWT_AUDIENCE = testConfig.audience;

    // Create and initialize JWT service
    jwtService = createJwtService(testConfig);
    await jwtService.initialize();

    // Create fresh Express app
    app = express();
    app.use(express.json());

    // Configure passport
    configurePassport();
    app.use(initializePassport());

    // Protected test route using our middleware
    app.get('/protected', authenticate, requireAuth, (req: Request, res: Response) => {
      res.json({
        success: true,
        data: { user: req.user },
      });
    });

    // Optional auth route - authenticate but don't require
    app.get('/optional-auth', authenticate, (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          authenticated: isAuthenticated(req),
          user: getAuthUser(req),
          userId: getAuthUserId(req),
        },
      });
    });
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('authenticate + requireAuth', () => {
    it('should allow access with valid token', async () => {
      const accessToken = await jwtService.generateAccessToken(testUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.role).toBe(testUser.role);
    });

    it('should return 401 without Authorization header', async () => {
      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(response.body.error.message).toBe('Authentication required');
    });

    it('should return 401 with malformed Authorization header', async () => {
      const response = await request(app).get('/protected').set('Authorization', 'NotBearer token');

      expect(response.status).toBe(401);
    });

    it('should return 401 with refresh token (only access tokens allowed)', async () => {
      const refreshToken = await jwtService.generateRefreshToken(testUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${refreshToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should authenticate administrator role', async () => {
      const adminUser: TokenUser = { ...testUser, role: 'administrator' };
      const token = await jwtService.generateAccessToken(adminUser);

      const response = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe('administrator');
    });

    it('should authenticate lead_analyst role', async () => {
      const leadUser: TokenUser = { ...testUser, role: 'lead_analyst' };
      const token = await jwtService.generateAccessToken(leadUser);

      const response = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe('lead_analyst');
    });

    it('should authenticate viewer role', async () => {
      const viewerUser: TokenUser = { ...testUser, role: 'viewer' };
      const token = await jwtService.generateAccessToken(viewerUser);

      const response = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe('viewer');
    });
  });

  describe('helper functions', () => {
    describe('isAuthenticated', () => {
      it('should return true for authenticated request', async () => {
        const accessToken = await jwtService.generateAccessToken(testUser);

        const response = await request(app)
          .get('/optional-auth')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.authenticated).toBe(true);
      });

      it('should return false for unauthenticated request', async () => {
        const response = await request(app)
          .get('/optional-auth')
          .set('Authorization', 'Bearer invalid.token.here');

        expect(response.status).toBe(200);
        expect(response.body.data.authenticated).toBe(false);
      });

      it('should return false for request without token', async () => {
        const response = await request(app).get('/optional-auth');

        expect(response.status).toBe(200);
        expect(response.body.data.authenticated).toBe(false);
      });
    });

    describe('getAuthUser', () => {
      it('should return user for authenticated request', async () => {
        const leadUser: TokenUser = { ...testUser, role: 'lead_analyst' };
        const accessToken = await jwtService.generateAccessToken(leadUser);

        const response = await request(app)
          .get('/optional-auth')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.user).toEqual({
          id: leadUser.id,
          email: leadUser.email,
          role: leadUser.role,
        });
      });

      it('should return undefined for unauthenticated request', async () => {
        const response = await request(app).get('/optional-auth');

        expect(response.status).toBe(200);
        expect(response.body.data.user).toBeUndefined();
      });
    });

    describe('getAuthUserId', () => {
      it('should return user ID for authenticated request', async () => {
        const accessToken = await jwtService.generateAccessToken(testUser);

        const response = await request(app)
          .get('/optional-auth')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.userId).toBe(testUser.id);
      });

      it('should return undefined for unauthenticated request', async () => {
        const response = await request(app).get('/optional-auth');

        expect(response.status).toBe(200);
        expect(response.body.data.userId).toBeUndefined();
      });
    });
  });

  describe('requireAuth standalone', () => {
    it('should return proper error structure when user is not set', async () => {
      const testApp = express();
      testApp.use(express.json());

      // Route without authentication, just requireAuth (simulating missing user)
      testApp.get('/test', (req: Request, res: Response, next: NextFunction) => {
        // req.user is undefined since no auth middleware ran
        requireAuth(req, res, next);
      });

      testApp.get('/test', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(testApp).get('/test');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should call next when user is present', async () => {
      const testApp = express();
      testApp.use(express.json());

      // Manually set req.user and test requireAuth
      testApp.get('/test', (req: Request, res: Response, next: NextFunction) => {
        (req as Request & { user: AuthenticatedUser }).user = {
          id: 'user-789',
          email: 'manual@example.com',
          role: 'viewer',
        };
        requireAuth(req, res, next);
      });

      testApp.get('/test', (req: Request, res: Response) => {
        res.json({ success: true, data: { userId: req.user?.id } });
      });

      const response = await request(testApp).get('/test');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { userId: 'user-789' },
      });
    });
  });
});
