/**
 * API integration tests for guide words endpoints.
 *
 * Tests the full API flow for guide word definitions.
 * These endpoints are public and don't require authentication.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express, { type Express } from 'express';

// Import the routes
import guideWordsRoutes from './guide-words.routes.js';

describe('Guide Words API Routes', () => {
  let app: Express;

  beforeAll(() => {
    // Create a fresh Express app for testing
    app = express();
    app.use(express.json());
    app.use('/guide-words', guideWordsRoutes);
  });

  describe('GET /guide-words', () => {
    it('should return all guide word definitions', async () => {
      const response = await request(app).get('/guide-words');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guideWords).toBeDefined();
      expect(response.body.data.count).toBe(7);

      // Verify all guide words are present
      const values = response.body.data.guideWords.map(
        (gw: { value: string }) => gw.value
      );
      expect(values).toContain('no');
      expect(values).toContain('more');
      expect(values).toContain('less');
      expect(values).toContain('reverse');
      expect(values).toContain('early');
      expect(values).toContain('late');
      expect(values).toContain('other_than');
    });

    it('should include all required properties for each guide word', async () => {
      const response = await request(app).get('/guide-words');

      expect(response.status).toBe(200);

      const firstGuideWord = response.body.data.guideWords[0];
      expect(firstGuideWord).toHaveProperty('value');
      expect(firstGuideWord).toHaveProperty('label');
      expect(firstGuideWord).toHaveProperty('description');
      expect(firstGuideWord).toHaveProperty('applicableParameters');
      expect(firstGuideWord).toHaveProperty('exampleDeviations');

      // Verify types
      expect(typeof firstGuideWord.value).toBe('string');
      expect(typeof firstGuideWord.label).toBe('string');
      expect(typeof firstGuideWord.description).toBe('string');
      expect(Array.isArray(firstGuideWord.applicableParameters)).toBe(true);
      expect(Array.isArray(firstGuideWord.exampleDeviations)).toBe(true);
    });
  });

  describe('GET /guide-words/:value', () => {
    it('should return a single guide word definition', async () => {
      const response = await request(app).get('/guide-words/no');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe('no');
      expect(response.body.data.label).toBe('No');
      expect(response.body.data.description).toContain('negation');
    });

    it('should return other_than guide word', async () => {
      const response = await request(app).get('/guide-words/other_than');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe('other_than');
      expect(response.body.data.label).toBe('Other Than');
    });

    it('should return 404 for invalid guide word', async () => {
      const response = await request(app).get('/guide-words/invalid');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for empty guide word value', async () => {
      // Note: Express treats '/guide-words/' as '/guide-words' (redirects to list endpoint)
      // So we test with an actual invalid value
      const response = await request(app).get('/guide-words/123');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /guide-words/parameters', () => {
    it('should return all valid parameters', async () => {
      const response = await request(app).get('/guide-words/parameters');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.parameters).toBeDefined();
      expect(Array.isArray(response.body.data.parameters)).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);

      // Verify common parameters are present
      const params = response.body.data.parameters;
      expect(params).toContain('flow');
      expect(params).toContain('pressure');
      expect(params).toContain('temperature');
    });

    it('should return sorted parameters', async () => {
      const response = await request(app).get('/guide-words/parameters');

      expect(response.status).toBe(200);

      const params = response.body.data.parameters;
      const sortedParams = [...params].sort();
      expect(params).toEqual(sortedParams);
    });
  });

  describe('GET /guide-words/by-parameter/:parameter', () => {
    it('should return guide words for flow parameter', async () => {
      const response = await request(app).get('/guide-words/by-parameter/flow');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.parameter).toBe('flow');
      expect(response.body.data.guideWords).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);

      // Flow should have no, more, less, and reverse guide words
      const values = response.body.data.guideWords.map(
        (gw: { value: string }) => gw.value
      );
      expect(values).toContain('no');
      expect(values).toContain('more');
      expect(values).toContain('less');
      expect(values).toContain('reverse');
    });

    it('should return guide words for composition parameter (other_than only)', async () => {
      const response = await request(app).get('/guide-words/by-parameter/composition');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.parameter).toBe('composition');

      // Composition should primarily have other_than
      const values = response.body.data.guideWords.map(
        (gw: { value: string }) => gw.value
      );
      expect(values).toContain('other_than');
    });

    it('should be case-insensitive for parameter lookup', async () => {
      const response1 = await request(app).get('/guide-words/by-parameter/FLOW');
      const response2 = await request(app).get('/guide-words/by-parameter/Flow');
      const response3 = await request(app).get('/guide-words/by-parameter/flow');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);

      // All should return the same data
      expect(response1.body.data.count).toBe(response2.body.data.count);
      expect(response2.body.data.count).toBe(response3.body.data.count);
    });

    it('should return empty array for unknown parameter', async () => {
      const response = await request(app).get('/guide-words/by-parameter/unknown');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.parameter).toBe('unknown');
      expect(response.body.data.guideWords).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });
  });
});
