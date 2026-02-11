/**
 * Unit tests for risk-calculation.service.ts
 *
 * Tests the risk calculation functions including:
 * - Risk score calculation (severity × likelihood × detectability)
 * - Risk level determination based on thresholds
 * - Validation functions
 * - Statistics calculations
 */

import { describe, it, expect } from '@jest/globals';
import type { RiskRanking } from '@hazop/types';
import {
  isValidSeverityLevel,
  isValidLikelihoodLevel,
  isValidDetectabilityLevel,
  isValidRiskScore,
  validateRiskFactors,
  calculateRiskScore,
  determineRiskLevel,
  calculateRiskRanking,
  calculateRisk,
  getSeverityLevels,
  getLikelihoodLevels,
  getDetectabilityLevels,
  getRiskLevelDefinitions,
  getSeverityLabel,
  getLikelihoodLabel,
  getDetectabilityLabel,
  getRiskLevelLabel,
  calculateRiskStatistics,
  getRiskDistribution,
} from './risk-calculation.service.js';

describe('Risk Calculation Service', () => {
  // ==========================================================================
  // Validation Functions
  // ==========================================================================

  describe('isValidSeverityLevel', () => {
    it('should return true for valid levels (1-5)', () => {
      expect(isValidSeverityLevel(1)).toBe(true);
      expect(isValidSeverityLevel(2)).toBe(true);
      expect(isValidSeverityLevel(3)).toBe(true);
      expect(isValidSeverityLevel(4)).toBe(true);
      expect(isValidSeverityLevel(5)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isValidSeverityLevel(0)).toBe(false);
      expect(isValidSeverityLevel(6)).toBe(false);
      expect(isValidSeverityLevel(-1)).toBe(false);
      expect(isValidSeverityLevel(1.5)).toBe(false);
    });
  });

  describe('isValidLikelihoodLevel', () => {
    it('should return true for valid levels (1-5)', () => {
      expect(isValidLikelihoodLevel(1)).toBe(true);
      expect(isValidLikelihoodLevel(2)).toBe(true);
      expect(isValidLikelihoodLevel(3)).toBe(true);
      expect(isValidLikelihoodLevel(4)).toBe(true);
      expect(isValidLikelihoodLevel(5)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isValidLikelihoodLevel(0)).toBe(false);
      expect(isValidLikelihoodLevel(6)).toBe(false);
      expect(isValidLikelihoodLevel(-1)).toBe(false);
    });
  });

  describe('isValidDetectabilityLevel', () => {
    it('should return true for valid levels (1-5)', () => {
      expect(isValidDetectabilityLevel(1)).toBe(true);
      expect(isValidDetectabilityLevel(2)).toBe(true);
      expect(isValidDetectabilityLevel(3)).toBe(true);
      expect(isValidDetectabilityLevel(4)).toBe(true);
      expect(isValidDetectabilityLevel(5)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isValidDetectabilityLevel(0)).toBe(false);
      expect(isValidDetectabilityLevel(6)).toBe(false);
    });
  });

  describe('isValidRiskScore', () => {
    it('should return true for valid scores (1-125)', () => {
      expect(isValidRiskScore(1)).toBe(true);
      expect(isValidRiskScore(20)).toBe(true);
      expect(isValidRiskScore(60)).toBe(true);
      expect(isValidRiskScore(125)).toBe(true);
    });

    it('should return false for invalid scores', () => {
      expect(isValidRiskScore(0)).toBe(false);
      expect(isValidRiskScore(126)).toBe(false);
      expect(isValidRiskScore(-1)).toBe(false);
      expect(isValidRiskScore(50.5)).toBe(false);
    });
  });

  describe('validateRiskFactors', () => {
    it('should return valid for correct inputs', () => {
      const result = validateRiskFactors(3, 3, 3);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid severity', () => {
      const result = validateRiskFactors(0, 3, 3);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('severity');
    });

    it('should return error for invalid likelihood', () => {
      const result = validateRiskFactors(3, 6, 3);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('likelihood');
    });

    it('should return error for invalid detectability', () => {
      const result = validateRiskFactors(3, 3, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('detectability');
    });
  });

  // ==========================================================================
  // Risk Score Calculation
  // ==========================================================================

  describe('calculateRiskScore', () => {
    it('should calculate minimum risk score (1 × 1 × 1 = 1)', () => {
      const score = calculateRiskScore(1, 1, 1);
      expect(score).toBe(1);
    });

    it('should calculate maximum risk score (5 × 5 × 5 = 125)', () => {
      const score = calculateRiskScore(5, 5, 5);
      expect(score).toBe(125);
    });

    it('should calculate intermediate risk scores correctly', () => {
      // 3 × 3 × 3 = 27
      expect(calculateRiskScore(3, 3, 3)).toBe(27);
      // 4 × 3 × 2 = 24
      expect(calculateRiskScore(4, 3, 2)).toBe(24);
      // 5 × 4 × 3 = 60
      expect(calculateRiskScore(5, 4, 3)).toBe(60);
      // 5 × 5 × 3 = 75
      expect(calculateRiskScore(5, 5, 3)).toBe(75);
    });

    it('should throw error for invalid severity', () => {
      expect(() => calculateRiskScore(0 as 1, 3, 3)).toThrow('severity');
      expect(() => calculateRiskScore(6 as 1, 3, 3)).toThrow('severity');
    });

    it('should throw error for invalid likelihood', () => {
      expect(() => calculateRiskScore(3, 0 as 1, 3)).toThrow('likelihood');
    });

    it('should throw error for invalid detectability', () => {
      expect(() => calculateRiskScore(3, 3, 0 as 1)).toThrow('detectability');
    });
  });

  // ==========================================================================
  // Risk Level Determination
  // ==========================================================================

  describe('determineRiskLevel', () => {
    describe('Low risk (1-20)', () => {
      it('should return low for score 1', () => {
        expect(determineRiskLevel(1)).toBe('low');
      });

      it('should return low for score 10', () => {
        expect(determineRiskLevel(10)).toBe('low');
      });

      it('should return low for score 20', () => {
        expect(determineRiskLevel(20)).toBe('low');
      });
    });

    describe('Medium risk (21-60)', () => {
      it('should return medium for score 21', () => {
        expect(determineRiskLevel(21)).toBe('medium');
      });

      it('should return medium for score 40', () => {
        expect(determineRiskLevel(40)).toBe('medium');
      });

      it('should return medium for score 60', () => {
        expect(determineRiskLevel(60)).toBe('medium');
      });
    });

    describe('High risk (61-125)', () => {
      it('should return high for score 61', () => {
        expect(determineRiskLevel(61)).toBe('high');
      });

      it('should return high for score 90', () => {
        expect(determineRiskLevel(90)).toBe('high');
      });

      it('should return high for score 125', () => {
        expect(determineRiskLevel(125)).toBe('high');
      });
    });

    describe('Invalid scores', () => {
      it('should throw error for score 0', () => {
        expect(() => determineRiskLevel(0)).toThrow('Invalid risk score');
      });

      it('should throw error for score 126', () => {
        expect(() => determineRiskLevel(126)).toThrow('Invalid risk score');
      });

      it('should throw error for negative score', () => {
        expect(() => determineRiskLevel(-1)).toThrow('Invalid risk score');
      });

      it('should throw error for non-integer score', () => {
        expect(() => determineRiskLevel(50.5)).toThrow('Invalid risk score');
      });
    });
  });

  // ==========================================================================
  // Complete Risk Ranking Calculation
  // ==========================================================================

  describe('calculateRiskRanking', () => {
    it('should return complete risk ranking for low risk', () => {
      const ranking = calculateRiskRanking(1, 2, 2);

      expect(ranking).toEqual({
        severity: 1,
        likelihood: 2,
        detectability: 2,
        riskScore: 4,
        riskLevel: 'low',
      });
    });

    it('should return complete risk ranking for medium risk', () => {
      const ranking = calculateRiskRanking(3, 3, 3);

      expect(ranking).toEqual({
        severity: 3,
        likelihood: 3,
        detectability: 3,
        riskScore: 27,
        riskLevel: 'medium',
      });
    });

    it('should return complete risk ranking for high risk', () => {
      const ranking = calculateRiskRanking(5, 5, 5);

      expect(ranking).toEqual({
        severity: 5,
        likelihood: 5,
        detectability: 5,
        riskScore: 125,
        riskLevel: 'high',
      });
    });

    it('should handle boundary case at low/medium threshold', () => {
      // 2 × 2 × 5 = 20 (low)
      const lowBoundary = calculateRiskRanking(2, 2, 5);
      expect(lowBoundary.riskScore).toBe(20);
      expect(lowBoundary.riskLevel).toBe('low');

      // 3 × 3 × 3 = 27 (medium) - closest possible above 20
      // Actually: 3 × 2 × 4 = 24 or 4 × 3 × 2 = 24 or 7 × 3 = 21
      // 3 × 1 × 7 = 21 - not valid as levels are 1-5
      // Let's use 1 × 3 × 7 = 21 - also not valid
      // 3 × 2 × 4 = 24 is closest using valid levels
    });

    it('should handle boundary case at medium/high threshold', () => {
      // 3 × 4 × 5 = 60 (medium)
      const mediumBoundary = calculateRiskRanking(3, 4, 5);
      expect(mediumBoundary.riskScore).toBe(60);
      expect(mediumBoundary.riskLevel).toBe('medium');

      // 5 × 5 × 3 = 75 (high)
      const highBoundary = calculateRiskRanking(5, 5, 3);
      expect(highBoundary.riskScore).toBe(75);
      expect(highBoundary.riskLevel).toBe('high');
    });
  });

  describe('calculateRisk', () => {
    it('should return risk with label for low risk', () => {
      const result = calculateRisk(1, 2, 2);

      expect(result.riskScore).toBe(4);
      expect(result.riskLevel).toBe('low');
      expect(result.riskLevelLabel).toBe('Low Risk');
    });

    it('should return risk with label for medium risk', () => {
      const result = calculateRisk(3, 3, 3);

      expect(result.riskScore).toBe(27);
      expect(result.riskLevel).toBe('medium');
      expect(result.riskLevelLabel).toBe('Medium Risk');
    });

    it('should return risk with label for high risk', () => {
      const result = calculateRisk(5, 4, 4);

      expect(result.riskScore).toBe(80);
      expect(result.riskLevel).toBe('high');
      expect(result.riskLevelLabel).toBe('High Risk');
    });

    it('should include all input values in result', () => {
      const result = calculateRisk(3, 4, 2);

      expect(result.severity).toBe(3);
      expect(result.likelihood).toBe(4);
      expect(result.detectability).toBe(2);
    });
  });

  // ==========================================================================
  // Risk Factor Information Functions
  // ==========================================================================

  describe('getSeverityLevels', () => {
    it('should return 5 severity levels', () => {
      const result = getSeverityLevels();

      expect(result.count).toBe(5);
      expect(result.levels).toHaveLength(5);
    });

    it('should include all levels with correct values', () => {
      const result = getSeverityLevels();
      const values = result.levels.map((l) => l.value);

      expect(values).toEqual([1, 2, 3, 4, 5]);
    });

    it('should have correct name', () => {
      const result = getSeverityLevels();
      expect(result.name).toBe('Severity');
    });

    it('should include labels for all levels', () => {
      const result = getSeverityLevels();

      expect(result.levels[0].label).toBe('Negligible');
      expect(result.levels[4].label).toBe('Catastrophic');
    });

    it('should include descriptions for all levels', () => {
      const result = getSeverityLevels();

      result.levels.forEach((level) => {
        expect(level.description).toBeDefined();
        expect(level.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getLikelihoodLevels', () => {
    it('should return 5 likelihood levels', () => {
      const result = getLikelihoodLevels();

      expect(result.count).toBe(5);
      expect(result.levels).toHaveLength(5);
    });

    it('should have correct name', () => {
      const result = getLikelihoodLevels();
      expect(result.name).toBe('Likelihood');
    });

    it('should include labels for all levels', () => {
      const result = getLikelihoodLevels();

      expect(result.levels[0].label).toBe('Rare');
      expect(result.levels[4].label).toBe('Almost Certain');
    });
  });

  describe('getDetectabilityLevels', () => {
    it('should return 5 detectability levels', () => {
      const result = getDetectabilityLevels();

      expect(result.count).toBe(5);
      expect(result.levels).toHaveLength(5);
    });

    it('should have correct name', () => {
      const result = getDetectabilityLevels();
      expect(result.name).toBe('Detectability');
    });

    it('should include labels for all levels', () => {
      const result = getDetectabilityLevels();

      expect(result.levels[0].label).toBe('Almost Certain');
      expect(result.levels[4].label).toBe('Undetectable');
    });
  });

  describe('getRiskLevelDefinitions', () => {
    it('should return 3 risk levels', () => {
      const result = getRiskLevelDefinitions();
      expect(result).toHaveLength(3);
    });

    it('should include low, medium, high in order', () => {
      const result = getRiskLevelDefinitions();

      expect(result[0].value).toBe('low');
      expect(result[1].value).toBe('medium');
      expect(result[2].value).toBe('high');
    });

    it('should have correct thresholds for low', () => {
      const result = getRiskLevelDefinitions();

      expect(result[0].minScore).toBe(1);
      expect(result[0].maxScore).toBe(20);
    });

    it('should have correct thresholds for medium', () => {
      const result = getRiskLevelDefinitions();

      expect(result[1].minScore).toBe(21);
      expect(result[1].maxScore).toBe(60);
    });

    it('should have correct thresholds for high', () => {
      const result = getRiskLevelDefinitions();

      expect(result[2].minScore).toBe(61);
      expect(result[2].maxScore).toBe(125);
    });

    it('should have labels for all levels', () => {
      const result = getRiskLevelDefinitions();

      expect(result[0].label).toBe('Low Risk');
      expect(result[1].label).toBe('Medium Risk');
      expect(result[2].label).toBe('High Risk');
    });
  });

  describe('getSeverityLabel', () => {
    it('should return correct labels for valid levels', () => {
      expect(getSeverityLabel(1)).toBe('Negligible');
      expect(getSeverityLabel(3)).toBe('Moderate');
      expect(getSeverityLabel(5)).toBe('Catastrophic');
    });

    it('should return null for invalid levels', () => {
      expect(getSeverityLabel(0)).toBeNull();
      expect(getSeverityLabel(6)).toBeNull();
    });
  });

  describe('getLikelihoodLabel', () => {
    it('should return correct labels for valid levels', () => {
      expect(getLikelihoodLabel(1)).toBe('Rare');
      expect(getLikelihoodLabel(3)).toBe('Possible');
      expect(getLikelihoodLabel(5)).toBe('Almost Certain');
    });

    it('should return null for invalid levels', () => {
      expect(getLikelihoodLabel(0)).toBeNull();
      expect(getLikelihoodLabel(6)).toBeNull();
    });
  });

  describe('getDetectabilityLabel', () => {
    it('should return correct labels for valid levels', () => {
      expect(getDetectabilityLabel(1)).toBe('Almost Certain');
      expect(getDetectabilityLabel(3)).toBe('Moderate');
      expect(getDetectabilityLabel(5)).toBe('Undetectable');
    });

    it('should return null for invalid levels', () => {
      expect(getDetectabilityLabel(0)).toBeNull();
      expect(getDetectabilityLabel(6)).toBeNull();
    });
  });

  describe('getRiskLevelLabel', () => {
    it('should return correct labels for all risk levels', () => {
      expect(getRiskLevelLabel('low')).toBe('Low Risk');
      expect(getRiskLevelLabel('medium')).toBe('Medium Risk');
      expect(getRiskLevelLabel('high')).toBe('High Risk');
    });
  });

  // ==========================================================================
  // Risk Statistics Functions
  // ==========================================================================

  describe('calculateRiskStatistics', () => {
    it('should handle empty array', () => {
      const stats = calculateRiskStatistics([]);

      expect(stats.totalEntries).toBe(0);
      expect(stats.assessedEntries).toBe(0);
      expect(stats.unassessedEntries).toBe(0);
      expect(stats.highRiskCount).toBe(0);
      expect(stats.mediumRiskCount).toBe(0);
      expect(stats.lowRiskCount).toBe(0);
      expect(stats.averageRiskScore).toBeNull();
      expect(stats.maxRiskScore).toBeNull();
      expect(stats.minRiskScore).toBeNull();
    });

    it('should handle array with only null values', () => {
      const stats = calculateRiskStatistics([null, null, null]);

      expect(stats.totalEntries).toBe(3);
      expect(stats.assessedEntries).toBe(0);
      expect(stats.unassessedEntries).toBe(3);
      expect(stats.averageRiskScore).toBeNull();
    });

    it('should calculate statistics correctly', () => {
      const rankings: (RiskRanking | null)[] = [
        { severity: 1, likelihood: 1, detectability: 1, riskScore: 1, riskLevel: 'low' },
        { severity: 3, likelihood: 3, detectability: 3, riskScore: 27, riskLevel: 'medium' },
        { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
        null,
      ];

      const stats = calculateRiskStatistics(rankings);

      expect(stats.totalEntries).toBe(4);
      expect(stats.assessedEntries).toBe(3);
      expect(stats.unassessedEntries).toBe(1);
      expect(stats.highRiskCount).toBe(1);
      expect(stats.mediumRiskCount).toBe(1);
      expect(stats.lowRiskCount).toBe(1);
      expect(stats.averageRiskScore).toBeCloseTo((1 + 27 + 125) / 3);
      expect(stats.maxRiskScore).toBe(125);
      expect(stats.minRiskScore).toBe(1);
    });

    it('should count risk levels correctly with multiple of same level', () => {
      const rankings: RiskRanking[] = [
        { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
        { severity: 5, likelihood: 4, detectability: 4, riskScore: 80, riskLevel: 'high' },
        { severity: 3, likelihood: 3, detectability: 3, riskScore: 27, riskLevel: 'medium' },
      ];

      const stats = calculateRiskStatistics(rankings);

      expect(stats.highRiskCount).toBe(2);
      expect(stats.mediumRiskCount).toBe(1);
      expect(stats.lowRiskCount).toBe(0);
    });
  });

  describe('getRiskDistribution', () => {
    it('should return null for empty array', () => {
      const distribution = getRiskDistribution([]);
      expect(distribution).toBeNull();
    });

    it('should return null for array with only null values', () => {
      const distribution = getRiskDistribution([null, null]);
      expect(distribution).toBeNull();
    });

    it('should calculate percentages correctly', () => {
      const rankings: RiskRanking[] = [
        { severity: 1, likelihood: 1, detectability: 1, riskScore: 1, riskLevel: 'low' },
        { severity: 1, likelihood: 1, detectability: 2, riskScore: 2, riskLevel: 'low' },
        { severity: 3, likelihood: 3, detectability: 3, riskScore: 27, riskLevel: 'medium' },
        { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
      ];

      const distribution = getRiskDistribution(rankings);

      expect(distribution).not.toBeNull();
      expect(distribution!.low).toBe(50); // 2 out of 4
      expect(distribution!.medium).toBe(25); // 1 out of 4
      expect(distribution!.high).toBe(25); // 1 out of 4
    });

    it('should handle 100% of one level', () => {
      const rankings: RiskRanking[] = [
        { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
        { severity: 5, likelihood: 4, detectability: 4, riskScore: 80, riskLevel: 'high' },
      ];

      const distribution = getRiskDistribution(rankings);

      expect(distribution).not.toBeNull();
      expect(distribution!.low).toBe(0);
      expect(distribution!.medium).toBe(0);
      expect(distribution!.high).toBe(100);
    });

    it('should ignore null values in percentage calculation', () => {
      const rankings: (RiskRanking | null)[] = [
        { severity: 1, likelihood: 1, detectability: 1, riskScore: 1, riskLevel: 'low' },
        null,
        null,
        { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
      ];

      const distribution = getRiskDistribution(rankings);

      expect(distribution).not.toBeNull();
      expect(distribution!.low).toBe(50); // 1 out of 2 assessed
      expect(distribution!.medium).toBe(0);
      expect(distribution!.high).toBe(50); // 1 out of 2 assessed
    });
  });
});
