/**
 * Unit tests for risk-aggregation.service.ts
 *
 * Tests the risk aggregation functions including:
 * - In-memory aggregation of risk rankings
 * - Percentile calculations
 * - Integration with threshold configuration
 *
 * Note: Database-dependent functions are tested in API integration tests.
 */

import { describe, it, expect } from '@jest/globals';
import type { RiskRanking } from '@hazop/types';
import { aggregateRiskRankings } from './risk-aggregation.service.js';

describe('Risk Aggregation Service', () => {
  // ==========================================================================
  // In-Memory Aggregation Functions
  // ==========================================================================

  describe('aggregateRiskRankings', () => {
    describe('with empty array', () => {
      it('should return zero statistics', () => {
        const result = aggregateRiskRankings([]);

        expect(result.statistics.totalEntries).toBe(0);
        expect(result.statistics.assessedEntries).toBe(0);
        expect(result.statistics.unassessedEntries).toBe(0);
        expect(result.statistics.highRiskCount).toBe(0);
        expect(result.statistics.mediumRiskCount).toBe(0);
        expect(result.statistics.lowRiskCount).toBe(0);
        expect(result.statistics.averageRiskScore).toBeNull();
        expect(result.statistics.maxRiskScore).toBeNull();
        expect(result.statistics.minRiskScore).toBeNull();
      });

      it('should return null distribution', () => {
        const result = aggregateRiskRankings([]);
        expect(result.distribution).toBeNull();
      });

      it('should return null percentiles', () => {
        const result = aggregateRiskRankings([]);
        expect(result.percentiles).toBeNull();
      });
    });

    describe('with only null values', () => {
      it('should count unassessed entries correctly', () => {
        const result = aggregateRiskRankings([null, null, null]);

        expect(result.statistics.totalEntries).toBe(3);
        expect(result.statistics.assessedEntries).toBe(0);
        expect(result.statistics.unassessedEntries).toBe(3);
      });

      it('should return null distribution and percentiles', () => {
        const result = aggregateRiskRankings([null, null]);

        expect(result.distribution).toBeNull();
        expect(result.percentiles).toBeNull();
      });
    });

    describe('with assessed rankings', () => {
      const mixedRankings: (RiskRanking | null)[] = [
        { severity: 1, likelihood: 1, detectability: 1, riskScore: 1, riskLevel: 'low' },
        { severity: 2, likelihood: 2, detectability: 2, riskScore: 8, riskLevel: 'low' },
        { severity: 3, likelihood: 3, detectability: 3, riskScore: 27, riskLevel: 'medium' },
        { severity: 4, likelihood: 4, detectability: 4, riskScore: 64, riskLevel: 'high' },
        { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
        null,
        null,
      ];

      it('should calculate statistics correctly', () => {
        const result = aggregateRiskRankings(mixedRankings);

        expect(result.statistics.totalEntries).toBe(7);
        expect(result.statistics.assessedEntries).toBe(5);
        expect(result.statistics.unassessedEntries).toBe(2);
        expect(result.statistics.highRiskCount).toBe(2);
        expect(result.statistics.mediumRiskCount).toBe(1);
        expect(result.statistics.lowRiskCount).toBe(2);
      });

      it('should calculate average risk score', () => {
        const result = aggregateRiskRankings(mixedRankings);

        const expectedAverage = (1 + 8 + 27 + 64 + 125) / 5;
        expect(result.statistics.averageRiskScore).toBeCloseTo(expectedAverage);
      });

      it('should calculate min and max risk scores', () => {
        const result = aggregateRiskRankings(mixedRankings);

        expect(result.statistics.minRiskScore).toBe(1);
        expect(result.statistics.maxRiskScore).toBe(125);
      });

      it('should calculate distribution percentages', () => {
        const result = aggregateRiskRankings(mixedRankings);

        expect(result.distribution).not.toBeNull();
        // 2 low out of 5 = 40%
        expect(result.distribution!.low).toBeCloseTo(40);
        // 1 medium out of 5 = 20%
        expect(result.distribution!.medium).toBeCloseTo(20);
        // 2 high out of 5 = 40%
        expect(result.distribution!.high).toBeCloseTo(40);
      });

      it('should calculate percentiles', () => {
        const result = aggregateRiskRankings(mixedRankings);

        expect(result.percentiles).not.toBeNull();
        // With sorted scores [1, 8, 27, 64, 125]:
        // p25 is at index 1 (25% of 4 = 1) = 8
        // p50 is at index 2 (50% of 4 = 2) = 27
        // p75 is at index 3 (75% of 4 = 3) = 64
        expect(result.percentiles!.p50).toBeCloseTo(27);
      });
    });

    describe('with single entry', () => {
      it('should handle single low risk entry', () => {
        const result = aggregateRiskRankings([
          { severity: 1, likelihood: 1, detectability: 1, riskScore: 1, riskLevel: 'low' },
        ]);

        expect(result.statistics.totalEntries).toBe(1);
        expect(result.statistics.assessedEntries).toBe(1);
        expect(result.statistics.lowRiskCount).toBe(1);
        expect(result.statistics.mediumRiskCount).toBe(0);
        expect(result.statistics.highRiskCount).toBe(0);
        expect(result.statistics.averageRiskScore).toBe(1);
        expect(result.statistics.minRiskScore).toBe(1);
        expect(result.statistics.maxRiskScore).toBe(1);
      });

      it('should return 100% for single entry distribution', () => {
        const result = aggregateRiskRankings([
          { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
        ]);

        expect(result.distribution).not.toBeNull();
        expect(result.distribution!.low).toBe(0);
        expect(result.distribution!.medium).toBe(0);
        expect(result.distribution!.high).toBe(100);
      });

      it('should set all percentiles to same value for single entry', () => {
        const result = aggregateRiskRankings([
          { severity: 3, likelihood: 3, detectability: 3, riskScore: 27, riskLevel: 'medium' },
        ]);

        expect(result.percentiles).not.toBeNull();
        expect(result.percentiles!.p25).toBe(27);
        expect(result.percentiles!.p50).toBe(27);
        expect(result.percentiles!.p75).toBe(27);
        expect(result.percentiles!.p90).toBe(27);
        expect(result.percentiles!.p95).toBe(27);
      });
    });

    describe('with all same risk level', () => {
      it('should return 100% for that level', () => {
        const allMedium: RiskRanking[] = [
          { severity: 3, likelihood: 3, detectability: 3, riskScore: 27, riskLevel: 'medium' },
          { severity: 3, likelihood: 4, detectability: 3, riskScore: 36, riskLevel: 'medium' },
          { severity: 4, likelihood: 3, detectability: 3, riskScore: 36, riskLevel: 'medium' },
        ];

        const result = aggregateRiskRankings(allMedium);

        expect(result.distribution!.low).toBe(0);
        expect(result.distribution!.medium).toBe(100);
        expect(result.distribution!.high).toBe(0);
      });
    });

    describe('distribution percentages', () => {
      it('should sum to 100', () => {
        const rankings: RiskRanking[] = [
          { severity: 1, likelihood: 1, detectability: 1, riskScore: 1, riskLevel: 'low' },
          { severity: 2, likelihood: 2, detectability: 2, riskScore: 8, riskLevel: 'low' },
          { severity: 3, likelihood: 3, detectability: 3, riskScore: 27, riskLevel: 'medium' },
          { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
        ];

        const result = aggregateRiskRankings(rankings);

        const total =
          result.distribution!.low +
          result.distribution!.medium +
          result.distribution!.high;

        expect(total).toBeCloseTo(100);
      });
    });
  });

  // ==========================================================================
  // Percentile Calculations
  // ==========================================================================

  describe('percentile calculations', () => {
    it('should calculate correct percentiles for evenly distributed scores', () => {
      // Scores: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
      const rankings: RiskRanking[] = [
        { severity: 1, likelihood: 1, detectability: 5, riskScore: 5, riskLevel: 'low' },
        { severity: 2, likelihood: 2, detectability: 3, riskScore: 12, riskLevel: 'low' },
        { severity: 3, likelihood: 3, detectability: 3, riskScore: 27, riskLevel: 'medium' },
        { severity: 3, likelihood: 4, detectability: 3, riskScore: 36, riskLevel: 'medium' },
        { severity: 4, likelihood: 3, detectability: 4, riskScore: 48, riskLevel: 'medium' },
        { severity: 4, likelihood: 4, detectability: 4, riskScore: 64, riskLevel: 'high' },
        { severity: 5, likelihood: 4, detectability: 4, riskScore: 80, riskLevel: 'high' },
        { severity: 5, likelihood: 5, detectability: 4, riskScore: 100, riskLevel: 'high' },
        { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
      ];

      const result = aggregateRiskRankings(rankings);

      expect(result.percentiles).not.toBeNull();
      // With 9 values, sorted: [5, 12, 27, 36, 48, 64, 80, 100, 125]
      // p50 (median) is at index 4 = 48
      expect(result.percentiles!.p50).toBeCloseTo(48, 0);
    });

    it('should interpolate percentiles correctly', () => {
      // Two values: 10 and 100
      const rankings: RiskRanking[] = [
        { severity: 1, likelihood: 2, detectability: 5, riskScore: 10, riskLevel: 'low' },
        { severity: 4, likelihood: 5, detectability: 5, riskScore: 100, riskLevel: 'high' },
      ];

      const result = aggregateRiskRankings(rankings);

      expect(result.percentiles).not.toBeNull();
      // p50 should interpolate between 10 and 100
      expect(result.percentiles!.p50).toBeCloseTo(55);
      // p25 should be closer to 10
      expect(result.percentiles!.p25).toBeCloseTo(32.5);
      // p75 should be closer to 100
      expect(result.percentiles!.p75).toBeCloseTo(77.5);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle maximum score (125) correctly', () => {
      const rankings: RiskRanking[] = [
        { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
        { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
      ];

      const result = aggregateRiskRankings(rankings);

      expect(result.statistics.maxRiskScore).toBe(125);
      expect(result.statistics.minRiskScore).toBe(125);
      expect(result.statistics.averageRiskScore).toBe(125);
    });

    it('should handle minimum score (1) correctly', () => {
      const rankings: RiskRanking[] = [
        { severity: 1, likelihood: 1, detectability: 1, riskScore: 1, riskLevel: 'low' },
        { severity: 1, likelihood: 1, detectability: 1, riskScore: 1, riskLevel: 'low' },
      ];

      const result = aggregateRiskRankings(rankings);

      expect(result.statistics.maxRiskScore).toBe(1);
      expect(result.statistics.minRiskScore).toBe(1);
      expect(result.statistics.averageRiskScore).toBe(1);
    });

    it('should handle large number of entries', () => {
      // Create 100 entries with varying risk levels
      const rankings: RiskRanking[] = [];
      for (let i = 0; i < 100; i++) {
        const score = (i % 125) + 1;
        let level: 'low' | 'medium' | 'high';
        if (score <= 20) level = 'low';
        else if (score <= 60) level = 'medium';
        else level = 'high';

        rankings.push({
          severity: 1 as 1 | 2 | 3 | 4 | 5,
          likelihood: 1 as 1 | 2 | 3 | 4 | 5,
          detectability: 1 as 1 | 2 | 3 | 4 | 5,
          riskScore: score,
          riskLevel: level,
        });
      }

      const result = aggregateRiskRankings(rankings);

      expect(result.statistics.totalEntries).toBe(100);
      expect(result.statistics.assessedEntries).toBe(100);
      expect(result.distribution).not.toBeNull();
      expect(result.percentiles).not.toBeNull();
    });

    it('should handle mix of assessed and unassessed with more unassessed', () => {
      const rankings: (RiskRanking | null)[] = [
        { severity: 3, likelihood: 3, detectability: 3, riskScore: 27, riskLevel: 'medium' },
        null,
        null,
        null,
        null,
        null,
      ];

      const result = aggregateRiskRankings(rankings);

      expect(result.statistics.totalEntries).toBe(6);
      expect(result.statistics.assessedEntries).toBe(1);
      expect(result.statistics.unassessedEntries).toBe(5);
      // Distribution should still work for assessed entries
      expect(result.distribution!.medium).toBe(100);
    });
  });

  // ==========================================================================
  // Type Definitions
  // ==========================================================================

  describe('type definitions', () => {
    it('should return correct RiskDistribution shape', () => {
      const rankings: RiskRanking[] = [
        { severity: 1, likelihood: 1, detectability: 1, riskScore: 1, riskLevel: 'low' },
      ];

      const result = aggregateRiskRankings(rankings);

      expect(result.distribution).toHaveProperty('low');
      expect(result.distribution).toHaveProperty('medium');
      expect(result.distribution).toHaveProperty('high');
      expect(typeof result.distribution!.low).toBe('number');
      expect(typeof result.distribution!.medium).toBe('number');
      expect(typeof result.distribution!.high).toBe('number');
    });

    it('should return correct ScorePercentiles shape', () => {
      const rankings: RiskRanking[] = [
        { severity: 1, likelihood: 1, detectability: 1, riskScore: 1, riskLevel: 'low' },
        { severity: 5, likelihood: 5, detectability: 5, riskScore: 125, riskLevel: 'high' },
      ];

      const result = aggregateRiskRankings(rankings);

      expect(result.percentiles).toHaveProperty('p25');
      expect(result.percentiles).toHaveProperty('p50');
      expect(result.percentiles).toHaveProperty('p75');
      expect(result.percentiles).toHaveProperty('p90');
      expect(result.percentiles).toHaveProperty('p95');
      expect(typeof result.percentiles!.p25).toBe('number');
      expect(typeof result.percentiles!.p50).toBe('number');
      expect(typeof result.percentiles!.p75).toBe('number');
      expect(typeof result.percentiles!.p90).toBe('number');
      expect(typeof result.percentiles!.p95).toBe('number');
    });

    it('should return correct RiskStatistics shape', () => {
      const result = aggregateRiskRankings([]);

      expect(result.statistics).toHaveProperty('totalEntries');
      expect(result.statistics).toHaveProperty('assessedEntries');
      expect(result.statistics).toHaveProperty('unassessedEntries');
      expect(result.statistics).toHaveProperty('highRiskCount');
      expect(result.statistics).toHaveProperty('mediumRiskCount');
      expect(result.statistics).toHaveProperty('lowRiskCount');
      expect(result.statistics).toHaveProperty('averageRiskScore');
      expect(result.statistics).toHaveProperty('maxRiskScore');
      expect(result.statistics).toHaveProperty('minRiskScore');
    });
  });
});
