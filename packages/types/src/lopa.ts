/**
 * LOPA (Layers of Protection Analysis) type definitions for HazOp Assistant.
 *
 * LOPA is a semi-quantitative risk assessment method used to evaluate whether
 * sufficient independent protection layers (IPLs) exist to reduce the frequency
 * of a hazardous scenario to an acceptable level.
 *
 * Key Concepts:
 * - Initiating Event Frequency (IEF): Starting frequency of the hazardous event
 * - Independent Protection Layers (IPLs): Safeguards that independently prevent or mitigate
 * - Probability of Failure on Demand (PFD): Likelihood that an IPL fails when called upon
 * - Target Mitigated Event Likelihood (TMEL): Acceptable frequency after IPLs
 * - Risk Reduction Factor (RRF): Total risk reduction provided by all IPLs
 *
 * Reference Standards:
 * - IEC 61511: Functional safety for process industries
 * - CCPS Guidelines for Initiating Events and Independent Protection Layers
 */

import type { SeverityLevel, LikelihoodLevel, RiskLevel } from './hazop-analysis.js';

// ============================================================================
// Safety Integrity Level (SIL)
// ============================================================================

/**
 * Safety Integrity Level (SIL) as defined by IEC 61511.
 *
 * SIL 1: PFD range 10^-1 to 10^-2 (RRF 10-100)
 * SIL 2: PFD range 10^-2 to 10^-3 (RRF 100-1000)
 * SIL 3: PFD range 10^-3 to 10^-4 (RRF 1000-10000)
 * SIL 4: PFD range 10^-4 to 10^-5 (RRF 10000-100000) - rarely used in process industry
 */
export type SafetyIntegrityLevel = 1 | 2 | 3 | 4;

/**
 * All SIL levels as a constant array.
 */
export const SAFETY_INTEGRITY_LEVELS: readonly SafetyIntegrityLevel[] = [1, 2, 3, 4] as const;

/**
 * Human-readable labels for SIL levels.
 */
export const SIL_LABELS: Record<SafetyIntegrityLevel, string> = {
  1: 'SIL 1',
  2: 'SIL 2',
  3: 'SIL 3',
  4: 'SIL 4',
};

/**
 * Descriptions for each SIL level including PFD range.
 */
export const SIL_DESCRIPTIONS: Record<SafetyIntegrityLevel, string> = {
  1: 'PFD 0.1 to 0.01 (Risk Reduction Factor 10-100)',
  2: 'PFD 0.01 to 0.001 (Risk Reduction Factor 100-1000)',
  3: 'PFD 0.001 to 0.0001 (Risk Reduction Factor 1000-10000)',
  4: 'PFD 0.0001 to 0.00001 (Risk Reduction Factor 10000-100000)',
};

/**
 * PFD ranges for each SIL level (upper and lower bounds).
 */
export const SIL_PFD_RANGES: Record<SafetyIntegrityLevel, { min: number; max: number }> = {
  1: { min: 0.01, max: 0.1 },
  2: { min: 0.001, max: 0.01 },
  3: { min: 0.0001, max: 0.001 },
  4: { min: 0.00001, max: 0.0001 },
};

/**
 * Typical PFD values for each SIL level (used for conservative estimates).
 */
export const SIL_TYPICAL_PFD: Record<SafetyIntegrityLevel, number> = {
  1: 0.1,
  2: 0.01,
  3: 0.001,
  4: 0.0001,
};

// ============================================================================
// IPL (Independent Protection Layer) Types
// ============================================================================

/**
 * Type of Independent Protection Layer.
 *
 * - safety_instrumented_function: SIF/SIS (Safety Instrumented System)
 * - basic_process_control: BPCS control loop
 * - relief_device: Pressure relief valve, rupture disk
 * - physical_containment: Dikes, bunds, secondary containment
 * - mechanical: Check valves, restrictors, excess flow valves
 * - human_intervention: Operator response (with constraints)
 * - emergency_response: Emergency services, fire brigade
 * - other: Other qualified IPLs
 */
export type IPLType =
  | 'safety_instrumented_function'
  | 'basic_process_control'
  | 'relief_device'
  | 'physical_containment'
  | 'mechanical'
  | 'human_intervention'
  | 'emergency_response'
  | 'other';

/**
 * All IPL types as a constant array.
 */
export const IPL_TYPES: readonly IPLType[] = [
  'safety_instrumented_function',
  'basic_process_control',
  'relief_device',
  'physical_containment',
  'mechanical',
  'human_intervention',
  'emergency_response',
  'other',
] as const;

/**
 * Human-readable labels for IPL types.
 */
export const IPL_TYPE_LABELS: Record<IPLType, string> = {
  safety_instrumented_function: 'Safety Instrumented Function (SIF)',
  basic_process_control: 'Basic Process Control System (BPCS)',
  relief_device: 'Relief Device (PSV/Rupture Disk)',
  physical_containment: 'Physical Containment (Dike/Bund)',
  mechanical: 'Mechanical Device (Check Valve/Restrictor)',
  human_intervention: 'Human Intervention',
  emergency_response: 'Emergency Response',
  other: 'Other IPL',
};

/**
 * Descriptions for each IPL type.
 */
export const IPL_TYPE_DESCRIPTIONS: Record<IPLType, string> = {
  safety_instrumented_function:
    'Dedicated safety system designed to SIL requirements (e.g., ESD, high-level trip)',
  basic_process_control:
    'Control system that prevents deviation from normal operation (e.g., level control)',
  relief_device:
    'Pressure relief devices that prevent overpressure (PSV, PRV, rupture disk)',
  physical_containment:
    'Secondary containment structures that limit consequences (dikes, bunds, double walls)',
  mechanical:
    'Passive mechanical devices that prevent or limit hazardous conditions (check valves, restrictors)',
  human_intervention:
    'Operator action in response to alarm or abnormal condition (requires specific conditions)',
  emergency_response:
    'External emergency services or plant emergency response team',
  other:
    'Other qualified independent protection layers',
};

/**
 * Typical PFD values for different IPL types (industry standard values).
 * These are starting points; actual values should be determined by analysis.
 */
export const IPL_TYPICAL_PFD: Record<IPLType, number> = {
  safety_instrumented_function: 0.01, // SIL 2 typical
  basic_process_control: 0.1, // Typically not credited below 0.1
  relief_device: 0.01, // Well-maintained PSV
  physical_containment: 0.01, // Dike designed to contain full volume
  mechanical: 0.01, // Check valve in clean service
  human_intervention: 0.1, // With alarm, procedure, training, time
  emergency_response: 0.1, // On-site fire brigade
  other: 0.1, // Conservative default
};

/**
 * Independent Protection Layer (IPL) definition.
 *
 * An IPL must meet the following criteria:
 * - Specificity: Designed to prevent or mitigate a specific consequence
 * - Independence: Independent of initiating event and other IPLs
 * - Dependability: Can be counted on to perform its intended function
 * - Auditability: Subject to periodic validation/testing
 */
export interface IPL {
  /** Unique identifier for this IPL */
  id: string;

  /** Type of protection layer */
  type: IPLType;

  /** Name/identifier for this specific IPL (e.g., "LAHH-101", "PSV-102") */
  name: string;

  /** Description of the IPL and how it provides protection */
  description: string;

  /** Probability of Failure on Demand (0-1, typically 0.001-0.1) */
  pfd: number;

  /** Whether this IPL is truly independent of the initiating event */
  independentOfInitiator: boolean;

  /** Whether this IPL is independent of other credited IPLs */
  independentOfOtherIPLs: boolean;

  /** For SIF/SIS: the required Safety Integrity Level */
  sil?: SafetyIntegrityLevel;

  /** Additional notes or justification for this IPL */
  notes?: string;
}

/**
 * Simplified IPL for display in tables and summaries.
 */
export interface IPLSummary {
  /** IPL identifier */
  id: string;
  /** IPL name */
  name: string;
  /** IPL type */
  type: IPLType;
  /** PFD value */
  pfd: number;
  /** Risk reduction factor (1/PFD) */
  rrf: number;
}

// ============================================================================
// Initiating Event Types
// ============================================================================

/**
 * Category of initiating event.
 *
 * - equipment_failure: Pump, valve, instrument, or other equipment failure
 * - human_error: Operator error, maintenance error, procedural deviation
 * - external_event: Weather, fire, flooding, vehicle impact
 * - process_upset: Deviation from normal operating conditions
 * - loss_of_utility: Power failure, cooling water loss, instrument air loss
 * - other: Other initiating events
 */
export type InitiatingEventCategory =
  | 'equipment_failure'
  | 'human_error'
  | 'external_event'
  | 'process_upset'
  | 'loss_of_utility'
  | 'other';

/**
 * All initiating event categories as a constant array.
 */
export const INITIATING_EVENT_CATEGORIES: readonly InitiatingEventCategory[] = [
  'equipment_failure',
  'human_error',
  'external_event',
  'process_upset',
  'loss_of_utility',
  'other',
] as const;

/**
 * Human-readable labels for initiating event categories.
 */
export const INITIATING_EVENT_CATEGORY_LABELS: Record<InitiatingEventCategory, string> = {
  equipment_failure: 'Equipment Failure',
  human_error: 'Human Error',
  external_event: 'External Event',
  process_upset: 'Process Upset',
  loss_of_utility: 'Loss of Utility',
  other: 'Other',
};

/**
 * Typical frequencies for different initiating event categories (per year).
 * These are starting points for analysis; actual frequencies should be
 * determined based on specific equipment and conditions.
 */
export const TYPICAL_INITIATING_EVENT_FREQUENCIES: Record<InitiatingEventCategory, { typical: number; range: { min: number; max: number }; description: string }> = {
  equipment_failure: {
    typical: 0.1,
    range: { min: 0.001, max: 1 },
    description: 'Pump: 0.1/yr, Control valve: 0.1/yr, Instrument: 0.1/yr',
  },
  human_error: {
    typical: 0.1,
    range: { min: 0.01, max: 1 },
    description: 'Routine task: 0.01/yr, Non-routine: 0.1/yr, High stress: 1/yr',
  },
  external_event: {
    typical: 0.01,
    range: { min: 0.0001, max: 0.1 },
    description: 'Fire: 0.01/yr, Flooding: 0.01/yr, Vehicle impact: 0.001/yr',
  },
  process_upset: {
    typical: 1,
    range: { min: 0.1, max: 10 },
    description: 'Minor deviation: 10/yr, Major deviation: 1/yr, Runaway: 0.1/yr',
  },
  loss_of_utility: {
    typical: 0.1,
    range: { min: 0.01, max: 1 },
    description: 'Power: 0.1/yr, Cooling water: 0.1/yr, Instrument air: 0.1/yr',
  },
  other: {
    typical: 0.1,
    range: { min: 0.001, max: 1 },
    description: 'Depends on specific scenario',
  },
};

// ============================================================================
// Target Frequency Types
// ============================================================================

/**
 * Target mitigated event likelihood (TMEL) categories based on consequence severity.
 * These are tolerable frequencies for events with different severities.
 *
 * Based on typical corporate risk criteria and IEC 61511 guidance.
 */
export type TargetFrequencyCategory = 'fatality' | 'serious_injury' | 'environmental' | 'financial';

/**
 * All target frequency categories as a constant array.
 */
export const TARGET_FREQUENCY_CATEGORIES: readonly TargetFrequencyCategory[] = [
  'fatality',
  'serious_injury',
  'environmental',
  'financial',
] as const;

/**
 * Human-readable labels for target frequency categories.
 */
export const TARGET_FREQUENCY_LABELS: Record<TargetFrequencyCategory, string> = {
  fatality: 'Fatality or Multiple Casualties',
  serious_injury: 'Serious Injury / Permanent Disability',
  environmental: 'Major Environmental Release',
  financial: 'Significant Financial Loss',
};

/**
 * Typical target frequencies (per year) for different consequence categories.
 * These represent tolerable risk levels that require management approval.
 */
export const TYPICAL_TARGET_FREQUENCIES: Record<TargetFrequencyCategory, number> = {
  fatality: 1e-5, // 10^-5 per year (1 in 100,000 years)
  serious_injury: 1e-4, // 10^-4 per year (1 in 10,000 years)
  environmental: 1e-4, // 10^-4 per year
  financial: 1e-3, // 10^-3 per year (1 in 1,000 years)
};

/**
 * Mapping from HazOp severity levels to target frequencies.
 * This allows LOPA to be triggered based on HazOp risk assessment results.
 */
export const SEVERITY_TO_TARGET_FREQUENCY: Record<SeverityLevel, number> = {
  1: 1e-2, // Negligible consequences - 10^-2
  2: 1e-3, // Minor consequences - 10^-3
  3: 1e-4, // Moderate consequences - 10^-4
  4: 1e-5, // Major consequences - 10^-5
  5: 1e-6, // Catastrophic consequences - 10^-6
};

// ============================================================================
// LOPA Analysis Types
// ============================================================================

/**
 * Status of a LOPA analysis.
 */
export type LOPAStatus = 'draft' | 'in_review' | 'approved' | 'requires_action';

/**
 * All LOPA statuses as a constant array.
 */
export const LOPA_STATUSES: readonly LOPAStatus[] = [
  'draft',
  'in_review',
  'approved',
  'requires_action',
] as const;

/**
 * Human-readable labels for LOPA statuses.
 */
export const LOPA_STATUS_LABELS: Record<LOPAStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  requires_action: 'Requires Action',
};

/**
 * Result of LOPA gap analysis.
 */
export type LOPAGapStatus = 'adequate' | 'marginal' | 'inadequate';

/**
 * All LOPA gap statuses as a constant array.
 */
export const LOPA_GAP_STATUSES: readonly LOPAGapStatus[] = [
  'adequate',
  'marginal',
  'inadequate',
] as const;

/**
 * Human-readable labels for LOPA gap statuses.
 */
export const LOPA_GAP_STATUS_LABELS: Record<LOPAGapStatus, string> = {
  adequate: 'Adequate Protection',
  marginal: 'Marginal (Review Recommended)',
  inadequate: 'Inadequate Protection',
};

/**
 * Colors for LOPA gap status display.
 */
export const LOPA_GAP_STATUS_COLORS: Record<LOPAGapStatus, string> = {
  adequate: '#22c55e', // Green
  marginal: '#f59e0b', // Amber
  inadequate: '#ef4444', // Red
};

/**
 * Complete LOPA analysis for a single scenario.
 */
export interface LOPAAnalysis {
  /** Unique identifier */
  id: string;

  /** Associated analysis entry ID (links to HazOp entry) */
  analysisEntryId: string;

  /** Description of the scenario being analyzed */
  scenarioDescription: string;

  /** Consequence description */
  consequence: string;

  /** Severity level from HazOp (1-5) */
  severity: SeverityLevel;

  /** Category of the initiating event */
  initiatingEventCategory: InitiatingEventCategory;

  /** Description of the initiating event */
  initiatingEventDescription: string;

  /** Frequency of the initiating event (per year) */
  initiatingEventFrequency: number;

  /** Independent protection layers credited in this analysis */
  ipls: IPL[];

  /** Target mitigated event likelihood (per year) */
  targetFrequency: number;

  /** Calculated mitigated event likelihood (per year) */
  mitigatedEventLikelihood: number;

  /** Total risk reduction factor (product of all IPL RRFs) */
  totalRiskReductionFactor: number;

  /** Required risk reduction factor to meet target */
  requiredRiskReductionFactor: number;

  /** Gap analysis result */
  gapStatus: LOPAGapStatus;

  /** Gap ratio (actual RRF / required RRF) - >1 is adequate */
  gapRatio: number;

  /** Current status of this LOPA analysis */
  status: LOPAStatus;

  /** Recommendations if gap exists */
  recommendations: string[];

  /** Required SIL for new SIF if protection is inadequate */
  requiredSIL: SafetyIntegrityLevel | null;

  /** Additional notes and assumptions */
  notes: string | null;

  /** User who created this analysis */
  createdById: string;

  /** Timestamp when created */
  createdAt: Date;

  /** Timestamp when last updated */
  updatedAt: Date;
}

/**
 * LOPA analysis with related HazOp entry information.
 */
export interface LOPAAnalysisWithEntry extends LOPAAnalysis {
  /** Node identifier from HazOp */
  nodeIdentifier: string;
  /** Guide word from HazOp */
  guideWord: string;
  /** Parameter from HazOp */
  parameter: string;
  /** Deviation from HazOp */
  deviation: string;
}

/**
 * Summary of a LOPA analysis for display in tables.
 */
export interface LOPAAnalysisSummary {
  /** LOPA ID */
  id: string;
  /** Analysis entry ID */
  analysisEntryId: string;
  /** Scenario description */
  scenarioDescription: string;
  /** Initiating event frequency */
  initiatingEventFrequency: number;
  /** Number of credited IPLs */
  iplCount: number;
  /** Target frequency */
  targetFrequency: number;
  /** Mitigated event likelihood */
  mitigatedEventLikelihood: number;
  /** Gap status */
  gapStatus: LOPAGapStatus;
  /** Gap ratio */
  gapRatio: number;
  /** Status */
  status: LOPAStatus;
}

// ============================================================================
// LOPA Calculation Result Types
// ============================================================================

/**
 * Input parameters for LOPA calculation.
 */
export interface LOPACalculationInput {
  /** Frequency of initiating event (per year) */
  initiatingEventFrequency: number;

  /** Array of IPLs with their PFD values */
  ipls: Pick<IPL, 'id' | 'name' | 'pfd'>[];

  /** Target mitigated event likelihood (per year) */
  targetFrequency: number;
}

/**
 * Result of LOPA calculation.
 */
export interface LOPACalculationResult {
  /** Input initiating event frequency */
  initiatingEventFrequency: number;

  /** Individual IPL risk reduction factors */
  iplRiskReductionFactors: { id: string; name: string; pfd: number; rrf: number }[];

  /** Combined risk reduction factor from all IPLs */
  totalRiskReductionFactor: number;

  /** Calculated mitigated event likelihood */
  mitigatedEventLikelihood: number;

  /** Target frequency for comparison */
  targetFrequency: number;

  /** Required RRF to meet target (initiatingFreq / targetFreq) */
  requiredRiskReductionFactor: number;

  /** Gap ratio (total RRF / required RRF) */
  gapRatio: number;

  /** Gap status based on ratio */
  gapStatus: LOPAGapStatus;

  /** Whether target frequency is met */
  isAdequate: boolean;

  /** Required SIL if additional protection is needed */
  requiredSIL: SafetyIntegrityLevel | null;
}

/**
 * Validation result for LOPA input parameters.
 */
export interface LOPAValidationResult {
  /** Whether all inputs are valid */
  valid: boolean;

  /** Array of error messages if invalid */
  errors: string[];
}

// ============================================================================
// LOPA Trigger Types
// ============================================================================

/**
 * Configuration for when LOPA should be recommended/required.
 */
export interface LOPATriggerConfig {
  /** Minimum risk score to trigger LOPA recommendation */
  riskScoreThreshold: number;

  /** Risk levels that trigger LOPA recommendation */
  riskLevels: RiskLevel[];

  /** Severity levels that require LOPA regardless of risk score */
  requiredSeverityLevels: SeverityLevel[];
}

/**
 * Default LOPA trigger configuration.
 * LOPA is recommended for high-risk entries or entries with severity >= 4.
 */
export const DEFAULT_LOPA_TRIGGER_CONFIG: LOPATriggerConfig = {
  riskScoreThreshold: 61, // High risk threshold
  riskLevels: ['high'],
  requiredSeverityLevels: [4, 5], // Major and Catastrophic
};

/**
 * Result of checking whether LOPA is needed.
 */
export interface LOPATriggerResult {
  /** Whether LOPA is recommended */
  recommended: boolean;

  /** Whether LOPA is required (mandatory) */
  required: boolean;

  /** Reason for the recommendation/requirement */
  reason: string;
}

// ============================================================================
// DTO Types for API
// ============================================================================

/**
 * Payload for creating a new LOPA analysis.
 */
export interface CreateLOPAAnalysisPayload {
  /** Analysis entry ID to link to */
  analysisEntryId: string;

  /** Scenario description */
  scenarioDescription: string;

  /** Consequence description */
  consequence: string;

  /** Initiating event category */
  initiatingEventCategory: InitiatingEventCategory;

  /** Initiating event description */
  initiatingEventDescription: string;

  /** Initiating event frequency (per year) */
  initiatingEventFrequency: number;

  /** IPLs to credit */
  ipls: Omit<IPL, 'id'>[];

  /** Target frequency (per year) */
  targetFrequency: number;

  /** Optional notes */
  notes?: string;
}

/**
 * Payload for updating a LOPA analysis.
 */
export interface UpdateLOPAAnalysisPayload {
  /** Scenario description */
  scenarioDescription?: string;

  /** Consequence description */
  consequence?: string;

  /** Initiating event category */
  initiatingEventCategory?: InitiatingEventCategory;

  /** Initiating event description */
  initiatingEventDescription?: string;

  /** Initiating event frequency (per year) */
  initiatingEventFrequency?: number;

  /** IPLs to credit (replaces existing) */
  ipls?: Omit<IPL, 'id'>[];

  /** Target frequency (per year) */
  targetFrequency?: number;

  /** Status update */
  status?: LOPAStatus;

  /** Recommendations */
  recommendations?: string[];

  /** Notes */
  notes?: string | null;
}

/**
 * Payload for adding an IPL to a LOPA analysis.
 */
export interface AddIPLPayload {
  /** IPL type */
  type: IPLType;

  /** IPL name */
  name: string;

  /** IPL description */
  description: string;

  /** PFD value */
  pfd: number;

  /** Independence of initiator */
  independentOfInitiator: boolean;

  /** Independence of other IPLs */
  independentOfOtherIPLs: boolean;

  /** SIL level for SIF */
  sil?: SafetyIntegrityLevel;

  /** Notes */
  notes?: string;
}
