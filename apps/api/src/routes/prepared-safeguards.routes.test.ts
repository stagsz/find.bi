/**
 * API integration tests for prepared safeguards endpoints.
 *
 * Tests the full API flow for prepared safeguard templates.
 * These endpoints are public and don't require authentication.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express, { type Express } from 'express';

// Import the routes
import preparedSafeguardsRoutes from './prepared-safeguards.routes.js';

describe('Prepared Safeguards API Routes', () => {
  let app: Express;

  beforeAll(() => {
    // Create a fresh Express app for testing
    app = express();
    app.use(express.json());
    app.use('/prepared-safeguards', preparedSafeguardsRoutes);
  });

  describe('GET /prepared-safeguards', () => {
    it('should return all prepared safeguards', async () => {
      const response = await request(app).get('/prepared-safeguards');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('safeguard');
      expect(response.body.data.answers).toBeDefined();
      expect(Array.isArray(response.body.data.answers)).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should include all required properties for each safeguard', async () => {
      const response = await request(app).get('/prepared-safeguards');

      expect(response.status).toBe(200);

      const firstSafeguard = response.body.data.answers[0];
      expect(firstSafeguard).toHaveProperty('id');
      expect(firstSafeguard).toHaveProperty('text');
      expect(firstSafeguard).toHaveProperty('applicableEquipmentTypes');
      expect(firstSafeguard).toHaveProperty('applicableGuideWords');
      expect(firstSafeguard).toHaveProperty('isCommon');
      expect(firstSafeguard).toHaveProperty('sortOrder');

      // Verify types
      expect(typeof firstSafeguard.id).toBe('string');
      expect(typeof firstSafeguard.text).toBe('string');
      expect(Array.isArray(firstSafeguard.applicableEquipmentTypes)).toBe(true);
      expect(Array.isArray(firstSafeguard.applicableGuideWords)).toBe(true);
      expect(typeof firstSafeguard.isCommon).toBe('boolean');
      expect(typeof firstSafeguard.sortOrder).toBe('number');
    });

    it('should filter by equipment type', async () => {
      const response = await request(app).get('/prepared-safeguards?equipmentType=pump');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.answers).toBeDefined();

      // All results should be applicable to pumps (empty array means universal)
      response.body.data.answers.forEach((safeguard: { applicableEquipmentTypes: string[] }) => {
        expect(
          safeguard.applicableEquipmentTypes.length === 0 ||
            safeguard.applicableEquipmentTypes.includes('pump')
        ).toBe(true);
      });
    });

    it('should filter by guide word', async () => {
      const response = await request(app).get('/prepared-safeguards?guideWord=more');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.answers).toBeDefined();

      // All results should be applicable to "more" guide word
      response.body.data.answers.forEach((safeguard: { applicableGuideWords: string[] }) => {
        expect(
          safeguard.applicableGuideWords.length === 0 ||
            safeguard.applicableGuideWords.includes('more')
        ).toBe(true);
      });
    });

    it('should filter by commonOnly', async () => {
      const response = await request(app).get('/prepared-safeguards?commonOnly=true');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // All results should be common
      response.body.data.answers.forEach((safeguard: { isCommon: boolean }) => {
        expect(safeguard.isCommon).toBe(true);
      });
    });

    it('should return validation error for invalid equipment type', async () => {
      const response = await request(app).get('/prepared-safeguards?equipmentType=invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for invalid guide word', async () => {
      const response = await request(app).get('/prepared-safeguards?guideWord=invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /prepared-safeguards/common', () => {
    it('should return only common prepared safeguards', async () => {
      const response = await request(app).get('/prepared-safeguards/common');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('safeguard');
      expect(response.body.data.answers).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);

      // All should be common
      response.body.data.answers.forEach((safeguard: { isCommon: boolean }) => {
        expect(safeguard.isCommon).toBe(true);
      });
    });
  });

  describe('GET /prepared-safeguards/stats', () => {
    it('should return statistics about prepared safeguards', async () => {
      const response = await request(app).get('/prepared-safeguards/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('commonCount');
      expect(response.body.data).toHaveProperty('byEquipmentType');
      expect(response.body.data).toHaveProperty('byGuideWord');
      expect(response.body.data).toHaveProperty('universalCount');

      // Verify types
      expect(typeof response.body.data.totalCount).toBe('number');
      expect(typeof response.body.data.commonCount).toBe('number');
      expect(typeof response.body.data.byEquipmentType).toBe('object');
      expect(typeof response.body.data.byGuideWord).toBe('object');
      expect(typeof response.body.data.universalCount).toBe('number');

      // Verify equipment types in stats
      expect(response.body.data.byEquipmentType).toHaveProperty('pump');
      expect(response.body.data.byEquipmentType).toHaveProperty('valve');
      expect(response.body.data.byEquipmentType).toHaveProperty('reactor');

      // Verify guide words in stats
      expect(response.body.data.byGuideWord).toHaveProperty('no');
      expect(response.body.data.byGuideWord).toHaveProperty('more');
      expect(response.body.data.byGuideWord).toHaveProperty('less');
    });
  });

  describe('GET /prepared-safeguards/by-equipment/:type', () => {
    it('should return safeguards for pump equipment type', async () => {
      const response = await request(app).get('/prepared-safeguards/by-equipment/pump');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.equipmentType).toBe('pump');
      expect(response.body.data.answers).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);

      // Verify pump-specific safeguards are included
      const texts = response.body.data.answers.map((s: { text: string }) => s.text.toLowerCase());
      expect(texts.some((t: string) => t.includes('pump') || t.includes('flow'))).toBe(true);
    });

    it('should return safeguards for tank equipment type', async () => {
      const response = await request(app).get('/prepared-safeguards/by-equipment/tank');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.equipmentType).toBe('tank');
      expect(response.body.data.count).toBeGreaterThan(0);

      // Verify tank-specific safeguards are included
      const texts = response.body.data.answers.map((s: { text: string }) => s.text.toLowerCase());
      expect(texts.some((t: string) => t.includes('level') || t.includes('tank'))).toBe(true);
    });

    it('should return 400 for invalid equipment type', async () => {
      const response = await request(app).get('/prepared-safeguards/by-equipment/invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /prepared-safeguards/by-guide-word/:guideWord', () => {
    it('should return safeguards for "more" guide word', async () => {
      const response = await request(app).get('/prepared-safeguards/by-guide-word/more');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guideWord).toBe('more');
      expect(response.body.data.answers).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should return safeguards for "less" guide word', async () => {
      const response = await request(app).get('/prepared-safeguards/by-guide-word/less');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guideWord).toBe('less');
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should return safeguards for "other_than" guide word', async () => {
      const response = await request(app).get('/prepared-safeguards/by-guide-word/other_than');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guideWord).toBe('other_than');
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should return 400 for invalid guide word', async () => {
      const response = await request(app).get('/prepared-safeguards/by-guide-word/invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /prepared-safeguards/context', () => {
    it('should return safeguards for pump + more combination', async () => {
      const response = await request(app).get(
        '/prepared-safeguards/context?equipmentType=pump&guideWord=more'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.equipmentType).toBe('pump');
      expect(response.body.data.guideWord).toBe('more');
      expect(response.body.data.answers).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);

      // All results should be applicable to both pump and "more"
      response.body.data.answers.forEach(
        (safeguard: { applicableEquipmentTypes: string[]; applicableGuideWords: string[] }) => {
          const appliesToPump =
            safeguard.applicableEquipmentTypes.length === 0 ||
            safeguard.applicableEquipmentTypes.includes('pump');
          const appliesToMore =
            safeguard.applicableGuideWords.length === 0 ||
            safeguard.applicableGuideWords.includes('more');
          expect(appliesToPump && appliesToMore).toBe(true);
        }
      );
    });

    it('should return 400 when equipmentType is missing', async () => {
      const response = await request(app).get('/prepared-safeguards/context?guideWord=more');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Equipment type');
    });

    it('should return 400 when guideWord is missing', async () => {
      const response = await request(app).get('/prepared-safeguards/context?equipmentType=pump');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Guide word');
    });

    it('should return 400 for invalid equipment type', async () => {
      const response = await request(app).get(
        '/prepared-safeguards/context?equipmentType=invalid&guideWord=more'
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid guide word', async () => {
      const response = await request(app).get(
        '/prepared-safeguards/context?equipmentType=pump&guideWord=invalid'
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /prepared-safeguards/search', () => {
    it('should search safeguards by text', async () => {
      const response = await request(app).get('/prepared-safeguards/search?q=valve');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('safeguard');
      expect(response.body.data.answers).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);

      // All results should contain "valve" in text or description
      response.body.data.answers.forEach((safeguard: { text: string; description?: string }) => {
        const matchesText = safeguard.text.toLowerCase().includes('valve');
        const matchesDescription =
          safeguard.description && safeguard.description.toLowerCase().includes('valve');
        expect(matchesText || matchesDescription).toBe(true);
      });
    });

    it('should search safeguards case-insensitively', async () => {
      const response1 = await request(app).get('/prepared-safeguards/search?q=ALARM');
      const response2 = await request(app).get('/prepared-safeguards/search?q=alarm');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.data.count).toBe(response2.body.data.count);
    });

    it('should return empty array when no matches', async () => {
      const response = await request(app).get('/prepared-safeguards/search?q=xyznonexistent');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.answers).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });

    it('should return 400 when query is missing', async () => {
      const response = await request(app).get('/prepared-safeguards/search');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when query is empty', async () => {
      const response = await request(app).get('/prepared-safeguards/search?q=');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /prepared-safeguards/:id', () => {
    it('should return a single prepared safeguard by ID', async () => {
      // First get all safeguards to find a valid ID
      const allResponse = await request(app).get('/prepared-safeguards');
      expect(allResponse.status).toBe(200);

      const firstSafeguard = allResponse.body.data.answers[0];
      const response = await request(app).get(`/prepared-safeguards/${firstSafeguard.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(firstSafeguard.id);
      expect(response.body.data.text).toBe(firstSafeguard.text);
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(app).get(
        '/prepared-safeguards/00000000-0000-0000-0000-000000000000'
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for invalid UUID format', async () => {
      const response = await request(app).get('/prepared-safeguards/invalid-uuid');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Safeguard-specific content verification', () => {
    it('should include key safeguard categories', async () => {
      const response = await request(app).get('/prepared-safeguards');

      expect(response.status).toBe(200);

      const texts = response.body.data.answers.map((s: { text: string }) => s.text.toLowerCase());

      // Verify key safeguard types exist
      expect(texts.some((t: string) => t.includes('pressure safety valve') || t.includes('psv'))).toBe(true);
      expect(texts.some((t: string) => t.includes('alarm'))).toBe(true);
      expect(texts.some((t: string) => t.includes('shutdown'))).toBe(true);
      expect(texts.some((t: string) => t.includes('check valve'))).toBe(true);
      expect(texts.some((t: string) => t.includes('procedure') || t.includes('sop'))).toBe(true);
    });

    it('should include SIS/safety system safeguards', async () => {
      const response = await request(app).get('/prepared-safeguards/search?q=shutdown');

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBeGreaterThan(0);

      // Should have multiple shutdown-related safeguards
      const texts = response.body.data.answers.map((s: { text: string }) => s.text.toLowerCase());
      expect(texts.filter((t: string) => t.includes('shutdown')).length).toBeGreaterThanOrEqual(2);
    });

    it('should include relief device safeguards', async () => {
      const response = await request(app).get('/prepared-safeguards/search?q=relief');

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should include alarm safeguards', async () => {
      const response = await request(app).get('/prepared-safeguards/search?q=alarm');

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBeGreaterThan(0);

      // Should have multiple alarm types
      expect(response.body.data.count).toBeGreaterThanOrEqual(5);
    });
  });
});
