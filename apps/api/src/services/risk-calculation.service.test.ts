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
import type { RiskRanking, RiskMatrixCell } from '@hazop/types';
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
  // 5x5 Risk Matrix functions
  getRiskLevelFromMatrix,
  calculateBaseRiskScore,
  determineRiskLevelFromBaseScore,
  generateRiskMatrixCell,
  generateRiskMatrixRow,
  generateRiskMatrix,
  getRiskMatrixCell,
  getRiskMatrixThresholds,
  isValidBaseRiskScore,
  getRiskMatrixCellsByLevel,
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

  // ==========================================================================
  // 5x5 Risk Matrix Functions
  // ==========================================================================

  describe('getRiskLevelFromMatrix', () => {
    it('should return correct risk level for corner cases', () => {
      // Low corner: S1 × L1
      expect(getRiskLevelFromMatrix(1, 1)).toBe('low');

      // High corner: S5 × L5
      expect(getRiskLevelFromMatrix(5, 5)).toBe('high');
    });

    it('should return correct risk levels across the matrix diagonal', () => {
      expect(getRiskLevelFromMatrix(1, 1)).toBe('low'); // S1×L1
      expect(getRiskLevelFromMatrix(2, 2)).toBe('low'); // S2×L2
      expect(getRiskLevelFromMatrix(3, 3)).toBe('medium'); // S3×L3
      expect(getRiskLevelFromMatrix(4, 4)).toBe('high'); // S4×L4
      expect(getRiskLevelFromMatrix(5, 5)).toBe('high'); // S5×L5
    });

    it('should match the documented matrix layout', () => {
      // Row S5 (severity 5)
      expect(getRiskLevelFromMatrix(5, 1)).toBe('medium');
      expect(getRiskLevelFromMatrix(5, 2)).toBe('high');
      expect(getRiskLevelFromMatrix(5, 3)).toBe('high');
      expect(getRiskLevelFromMatrix(5, 4)).toBe('high');
      expect(getRiskLevelFromMatrix(5, 5)).toBe('high');

      // Row S4 (severity 4)
      expect(getRiskLevelFromMatrix(4, 1)).toBe('low');
      expect(getRiskLevelFromMatrix(4, 2)).toBe('medium');
      expect(getRiskLevelFromMatrix(4, 3)).toBe('medium');
      expect(getRiskLevelFromMatrix(4, 4)).toBe('high');
      expect(getRiskLevelFromMatrix(4, 5)).toBe('high');

      // Row S3 (severity 3)
      expect(getRiskLevelFromMatrix(3, 1)).toBe('low');
      expect(getRiskLevelFromMatrix(3, 2)).toBe('low');
      expect(getRiskLevelFromMatrix(3, 3)).toBe('medium');
      expect(getRiskLevelFromMatrix(3, 4)).toBe('medium');
      expect(getRiskLevelFromMatrix(3, 5)).toBe('high');

      // Row S2 (severity 2)
      expect(getRiskLevelFromMatrix(2, 1)).toBe('low');
      expect(getRiskLevelFromMatrix(2, 2)).toBe('low');
      expect(getRiskLevelFromMatrix(2, 3)).toBe('low');
      expect(getRiskLevelFromMatrix(2, 4)).toBe('medium');
      expect(getRiskLevelFromMatrix(2, 5)).toBe('medium');

      // Row S1 (severity 1)
      expect(getRiskLevelFromMatrix(1, 1)).toBe('low');
      expect(getRiskLevelFromMatrix(1, 2)).toBe('low');
      expect(getRiskLevelFromMatrix(1, 3)).toBe('low');
      expect(getRiskLevelFromMatrix(1, 4)).toBe('low');
      expect(getRiskLevelFromMatrix(1, 5)).toBe('medium');
    });

    it('should throw error for invalid severity', () => {
      expect(() => getRiskLevelFromMatrix(0 as 1, 3)).toThrow('severity');
      expect(() => getRiskLevelFromMatrix(6 as 1, 3)).toThrow('severity');
    });

    it('should throw error for invalid likelihood', () => {
      expect(() => getRiskLevelFromMatrix(3, 0 as 1)).toThrow('likelihood');
      expect(() => getRiskLevelFromMatrix(3, 6 as 1)).toThrow('likelihood');
    });
  });

  describe('calculateBaseRiskScore', () => {
    it('should calculate minimum base score (1 × 1 = 1)', () => {
      expect(calculateBaseRiskScore(1, 1)).toBe(1);
    });

    it('should calculate maximum base score (5 × 5 = 25)', () => {
      expect(calculateBaseRiskScore(5, 5)).toBe(25);
    });

    it('should calculate intermediate base scores correctly', () => {
      expect(calculateBaseRiskScore(2, 3)).toBe(6);
      expect(calculateBaseRiskScore(3, 4)).toBe(12);
      expect(calculateBaseRiskScore(4, 5)).toBe(20);
    });

    it('should throw error for invalid severity', () => {
      expect(() => calculateBaseRiskScore(0 as 1, 3)).toThrow('severity');
    });

    it('should throw error for invalid likelihood', () => {
      expect(() => calculateBaseRiskScore(3, 0 as 1)).toThrow('likelihood');
    });
  });

  describe('determineRiskLevelFromBaseScore', () => {
    describe('Low risk (1-4)', () => {
      it('should return low for score 1', () => {
        expect(determineRiskLevelFromBaseScore(1)).toBe('low');
      });

      it('should return low for score 2', () => {
        expect(determineRiskLevelFromBaseScore(2)).toBe('low');
      });

      it('should return low for score 4', () => {
        expect(determineRiskLevelFromBaseScore(4)).toBe('low');
      });
    });

    describe('Medium risk (5-14)', () => {
      it('should return medium for score 5', () => {
        expect(determineRiskLevelFromBaseScore(5)).toBe('medium');
      });

      it('should return medium for score 10', () => {
        expect(determineRiskLevelFromBaseScore(10)).toBe('medium');
      });

      it('should return medium for score 14', () => {
        expect(determineRiskLevelFromBaseScore(14)).toBe('medium');
      });
    });

    describe('High risk (15-25)', () => {
      it('should return high for score 15', () => {
        expect(determineRiskLevelFromBaseScore(15)).toBe('high');
      });

      it('should return high for score 20', () => {
        expect(determineRiskLevelFromBaseScore(20)).toBe('high');
      });

      it('should return high for score 25', () => {
        expect(determineRiskLevelFromBaseScore(25)).toBe('high');
      });
    });

    describe('Invalid scores', () => {
      it('should throw error for score 0', () => {
        expect(() => determineRiskLevelFromBaseScore(0)).toThrow('Invalid base risk score');
      });

      it('should throw error for score 26', () => {
        expect(() => determineRiskLevelFromBaseScore(26)).toThrow('Invalid base risk score');
      });

      it('should throw error for negative score', () => {
        expect(() => determineRiskLevelFromBaseScore(-1)).toThrow('Invalid base risk score');
      });

      it('should throw error for non-integer score', () => {
        expect(() => determineRiskLevelFromBaseScore(10.5)).toThrow('Invalid base risk score');
      });
    });
  });

  describe('generateRiskMatrixCell', () => {
    it('should generate a complete cell with all properties', () => {
      const cell = generateRiskMatrixCell(3, 4);

      expect(cell.severity).toBe(3);
      expect(cell.likelihood).toBe(4);
      expect(cell.baseScore).toBe(12);
      expect(cell.riskLevel).toBe('medium');
    });

    it('should generate correct cell for low risk', () => {
      const cell = generateRiskMatrixCell(1, 2);

      expect(cell.baseScore).toBe(2);
      expect(cell.riskLevel).toBe('low');
    });

    it('should generate correct cell for high risk', () => {
      const cell = generateRiskMatrixCell(5, 5);

      expect(cell.baseScore).toBe(25);
      expect(cell.riskLevel).toBe('high');
    });
  });

  describe('generateRiskMatrixRow', () => {
    it('should generate a complete row with 5 cells', () => {
      const row = generateRiskMatrixRow(3);

      expect(row.severity).toBe(3);
      expect(row.severityLabel).toBe('Moderate');
      expect(row.cells).toHaveLength(5);
    });

    it('should have cells for all likelihood levels', () => {
      const row = generateRiskMatrixRow(4);

      expect(row.cells[0].likelihood).toBe(1);
      expect(row.cells[1].likelihood).toBe(2);
      expect(row.cells[2].likelihood).toBe(3);
      expect(row.cells[3].likelihood).toBe(4);
      expect(row.cells[4].likelihood).toBe(5);
    });

    it('should have consistent severity across all cells', () => {
      const row = generateRiskMatrixRow(2);

      row.cells.forEach((cell: RiskMatrixCell) => {
        expect(cell.severity).toBe(2);
      });
    });
  });

  describe('generateRiskMatrix', () => {
    it('should generate a complete 5x5 matrix', () => {
      const matrix = generateRiskMatrix();

      expect(matrix.rows).toHaveLength(5);
      expect(matrix.columns).toHaveLength(5);
      expect(matrix.summary.totalCells).toBe(25);
    });

    it('should have rows ordered from severity 5 (top) to 1 (bottom)', () => {
      const matrix = generateRiskMatrix();

      expect(matrix.rows[0].severity).toBe(5); // Top row
      expect(matrix.rows[1].severity).toBe(4);
      expect(matrix.rows[2].severity).toBe(3);
      expect(matrix.rows[3].severity).toBe(2);
      expect(matrix.rows[4].severity).toBe(1); // Bottom row
    });

    it('should have columns ordered from likelihood 1 (left) to 5 (right)', () => {
      const matrix = generateRiskMatrix();

      expect(matrix.columns[0].level).toBe(1);
      expect(matrix.columns[1].level).toBe(2);
      expect(matrix.columns[2].level).toBe(3);
      expect(matrix.columns[3].level).toBe(4);
      expect(matrix.columns[4].level).toBe(5);
    });

    it('should have correct column labels', () => {
      const matrix = generateRiskMatrix();

      expect(matrix.columns[0].label).toBe('Rare');
      expect(matrix.columns[4].label).toBe('Almost Certain');
    });

    it('should have summary counts that match actual cell counts', () => {
      const matrix = generateRiskMatrix();

      // Count cells manually
      let low = 0;
      let medium = 0;
      let high = 0;

      for (const row of matrix.rows) {
        for (const cell of row.cells) {
          if (cell.riskLevel === 'low') low++;
          else if (cell.riskLevel === 'medium') medium++;
          else if (cell.riskLevel === 'high') high++;
        }
      }

      expect(matrix.summary.lowRiskCells).toBe(low);
      expect(matrix.summary.mediumRiskCells).toBe(medium);
      expect(matrix.summary.highRiskCells).toBe(high);
      expect(low + medium + high).toBe(25);
    });
  });

  describe('getRiskMatrixCell', () => {
    it('should return cell for valid inputs', () => {
      const cell = getRiskMatrixCell(3, 4);

      expect(cell).not.toBeNull();
      expect(cell!.severity).toBe(3);
      expect(cell!.likelihood).toBe(4);
    });

    it('should return null for invalid severity', () => {
      expect(getRiskMatrixCell(0, 3)).toBeNull();
      expect(getRiskMatrixCell(6, 3)).toBeNull();
    });

    it('should return null for invalid likelihood', () => {
      expect(getRiskMatrixCell(3, 0)).toBeNull();
      expect(getRiskMatrixCell(3, 6)).toBeNull();
    });
  });

  describe('getRiskMatrixThresholds', () => {
    it('should return correct low threshold', () => {
      const thresholds = getRiskMatrixThresholds();

      expect(thresholds.low.min).toBe(1);
      expect(thresholds.low.max).toBe(4);
    });

    it('should return correct medium threshold', () => {
      const thresholds = getRiskMatrixThresholds();

      expect(thresholds.medium.min).toBe(5);
      expect(thresholds.medium.max).toBe(14);
    });

    it('should return correct high threshold', () => {
      const thresholds = getRiskMatrixThresholds();

      expect(thresholds.high.min).toBe(15);
      expect(thresholds.high.max).toBe(25);
    });
  });

  describe('isValidBaseRiskScore', () => {
    it('should return true for valid scores (1-25)', () => {
      expect(isValidBaseRiskScore(1)).toBe(true);
      expect(isValidBaseRiskScore(13)).toBe(true);
      expect(isValidBaseRiskScore(25)).toBe(true);
    });

    it('should return false for invalid scores', () => {
      expect(isValidBaseRiskScore(0)).toBe(false);
      expect(isValidBaseRiskScore(26)).toBe(false);
      expect(isValidBaseRiskScore(-1)).toBe(false);
      expect(isValidBaseRiskScore(10.5)).toBe(false);
    });
  });

  describe('getRiskMatrixCellsByLevel', () => {
    it('should return all low risk cells', () => {
      const cells = getRiskMatrixCellsByLevel('low');

      cells.forEach((cell) => {
        expect(cell.riskLevel).toBe('low');
      });
    });

    it('should return all medium risk cells', () => {
      const cells = getRiskMatrixCellsByLevel('medium');

      cells.forEach((cell) => {
        expect(cell.riskLevel).toBe('medium');
      });
    });

    it('should return all high risk cells', () => {
      const cells = getRiskMatrixCellsByLevel('high');

      cells.forEach((cell) => {
        expect(cell.riskLevel).toBe('high');
      });
    });

    it('should return cells with correct base scores', () => {
      const cells = getRiskMatrixCellsByLevel('high');

      cells.forEach((cell) => {
        expect(cell.baseScore).toBe(cell.severity * cell.likelihood);
      });
    });

    it('should have total cells across all levels equal to 25', () => {
      const lowCells = getRiskMatrixCellsByLevel('low');
      const mediumCells = getRiskMatrixCellsByLevel('medium');
      const highCells = getRiskMatrixCellsByLevel('high');

      expect(lowCells.length + mediumCells.length + highCells.length).toBe(25);
    });
  });
});
