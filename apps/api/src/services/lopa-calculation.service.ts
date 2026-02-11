/**
 * LOPA (Layers of Protection Analysis) Calculation service.
 *
 * Provides functions for performing LOPA calculations to determine whether
 * sufficient independent protection layers (IPLs) exist to reduce the frequency
 * of a hazardous scenario to an acceptable level.
 *
 * LOPA Methodology:
 * - Start with Initiating Event Frequency (IEF)
 * - Apply Risk Reduction Factors (RRF) from each credited IPL
 * - Calculate Mitigated Event Likelihood (MEL) = IEF × ∏(PFD of each IPL)
 * - Compare MEL to Target Mitigated Event Likelihood (TMEL)
 * - Determine if gap exists between actual and required risk reduction
 *
 * Key Formulas:
 * - Risk Reduction Factor (RRF) = 1 / PFD
 * - Total RRF = ∏(RRF of each IPL) = 1 / ∏(PFD of each IPL)
 * - MEL = IEF × ∏(PFD of each IPL) = IEF / Total RRF
 * - Required RRF = IEF / TMEL
 * - Gap Ratio = Total RRF / Required RRF (>1 is adequate)
 *
 * Reference Standards:
 * - IEC 61511: Functional safety for process industries
 * - CCPS Guidelines for Initiating Events and Independent Protection Layers
 */

import {
  type SafetyIntegrityLevel,
  type IPL,
  type IPLType,
  type InitiatingEventCategory,
  type LOPAGapStatus,
  type LOPACalculationInput,
  type LOPACalculationResult,
  type LOPAValidationResult,
  type LOPATriggerConfig,
  type LOPATriggerResult,
  type SeverityLevel,
  type RiskLevel,
  type RiskRanking,
  SAFETY_INTEGRITY_LEVELS,
  SIL_PFD_RANGES,
  SIL_TYPICAL_PFD,
  IPL_TYPES,
  IPL_TYPICAL_PFD,
  INITIATING_EVENT_CATEGORIES,
  SEVERITY_TO_TARGET_FREQUENCY,
  DEFAULT_LOPA_TRIGGER_CONFIG,
  RISK_THRESHOLDS,
} from '@hazop/types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum PFD value that can be credited (prevents unrealistic claims).
 * Based on industry practice, no IPL should claim PFD better than 1e-5.
 */
export const MIN_CREDITABLE_PFD = 1e-5;

/**
 * Maximum PFD value for an IPL (effectively 1.0 means no protection).
 */
export const MAX_CREDITABLE_PFD = 1.0;

/**
 * Minimum initiating event frequency that makes sense (per year).
 * Frequencies below this are considered negligible.
 */
export const MIN_INITIATING_EVENT_FREQUENCY = 1e-8;

/**
 * Maximum initiating event frequency (per year).
 * Frequencies above this indicate continuous occurrence.
 */
export const MAX_INITIATING_EVENT_FREQUENCY = 100;

/**
 * Gap ratio threshold for marginal protection (between marginal and adequate).
 * If gap ratio is between 0.5 and 1.0, protection is marginal.
 */
export const MARGINAL_GAP_THRESHOLD = 0.5;

/**
 * Gap ratio threshold for adequate protection.
 * Gap ratio >= 1.0 means protection is adequate.
 */
export const ADEQUATE_GAP_THRESHOLD = 1.0;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate if a value is a valid PFD (Probability of Failure on Demand).
 *
 * @param value - The PFD value to validate
 * @returns True if valid PFD, false otherwise
 */
export function isValidPFD(value: number): boolean {
  return (
    typeof value === 'number' &&
    !isNaN(value) &&
    value >= MIN_CREDITABLE_PFD &&
    value <= MAX_CREDITABLE_PFD
  );
}

/**
 * Validate if a value is a valid initiating event frequency.
 *
 * @param value - The frequency value to validate (per year)
 * @returns True if valid frequency, false otherwise
 */
export function isValidInitiatingEventFrequency(value: number): boolean {
  return (
    typeof value === 'number' &&
    !isNaN(value) &&
    value >= MIN_INITIATING_EVENT_FREQUENCY &&
    value <= MAX_INITIATING_EVENT_FREQUENCY
  );
}

/**
 * Validate if a value is a valid target frequency.
 *
 * @param value - The target frequency value to validate (per year)
 * @returns True if valid frequency, false otherwise
 */
export function isValidTargetFrequency(value: number): boolean {
  return (
    typeof value === 'number' &&
    !isNaN(value) &&
    value > 0 &&
    value <= 1 // Target should be at most 1 per year
  );
}

/**
 * Validate if a value is a valid Safety Integrity Level.
 *
 * @param value - The SIL value to validate
 * @returns True if valid SIL, false otherwise
 */
export function isValidSIL(value: number): value is SafetyIntegrityLevel {
  return (SAFETY_INTEGRITY_LEVELS as readonly number[]).includes(value);
}

/**
 * Validate if a value is a valid IPL type.
 *
 * @param value - The IPL type to validate
 * @returns True if valid IPL type, false otherwise
 */
export function isValidIPLType(value: string): value is IPLType {
  return (IPL_TYPES as readonly string[]).includes(value);
}

/**
 * Validate if a value is a valid initiating event category.
 *
 * @param value - The category to validate
 * @returns True if valid category, false otherwise
 */
export function isValidInitiatingEventCategory(
  value: string
): value is InitiatingEventCategory {
  return (INITIATING_EVENT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Validate a single IPL.
 *
 * @param ipl - The IPL to validate
 * @returns Validation result with errors if invalid
 */
export function validateIPL(
  ipl: Pick<IPL, 'pfd' | 'independentOfInitiator' | 'independentOfOtherIPLs'>
): LOPAValidationResult {
  const errors: string[] = [];

  if (!isValidPFD(ipl.pfd)) {
    errors.push(
      `Invalid PFD value: ${ipl.pfd}. Must be between ${MIN_CREDITABLE_PFD} and ${MAX_CREDITABLE_PFD}.`
    );
  }

  if (typeof ipl.independentOfInitiator !== 'boolean') {
    errors.push('Independence of initiator must be specified (true/false).');
  }

  if (typeof ipl.independentOfOtherIPLs !== 'boolean') {
    errors.push('Independence of other IPLs must be specified (true/false).');
  }

  if (ipl.independentOfInitiator === false) {
    errors.push('IPL is not independent of initiator - cannot be credited in LOPA.');
  }

  if (ipl.independentOfOtherIPLs === false) {
    errors.push('IPL is not independent of other IPLs - review for common cause failures.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate all IPLs in a collection.
 *
 * @param ipls - Array of IPLs to validate
 * @returns Validation result with errors if invalid
 */
export function validateIPLs(ipls: IPL[]): LOPAValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(ipls)) {
    return { valid: false, errors: ['IPLs must be an array.'] };
  }

  ipls.forEach((ipl, index) => {
    const result = validateIPL(ipl);
    if (!result.valid) {
      result.errors.forEach((error) => {
        errors.push(`IPL ${index + 1} (${ipl.name || 'unnamed'}): ${error}`);
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate complete LOPA calculation input.
 *
 * @param input - The LOPA calculation input to validate
 * @returns Validation result with errors if invalid
 */
export function validateLOPAInput(input: LOPACalculationInput): LOPAValidationResult {
  const errors: string[] = [];

  if (!isValidInitiatingEventFrequency(input.initiatingEventFrequency)) {
    errors.push(
      `Invalid initiating event frequency: ${input.initiatingEventFrequency}. ` +
        `Must be between ${MIN_INITIATING_EVENT_FREQUENCY} and ${MAX_INITIATING_EVENT_FREQUENCY} per year.`
    );
  }

  if (!isValidTargetFrequency(input.targetFrequency)) {
    errors.push(
      `Invalid target frequency: ${input.targetFrequency}. Must be greater than 0 and at most 1 per year.`
    );
  }

  if (input.targetFrequency >= input.initiatingEventFrequency) {
    errors.push(
      'Target frequency must be less than initiating event frequency (otherwise no protection needed).'
    );
  }

  if (!Array.isArray(input.ipls)) {
    errors.push('IPLs must be an array.');
  } else {
    input.ipls.forEach((ipl, index) => {
      if (!isValidPFD(ipl.pfd)) {
        errors.push(
          `IPL ${index + 1} (${ipl.name || 'unnamed'}): Invalid PFD value ${ipl.pfd}.`
        );
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate Risk Reduction Factor (RRF) from PFD.
 *
 * RRF = 1 / PFD
 *
 * @param pfd - Probability of Failure on Demand
 * @returns Risk Reduction Factor
 * @throws Error if PFD is invalid
 */
export function calculateRRF(pfd: number): number {
  if (!isValidPFD(pfd)) {
    throw new Error(
      `Invalid PFD value: ${pfd}. Must be between ${MIN_CREDITABLE_PFD} and ${MAX_CREDITABLE_PFD}.`
    );
  }

  return 1 / pfd;
}

/**
 * Calculate total Risk Reduction Factor from multiple IPLs.
 *
 * Total RRF = ∏(1/PFD) = 1 / ∏(PFD)
 *
 * @param pfds - Array of PFD values
 * @returns Total Risk Reduction Factor
 */
export function calculateTotalRRF(pfds: number[]): number {
  if (pfds.length === 0) {
    return 1; // No protection layers means RRF of 1
  }

  // Validate all PFDs first
  for (const pfd of pfds) {
    if (!isValidPFD(pfd)) {
      throw new Error(
        `Invalid PFD value: ${pfd}. Must be between ${MIN_CREDITABLE_PFD} and ${MAX_CREDITABLE_PFD}.`
      );
    }
  }

  // Calculate product of all PFDs
  const totalPFD = pfds.reduce((product, pfd) => product * pfd, 1);

  return 1 / totalPFD;
}

/**
 * Calculate mitigated event likelihood.
 *
 * MEL = IEF × ∏(PFD of each IPL) = IEF / Total RRF
 *
 * @param initiatingEventFrequency - Initiating event frequency (per year)
 * @param totalRRF - Total risk reduction factor
 * @returns Mitigated event likelihood (per year)
 */
export function calculateMitigatedEventLikelihood(
  initiatingEventFrequency: number,
  totalRRF: number
): number {
  if (totalRRF <= 0) {
    throw new Error('Total RRF must be greater than 0.');
  }

  return initiatingEventFrequency / totalRRF;
}

/**
 * Calculate required Risk Reduction Factor to meet target frequency.
 *
 * Required RRF = IEF / TMEL
 *
 * @param initiatingEventFrequency - Initiating event frequency (per year)
 * @param targetFrequency - Target mitigated event likelihood (per year)
 * @returns Required Risk Reduction Factor
 */
export function calculateRequiredRRF(
  initiatingEventFrequency: number,
  targetFrequency: number
): number {
  if (targetFrequency <= 0) {
    throw new Error('Target frequency must be greater than 0.');
  }

  return initiatingEventFrequency / targetFrequency;
}

/**
 * Calculate gap ratio between actual and required RRF.
 *
 * Gap Ratio = Total RRF / Required RRF
 * - > 1.0: Adequate protection
 * - 0.5 to 1.0: Marginal protection
 * - < 0.5: Inadequate protection
 *
 * @param totalRRF - Actual total risk reduction factor
 * @param requiredRRF - Required risk reduction factor
 * @returns Gap ratio
 */
export function calculateGapRatio(totalRRF: number, requiredRRF: number): number {
  if (requiredRRF <= 0) {
    throw new Error('Required RRF must be greater than 0.');
  }

  return totalRRF / requiredRRF;
}

/**
 * Determine gap status from gap ratio.
 *
 * @param gapRatio - The calculated gap ratio
 * @returns The gap status (adequate, marginal, or inadequate)
 */
export function determineGapStatus(gapRatio: number): LOPAGapStatus {
  if (gapRatio >= ADEQUATE_GAP_THRESHOLD) {
    return 'adequate';
  }
  if (gapRatio >= MARGINAL_GAP_THRESHOLD) {
    return 'marginal';
  }
  return 'inadequate';
}

/**
 * Determine required SIL to close the protection gap.
 *
 * Based on the gap ratio, determines what SIL would be needed for an
 * additional SIF to bring protection to adequate levels.
 *
 * @param gapRatio - Current gap ratio
 * @returns Required SIL level, or null if protection is already adequate
 */
export function determineRequiredSIL(gapRatio: number): SafetyIntegrityLevel | null {
  if (gapRatio >= ADEQUATE_GAP_THRESHOLD) {
    return null; // No additional SIF needed
  }

  // Calculate the additional RRF needed
  const additionalRRFNeeded = ADEQUATE_GAP_THRESHOLD / gapRatio;

  // Determine SIL based on required RRF
  // SIL 1: RRF 10-100, SIL 2: RRF 100-1000, SIL 3: RRF 1000-10000, SIL 4: RRF 10000+
  if (additionalRRFNeeded <= 10) {
    return 1;
  }
  if (additionalRRFNeeded <= 100) {
    return 2;
  }
  if (additionalRRFNeeded <= 1000) {
    return 3;
  }
  return 4;
}

/**
 * Perform complete LOPA calculation.
 *
 * This is the main entry point for LOPA calculation. It validates inputs,
 * calculates all metrics, and determines the gap status.
 *
 * @param input - LOPA calculation input parameters
 * @returns Complete LOPA calculation result
 * @throws Error if inputs are invalid
 */
export function performLOPACalculation(input: LOPACalculationInput): LOPACalculationResult {
  // Validate input
  const validation = validateLOPAInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid LOPA input: ${validation.errors.join('; ')}`);
  }

  // Calculate individual IPL RRFs
  const iplRiskReductionFactors = input.ipls.map((ipl) => ({
    id: ipl.id,
    name: ipl.name,
    pfd: ipl.pfd,
    rrf: calculateRRF(ipl.pfd),
  }));

  // Calculate total RRF
  const pfds = input.ipls.map((ipl) => ipl.pfd);
  const totalRiskReductionFactor = calculateTotalRRF(pfds);

  // Calculate MEL
  const mitigatedEventLikelihood = calculateMitigatedEventLikelihood(
    input.initiatingEventFrequency,
    totalRiskReductionFactor
  );

  // Calculate required RRF
  const requiredRiskReductionFactor = calculateRequiredRRF(
    input.initiatingEventFrequency,
    input.targetFrequency
  );

  // Calculate gap ratio
  const gapRatio = calculateGapRatio(totalRiskReductionFactor, requiredRiskReductionFactor);

  // Determine gap status
  const gapStatus = determineGapStatus(gapRatio);

  // Determine required SIL if inadequate
  const requiredSIL = determineRequiredSIL(gapRatio);

  return {
    initiatingEventFrequency: input.initiatingEventFrequency,
    iplRiskReductionFactors,
    totalRiskReductionFactor,
    mitigatedEventLikelihood,
    targetFrequency: input.targetFrequency,
    requiredRiskReductionFactor,
    gapRatio,
    gapStatus,
    isAdequate: gapStatus === 'adequate',
    requiredSIL,
  };
}

// ============================================================================
// LOPA Trigger Functions
// ============================================================================

/**
 * Check if LOPA is recommended or required based on risk assessment.
 *
 * LOPA is typically triggered when:
 * - Risk level is 'high'
 * - Risk score exceeds a configurable threshold
 * - Severity is 4 (Major) or 5 (Catastrophic)
 *
 * @param riskRanking - The risk ranking from HazOp analysis
 * @param config - Trigger configuration (defaults to DEFAULT_LOPA_TRIGGER_CONFIG)
 * @returns Trigger result indicating if LOPA is recommended/required
 */
export function checkLOPATrigger(
  riskRanking: RiskRanking,
  config: LOPATriggerConfig = DEFAULT_LOPA_TRIGGER_CONFIG
): LOPATriggerResult {
  // Check if LOPA is required based on severity
  if (config.requiredSeverityLevels.includes(riskRanking.severity)) {
    return {
      recommended: true,
      required: true,
      reason: `LOPA required due to severity level ${riskRanking.severity} (Major or Catastrophic consequences)`,
    };
  }

  // Check if LOPA is recommended based on risk level
  if (config.riskLevels.includes(riskRanking.riskLevel)) {
    return {
      recommended: true,
      required: false,
      reason: `LOPA recommended due to ${riskRanking.riskLevel} risk level`,
    };
  }

  // Check if LOPA is recommended based on risk score
  if (riskRanking.riskScore >= config.riskScoreThreshold) {
    return {
      recommended: true,
      required: false,
      reason: `LOPA recommended due to risk score ${riskRanking.riskScore} exceeding threshold ${config.riskScoreThreshold}`,
    };
  }

  return {
    recommended: false,
    required: false,
    reason: 'LOPA not required - risk is within acceptable limits',
  };
}

/**
 * Check if LOPA is needed based on severity and likelihood alone.
 * Simplified check when full risk ranking is not available.
 *
 * @param severity - Severity level (1-5)
 * @param likelihood - Likelihood level (1-5)
 * @returns Whether LOPA is recommended
 */
export function isLOPARecommended(
  severity: SeverityLevel,
  likelihood: SeverityLevel
): boolean {
  // Severity 4 or 5 always needs LOPA
  if (severity >= 4) {
    return true;
  }

  // High likelihood combined with moderate severity
  if (severity >= 3 && likelihood >= 4) {
    return true;
  }

  return false;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the typical PFD for an IPL type.
 *
 * @param type - The IPL type
 * @returns Typical PFD value for this type
 */
export function getTypicalPFDForIPLType(type: IPLType): number {
  return IPL_TYPICAL_PFD[type];
}

/**
 * Get the typical PFD for a SIL level.
 *
 * @param sil - The SIL level
 * @returns Typical PFD value for this SIL
 */
export function getTypicalPFDForSIL(sil: SafetyIntegrityLevel): number {
  return SIL_TYPICAL_PFD[sil];
}

/**
 * Get the PFD range for a SIL level.
 *
 * @param sil - The SIL level
 * @returns PFD range (min and max) for this SIL
 */
export function getPFDRangeForSIL(sil: SafetyIntegrityLevel): { min: number; max: number } {
  return { ...SIL_PFD_RANGES[sil] };
}

/**
 * Determine the SIL level from a PFD value.
 *
 * @param pfd - The PFD value
 * @returns The SIL level corresponding to this PFD, or null if out of range
 */
export function determineSILFromPFD(pfd: number): SafetyIntegrityLevel | null {
  if (!isValidPFD(pfd)) {
    return null;
  }

  for (const sil of SAFETY_INTEGRITY_LEVELS) {
    const range = SIL_PFD_RANGES[sil];
    if (pfd >= range.min && pfd <= range.max) {
      return sil;
    }
  }

  // PFD too high for any SIL (> 0.1)
  return null;
}

/**
 * Get the target frequency based on severity level.
 *
 * Uses the SEVERITY_TO_TARGET_FREQUENCY mapping from types.
 *
 * @param severity - The severity level (1-5)
 * @returns Target frequency (per year)
 */
export function getTargetFrequencyForSeverity(severity: SeverityLevel): number {
  return SEVERITY_TO_TARGET_FREQUENCY[severity];
}

/**
 * Format a frequency value for display.
 *
 * @param frequency - Frequency in events per year
 * @returns Formatted string (e.g., "1 × 10⁻⁵ per year")
 */
export function formatFrequency(frequency: number): string {
  if (frequency >= 1) {
    return `${frequency.toFixed(1)} per year`;
  }

  const exponent = Math.floor(Math.log10(frequency));
  const mantissa = frequency / Math.pow(10, exponent);

  if (Math.abs(mantissa - 1) < 0.01) {
    return `10^${exponent} per year`;
  }

  return `${mantissa.toFixed(1)} × 10^${exponent} per year`;
}

/**
 * Format a PFD value for display.
 *
 * @param pfd - PFD value
 * @returns Formatted string (e.g., "0.01" or "10⁻³")
 */
export function formatPFD(pfd: number): string {
  if (pfd >= 0.1) {
    return pfd.toFixed(2);
  }

  const exponent = Math.floor(Math.log10(pfd));
  const mantissa = pfd / Math.pow(10, exponent);

  if (Math.abs(mantissa - 1) < 0.01) {
    return `10^${exponent}`;
  }

  return `${mantissa.toFixed(1)} × 10^${exponent}`;
}

/**
 * Format an RRF value for display.
 *
 * @param rrf - Risk Reduction Factor
 * @returns Formatted string (e.g., "100" or "1,000")
 */
export function formatRRF(rrf: number): string {
  if (rrf < 1000) {
    return Math.round(rrf).toLocaleString();
  }

  if (rrf < 1000000) {
    return `${(rrf / 1000).toFixed(1)}K`;
  }

  return `${(rrf / 1000000).toFixed(1)}M`;
}

/**
 * Calculate the number of orders of magnitude of risk reduction.
 *
 * @param rrf - Risk Reduction Factor
 * @returns Number of orders of magnitude (e.g., RRF of 100 = 2)
 */
export function calculateOrdersOfMagnitude(rrf: number): number {
  if (rrf <= 0) {
    return 0;
  }
  return Math.log10(rrf);
}

/**
 * Generate recommendations based on LOPA gap analysis.
 *
 * @param result - LOPA calculation result
 * @returns Array of recommendation strings
 */
export function generateLOPARecommendations(result: LOPACalculationResult): string[] {
  const recommendations: string[] = [];

  if (result.gapStatus === 'adequate') {
    recommendations.push(
      'Current protection layers are adequate. Document LOPA analysis and maintain IPL integrity.'
    );
    return recommendations;
  }

  if (result.gapStatus === 'marginal') {
    recommendations.push(
      'Protection is marginal. Consider additional safeguards to improve safety margins.'
    );
  } else {
    recommendations.push(
      'Protection is inadequate. Additional risk reduction measures are required.'
    );
  }

  if (result.requiredSIL) {
    recommendations.push(
      `Consider installing a Safety Instrumented Function (SIF) rated to SIL ${result.requiredSIL}.`
    );
  }

  const additionalRRFNeeded = result.requiredRiskReductionFactor / result.totalRiskReductionFactor;
  if (additionalRRFNeeded > 1) {
    recommendations.push(
      `Additional risk reduction factor of approximately ${formatRRF(additionalRRFNeeded)} is needed.`
    );
  }

  recommendations.push(
    'Conduct LOPA review with process safety team to identify suitable protection layers.'
  );

  return recommendations;
}
