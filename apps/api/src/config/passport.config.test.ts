/**
 * Unit tests for Passport.js JWT authentication strategy.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { configurePassport, initializePassport, passport, type AuthenticatedUser } from './passport.config.js';
import { createJwtService, type JwtService, type TokenUser } from '../services/jwt.service.js';
import type { JwtConfig } from './jwt.config.js';

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

describe('Passport JWT Strategy', () => {
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

    // Protected test route
    app.get(
      '/protected',
      passport.authenticate('jwt', { session: false }),
      (req: Request, res: Response) => {
        res.json({
          message: 'Success',
          user: req.user,
        });
      }
    );

    // Unprotected route for comparison
    app.get('/public', (_req: Request, res: Response) => {
      res.json({ message: 'Public' });
    });
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('Protected route authentication', () => {
    it('should allow access with valid access token', async () => {
      const accessToken = await jwtService.generateAccessToken(testUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Success');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.role).toBe(testUser.role);
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });

    it('should reject request with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
    });

    it('should reject refresh token (only access tokens allowed)', async () => {
      const refreshToken = await jwtService.generateRefreshToken(testUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${refreshToken}`);

      expect(response.status).toBe(401);
    });

    it('should allow public route without authentication', async () => {
      const response = await request(app).get('/public');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Public');
    });
  });

  describe('Token validation', () => {
    it('should reject token signed with different key', async () => {
      // Generate different keys
      const otherKeys = await generateTestKeys();
      const otherConfig = { ...testConfig, ...otherKeys };
      const otherService = createJwtService(otherConfig);
      await otherService.initialize();

      const token = await otherService.generateAccessToken(testUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
    });

    it('should reject token with wrong issuer', async () => {
      const otherConfig = { ...testConfig, issuer: 'wrong-issuer' };
      const otherService = createJwtService(otherConfig);
      await otherService.initialize();

      const token = await otherService.generateAccessToken(testUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
    });

    it('should reject token with wrong audience', async () => {
      const otherConfig = { ...testConfig, audience: 'wrong-audience' };
      const otherService = createJwtService(otherConfig);
      await otherService.initialize();

      const token = await otherService.generateAccessToken(testUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
    });
  });

  describe('User roles', () => {
    it('should authenticate administrator role', async () => {
      const adminUser: TokenUser = { ...testUser, role: 'administrator' };
      const token = await jwtService.generateAccessToken(adminUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('administrator');
    });

    it('should authenticate lead_analyst role', async () => {
      const leadUser: TokenUser = { ...testUser, role: 'lead_analyst' };
      const token = await jwtService.generateAccessToken(leadUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('lead_analyst');
    });

    it('should authenticate viewer role', async () => {
      const viewerUser: TokenUser = { ...testUser, role: 'viewer' };
      const token = await jwtService.generateAccessToken(viewerUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('viewer');
    });
  });

  describe('initializePassport()', () => {
    it('should return passport middleware', () => {
      const middleware = initializePassport();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('passport export', () => {
    it('should export configured passport instance', () => {
      expect(passport).toBeDefined();
      expect(typeof passport.authenticate).toBe('function');
      expect(typeof passport.initialize).toBe('function');
    });
  });
});
