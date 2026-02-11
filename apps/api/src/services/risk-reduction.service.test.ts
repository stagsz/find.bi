/**
 * Unit tests for risk-reduction.service.ts
 *
 * Tests the Risk Reduction Factor (RRF) calculation and analysis functions
 * including:
 * - Core RRF calculations (RRF, orders of magnitude, PFD conversions)
 * - IPL risk reduction analysis
 * - Gap analysis between actual and required protection
 * - RRF requirement calculations
 * - Formatting functions
 */

import { describe, it, expect } from '@jest/globals';
import type { IPL, SafetyIntegrityLevel } from '@hazop/types';
import {
  calculateRRF,
  calculateTotalRRF,
  calculateOrdersOfMagnitude,
  calculateAdditionalRRFNeeded,
  calculatePFDFromRRF,
  determineSILFromRRF,
  getRRFRangeForSIL,
  getTypicalRRFForSIL,
  getTypicalRRFForIPLType,
  analyzeIPLRiskReduction,
  analyzeRiskReduction,
  getRRFByIPLType,
  analyzeRiskReductionGap,
  calculateRRFRequirement,
  calculateRRFRequirementFromSeverity,
  formatRRF,
  formatOrdersOfMagnitude,
  formatPFD,
  formatFrequency,
  formatGapStatus,
  isCrediblePFD,
  clampPFD,
  combineRRFs,
  getGapThresholds,
  performComprehensiveRiskReductionAnalysis,
  MIN_CREDITABLE_PFD,
  MAX_CREDITABLE_PFD,
} from './risk-reduction.service.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a valid IPL for testing.
 */
function createTestIPL(overrides: Partial<IPL> = {}): IPL {
  return {
    id: 'ipl-1',
    type: 'safety_instrumented_function',
    name: 'LAHH-101',
    description: 'High-high level alarm with shutdown',
    pfd: 0.01,
    independentOfInitiator: true,
    independentOfOtherIPLs: true,
    sil: 2,
    ...overrides,
  };
}

// =============================================================================
// Core RRF Calculation Tests
// =============================================================================

describe('Risk Reduction Service', () => {
  describe('calculateRRF', () => {
    it('should calculate RRF correctly for typical PFD values', () => {
      expect(calculateRRF(0.1)).toBe(10);
      expect(calculateRRF(0.01)).toBe(100);
      expect(calculateRRF(0.001)).toBe(1000);
      expect(calculateRRF(0.0001)).toBe(10000);
    });

    it('should handle boundary PFD values', () => {
      expect(calculateRRF(1)).toBe(1);
      expect(calculateRRF(MIN_CREDITABLE_PFD)).toBe(1 / MIN_CREDITABLE_PFD);
    });

    it('should throw for invalid PFD values', () => {
      expect(() => calculateRRF(0)).toThrow();
      expect(() => calculateRRF(-0.1)).toThrow();
      expect(() => calculateRRF(1.5)).toThrow();
    });
  });

  describe('calculateTotalRRF', () => {
    it('should combine RRFs correctly', () => {
      // Two IPLs with PFD 0.1 each: combined PFD = 0.01, RRF = 100
      expect(calculateTotalRRF([0.1, 0.1])).toBe(100);

      // Two IPLs with PFD 0.01 each: combined PFD = 0.0001, RRF = 10000
      expect(calculateTotalRRF([0.01, 0.01])).toBe(10000);
    });

    it('should return 1 for empty array', () => {
      expect(calculateTotalRRF([])).toBe(1);
    });

    it('should handle single IPL', () => {
      expect(calculateTotalRRF([0.01])).toBe(100);
    });
  });

  describe('calculateOrdersOfMagnitude', () => {
    it('should calculate orders of magnitude correctly', () => {
      expect(calculateOrdersOfMagnitude(10)).toBe(1);
      expect(calculateOrdersOfMagnitude(100)).toBe(2);
      expect(calculateOrdersOfMagnitude(1000)).toBe(3);
      expect(calculateOrdersOfMagnitude(10000)).toBe(4);
    });

    it('should handle intermediate values', () => {
      const orders = calculateOrdersOfMagnitude(50);
      expect(orders).toBeGreaterThan(1);
      expect(orders).toBeLessThan(2);
    });

    it('should return 0 for RRF <= 0', () => {
      expect(calculateOrdersOfMagnitude(0)).toBe(0);
      expect(calculateOrdersOfMagnitude(-1)).toBe(0);
    });
  });

  describe('calculateAdditionalRRFNeeded', () => {
    it('should return 0 when current RRF is adequate', () => {
      expect(calculateAdditionalRRFNeeded(1000, 1000)).toBe(0);
      expect(calculateAdditionalRRFNeeded(2000, 1000)).toBe(0);
    });

    it('should calculate additional RRF needed correctly', () => {
      // Current 100, need 1000: need additional 10x
      expect(calculateAdditionalRRFNeeded(100, 1000)).toBe(10);

      // Current 50, need 500: need additional 10x
      expect(calculateAdditionalRRFNeeded(50, 500)).toBe(10);
    });
  });

  describe('calculatePFDFromRRF', () => {
    it('should calculate PFD from RRF correctly', () => {
      expect(calculatePFDFromRRF(10)).toBe(0.1);
      expect(calculatePFDFromRRF(100)).toBe(0.01);
      expect(calculatePFDFromRRF(1000)).toBe(0.001);
    });

    it('should throw for invalid RRF', () => {
      expect(() => calculatePFDFromRRF(0)).toThrow();
      expect(() => calculatePFDFromRRF(-10)).toThrow();
    });
  });

  describe('determineSILFromRRF', () => {
    it('should return null for RRF below SIL 1', () => {
      expect(determineSILFromRRF(5)).toBeNull();
      expect(determineSILFromRRF(9.9)).toBeNull();
    });

    it('should return correct SIL for RRF ranges', () => {
      expect(determineSILFromRRF(10)).toBe(1);
      expect(determineSILFromRRF(50)).toBe(1);
      expect(determineSILFromRRF(100)).toBe(2);
      expect(determineSILFromRRF(500)).toBe(2);
      expect(determineSILFromRRF(1000)).toBe(3);
      expect(determineSILFromRRF(5000)).toBe(3);
      expect(determineSILFromRRF(10000)).toBe(4);
      expect(determineSILFromRRF(50000)).toBe(4);
    });
  });

  describe('getRRFRangeForSIL', () => {
    it('should return correct ranges for each SIL', () => {
      const sil1 = getRRFRangeForSIL(1);
      expect(sil1.min).toBe(10);
      expect(sil1.max).toBe(100);

      const sil2 = getRRFRangeForSIL(2);
      expect(sil2.min).toBe(100);
      expect(sil2.max).toBe(1000);

      const sil3 = getRRFRangeForSIL(3);
      expect(sil3.min).toBe(1000);
      expect(sil3.max).toBe(10000);

      const sil4 = getRRFRangeForSIL(4);
      expect(sil4.min).toBe(10000);
      expect(sil4.max).toBe(100000);
    });
  });

  describe('getTypicalRRFForSIL', () => {
    it('should return typical RRF for each SIL', () => {
      expect(getTypicalRRFForSIL(1)).toBe(10); // 1/0.1
      expect(getTypicalRRFForSIL(2)).toBe(100); // 1/0.01
      expect(getTypicalRRFForSIL(3)).toBe(1000); // 1/0.001
      expect(getTypicalRRFForSIL(4)).toBe(10000); // 1/0.0001
    });
  });

  describe('getTypicalRRFForIPLType', () => {
    it('should return typical RRF for common IPL types', () => {
      expect(getTypicalRRFForIPLType('safety_instrumented_function')).toBe(100);
      expect(getTypicalRRFForIPLType('basic_process_control')).toBe(10);
      expect(getTypicalRRFForIPLType('relief_device')).toBe(100);
      expect(getTypicalRRFForIPLType('human_intervention')).toBe(10);
    });
  });

  // ===========================================================================
  // IPL Analysis Tests
  // ===========================================================================

  describe('analyzeIPLRiskReduction', () => {
    it('should analyze a single IPL correctly', () => {
      const ipl = createTestIPL({ pfd: 0.01 });
      const analysis = analyzeIPLRiskReduction(ipl);

      expect(analysis.id).toBe('ipl-1');
      expect(analysis.rrf).toBe(100);
      expect(analysis.ordersOfMagnitude).toBe(2);
      expect(analysis.creditable).toBe(true);
    });

    it('should calculate contribution percentage when total RRF provided', () => {
      const ipl = createTestIPL({ pfd: 0.01 }); // RRF = 100
      const analysis = analyzeIPLRiskReduction(ipl, 10000); // Total RRF = 10000

      // Orders: ipl = 2, total = 4, contribution = 50%
      expect(analysis.contributionPercent).toBe(50);
    });

    it('should mark non-creditable IPL correctly', () => {
      const ipl = createTestIPL();
      const analysis = analyzeIPLRiskReduction(ipl, undefined, false);

      expect(analysis.creditable).toBe(false);
    });
  });

  describe('analyzeRiskReduction', () => {
    it('should analyze multiple IPLs correctly', () => {
      const ipls = [
        createTestIPL({ id: '1', pfd: 0.01 }), // RRF = 100
        createTestIPL({ id: '2', type: 'relief_device', pfd: 0.01 }), // RRF = 100
      ];

      const analysis = analyzeRiskReduction(ipls);

      expect(analysis.iplCount).toBe(2);
      expect(analysis.creditableCount).toBe(2);
      expect(analysis.totalRRF).toBe(10000); // 100 * 100
      expect(analysis.creditableRRF).toBe(10000);
      expect(analysis.totalOrdersOfMagnitude).toBe(4);
    });

    it('should exclude non-creditable IPLs from creditable RRF', () => {
      const ipls = [
        createTestIPL({ id: '1', pfd: 0.01 }), // Creditable
        createTestIPL({ id: '2', pfd: 0.01, independentOfInitiator: false }), // Not creditable
      ];

      const analysis = analyzeRiskReduction(ipls);

      expect(analysis.iplCount).toBe(2);
      expect(analysis.creditableCount).toBe(1);
      expect(analysis.creditableRRF).toBe(100); // Only first IPL
      expect(analysis.validationResult.nonCreditableIPLs).toContain('2');
    });

    it('should handle empty IPL array', () => {
      const analysis = analyzeRiskReduction([]);

      expect(analysis.iplCount).toBe(0);
      expect(analysis.totalRRF).toBe(1);
      expect(analysis.creditableRRF).toBe(1);
    });
  });

  describe('getRRFByIPLType', () => {
    it('should group RRF by IPL type', () => {
      const ipls = [
        createTestIPL({ id: '1', type: 'safety_instrumented_function', pfd: 0.01 }),
        createTestIPL({ id: '2', type: 'safety_instrumented_function', pfd: 0.01 }),
        createTestIPL({ id: '3', type: 'relief_device', pfd: 0.01 }),
      ];

      const byType = getRRFByIPLType(ipls);

      expect(byType.length).toBe(2);

      const sif = byType.find((t) => t.type === 'safety_instrumented_function');
      expect(sif).toBeDefined();
      expect(sif!.count).toBe(2);
      expect(sif!.combinedRRF).toBe(10000); // 100 * 100
    });

    it('should sort by combined RRF descending', () => {
      const ipls = [
        createTestIPL({ id: '1', type: 'relief_device', pfd: 0.1 }), // RRF = 10
        createTestIPL({ id: '2', type: 'safety_instrumented_function', pfd: 0.01 }), // RRF = 100
      ];

      const byType = getRRFByIPLType(ipls);

      expect(byType[0].type).toBe('safety_instrumented_function');
      expect(byType[1].type).toBe('relief_device');
    });
  });

  // ===========================================================================
  // Gap Analysis Tests
  // ===========================================================================

  describe('analyzeRiskReductionGap', () => {
    it('should return adequate status when actual exceeds required', () => {
      const gap = analyzeRiskReductionGap(10000, 1000);

      expect(gap.gapStatus).toBe('adequate');
      expect(gap.gapRatio).toBe(10);
      expect(gap.additionalRRFNeeded).toBe(0);
      expect(gap.requiredSIL).toBeNull();
    });

    it('should return marginal status when close to required', () => {
      const gap = analyzeRiskReductionGap(750, 1000);

      expect(gap.gapStatus).toBe('marginal');
      expect(gap.gapRatio).toBe(0.75);
      expect(gap.requiredSIL).not.toBeNull();
    });

    it('should return inadequate status when far below required', () => {
      const gap = analyzeRiskReductionGap(100, 1000);

      expect(gap.gapStatus).toBe('inadequate');
      expect(gap.gapRatio).toBe(0.1);
      expect(gap.additionalRRFNeeded).toBe(10);
    });

    it('should provide suggested actions', () => {
      const gap = analyzeRiskReductionGap(100, 1000);

      expect(gap.suggestedActions.length).toBeGreaterThan(0);
      expect(gap.suggestedActions.some((a) => a.includes('required'))).toBe(true);
    });
  });

  // ===========================================================================
  // Requirement Calculation Tests
  // ===========================================================================

  describe('calculateRRFRequirement', () => {
    it('should calculate required RRF correctly', () => {
      // IEF = 1/yr, target = 1e-4/yr => required RRF = 10000
      const req = calculateRRFRequirement(1, 1e-4);

      expect(req.requiredRRF).toBe(10000);
      expect(req.requiredOrdersOfMagnitude).toBe(4);
    });

    it('should provide IPL count estimates', () => {
      const req = calculateRRFRequirement(1, 1e-4);

      expect(req.estimatedIPLCount.length).toBe(4);
      expect(req.estimatedIPLCount.some((e) => e.sil === 2)).toBe(true);
    });
  });

  describe('calculateRRFRequirementFromSeverity', () => {
    it('should use correct target frequency for each severity', () => {
      // Severity 5 (catastrophic) should have lowest target frequency
      const sev5 = calculateRRFRequirementFromSeverity(5, 0.1);
      // Severity 1 (negligible) should have highest target frequency
      const sev1 = calculateRRFRequirementFromSeverity(1, 0.1);

      expect(sev5.targetFrequency).toBeLessThan(sev1.targetFrequency);
      expect(sev5.requiredRRF).toBeGreaterThan(sev1.requiredRRF);
    });
  });

  // ===========================================================================
  // Formatting Tests
  // ===========================================================================

  describe('formatRRF', () => {
    it('should format small RRF values', () => {
      expect(formatRRF(10)).toBe('10');
      expect(formatRRF(100)).toBe('100');
      expect(formatRRF(999)).toBe('999');
    });

    it('should format large RRF values with K suffix', () => {
      expect(formatRRF(1000)).toContain('K');
      expect(formatRRF(10000)).toBe('10K');
      expect(formatRRF(100000)).toBe('100K');
    });

    it('should format very large RRF values with M suffix', () => {
      expect(formatRRF(1000000)).toContain('M');
      expect(formatRRF(10000000)).toBe('10M');
    });
  });

  describe('formatOrdersOfMagnitude', () => {
    it('should format orders correctly', () => {
      expect(formatOrdersOfMagnitude(1)).toContain('1');
      expect(formatOrdersOfMagnitude(1)).toContain('order');
      expect(formatOrdersOfMagnitude(2)).toContain('2');
      expect(formatOrdersOfMagnitude(2)).toContain('orders');
    });

    it('should round to one decimal place', () => {
      expect(formatOrdersOfMagnitude(2.34)).toBe('2.3 orders');
      expect(formatOrdersOfMagnitude(2.56)).toBe('2.6 orders');
    });
  });

  describe('formatPFD', () => {
    it('should format large PFD values', () => {
      expect(formatPFD(0.1)).toBe('0.10');
      expect(formatPFD(0.5)).toBe('0.50');
    });

    it('should format small PFD values with scientific notation', () => {
      const formatted = formatPFD(0.0001);
      expect(formatted).toContain('10');
      expect(formatted).toContain('-4');
    });
  });

  describe('formatFrequency', () => {
    it('should format large frequencies', () => {
      expect(formatFrequency(1)).toBe('1.0/yr');
      expect(formatFrequency(0.1)).toBe('0.10/yr');
    });

    it('should format small frequencies with scientific notation', () => {
      const formatted = formatFrequency(0.0001);
      expect(formatted).toContain('/yr');
      expect(formatted).toContain('10');
    });
  });

  describe('formatGapStatus', () => {
    it('should return correct labels and colors', () => {
      const adequate = formatGapStatus('adequate');
      expect(adequate.label).toBe('Adequate');
      expect(adequate.color).toBe('#22c55e');

      const marginal = formatGapStatus('marginal');
      expect(marginal.label).toBe('Marginal');
      expect(marginal.color).toBe('#f59e0b');

      const inadequate = formatGapStatus('inadequate');
      expect(inadequate.label).toBe('Inadequate');
      expect(inadequate.color).toBe('#ef4444');
    });
  });

  // ===========================================================================
  // Utility Function Tests
  // ===========================================================================

  describe('isCrediblePFD', () => {
    it('should return true for valid PFD values', () => {
      expect(isCrediblePFD(0.01)).toBe(true);
      expect(isCrediblePFD(0.1)).toBe(true);
      expect(isCrediblePFD(MIN_CREDITABLE_PFD)).toBe(true);
      expect(isCrediblePFD(MAX_CREDITABLE_PFD)).toBe(true);
    });

    it('should return false for invalid PFD values', () => {
      expect(isCrediblePFD(0)).toBe(false);
      expect(isCrediblePFD(-0.1)).toBe(false);
      expect(isCrediblePFD(1.5)).toBe(false);
      expect(isCrediblePFD(MIN_CREDITABLE_PFD / 10)).toBe(false);
    });
  });

  describe('clampPFD', () => {
    it('should return value unchanged if within range', () => {
      expect(clampPFD(0.01)).toBe(0.01);
      expect(clampPFD(0.1)).toBe(0.1);
    });

    it('should clamp to minimum if below range', () => {
      expect(clampPFD(MIN_CREDITABLE_PFD / 10)).toBe(MIN_CREDITABLE_PFD);
      expect(clampPFD(0)).toBe(MIN_CREDITABLE_PFD);
    });

    it('should clamp to maximum if above range', () => {
      expect(clampPFD(1.5)).toBe(MAX_CREDITABLE_PFD);
      expect(clampPFD(2)).toBe(MAX_CREDITABLE_PFD);
    });
  });

  describe('combineRRFs', () => {
    it('should multiply RRF values', () => {
      expect(combineRRFs([10, 10])).toBe(100);
      expect(combineRRFs([100, 100])).toBe(10000);
      expect(combineRRFs([10, 100, 1000])).toBe(1000000);
    });

    it('should return 1 for empty array', () => {
      expect(combineRRFs([])).toBe(1);
    });

    it('should handle single value', () => {
      expect(combineRRFs([100])).toBe(100);
    });
  });

  describe('getGapThresholds', () => {
    it('should return correct thresholds', () => {
      const thresholds = getGapThresholds();
      expect(thresholds.marginal).toBe(0.5);
      expect(thresholds.adequate).toBe(1.0);
    });
  });

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe('performComprehensiveRiskReductionAnalysis', () => {
    it('should perform complete analysis', () => {
      const ipls = [
        createTestIPL({ id: '1', pfd: 0.01 }), // RRF = 100
        createTestIPL({ id: '2', type: 'relief_device', pfd: 0.01 }), // RRF = 100
      ];

      const result = performComprehensiveRiskReductionAnalysis(ipls, 1, 1e-4);

      // Check LOPA result
      expect(result.lopaResult.totalRiskReductionFactor).toBe(10000);
      expect(result.lopaResult.requiredRiskReductionFactor).toBe(10000);
      expect(result.lopaResult.gapStatus).toBe('adequate');

      // Check reduction analysis
      expect(result.reductionAnalysis.iplCount).toBe(2);
      expect(result.reductionAnalysis.creditableCount).toBe(2);

      // Check gap analysis
      expect(result.gapAnalysis.gapStatus).toBe('adequate');

      // Check RRF by type
      expect(result.rrfByType.length).toBe(2);

      // Check requirement
      expect(result.requirement.requiredRRF).toBe(10000);
    });

    it('should identify inadequate protection', () => {
      const ipls = [createTestIPL({ id: '1', pfd: 0.1 })]; // RRF = 10

      const result = performComprehensiveRiskReductionAnalysis(ipls, 1, 1e-4);

      expect(result.lopaResult.gapStatus).toBe('inadequate');
      expect(result.gapAnalysis.gapStatus).toBe('inadequate');
      expect(result.gapAnalysis.additionalRRFNeeded).toBeGreaterThan(0);
      expect(result.gapAnalysis.requiredSIL).not.toBeNull();
    });

    it('should handle empty IPL array', () => {
      const result = performComprehensiveRiskReductionAnalysis([], 1, 1e-4);

      expect(result.reductionAnalysis.iplCount).toBe(0);
      expect(result.lopaResult.totalRiskReductionFactor).toBe(1);
      expect(result.gapAnalysis.gapStatus).toBe('inadequate');
    });
  });
});
