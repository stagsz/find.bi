/**
 * Unit tests for lopa-recommendation.service.ts
 *
 * Tests the LOPA recommendation trigger functions including:
 * - Single entry LOPA recommendation checks
 * - Risk factor-based LOPA recommendations
 * - Trigger configuration creation and validation
 * - Preset configurations (default, conservative, relaxed)
 *
 * Note: Database-dependent functions (getEntryLOPARecommendation,
 * getAnalysisLOPARecommendations, etc.) are tested in API route tests
 * with proper database fixtures.
 */

import { describe, it, expect } from '@jest/globals';
import type { RiskRanking, LOPATriggerConfig } from '@hazop/types';
import { DEFAULT_LOPA_TRIGGER_CONFIG } from '@hazop/types';
import {
  checkLOPARecommendationForRanking,
  checkLOPARecommendationForFactors,
  isLOPARecommendedSimple,
  createLOPATriggerConfig,
  getDefaultLOPATriggerConfig,
  getConservativeLOPATriggerConfig,
  getRelaxedLOPATriggerConfig,
} from './lopa-recommendation.service.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a risk ranking for testing.
 */
function createRiskRanking(overrides: Partial<RiskRanking> = {}): RiskRanking {
  const severity = overrides.severity ?? 3;
  const likelihood = overrides.likelihood ?? 3;
  const detectability = overrides.detectability ?? 3;
  const riskScore = overrides.riskScore ?? severity * likelihood * detectability;
  const riskLevel = overrides.riskLevel ??
    (riskScore >= 61 ? 'high' : riskScore >= 21 ? 'medium' : 'low');

  return {
    severity,
    likelihood,
    detectability,
    riskScore,
    riskLevel,
    ...overrides,
  };
}

// =============================================================================
// checkLOPARecommendationForRanking Tests
// =============================================================================

describe('LOPA Recommendation Service', () => {
  describe('checkLOPARecommendationForRanking', () => {
    it('should recommend LOPA for high risk entries', () => {
      // Use severity 3 so it triggers on risk level, not severity
      const ranking = createRiskRanking({
        severity: 3,
        likelihood: 5,
        detectability: 5,
        riskScore: 75,
        riskLevel: 'high',
      });
      const result = checkLOPARecommendationForRanking(ranking);

      expect(result.recommended).toBe(true);
      expect(result.reason).toContain('high');
    });

    it('should require LOPA for severity 5 (Catastrophic)', () => {
      const ranking = createRiskRanking({
        severity: 5,
        likelihood: 2,
        detectability: 2,
        riskScore: 20,
        riskLevel: 'low',
      });
      const result = checkLOPARecommendationForRanking(ranking);

      expect(result.recommended).toBe(true);
      expect(result.required).toBe(true);
      expect(result.reason).toContain('severity level 5');
    });

    it('should require LOPA for severity 4 (Major)', () => {
      const ranking = createRiskRanking({
        severity: 4,
        likelihood: 2,
        detectability: 2,
        riskScore: 16,
        riskLevel: 'low',
      });
      const result = checkLOPARecommendationForRanking(ranking);

      expect(result.recommended).toBe(true);
      expect(result.required).toBe(true);
      expect(result.reason).toContain('severity level 4');
    });

    it('should recommend LOPA when risk score exceeds threshold', () => {
      const ranking = createRiskRanking({
        severity: 3,
        likelihood: 5,
        detectability: 5,
        riskScore: 75,
        riskLevel: 'high',
      });
      const result = checkLOPARecommendationForRanking(ranking);

      expect(result.recommended).toBe(true);
    });

    it('should not recommend LOPA for low risk entries', () => {
      const ranking = createRiskRanking({
        severity: 1,
        likelihood: 2,
        detectability: 2,
        riskScore: 4,
        riskLevel: 'low',
      });
      const result = checkLOPARecommendationForRanking(ranking);

      expect(result.recommended).toBe(false);
      expect(result.required).toBe(false);
      expect(result.reason).toContain('not required');
    });

    it('should not recommend LOPA for medium risk below threshold', () => {
      const ranking = createRiskRanking({
        severity: 3,
        likelihood: 3,
        detectability: 2,
        riskScore: 18,
        riskLevel: 'low',
      });
      const result = checkLOPARecommendationForRanking(ranking);

      expect(result.recommended).toBe(false);
    });

    it('should use custom config when provided', () => {
      const ranking = createRiskRanking({
        severity: 3,
        likelihood: 3,
        detectability: 3,
        riskScore: 27,
        riskLevel: 'medium',
      });

      // Default config doesn't recommend LOPA for medium risk
      const defaultResult = checkLOPARecommendationForRanking(ranking);
      expect(defaultResult.recommended).toBe(false);

      // Custom config that includes medium risk
      const customConfig: LOPATriggerConfig = {
        riskScoreThreshold: 20,
        riskLevels: ['medium', 'high'],
        requiredSeverityLevels: [4, 5],
      };
      const customResult = checkLOPARecommendationForRanking(ranking, customConfig);
      expect(customResult.recommended).toBe(true);
    });
  });

  // ===========================================================================
  // checkLOPARecommendationForFactors Tests
  // ===========================================================================

  describe('checkLOPARecommendationForFactors', () => {
    it('should calculate risk score from factors and check LOPA', () => {
      const result = checkLOPARecommendationForFactors(5, 3, 3);
      // Score = 5 * 3 * 3 = 45, but severity 5 requires LOPA
      expect(result.recommended).toBe(true);
      expect(result.required).toBe(true);
    });

    it('should recommend LOPA for high risk factors', () => {
      const result = checkLOPARecommendationForFactors(4, 4, 4);
      // Score = 4 * 4 * 4 = 64 (high risk)
      expect(result.recommended).toBe(true);
    });

    it('should not recommend LOPA for low risk factors', () => {
      const result = checkLOPARecommendationForFactors(2, 2, 2);
      // Score = 2 * 2 * 2 = 8 (low risk)
      expect(result.recommended).toBe(false);
    });

    it('should handle boundary cases correctly', () => {
      // Exactly at high risk threshold (61)
      // Need to find factors that multiply to 61 or close
      // 61 is prime, so let's test 60 (medium) and 64 (high)
      const mediumResult = checkLOPARecommendationForFactors(3, 4, 5);
      // Score = 3 * 4 * 5 = 60 (medium)
      expect(mediumResult.recommended).toBe(false);

      const highResult = checkLOPARecommendationForFactors(4, 4, 4);
      // Score = 4 * 4 * 4 = 64 (high)
      expect(highResult.recommended).toBe(true);
    });

    it('should accept custom config', () => {
      const customConfig: LOPATriggerConfig = {
        riskScoreThreshold: 30,
        riskLevels: ['medium', 'high'],
        requiredSeverityLevels: [5],
      };

      const result = checkLOPARecommendationForFactors(3, 3, 4, customConfig);
      // Score = 3 * 3 * 4 = 36 (medium), included in custom config
      expect(result.recommended).toBe(true);
    });
  });

  // ===========================================================================
  // isLOPARecommendedSimple Tests
  // ===========================================================================

  describe('isLOPARecommendedSimple', () => {
    it('should return true for severity 4 or higher', () => {
      expect(isLOPARecommendedSimple(4, 1)).toBe(true);
      expect(isLOPARecommendedSimple(5, 1)).toBe(true);
    });

    it('should return true for severity 3 with high likelihood', () => {
      expect(isLOPARecommendedSimple(3, 4)).toBe(true);
      expect(isLOPARecommendedSimple(3, 5)).toBe(true);
    });

    it('should return false for low severity', () => {
      expect(isLOPARecommendedSimple(1, 5)).toBe(false);
      expect(isLOPARecommendedSimple(2, 5)).toBe(false);
    });

    it('should return false for moderate severity with low likelihood', () => {
      expect(isLOPARecommendedSimple(3, 1)).toBe(false);
      expect(isLOPARecommendedSimple(3, 2)).toBe(false);
      expect(isLOPARecommendedSimple(3, 3)).toBe(false);
    });
  });

  // ===========================================================================
  // Trigger Configuration Tests
  // ===========================================================================

  describe('createLOPATriggerConfig', () => {
    it('should create valid config with valid parameters', () => {
      const config = createLOPATriggerConfig(50, ['high'], [4, 5]);

      expect(config.riskScoreThreshold).toBe(50);
      expect(config.riskLevels).toEqual(['high']);
      expect(config.requiredSeverityLevels).toEqual([4, 5]);
    });

    it('should throw error for threshold below 1', () => {
      expect(() => createLOPATriggerConfig(0, ['high'], [4, 5])).toThrow();
    });

    it('should throw error for threshold above 125', () => {
      expect(() => createLOPATriggerConfig(126, ['high'], [4, 5])).toThrow();
    });

    it('should throw error for invalid risk level', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => createLOPATriggerConfig(50, ['invalid' as any], [4, 5])).toThrow();
    });

    it('should throw error for invalid severity level', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => createLOPATriggerConfig(50, ['high'], [6 as any])).toThrow();
    });

    it('should allow boundary values', () => {
      const configMin = createLOPATriggerConfig(1, ['low'], [1]);
      expect(configMin.riskScoreThreshold).toBe(1);

      const configMax = createLOPATriggerConfig(125, ['high'], [5]);
      expect(configMax.riskScoreThreshold).toBe(125);
    });

    it('should allow multiple risk levels', () => {
      const config = createLOPATriggerConfig(30, ['medium', 'high'], [3, 4, 5]);

      expect(config.riskLevels).toContain('medium');
      expect(config.riskLevels).toContain('high');
      expect(config.requiredSeverityLevels).toContain(3);
    });
  });

  // ===========================================================================
  // Preset Configuration Tests
  // ===========================================================================

  describe('getDefaultLOPATriggerConfig', () => {
    it('should return default configuration matching type constants', () => {
      const config = getDefaultLOPATriggerConfig();

      expect(config.riskScoreThreshold).toBe(DEFAULT_LOPA_TRIGGER_CONFIG.riskScoreThreshold);
      expect(config.riskLevels).toEqual(DEFAULT_LOPA_TRIGGER_CONFIG.riskLevels);
      expect(config.requiredSeverityLevels).toEqual(DEFAULT_LOPA_TRIGGER_CONFIG.requiredSeverityLevels);
    });

    it('should return a copy, not the original', () => {
      const config1 = getDefaultLOPATriggerConfig();
      const config2 = getDefaultLOPATriggerConfig();

      config1.riskScoreThreshold = 999;
      expect(config2.riskScoreThreshold).not.toBe(999);
    });
  });

  describe('getConservativeLOPATriggerConfig', () => {
    it('should return conservative configuration', () => {
      const config = getConservativeLOPATriggerConfig();

      // Conservative has lower threshold
      expect(config.riskScoreThreshold).toBeLessThan(DEFAULT_LOPA_TRIGGER_CONFIG.riskScoreThreshold);
      // Conservative includes medium risk
      expect(config.riskLevels).toContain('medium');
      // Conservative includes severity 3
      expect(config.requiredSeverityLevels).toContain(3);
    });

    it('should be stricter than default', () => {
      const defaultConfig = getDefaultLOPATriggerConfig();
      const conservativeConfig = getConservativeLOPATriggerConfig();

      // Lower threshold means more recommendations
      expect(conservativeConfig.riskScoreThreshold).toBeLessThan(defaultConfig.riskScoreThreshold);
      // More severity levels included
      expect(conservativeConfig.requiredSeverityLevels.length)
        .toBeGreaterThanOrEqual(defaultConfig.requiredSeverityLevels.length);
    });
  });

  describe('getRelaxedLOPATriggerConfig', () => {
    it('should return relaxed configuration', () => {
      const config = getRelaxedLOPATriggerConfig();

      // Relaxed has higher threshold
      expect(config.riskScoreThreshold).toBeGreaterThan(DEFAULT_LOPA_TRIGGER_CONFIG.riskScoreThreshold);
      // Relaxed only includes high risk
      expect(config.riskLevels).toEqual(['high']);
      // Relaxed only requires severity 5
      expect(config.requiredSeverityLevels).toEqual([5]);
    });

    it('should be less strict than default', () => {
      const defaultConfig = getDefaultLOPATriggerConfig();
      const relaxedConfig = getRelaxedLOPATriggerConfig();

      // Higher threshold means fewer recommendations
      expect(relaxedConfig.riskScoreThreshold).toBeGreaterThan(defaultConfig.riskScoreThreshold);
      // Fewer severity levels included
      expect(relaxedConfig.requiredSeverityLevels.length)
        .toBeLessThanOrEqual(defaultConfig.requiredSeverityLevels.length);
    });
  });

  // ===========================================================================
  // Integration Tests with Different Configs
  // ===========================================================================

  describe('LOPA trigger with different presets', () => {
    it('should have consistent behavior across presets for high severity', () => {
      const ranking = createRiskRanking({
        severity: 5,
        likelihood: 3,
        detectability: 3,
        riskScore: 45,
        riskLevel: 'medium',
      });

      const defaultResult = checkLOPARecommendationForRanking(ranking, getDefaultLOPATriggerConfig());
      const conservativeResult = checkLOPARecommendationForRanking(ranking, getConservativeLOPATriggerConfig());
      const relaxedResult = checkLOPARecommendationForRanking(ranking, getRelaxedLOPATriggerConfig());

      // All configs should require LOPA for severity 5
      expect(defaultResult.required).toBe(true);
      expect(conservativeResult.required).toBe(true);
      expect(relaxedResult.required).toBe(true);
    });

    it('should show different recommendations for medium risk', () => {
      const ranking = createRiskRanking({
        severity: 3,
        likelihood: 3,
        detectability: 3,
        riskScore: 27,
        riskLevel: 'medium',
      });

      const defaultResult = checkLOPARecommendationForRanking(ranking, getDefaultLOPATriggerConfig());
      const conservativeResult = checkLOPARecommendationForRanking(ranking, getConservativeLOPATriggerConfig());
      const relaxedResult = checkLOPARecommendationForRanking(ranking, getRelaxedLOPATriggerConfig());

      // Default doesn't recommend for medium
      expect(defaultResult.recommended).toBe(false);
      // Conservative recommends for medium
      expect(conservativeResult.recommended).toBe(true);
      // Relaxed doesn't recommend for medium
      expect(relaxedResult.recommended).toBe(false);
    });

    it('should show different recommendations for borderline high risk', () => {
      const ranking = createRiskRanking({
        severity: 3,
        likelihood: 5,
        detectability: 4,
        riskScore: 60,
        riskLevel: 'medium',
      });

      const defaultResult = checkLOPARecommendationForRanking(ranking, getDefaultLOPATriggerConfig());
      const conservativeResult = checkLOPARecommendationForRanking(ranking, getConservativeLOPATriggerConfig());
      const relaxedResult = checkLOPARecommendationForRanking(ranking, getRelaxedLOPATriggerConfig());

      // Score 60 is just below default threshold (61)
      expect(defaultResult.recommended).toBe(false);
      // Conservative threshold (41) is exceeded
      expect(conservativeResult.recommended).toBe(true);
      // Relaxed threshold (81) is not exceeded
      expect(relaxedResult.recommended).toBe(false);
    });

    it('should show different recommendations for severity 4', () => {
      const ranking = createRiskRanking({
        severity: 4,
        likelihood: 2,
        detectability: 2,
        riskScore: 16,
        riskLevel: 'low',
      });

      const defaultResult = checkLOPARecommendationForRanking(ranking, getDefaultLOPATriggerConfig());
      const conservativeResult = checkLOPARecommendationForRanking(ranking, getConservativeLOPATriggerConfig());
      const relaxedResult = checkLOPARecommendationForRanking(ranking, getRelaxedLOPATriggerConfig());

      // Default requires LOPA for severity 4
      expect(defaultResult.required).toBe(true);
      // Conservative requires LOPA for severity 4
      expect(conservativeResult.required).toBe(true);
      // Relaxed does NOT require LOPA for severity 4 (only 5)
      expect(relaxedResult.required).toBe(false);
      expect(relaxedResult.recommended).toBe(false);
    });
  });
});
