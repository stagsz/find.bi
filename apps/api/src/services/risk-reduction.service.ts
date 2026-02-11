/**
 * Risk Reduction Factor (RRF) Calculation service.
 *
 * Provides functions for calculating and analyzing risk reduction factors
 * in LOPA (Layers of Protection Analysis). This service combines the core
 * LOPA calculation functions with IPL validation to provide comprehensive
 * risk reduction analysis.
 *
 * Key Concepts:
 * - Risk Reduction Factor (RRF) = 1 / PFD
 * - Total RRF = ∏(RRF of each IPL) = 1 / ∏(PFD)
 * - RRF Gap = Required RRF / Actual RRF
 * - Orders of Magnitude = log10(RRF)
 *
 * Reference Standards:
 * - IEC 61511: Functional safety for process industries
 * - CCPS Guidelines for Initiating Events and Independent Protection Layers
 */

import type {
  IPL,
  IPLType,
  SafetyIntegrityLevel,
  SeverityLevel,
  LOPAGapStatus,
  LOPACalculationResult,
} from '@hazop/types';

import {
  IPL_TYPICAL_PFD,
  SIL_PFD_RANGES,
  SIL_TYPICAL_PFD,
  SEVERITY_TO_TARGET_FREQUENCY,
} from '@hazop/types';

import {
  calculateRRF,
  calculateTotalRRF,
  calculateRequiredRRF,
  calculateGapRatio,
  determineGapStatus,
  determineRequiredSIL,
  performLOPACalculation,
  MIN_CREDITABLE_PFD,
  MAX_CREDITABLE_PFD,
  MARGINAL_GAP_THRESHOLD,
  ADEQUATE_GAP_THRESHOLD,
} from './lopa-calculation.service.js';

import { validateIPLCollection, type IPLCollectionValidationResult } from './ipl-validation.service.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Risk reduction factor analysis result for a single IPL.
 */
export interface IPLRiskReduction {
  /** IPL identifier */
  id: string;
  /** IPL name */
  name: string;
  /** IPL type */
  type: IPLType;
  /** Probability of failure on demand */
  pfd: number;
  /** Risk reduction factor (1/PFD) */
  rrf: number;
  /** Orders of magnitude of reduction (log10 RRF) */
  ordersOfMagnitude: number;
  /** Whether this IPL is creditable */
  creditable: boolean;
  /** Percentage contribution to total RRF */
  contributionPercent: number | null;
}

/**
 * Comprehensive risk reduction analysis result.
 */
export interface RiskReductionAnalysis {
  /** Individual IPL analysis */
  ipls: IPLRiskReduction[];
  /** Total risk reduction factor from all IPLs */
  totalRRF: number;
  /** Total risk reduction factor from creditable IPLs only */
  creditableRRF: number;
  /** Total orders of magnitude of reduction */
  totalOrdersOfMagnitude: number;
  /** Number of IPLs analyzed */
  iplCount: number;
  /** Number of creditable IPLs */
  creditableCount: number;
  /** Validation result for the IPL collection */
  validationResult: IPLCollectionValidationResult;
}

/**
 * Risk reduction gap analysis result.
 */
export interface RiskReductionGap {
  /** Required risk reduction factor */
  requiredRRF: number;
  /** Actual risk reduction factor */
  actualRRF: number;
  /** Gap ratio (actual/required) */
  gapRatio: number;
  /** Gap status */
  gapStatus: LOPAGapStatus;
  /** Additional RRF needed to close gap (0 if adequate) */
  additionalRRFNeeded: number;
  /** Additional orders of magnitude needed */
  additionalOrdersNeeded: number;
  /** Required SIL to close gap, if applicable */
  requiredSIL: SafetyIntegrityLevel | null;
  /** Suggested actions based on gap status */
  suggestedActions: string[];
}

/**
 * RRF requirement based on scenario parameters.
 */
export interface RRFRequirement {
  /** Initiating event frequency (per year) */
  initiatingEventFrequency: number;
  /** Target frequency (per year) */
  targetFrequency: number;
  /** Required RRF to meet target */
  requiredRRF: number;
  /** Required orders of magnitude of reduction */
  requiredOrdersOfMagnitude: number;
  /** Minimum number of SIL-rated IPLs that might be needed */
  estimatedIPLCount: SILEstimate[];
}

/**
 * Estimate of IPLs needed at each SIL level.
 */
export interface SILEstimate {
  /** SIL level */
  sil: SafetyIntegrityLevel;
  /** Number of IPLs at this SIL needed */
  count: number;
  /** Combined RRF from these IPLs */
  combinedRRF: number;
}

/**
 * Summary of risk reduction by IPL type.
 */
export interface RRFByIPLType {
  /** IPL type */
  type: IPLType;
  /** Number of IPLs of this type */
  count: number;
  /** Combined RRF from IPLs of this type */
  combinedRRF: number;
  /** Percentage of total RRF */
  percentOfTotal: number;
}

// ============================================================================
// Core RRF Calculation Functions
// ============================================================================

/**
 * Calculate the Risk Reduction Factor from a PFD value.
 * Re-exported for convenience.
 *
 * @param pfd - Probability of Failure on Demand (0 < pfd <= 1)
 * @returns Risk Reduction Factor (RRF = 1/PFD)
 */
export { calculateRRF };

/**
 * Calculate the combined RRF from multiple PFD values.
 * Re-exported for convenience.
 *
 * @param pfds - Array of PFD values
 * @returns Combined Risk Reduction Factor
 */
export { calculateTotalRRF };

/**
 * Calculate the orders of magnitude of risk reduction.
 *
 * @param rrf - Risk reduction factor
 * @returns Orders of magnitude (log10 of RRF)
 */
export function calculateOrdersOfMagnitude(rrf: number): number {
  if (rrf <= 0) {
    return 0;
  }
  return Math.log10(rrf);
}

/**
 * Calculate the RRF needed to achieve a target from current state.
 *
 * @param currentRRF - Current total RRF
 * @param requiredRRF - Required total RRF
 * @returns Additional RRF needed (0 if already adequate)
 */
export function calculateAdditionalRRFNeeded(currentRRF: number, requiredRRF: number): number {
  if (currentRRF >= requiredRRF) {
    return 0;
  }
  return requiredRRF / currentRRF;
}

/**
 * Calculate the PFD that would give a specific RRF.
 *
 * @param rrf - Target risk reduction factor
 * @returns Required PFD value
 */
export function calculatePFDFromRRF(rrf: number): number {
  if (rrf <= 0) {
    throw new Error('RRF must be greater than 0');
  }
  return 1 / rrf;
}

/**
 * Determine the SIL level that corresponds to a given RRF.
 *
 * @param rrf - Risk reduction factor
 * @returns SIL level, or null if RRF is too low for any SIL
 */
export function determineSILFromRRF(rrf: number): SafetyIntegrityLevel | null {
  if (rrf < 10) {
    return null; // Below SIL 1
  }
  if (rrf < 100) {
    return 1;
  }
  if (rrf < 1000) {
    return 2;
  }
  if (rrf < 10000) {
    return 3;
  }
  return 4;
}

/**
 * Get the RRF range for a given SIL level.
 *
 * @param sil - Safety Integrity Level
 * @returns RRF range (min and max)
 */
export function getRRFRangeForSIL(sil: SafetyIntegrityLevel): { min: number; max: number } {
  const pfdRange = SIL_PFD_RANGES[sil];
  return {
    min: 1 / pfdRange.max, // min RRF from max PFD
    max: 1 / pfdRange.min, // max RRF from min PFD
  };
}

/**
 * Get the typical RRF for a given SIL level.
 *
 * @param sil - Safety Integrity Level
 * @returns Typical RRF value
 */
export function getTypicalRRFForSIL(sil: SafetyIntegrityLevel): number {
  return 1 / SIL_TYPICAL_PFD[sil];
}

/**
 * Get the typical RRF for a given IPL type.
 *
 * @param type - IPL type
 * @returns Typical RRF value
 */
export function getTypicalRRFForIPLType(type: IPLType): number {
  return 1 / IPL_TYPICAL_PFD[type];
}

// ============================================================================
// IPL Analysis Functions
// ============================================================================

/**
 * Analyze risk reduction from a single IPL.
 *
 * @param ipl - The IPL to analyze
 * @param totalRRF - Total RRF for calculating contribution (optional)
 * @param creditable - Whether this IPL is creditable (defaults to true)
 * @returns Risk reduction analysis for this IPL
 */
export function analyzeIPLRiskReduction(
  ipl: IPL,
  totalRRF?: number,
  creditable = true
): IPLRiskReduction {
  const rrf = calculateRRF(ipl.pfd);
  const ordersOfMagnitude = calculateOrdersOfMagnitude(rrf);

  let contributionPercent: number | null = null;
  if (totalRRF && totalRRF > 0) {
    // Contribution is based on orders of magnitude, not raw RRF
    const totalOrders = calculateOrdersOfMagnitude(totalRRF);
    if (totalOrders > 0) {
      contributionPercent = (ordersOfMagnitude / totalOrders) * 100;
    }
  }

  return {
    id: ipl.id,
    name: ipl.name,
    type: ipl.type,
    pfd: ipl.pfd,
    rrf,
    ordersOfMagnitude,
    creditable,
    contributionPercent,
  };
}

/**
 * Analyze risk reduction from a collection of IPLs.
 *
 * This function validates all IPLs, calculates individual and total RRF,
 * and provides a comprehensive analysis including contribution percentages.
 *
 * @param ipls - Array of IPLs to analyze
 * @returns Comprehensive risk reduction analysis
 */
export function analyzeRiskReduction(ipls: IPL[]): RiskReductionAnalysis {
  // Validate all IPLs
  const validationResult = validateIPLCollection(ipls);

  // Calculate total RRF from all IPLs (for reference)
  const allPfds = ipls.map((ipl) => ipl.pfd);
  const totalRRF = ipls.length > 0 ? calculateTotalRRF(allPfds) : 1;

  // Calculate creditable RRF
  const creditableIPLs = ipls.filter((ipl) => !validationResult.nonCreditableIPLs.includes(ipl.id));
  const creditablePfds = creditableIPLs.map((ipl) => ipl.pfd);
  const creditableRRF = creditableIPLs.length > 0 ? calculateTotalRRF(creditablePfds) : 1;

  // Analyze each IPL with contribution percentages based on creditable RRF
  const iplAnalyses = ipls.map((ipl) => {
    const isCreditable = !validationResult.nonCreditableIPLs.includes(ipl.id);
    return analyzeIPLRiskReduction(ipl, creditableRRF, isCreditable);
  });

  return {
    ipls: iplAnalyses,
    totalRRF,
    creditableRRF,
    totalOrdersOfMagnitude: calculateOrdersOfMagnitude(creditableRRF),
    iplCount: ipls.length,
    creditableCount: creditableIPLs.length,
    validationResult,
  };
}

/**
 * Get RRF breakdown by IPL type.
 *
 * @param ipls - Array of IPLs to analyze
 * @returns Array of RRF summaries by type
 */
export function getRRFByIPLType(ipls: IPL[]): RRFByIPLType[] {
  // Group IPLs by type
  const byType = new Map<IPLType, IPL[]>();
  for (const ipl of ipls) {
    const existing = byType.get(ipl.type) || [];
    existing.push(ipl);
    byType.set(ipl.type, existing);
  }

  // Calculate total RRF for percentage calculation
  const allPfds = ipls.map((ipl) => ipl.pfd);
  const totalRRF = ipls.length > 0 ? calculateTotalRRF(allPfds) : 1;
  const totalOrders = calculateOrdersOfMagnitude(totalRRF);

  // Calculate RRF for each type
  const result: RRFByIPLType[] = [];
  for (const [type, typeIPLs] of byType) {
    const typePfds = typeIPLs.map((ipl) => ipl.pfd);
    const combinedRRF = calculateTotalRRF(typePfds);
    const typeOrders = calculateOrdersOfMagnitude(combinedRRF);

    result.push({
      type,
      count: typeIPLs.length,
      combinedRRF,
      percentOfTotal: totalOrders > 0 ? (typeOrders / totalOrders) * 100 : 0,
    });
  }

  // Sort by combined RRF descending
  result.sort((a, b) => b.combinedRRF - a.combinedRRF);

  return result;
}

// ============================================================================
// Gap Analysis Functions
// ============================================================================

/**
 * Analyze the risk reduction gap between actual and required protection.
 *
 * @param actualRRF - Current total RRF from IPLs
 * @param requiredRRF - Required RRF to meet target frequency
 * @returns Gap analysis result with recommendations
 */
export function analyzeRiskReductionGap(
  actualRRF: number,
  requiredRRF: number
): RiskReductionGap {
  const gapRatio = calculateGapRatio(actualRRF, requiredRRF);
  const gapStatus = determineGapStatus(gapRatio);
  const requiredSIL = determineRequiredSIL(gapRatio);

  const additionalRRFNeeded = calculateAdditionalRRFNeeded(actualRRF, requiredRRF);
  const additionalOrdersNeeded = additionalRRFNeeded > 0
    ? calculateOrdersOfMagnitude(additionalRRFNeeded)
    : 0;

  const suggestedActions = generateGapActions(gapStatus, additionalRRFNeeded, requiredSIL);

  return {
    requiredRRF,
    actualRRF,
    gapRatio,
    gapStatus,
    additionalRRFNeeded,
    additionalOrdersNeeded,
    requiredSIL,
    suggestedActions,
  };
}

/**
 * Generate suggested actions based on gap analysis.
 */
function generateGapActions(
  gapStatus: LOPAGapStatus,
  additionalRRFNeeded: number,
  requiredSIL: SafetyIntegrityLevel | null
): string[] {
  const actions: string[] = [];

  switch (gapStatus) {
    case 'adequate':
      actions.push('Current protection is adequate. Maintain existing IPLs and testing schedules.');
      actions.push('Document LOPA analysis for regulatory compliance.');
      break;

    case 'marginal':
      actions.push('Protection is marginal. Review IPL independence and PFD assumptions.');
      actions.push(`Consider adding protection with RRF of at least ${formatRRF(additionalRRFNeeded)}.`);
      if (requiredSIL) {
        actions.push(`A SIL ${requiredSIL} Safety Instrumented Function would provide adequate margin.`);
      }
      actions.push('Conduct management of change review for any modifications.');
      break;

    case 'inadequate':
      actions.push('Protection is inadequate. Additional risk reduction measures are required.');
      actions.push(`Required additional RRF: ${formatRRF(additionalRRFNeeded)} (${formatOrdersOfMagnitude(calculateOrdersOfMagnitude(additionalRRFNeeded))} orders of magnitude).`);
      if (requiredSIL) {
        actions.push(`Install a Safety Instrumented Function rated to SIL ${requiredSIL}.`);
      }
      actions.push('Conduct LOPA review meeting with process safety team.');
      actions.push('Do not start up or continue operation until protection gap is closed.');
      break;
  }

  return actions;
}

// ============================================================================
// Requirement Calculation Functions
// ============================================================================

/**
 * Calculate the RRF requirement for a given scenario.
 *
 * @param initiatingEventFrequency - Frequency of initiating event (per year)
 * @param targetFrequency - Target mitigated event likelihood (per year)
 * @returns RRF requirement with estimated IPL count
 */
export function calculateRRFRequirement(
  initiatingEventFrequency: number,
  targetFrequency: number
): RRFRequirement {
  const requiredRRF = calculateRequiredRRF(initiatingEventFrequency, targetFrequency);
  const requiredOrdersOfMagnitude = calculateOrdersOfMagnitude(requiredRRF);

  // Estimate how many IPLs at each SIL would be needed
  const estimatedIPLCount = estimateIPLCount(requiredRRF);

  return {
    initiatingEventFrequency,
    targetFrequency,
    requiredRRF,
    requiredOrdersOfMagnitude,
    estimatedIPLCount,
  };
}

/**
 * Calculate the RRF requirement based on severity level.
 *
 * Uses the SEVERITY_TO_TARGET_FREQUENCY mapping.
 *
 * @param severity - Severity level (1-5)
 * @param initiatingEventFrequency - Frequency of initiating event (per year)
 * @returns RRF requirement
 */
export function calculateRRFRequirementFromSeverity(
  severity: SeverityLevel,
  initiatingEventFrequency: number
): RRFRequirement {
  const targetFrequency = SEVERITY_TO_TARGET_FREQUENCY[severity];
  return calculateRRFRequirement(initiatingEventFrequency, targetFrequency);
}

/**
 * Estimate the number of IPLs needed at each SIL level.
 */
function estimateIPLCount(requiredRRF: number): SILEstimate[] {
  const estimates: SILEstimate[] = [];

  // Try each SIL level
  for (const sil of [1, 2, 3, 4] as SafetyIntegrityLevel[]) {
    const typicalRRF = getTypicalRRFForSIL(sil);

    // How many IPLs at this SIL to meet requirement?
    const count = Math.ceil(calculateOrdersOfMagnitude(requiredRRF) / calculateOrdersOfMagnitude(typicalRRF));

    // Combined RRF from this many IPLs
    const combinedRRF = Math.pow(typicalRRF, count);

    estimates.push({ sil, count, combinedRRF });
  }

  return estimates;
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format an RRF value for display.
 *
 * @param rrf - Risk reduction factor
 * @returns Formatted string (e.g., "100", "1,000", "10K")
 */
export function formatRRF(rrf: number): string {
  if (rrf < 1000) {
    return Math.round(rrf).toLocaleString();
  }
  if (rrf < 1000000) {
    const k = rrf / 1000;
    return k >= 10 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`;
  }
  const m = rrf / 1000000;
  return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`;
}

/**
 * Format orders of magnitude for display.
 *
 * @param orders - Number of orders of magnitude
 * @returns Formatted string (e.g., "2 orders", "2.5 orders")
 */
export function formatOrdersOfMagnitude(orders: number): string {
  const rounded = Math.round(orders * 10) / 10;
  const unit = Math.abs(rounded - 1) < 0.01 ? 'order' : 'orders';
  return `${rounded} ${unit}`;
}

/**
 * Format a PFD value for display.
 *
 * @param pfd - Probability of failure on demand
 * @returns Formatted string (e.g., "0.01", "10⁻³")
 */
export function formatPFD(pfd: number): string {
  if (pfd >= 0.1) {
    return pfd.toFixed(2);
  }
  if (pfd >= 0.01) {
    return pfd.toFixed(3);
  }

  // Use scientific notation for small values
  const exponent = Math.floor(Math.log10(pfd));
  const mantissa = pfd / Math.pow(10, exponent);

  if (Math.abs(mantissa - 1) < 0.01) {
    return `10^${exponent}`;
  }

  return `${mantissa.toFixed(1)} × 10^${exponent}`;
}

/**
 * Format a frequency value for display.
 *
 * @param frequency - Frequency in events per year
 * @returns Formatted string (e.g., "0.1/yr", "10⁻⁵/yr")
 */
export function formatFrequency(frequency: number): string {
  if (frequency >= 1) {
    return `${frequency.toFixed(1)}/yr`;
  }
  if (frequency >= 0.01) {
    return `${frequency.toFixed(2)}/yr`;
  }

  const exponent = Math.floor(Math.log10(frequency));
  const mantissa = frequency / Math.pow(10, exponent);

  if (Math.abs(mantissa - 1) < 0.01) {
    return `10^${exponent}/yr`;
  }

  return `${mantissa.toFixed(1)} × 10^${exponent}/yr`;
}

/**
 * Format gap status for display with color code.
 *
 * @param status - Gap status
 * @returns Object with label and color
 */
export function formatGapStatus(status: LOPAGapStatus): { label: string; color: string } {
  switch (status) {
    case 'adequate':
      return { label: 'Adequate', color: '#22c55e' };
    case 'marginal':
      return { label: 'Marginal', color: '#f59e0b' };
    case 'inadequate':
      return { label: 'Inadequate', color: '#ef4444' };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a PFD value is within the creditable range.
 *
 * @param pfd - PFD value to check
 * @returns True if within creditable range
 */
export function isCrediblePFD(pfd: number): boolean {
  return pfd >= MIN_CREDITABLE_PFD && pfd <= MAX_CREDITABLE_PFD;
}

/**
 * Clamp a PFD value to the creditable range.
 *
 * @param pfd - PFD value to clamp
 * @returns Clamped PFD value
 */
export function clampPFD(pfd: number): number {
  return Math.max(MIN_CREDITABLE_PFD, Math.min(MAX_CREDITABLE_PFD, pfd));
}

/**
 * Combine multiple RRF values (multiply them).
 *
 * @param rrfs - Array of RRF values
 * @returns Combined RRF (product of all values)
 */
export function combineRRFs(rrfs: number[]): number {
  if (rrfs.length === 0) {
    return 1;
  }
  return rrfs.reduce((product, rrf) => product * rrf, 1);
}

/**
 * Get the gap thresholds for reference.
 */
export function getGapThresholds(): { marginal: number; adequate: number } {
  return {
    marginal: MARGINAL_GAP_THRESHOLD,
    adequate: ADEQUATE_GAP_THRESHOLD,
  };
}

// ============================================================================
// Integration Functions
// ============================================================================

/**
 * Perform comprehensive risk reduction analysis for a LOPA scenario.
 *
 * This is the main entry point that combines IPL validation, RRF calculation,
 * and gap analysis into a single comprehensive result.
 *
 * @param ipls - Array of IPLs to analyze
 * @param initiatingEventFrequency - Frequency of initiating event (per year)
 * @param targetFrequency - Target mitigated event likelihood (per year)
 * @returns LOPA calculation result with additional risk reduction analysis
 */
export function performComprehensiveRiskReductionAnalysis(
  ipls: IPL[],
  initiatingEventFrequency: number,
  targetFrequency: number
): {
  lopaResult: LOPACalculationResult;
  reductionAnalysis: RiskReductionAnalysis;
  gapAnalysis: RiskReductionGap;
  rrfByType: RRFByIPLType[];
  requirement: RRFRequirement;
} {
  // Perform the LOPA calculation
  const lopaResult = performLOPACalculation({
    initiatingEventFrequency,
    targetFrequency,
    ipls: ipls.map((ipl) => ({ id: ipl.id, name: ipl.name, pfd: ipl.pfd })),
  });

  // Analyze risk reduction from IPLs
  const reductionAnalysis = analyzeRiskReduction(ipls);

  // Analyze the gap
  const gapAnalysis = analyzeRiskReductionGap(
    reductionAnalysis.creditableRRF,
    lopaResult.requiredRiskReductionFactor
  );

  // Get RRF by type
  const rrfByType = getRRFByIPLType(ipls);

  // Calculate the requirement
  const requirement = calculateRRFRequirement(initiatingEventFrequency, targetFrequency);

  return {
    lopaResult,
    reductionAnalysis,
    gapAnalysis,
    rrfByType,
    requirement,
  };
}

// Re-export relevant constants
export {
  MIN_CREDITABLE_PFD,
  MAX_CREDITABLE_PFD,
  MARGINAL_GAP_THRESHOLD,
  ADEQUATE_GAP_THRESHOLD,
};
