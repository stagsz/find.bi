/**
 * Unit tests for auth controller validation logic.
 *
 * Tests the request validation without requiring a database connection.
 * Integration tests with database will be in AUTH-16.
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { register, login, refresh, logout } from './auth.controller.js';

// Create a minimal test app for validation testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.post('/auth/register', register);
  app.post('/auth/login', login);
  app.post('/auth/refresh', refresh);
  app.post('/auth/logout', logout);
  return app;
};

describe('POST /auth/register - Validation', () => {
  describe('email validation', () => {
    it('should return 400 when email is missing', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        password: 'Password123',
        name: 'Test User',
        organization: 'Acme Corp',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email', code: 'REQUIRED' })])
      );
    });

    it('should return 400 when email format is invalid', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        email: 'invalid-email',
        password: 'Password123',
        name: 'Test User',
        organization: 'Acme Corp',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email', code: 'INVALID_FORMAT' }),
        ])
      );
    });
  });

  describe('password validation', () => {
    it('should return 400 when password is missing', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        name: 'Test User',
        organization: 'Acme Corp',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'password', code: 'REQUIRED' })])
      );
    });

    it('should return 400 when password is too short', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'Pass1',
        name: 'Test User',
        organization: 'Acme Corp',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'password', code: 'WEAK_PASSWORD' }),
        ])
      );
    });

    it('should return 400 when password has no uppercase', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        organization: 'Acme Corp',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'password', code: 'WEAK_PASSWORD' }),
        ])
      );
    });

    it('should return 400 when password has no lowercase', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'PASSWORD123',
        name: 'Test User',
        organization: 'Acme Corp',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'password', code: 'WEAK_PASSWORD' }),
        ])
      );
    });

    it('should return 400 when password has no number', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'PasswordABC',
        name: 'Test User',
        organization: 'Acme Corp',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'password', code: 'WEAK_PASSWORD' }),
        ])
      );
    });
  });

  describe('name validation', () => {
    it('should return 400 when name is missing', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'Password123',
        organization: 'Acme Corp',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'name', code: 'REQUIRED' })])
      );
    });

    it('should return 400 when name is empty string', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'Password123',
        name: '   ',
        organization: 'Acme Corp',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'name', code: 'EMPTY' })])
      );
    });
  });

  describe('organization validation', () => {
    it('should return 400 when organization is missing', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'organization', code: 'REQUIRED' }),
        ])
      );
    });
  });

  describe('role validation', () => {
    it('should return 400 when role is invalid', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
        organization: 'Acme Corp',
        role: 'invalid_role',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'role', code: 'INVALID_VALUE' })])
      );
    });
  });

  describe('multiple validation errors', () => {
    it('should return all validation errors', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/register').send({});

      expect(response.status).toBe(400);
      expect(response.body.error.errors.length).toBeGreaterThanOrEqual(4);
    });
  });
});

describe('POST /auth/login - Validation', () => {
  describe('email validation', () => {
    it('should return 400 when email is missing', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/login').send({
        password: 'Password123',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email', code: 'REQUIRED' })])
      );
    });

    it('should return 400 when email format is invalid', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/login').send({
        email: 'invalid-email',
        password: 'Password123',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email', code: 'INVALID_FORMAT' }),
        ])
      );
    });
  });

  describe('password validation', () => {
    it('should return 400 when password is missing', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/login').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'password', code: 'REQUIRED' })])
      );
    });

    it('should not enforce password strength requirements for login', async () => {
      // Login should only require password presence, not strength
      // This test verifies that short/weak passwords pass validation
      // (actual auth failure would happen at database lookup level)
      const app = createTestApp();
      const response = await request(app).post('/auth/login').send({
        email: 'test@example.com',
        password: 'weak', // Short password should pass validation
      });

      // Should not be a validation error (would fail at DB level instead)
      expect(response.status).not.toBe(400);
    });
  });

  describe('multiple validation errors', () => {
    it('should return all validation errors when both fields are missing', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/login').send({});

      expect(response.status).toBe(400);
      expect(response.body.error.errors.length).toBe(2);
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email', code: 'REQUIRED' }),
          expect.objectContaining({ field: 'password', code: 'REQUIRED' }),
        ])
      );
    });
  });
});

describe('POST /auth/refresh - Validation', () => {
  describe('refreshToken validation', () => {
    it('should return 400 when refreshToken is missing', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/refresh').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'refreshToken', code: 'REQUIRED' }),
        ])
      );
    });

    it('should return 401 when refreshToken is invalid', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/refresh').send({
        refreshToken: 'invalid-token',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
      expect(response.body.error.message).toBe('Invalid or expired refresh token');
    });
  });
});

describe('POST /auth/logout - Validation', () => {
  describe('refreshToken validation', () => {
    it('should return 400 when refreshToken is missing', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/logout').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'refreshToken', code: 'REQUIRED' }),
        ])
      );
    });

    it('should return 401 when refreshToken is invalid', async () => {
      const app = createTestApp();
      const response = await request(app).post('/auth/logout').send({
        refreshToken: 'invalid-token',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
      expect(response.body.error.message).toBe('Invalid or expired refresh token');
    });
  });
});
