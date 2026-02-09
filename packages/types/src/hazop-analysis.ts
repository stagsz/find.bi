/**
 * HazOps Analysis type definitions for HazOp Assistant.
 *
 * These types define the core HazOps methodology including guide words,
 * analysis sessions, analysis entries, and risk rankings.
 *
 * HazOps Methodology Overview:
 * - Analysis is performed node by node on a P&ID
 * - Each node is analyzed using standard guide words
 * - Guide words identify deviations from normal operation
 * - Each deviation is assessed for causes, consequences, safeguards, and recommendations
 * - Risk is calculated as Severity × Likelihood × Detectability
 */

import type { EquipmentType } from './analysis-node.js';

// ============================================================================
// Guide Words
// ============================================================================

/**
 * Standard HazOps guide words for identifying process deviations.
 *
 * - no: Complete negation of intention (e.g., no flow)
 * - more: Quantitative increase (e.g., more pressure)
 * - less: Quantitative decrease (e.g., less temperature)
 * - reverse: Opposite of intention (e.g., reverse flow)
 * - early: Timing-related early occurrence
 * - late: Timing-related late occurrence
 * - other_than: Qualitative deviation (e.g., wrong composition)
 */
export type GuideWord =
  | 'no'
  | 'more'
  | 'less'
  | 'reverse'
  | 'early'
  | 'late'
  | 'other_than';

/**
 * All available guide words as a constant array.
 * Useful for validation, iteration, and UI dropdowns.
 */
export const GUIDE_WORDS: readonly GuideWord[] = [
  'no',
  'more',
  'less',
  'reverse',
  'early',
  'late',
  'other_than',
] as const;

/**
 * Human-readable labels for guide words.
 */
export const GUIDE_WORD_LABELS: Record<GuideWord, string> = {
  no: 'No',
  more: 'More',
  less: 'Less',
  reverse: 'Reverse',
  early: 'Early',
  late: 'Late',
  other_than: 'Other Than',
};

/**
 * Descriptions for each guide word explaining their meaning.
 */
export const GUIDE_WORD_DESCRIPTIONS: Record<GuideWord, string> = {
  no: 'Complete negation of intention (e.g., no flow, no power)',
  more: 'Quantitative increase above normal (e.g., more pressure, more temperature)',
  less: 'Quantitative decrease below normal (e.g., less flow, less level)',
  reverse: 'Opposite of the intended direction (e.g., reverse flow, reverse reaction)',
  early: 'Timing deviation - occurs earlier than intended',
  late: 'Timing deviation - occurs later than intended',
  other_than: 'Qualitative deviation from specification (e.g., wrong composition, contamination)',
};

// ============================================================================
// Risk Assessment Scales
// ============================================================================

/**
 * Severity scale (1-5) measuring the impact of a consequence.
 *
 * 1 - Negligible: No injury, minimal equipment damage
 * 2 - Minor: First aid injury, minor equipment damage
 * 3 - Moderate: Lost workday injury, moderate equipment damage
 * 4 - Major: Permanent disability, major equipment damage, environmental release
 * 5 - Catastrophic: Fatality, multiple casualties, major environmental disaster
 */
export type SeverityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * All severity levels as a constant array.
 */
export const SEVERITY_LEVELS: readonly SeverityLevel[] = [1, 2, 3, 4, 5] as const;

/**
 * Human-readable labels for severity levels.
 */
export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  1: 'Negligible',
  2: 'Minor',
  3: 'Moderate',
  4: 'Major',
  5: 'Catastrophic',
};

/**
 * Descriptions for each severity level.
 */
export const SEVERITY_DESCRIPTIONS: Record<SeverityLevel, string> = {
  1: 'No injury, minimal equipment damage',
  2: 'First aid injury, minor equipment damage',
  3: 'Lost workday injury, moderate equipment damage',
  4: 'Permanent disability, major equipment damage, environmental release',
  5: 'Fatality, multiple casualties, major environmental disaster',
};

/**
 * Likelihood scale (1-5) measuring the probability of occurrence.
 *
 * 1 - Rare: Unlikely to occur during plant lifetime
 * 2 - Unlikely: Could occur once in plant lifetime
 * 3 - Possible: Could occur several times during plant lifetime
 * 4 - Likely: Expected to occur multiple times per year
 * 5 - Almost Certain: Expected to occur frequently
 */
export type LikelihoodLevel = 1 | 2 | 3 | 4 | 5;

/**
 * All likelihood levels as a constant array.
 */
export const LIKELIHOOD_LEVELS: readonly LikelihoodLevel[] = [1, 2, 3, 4, 5] as const;

/**
 * Human-readable labels for likelihood levels.
 */
export const LIKELIHOOD_LABELS: Record<LikelihoodLevel, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Almost Certain',
};

/**
 * Descriptions for each likelihood level.
 */
export const LIKELIHOOD_DESCRIPTIONS: Record<LikelihoodLevel, string> = {
  1: 'Unlikely to occur during plant lifetime',
  2: 'Could occur once in plant lifetime',
  3: 'Could occur several times during plant lifetime',
  4: 'Expected to occur multiple times per year',
  5: 'Expected to occur frequently',
};

/**
 * Detectability scale (1-5) measuring the ability to detect before impact.
 *
 * 1 - Almost Certain: Deviation will almost certainly be detected before impact
 * 2 - High: Good chance of detection before impact
 * 3 - Moderate: May or may not be detected before impact
 * 4 - Low: Unlikely to be detected before impact
 * 5 - Undetectable: No means of detection before impact
 */
export type DetectabilityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * All detectability levels as a constant array.
 */
export const DETECTABILITY_LEVELS: readonly DetectabilityLevel[] = [1, 2, 3, 4, 5] as const;

/**
 * Human-readable labels for detectability levels.
 */
export const DETECTABILITY_LABELS: Record<DetectabilityLevel, string> = {
  1: 'Almost Certain',
  2: 'High',
  3: 'Moderate',
  4: 'Low',
  5: 'Undetectable',
};

/**
 * Descriptions for each detectability level.
 */
export const DETECTABILITY_DESCRIPTIONS: Record<DetectabilityLevel, string> = {
  1: 'Deviation will almost certainly be detected before impact',
  2: 'Good chance of detection before impact',
  3: 'May or may not be detected before impact',
  4: 'Unlikely to be detected before impact',
  5: 'No means of detection before impact',
};

// ============================================================================
// Risk Levels and Scores
// ============================================================================

/**
 * Overall risk level classification.
 * Based on risk score: Low (1-20), Medium (21-60), High (61-125)
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * All risk levels as a constant array.
 */
export const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high'] as const;

/**
 * Human-readable labels for risk levels.
 */
export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
};

/**
 * Risk level thresholds.
 * Score 1-20: Low, 21-60: Medium, 61-125: High
 */
export const RISK_THRESHOLDS = {
  low: { min: 1, max: 20 },
  medium: { min: 21, max: 60 },
  high: { min: 61, max: 125 },
} as const;

/**
 * Risk ranking entity containing severity, likelihood, detectability and calculated risk.
 */
export interface RiskRanking {
  /** Severity level (1-5) */
  severity: SeverityLevel;

  /** Likelihood level (1-5) */
  likelihood: LikelihoodLevel;

  /** Detectability level (1-5) */
  detectability: DetectabilityLevel;

  /** Calculated risk score (severity × likelihood × detectability, range 1-125) */
  riskScore: number;

  /** Classified risk level based on score thresholds */
  riskLevel: RiskLevel;
}

// ============================================================================
// Analysis Status
// ============================================================================

/**
 * Status of a HazOps analysis session.
 *
 * - draft: Analysis is in progress, not yet submitted for review
 * - in_review: Analysis is complete and awaiting lead analyst review
 * - approved: Analysis has been reviewed and approved
 * - rejected: Analysis was rejected and needs revision
 */
export type AnalysisStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

/**
 * All analysis statuses as a constant array.
 */
export const ANALYSIS_STATUSES: readonly AnalysisStatus[] = [
  'draft',
  'in_review',
  'approved',
  'rejected',
] as const;

/**
 * Human-readable labels for analysis statuses.
 */
export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

// ============================================================================
// HazOps Analysis Session
// ============================================================================

/**
 * HazOps analysis session entity.
 * Represents a complete analysis session for a project's P&ID.
 */
export interface HazopsAnalysis {
  /** Unique identifier (UUID) */
  id: string;

  /** ID of the project this analysis belongs to */
  projectId: string;

  /** ID of the P&ID document being analyzed */
  documentId: string;

  /** Name/title of the analysis session */
  name: string;

  /** Optional description of the analysis scope or notes */
  description: string | null;

  /** Current status of the analysis */
  status: AnalysisStatus;

  /** ID of the lead analyst responsible for this analysis */
  leadAnalystId: string;

  /** ID of the user who created this analysis session */
  createdById: string;

  /** Timestamp when the analysis was created */
  createdAt: Date;

  /** Timestamp when the analysis was last updated */
  updatedAt: Date;

  /** Timestamp when the analysis was submitted for review (null if not submitted) */
  submittedAt: Date | null;

  /** Timestamp when the analysis was approved (null if not approved) */
  approvedAt: Date | null;

  /** ID of the user who approved the analysis (null if not approved) */
  approvedById: string | null;
}

/**
 * HazOps analysis with document and lead analyst details.
 */
export interface HazopsAnalysisWithDetails extends HazopsAnalysis {
  /** Name of the P&ID document */
  documentName: string;

  /** Name of the lead analyst */
  leadAnalystName: string;

  /** Email of the lead analyst */
  leadAnalystEmail: string;

  /** Name of the user who created the analysis */
  createdByName: string;
}

/**
 * HazOps analysis with progress metrics.
 */
export interface HazopsAnalysisWithProgress extends HazopsAnalysis {
  /** Total number of nodes in the document */
  totalNodes: number;

  /** Number of nodes with at least one analysis entry */
  analyzedNodes: number;

  /** Total number of analysis entries */
  totalEntries: number;

  /** Number of entries with high risk level */
  highRiskCount: number;

  /** Number of entries with medium risk level */
  mediumRiskCount: number;

  /** Number of entries with low risk level */
  lowRiskCount: number;
}

// ============================================================================
// Analysis Entry (Node + GuideWord Analysis)
// ============================================================================

/**
 * Analysis entry for a specific node and guide word combination.
 * This is the core data structure for HazOps methodology.
 */
export interface AnalysisEntry {
  /** Unique identifier (UUID) */
  id: string;

  /** ID of the HazOps analysis session this entry belongs to */
  analysisId: string;

  /** ID of the analysis node being analyzed */
  nodeId: string;

  /** Guide word applied to this node */
  guideWord: GuideWord;

  /** Parameter being analyzed (e.g., "flow", "pressure", "temperature") */
  parameter: string;

  /** Description of the deviation from normal operation */
  deviation: string;

  /** Possible causes of this deviation */
  causes: string[];

  /** Potential consequences of this deviation */
  consequences: string[];

  /** Existing safeguards that mitigate this risk */
  safeguards: string[];

  /** Recommended actions to reduce risk */
  recommendations: string[];

  /** Risk ranking for this entry (null if not yet assessed) */
  riskRanking: RiskRanking | null;

  /** Additional notes or comments */
  notes: string | null;

  /** ID of the user who created this entry */
  createdById: string;

  /** Timestamp when the entry was created */
  createdAt: Date;

  /** Timestamp when the entry was last updated */
  updatedAt: Date;
}

/**
 * Analysis entry with node details for display.
 */
export interface AnalysisEntryWithNode extends AnalysisEntry {
  /** User-defined node identifier (e.g., "P-101") */
  nodeIdentifier: string;

  /** Description of the node */
  nodeDescription: string;

  /** Type of equipment */
  nodeEquipmentType: EquipmentType;
}

/**
 * Analysis entry with creator details.
 */
export interface AnalysisEntryWithCreator extends AnalysisEntry {
  /** Name of the user who created the entry */
  createdByName: string;

  /** Email of the user who created the entry */
  createdByEmail: string;
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

/**
 * Payload for creating a new HazOps analysis session.
 */
export interface CreateHazopsAnalysisPayload {
  /** ID of the project to create the analysis for */
  projectId: string;

  /** ID of the P&ID document to analyze */
  documentId: string;

  /** Name/title of the analysis session */
  name: string;

  /** Optional description of the analysis scope or notes */
  description?: string;

  /** ID of the lead analyst (defaults to current user if not specified) */
  leadAnalystId?: string;
}

/**
 * Payload for updating a HazOps analysis session.
 * All fields are optional - only provided fields are updated.
 */
export interface UpdateHazopsAnalysisPayload {
  /** Name/title of the analysis session */
  name?: string;

  /** Description of the analysis scope or notes */
  description?: string | null;

  /** ID of the lead analyst */
  leadAnalystId?: string;
}

/**
 * Payload for submitting an analysis for review.
 */
export interface SubmitAnalysisForReviewPayload {
  /** Optional notes for the reviewer */
  reviewNotes?: string;
}

/**
 * Payload for approving or rejecting an analysis.
 */
export interface ReviewAnalysisPayload {
  /** Whether to approve (true) or reject (false) the analysis */
  approved: boolean;

  /** Required comments explaining the decision */
  comments: string;
}

/**
 * Payload for creating a new analysis entry.
 */
export interface CreateAnalysisEntryPayload {
  /** ID of the analysis session */
  analysisId: string;

  /** ID of the analysis node */
  nodeId: string;

  /** Guide word to apply */
  guideWord: GuideWord;

  /** Parameter being analyzed (e.g., "flow", "pressure") */
  parameter: string;

  /** Description of the deviation */
  deviation: string;

  /** Possible causes (can be empty array) */
  causes?: string[];

  /** Potential consequences (can be empty array) */
  consequences?: string[];

  /** Existing safeguards (can be empty array) */
  safeguards?: string[];

  /** Recommended actions (can be empty array) */
  recommendations?: string[];

  /** Optional notes */
  notes?: string;
}

/**
 * Payload for updating an analysis entry.
 * All fields are optional - only provided fields are updated.
 */
export interface UpdateAnalysisEntryPayload {
  /** Parameter being analyzed */
  parameter?: string;

  /** Description of the deviation */
  deviation?: string;

  /** Possible causes */
  causes?: string[];

  /** Potential consequences */
  consequences?: string[];

  /** Existing safeguards */
  safeguards?: string[];

  /** Recommended actions */
  recommendations?: string[];

  /** Additional notes */
  notes?: string | null;
}

/**
 * Payload for updating the risk ranking of an analysis entry.
 */
export interface UpdateRiskRankingPayload {
  /** Severity level (1-5) */
  severity: SeverityLevel;

  /** Likelihood level (1-5) */
  likelihood: LikelihoodLevel;

  /** Detectability level (1-5) */
  detectability: DetectabilityLevel;
}
