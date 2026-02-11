/**
 * Compliance Validation Engine Service.
 *
 * Cross-references HazOps analysis findings against regulatory standards to assess
 * compliance status. This service evaluates whether analysis entries adequately
 * address requirements from IEC 61511, ISO 31000, OSHA PSM, EPA RMP, SEVESO III,
 * and other supported standards.
 *
 * Validation Methodology:
 * - Map HazOps entry content (causes, consequences, safeguards, recommendations) to regulatory clauses
 * - Check coverage of mandatory clauses based on HazOps relevance areas
 * - Identify gaps where analysis does not address required elements
 * - Generate compliance summaries and remediation recommendations
 *
 * Task: COMP-07
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  RegulatoryStandardId,
  RegulatoryClause,
  HazopsRelevanceArea,
  ComplianceStatus,
  ComplianceCheckResult,
  StandardComplianceSummary,
  ComplianceReport,
  ComplianceGap,
  ComplianceValidationResult,
  AnalysisEntry,
} from '@hazop/types';
import {
  REGULATORY_STANDARD_NAMES,
} from '@hazop/types';
import {
  getAllRegulatoryStandards,
  getRegulatoryStandardById,
  getStandardClauses,
  getClausesByRelevanceArea,
} from './regulatory-standards.service.js';

// ============================================================================
// Types for Internal Use
// ============================================================================

/**
 * Analysis context for compliance validation.
 * Contains all relevant data from HazOps analysis.
 */
export interface AnalysisContext {
  /** Analysis entries to validate */
  entries: AnalysisEntry[];
  /** Whether any entries have risk rankings */
  hasRiskAssessment: boolean;
  /** Whether any entries have LOPA analysis */
  hasLOPA: boolean;
  /** Total number of nodes analyzed */
  nodeCount: number;
  /** Number of unique guide words used */
  guideWordCount: number;
  /** Number of entries with safeguards documented */
  entriesWithSafeguards: number;
  /** Number of entries with recommendations */
  entriesWithRecommendations: number;
  /** Number of high-risk entries */
  highRiskEntryCount: number;
}

/**
 * Clause evaluation result.
 */
interface ClauseEvaluation {
  clauseId: string;
  standardId: RegulatoryStandardId;
  status: ComplianceStatus;
  evidence: string;
  gaps: string[];
  recommendations: string[];
  relevantEntryCount: number;
}

/**
 * Keywords mapped to HazOps analysis fields.
 */
interface AnalysisKeywords {
  causes: Set<string>;
  consequences: Set<string>;
  safeguards: Set<string>;
  recommendations: Set<string>;
  parameters: Set<string>;
  deviations: Set<string>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum number of entries needed for a meaningful compliance assessment.
 */
export const MIN_ENTRIES_FOR_ASSESSMENT = 1;

/**
 * Compliance percentage thresholds for overall status.
 */
export const COMPLIANCE_THRESHOLDS = {
  compliant: 90, // >= 90% compliance
  partiallyCompliant: 50, // >= 50% compliance
  // Below 50% is non-compliant
} as const;

/**
 * Mapping from HazOps relevance areas to analysis fields.
 * Used to determine which parts of an entry are relevant for clause evaluation.
 */
const RELEVANCE_AREA_TO_ANALYSIS_FIELDS: Record<HazopsRelevanceArea, string[]> = {
  hazard_identification: ['causes', 'deviations', 'consequences'],
  risk_assessment: ['riskRanking', 'consequences', 'causes'],
  risk_ranking: ['riskRanking'],
  safeguards: ['safeguards'],
  recommendations: ['recommendations'],
  lopa: ['riskRanking', 'safeguards'],
  sil_determination: ['riskRanking', 'safeguards'],
  documentation: ['all'],
  team_composition: ['metadata'],
  methodology: ['guideWord', 'parameter', 'deviation'],
  follow_up: ['recommendations'],
  management_of_change: ['recommendations'],
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract keywords from analysis entries for matching against clauses.
 *
 * @param entries - Analysis entries to extract keywords from
 * @returns Set of keywords organized by field
 */
export function extractAnalysisKeywords(entries: AnalysisEntry[]): AnalysisKeywords {
  const keywords: AnalysisKeywords = {
    causes: new Set(),
    consequences: new Set(),
    safeguards: new Set(),
    recommendations: new Set(),
    parameters: new Set(),
    deviations: new Set(),
  };

  for (const entry of entries) {
    // Extract and normalize keywords from each field
    entry.causes.forEach((c) => {
      keywords.causes.add(c.toLowerCase());
      // Extract key terms
      extractKeyTerms(c).forEach((t) => keywords.causes.add(t));
    });

    entry.consequences.forEach((c) => {
      keywords.consequences.add(c.toLowerCase());
      extractKeyTerms(c).forEach((t) => keywords.consequences.add(t));
    });

    entry.safeguards.forEach((s) => {
      keywords.safeguards.add(s.toLowerCase());
      extractKeyTerms(s).forEach((t) => keywords.safeguards.add(t));
    });

    entry.recommendations.forEach((r) => {
      keywords.recommendations.add(r.toLowerCase());
      extractKeyTerms(r).forEach((t) => keywords.recommendations.add(t));
    });

    keywords.parameters.add(entry.parameter.toLowerCase());
    keywords.deviations.add(entry.deviation.toLowerCase());
  }

  return keywords;
}

/**
 * Extract key terms from a text string.
 * Splits by common delimiters and normalizes.
 *
 * @param text - Text to extract terms from
 * @returns Array of key terms
 */
function extractKeyTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,;:\/\-\(\)]+/)
    .filter((term) => term.length > 3)
    .map((term) => term.trim());
}

/**
 * Build analysis context from entries for validation.
 *
 * @param entries - Analysis entries
 * @returns Analysis context
 */
export function buildAnalysisContext(entries: AnalysisEntry[]): AnalysisContext {
  const nodeIds = new Set(entries.map((e) => e.nodeId));
  const guideWords = new Set(entries.map((e) => e.guideWord));
  const entriesWithRisk = entries.filter((e) => e.riskRanking !== null);
  const highRiskEntries = entriesWithRisk.filter(
    (e) => e.riskRanking && e.riskRanking.riskLevel === 'high'
  );

  return {
    entries,
    hasRiskAssessment: entriesWithRisk.length > 0,
    hasLOPA: false, // Will be updated when LOPA data is available
    nodeCount: nodeIds.size,
    guideWordCount: guideWords.size,
    entriesWithSafeguards: entries.filter((e) => e.safeguards.length > 0).length,
    entriesWithRecommendations: entries.filter((e) => e.recommendations.length > 0).length,
    highRiskEntryCount: highRiskEntries.length,
  };
}

// ============================================================================
// Clause Evaluation Functions
// ============================================================================

/**
 * Check if analysis content matches clause keywords.
 *
 * @param clause - Regulatory clause to check
 * @param keywords - Keywords extracted from analysis
 * @param relevantFields - Which analysis fields to check
 * @returns Number of keyword matches found
 */
function countKeywordMatches(
  clause: RegulatoryClause,
  keywords: AnalysisKeywords,
  relevantFields: string[]
): number {
  let matchCount = 0;
  const clauseKeywords = clause.keywords.map((k) => k.toLowerCase());

  for (const clauseKeyword of clauseKeywords) {
    // Check each relevant field for matches
    for (const field of relevantFields) {
      const fieldKeywords = keywords[field as keyof AnalysisKeywords];
      if (fieldKeywords instanceof Set) {
        for (const analysisKeyword of fieldKeywords) {
          if (
            analysisKeyword.includes(clauseKeyword) ||
            clauseKeyword.includes(analysisKeyword)
          ) {
            matchCount++;
            break; // Count once per clause keyword
          }
        }
      }
    }
  }

  return matchCount;
}

/**
 * Evaluate a single clause against analysis context.
 *
 * @param clause - Clause to evaluate
 * @param standardId - Standard the clause belongs to
 * @param context - Analysis context
 * @param keywords - Extracted keywords
 * @returns Clause evaluation result
 */
function evaluateClause(
  clause: RegulatoryClause,
  standardId: RegulatoryStandardId,
  context: AnalysisContext,
  keywords: AnalysisKeywords
): ClauseEvaluation {
  const gaps: string[] = [];
  const recommendations: string[] = [];
  let status: ComplianceStatus = 'not_assessed';
  let evidence = '';

  // Determine relevant analysis fields based on clause relevance areas
  const relevantFields = new Set<string>();
  for (const area of clause.hazopsRelevance) {
    const fields = RELEVANCE_AREA_TO_ANALYSIS_FIELDS[area];
    fields.forEach((f) => relevantFields.add(f));
  }

  // Check keyword matches
  const matchCount = countKeywordMatches(
    clause,
    keywords,
    Array.from(relevantFields)
  );

  // Count relevant entries based on clause requirements
  let relevantEntryCount = 0;

  // Evaluate based on clause relevance areas
  for (const area of clause.hazopsRelevance) {
    switch (area) {
      case 'hazard_identification':
        // Check if hazards/causes are documented
        if (keywords.causes.size > 0 && keywords.consequences.size > 0) {
          relevantEntryCount = context.entries.filter(
            (e) => e.causes.length > 0 && e.consequences.length > 0
          ).length;
          if (relevantEntryCount >= context.entries.length * 0.7) {
            status = 'compliant';
            evidence = `${relevantEntryCount} entries document hazard causes and consequences.`;
          } else if (relevantEntryCount > 0) {
            status = 'partially_compliant';
            evidence = `${relevantEntryCount} of ${context.entries.length} entries have documented causes and consequences.`;
            gaps.push('Not all entries have documented causes and consequences.');
            recommendations.push('Review entries without causes/consequences and complete documentation.');
          } else {
            status = 'non_compliant';
            gaps.push('No entries document hazard causes and consequences.');
            recommendations.push('Document causes and consequences for all identified deviations.');
          }
        }
        break;

      case 'risk_assessment':
      case 'risk_ranking':
        // Check if risk assessment is performed
        if (context.hasRiskAssessment) {
          const assessedCount = context.entries.filter((e) => e.riskRanking !== null).length;
          if (assessedCount >= context.entries.length * 0.9) {
            status = 'compliant';
            evidence = `${assessedCount} of ${context.entries.length} entries have risk assessments.`;
          } else if (assessedCount > 0) {
            status = 'partially_compliant';
            evidence = `${assessedCount} of ${context.entries.length} entries have risk assessments.`;
            gaps.push(`${context.entries.length - assessedCount} entries lack risk assessment.`);
            recommendations.push('Complete risk assessment for all analysis entries.');
          }
        } else {
          status = 'non_compliant';
          gaps.push('No risk assessments have been performed.');
          recommendations.push('Perform risk assessment (severity × likelihood × detectability) for all entries.');
        }
        relevantEntryCount = context.entries.filter((e) => e.riskRanking !== null).length;
        break;

      case 'safeguards':
        // Check if safeguards are documented
        if (context.entriesWithSafeguards > 0) {
          const safeguardCoverage = context.entriesWithSafeguards / context.entries.length;
          if (safeguardCoverage >= 0.8) {
            status = 'compliant';
            evidence = `${context.entriesWithSafeguards} entries have documented safeguards.`;
          } else if (safeguardCoverage >= 0.5) {
            status = 'partially_compliant';
            evidence = `${context.entriesWithSafeguards} of ${context.entries.length} entries have safeguards.`;
            gaps.push('Some entries lack documented safeguards.');
            recommendations.push('Review and document existing safeguards for all scenarios.');
          } else {
            status = 'partially_compliant';
            evidence = `Only ${context.entriesWithSafeguards} entries have safeguards documented.`;
            gaps.push('Majority of entries lack documented safeguards.');
            recommendations.push('Conduct safeguard review for all identified hazards.');
          }
        } else {
          status = 'non_compliant';
          gaps.push('No safeguards have been documented.');
          recommendations.push('Identify and document existing safeguards for all hazard scenarios.');
        }
        relevantEntryCount = context.entriesWithSafeguards;
        break;

      case 'recommendations':
      case 'follow_up':
        // Check if recommendations are made for high-risk entries
        if (context.entriesWithRecommendations > 0) {
          const highRiskWithRecs = context.entries.filter(
            (e) =>
              e.riskRanking?.riskLevel === 'high' && e.recommendations.length > 0
          ).length;
          if (context.highRiskEntryCount === 0 || highRiskWithRecs >= context.highRiskEntryCount * 0.9) {
            status = 'compliant';
            evidence = `${context.entriesWithRecommendations} entries have recommendations documented.`;
          } else {
            status = 'partially_compliant';
            evidence = `${highRiskWithRecs} of ${context.highRiskEntryCount} high-risk entries have recommendations.`;
            gaps.push('Not all high-risk entries have documented recommendations.');
            recommendations.push('Ensure all high-risk scenarios have mitigation recommendations.');
          }
        } else if (context.highRiskEntryCount > 0) {
          status = 'non_compliant';
          gaps.push('High-risk entries exist without recommendations.');
          recommendations.push('Document risk reduction recommendations for all high-risk scenarios.');
        } else {
          status = 'compliant';
          evidence = 'No high-risk entries requiring mandatory recommendations.';
        }
        relevantEntryCount = context.entriesWithRecommendations;
        break;

      case 'lopa':
      case 'sil_determination':
        // Check if LOPA is performed for high-risk scenarios
        if (context.highRiskEntryCount > 0) {
          if (context.hasLOPA) {
            status = 'compliant';
            evidence = 'LOPA analysis has been performed for high-risk scenarios.';
          } else {
            status = 'non_compliant';
            gaps.push('High-risk scenarios identified but no LOPA analysis performed.');
            recommendations.push('Perform LOPA analysis for scenarios with severity ≥ 4 or high risk scores.');
          }
        } else {
          status = 'not_applicable';
          evidence = 'No high-risk scenarios requiring LOPA analysis.';
        }
        relevantEntryCount = context.highRiskEntryCount;
        break;

      case 'methodology':
        // Check if proper HazOps methodology is followed
        if (context.guideWordCount >= 3 && context.nodeCount > 0) {
          status = 'compliant';
          evidence = `Analysis covers ${context.nodeCount} nodes using ${context.guideWordCount} guide words.`;
        } else if (context.entries.length > 0) {
          status = 'partially_compliant';
          evidence = `${context.entries.length} analysis entries documented.`;
          if (context.guideWordCount < 3) {
            gaps.push('Limited guide word coverage.');
            recommendations.push('Ensure all standard guide words (No, More, Less, Reverse, Early, Late, Other Than) are considered.');
          }
        } else {
          status = 'non_compliant';
          gaps.push('No analysis methodology evidence found.');
          recommendations.push('Conduct systematic HazOps using standard guide words.');
        }
        relevantEntryCount = context.entries.length;
        break;

      case 'documentation':
        // Check overall documentation completeness
        const totalFields = context.entries.length * 4; // causes, consequences, safeguards, recommendations
        const filledFields = context.entries.reduce((count, e) => {
          return count +
            (e.causes.length > 0 ? 1 : 0) +
            (e.consequences.length > 0 ? 1 : 0) +
            (e.safeguards.length > 0 ? 1 : 0) +
            (e.recommendations.length > 0 ? 1 : 0);
        }, 0);
        const completeness = totalFields > 0 ? filledFields / totalFields : 0;

        if (completeness >= 0.8) {
          status = 'compliant';
          evidence = `Documentation is ${Math.round(completeness * 100)}% complete.`;
        } else if (completeness >= 0.5) {
          status = 'partially_compliant';
          evidence = `Documentation is ${Math.round(completeness * 100)}% complete.`;
          gaps.push('Documentation is incomplete.');
          recommendations.push('Complete all analysis fields for full traceability.');
        } else {
          status = 'non_compliant';
          gaps.push('Significant documentation gaps exist.');
          recommendations.push('Review and complete documentation for all analysis entries.');
        }
        relevantEntryCount = context.entries.length;
        break;

      case 'team_composition':
        // Team composition is typically validated outside the analysis entries
        // Mark as not assessed unless we have team metadata
        status = 'not_assessed';
        evidence = 'Team composition validation requires project-level metadata.';
        break;

      case 'management_of_change':
        // MOC is typically validated at project level
        if (keywords.recommendations.has('moc') ||
            keywords.recommendations.has('management of change') ||
            keywords.recommendations.has('change management')) {
          status = 'compliant';
          evidence = 'Management of change considerations documented in recommendations.';
        } else {
          status = 'not_assessed';
          evidence = 'MOC validation requires project-level review.';
        }
        relevantEntryCount = context.entriesWithRecommendations;
        break;
    }
  }

  // If still not assessed and we have keyword matches, use those
  if (status === 'not_assessed' && matchCount > 0) {
    if (matchCount >= clause.keywords.length * 0.5) {
      status = 'partially_compliant';
      evidence = `Analysis addresses ${matchCount} of ${clause.keywords.length} clause keywords.`;
    } else {
      status = 'partially_compliant';
      evidence = `Limited keyword coverage (${matchCount}/${clause.keywords.length}).`;
      gaps.push('Clause requirements not fully addressed in analysis.');
      recommendations.push(`Review clause requirements: ${clause.title}`);
    }
  }

  // Default to not assessed if no evaluation could be made
  if (status === 'not_assessed' && context.entries.length === 0) {
    gaps.push('No analysis entries available for evaluation.');
    recommendations.push('Complete HazOps analysis before compliance validation.');
  }

  return {
    clauseId: clause.id,
    standardId,
    status,
    evidence,
    gaps,
    recommendations,
    relevantEntryCount,
  };
}

// ============================================================================
// Standard Validation Functions
// ============================================================================

/**
 * Validate analysis against a single regulatory standard.
 *
 * @param standardId - ID of standard to validate against
 * @param context - Analysis context
 * @param keywords - Extracted keywords
 * @returns Array of compliance check results
 */
function validateAgainstStandard(
  standardId: RegulatoryStandardId,
  context: AnalysisContext,
  keywords: AnalysisKeywords
): ComplianceCheckResult[] {
  const clauses = getStandardClauses(standardId);
  const results: ComplianceCheckResult[] = [];

  for (const clause of clauses) {
    const evaluation = evaluateClause(clause, standardId, context, keywords);

    results.push({
      clauseId: evaluation.clauseId,
      standardId: evaluation.standardId,
      status: evaluation.status,
      evidence: evaluation.evidence,
      gaps: evaluation.gaps,
      recommendations: evaluation.recommendations,
      assessedAt: new Date(),
    });
  }

  return results;
}

/**
 * Calculate compliance summary for a standard.
 *
 * @param standardId - Standard ID
 * @param checkResults - Compliance check results for this standard
 * @returns Standard compliance summary
 */
function calculateStandardSummary(
  standardId: RegulatoryStandardId,
  checkResults: ComplianceCheckResult[]
): StandardComplianceSummary {
  const standardResults = checkResults.filter((r) => r.standardId === standardId);

  let compliantCount = 0;
  let partiallyCompliantCount = 0;
  let nonCompliantCount = 0;
  let notApplicableCount = 0;
  let notAssessedCount = 0;

  for (const result of standardResults) {
    switch (result.status) {
      case 'compliant':
        compliantCount++;
        break;
      case 'partially_compliant':
        partiallyCompliantCount++;
        break;
      case 'non_compliant':
        nonCompliantCount++;
        break;
      case 'not_applicable':
        notApplicableCount++;
        break;
      case 'not_assessed':
        notAssessedCount++;
        break;
    }
  }

  // Calculate compliance percentage (excluding not applicable)
  const assessedClauses = standardResults.length - notApplicableCount - notAssessedCount;
  const compliantOrPartial = compliantCount + partiallyCompliantCount * 0.5;
  const compliancePercentage = assessedClauses > 0
    ? Math.round((compliantOrPartial / assessedClauses) * 100)
    : 0;

  // Determine overall status
  let overallStatus: ComplianceStatus;
  if (nonCompliantCount > 0) {
    overallStatus = 'non_compliant';
  } else if (compliancePercentage >= COMPLIANCE_THRESHOLDS.compliant) {
    overallStatus = 'compliant';
  } else if (compliancePercentage >= COMPLIANCE_THRESHOLDS.partiallyCompliant) {
    overallStatus = 'partially_compliant';
  } else if (assessedClauses === 0) {
    overallStatus = 'not_assessed';
  } else {
    overallStatus = 'non_compliant';
  }

  return {
    standardId,
    standardName: REGULATORY_STANDARD_NAMES[standardId],
    totalClauses: standardResults.length,
    compliantCount,
    partiallyCompliantCount,
    nonCompliantCount,
    notApplicableCount,
    notAssessedCount,
    compliancePercentage,
    overallStatus,
  };
}

/**
 * Identify critical gaps from compliance check results.
 *
 * @param checkResults - All compliance check results
 * @returns Array of critical compliance gaps
 */
function identifyCriticalGaps(checkResults: ComplianceCheckResult[]): ComplianceGap[] {
  const criticalGaps: ComplianceGap[] = [];

  for (const result of checkResults) {
    if (result.status === 'non_compliant' && result.gaps.length > 0) {
      // Get the standard to check if it's mandatory
      const standard = getRegulatoryStandardById(result.standardId);
      const clause = standard?.relevantClauses.find((c) => c.id === result.clauseId);

      const severity: ComplianceGap['severity'] =
        (standard?.mandatory && clause?.mandatory) ? 'critical' :
        (standard?.mandatory || clause?.mandatory) ? 'major' : 'minor';

      criticalGaps.push({
        id: uuidv4(),
        standardId: result.standardId,
        clauseId: result.clauseId,
        description: result.gaps.join(' '),
        severity,
        remediation: result.recommendations,
      });
    }
  }

  // Sort by severity (critical first)
  const severityOrder: Record<ComplianceGap['severity'], number> = {
    critical: 0,
    major: 1,
    minor: 2,
  };

  return criticalGaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ============================================================================
// Main Validation Functions
// ============================================================================

/**
 * Validate analysis entries against specified regulatory standards.
 *
 * This is the main entry point for compliance validation.
 *
 * @param entries - Analysis entries to validate
 * @param standards - Standards to validate against
 * @param options - Additional validation options
 * @returns Compliance validation result
 */
export function validateCompliance(
  entries: AnalysisEntry[],
  standards: RegulatoryStandardId[],
  options: { includeRecommendations?: boolean; hasLOPA?: boolean } = {}
): ComplianceValidationResult {
  // Build analysis context
  const context = buildAnalysisContext(entries);
  context.hasLOPA = options.hasLOPA ?? false;

  // Check minimum entries
  if (entries.length < MIN_ENTRIES_FOR_ASSESSMENT) {
    return {
      success: false,
      overallStatus: 'not_assessed',
      summaries: [],
      errors: ['Insufficient analysis entries for compliance assessment.'],
    };
  }

  // Extract keywords for matching
  const keywords = extractAnalysisKeywords(entries);

  // Validate against each standard
  const allCheckResults: ComplianceCheckResult[] = [];
  const summaries: StandardComplianceSummary[] = [];

  for (const standardId of standards) {
    const checkResults = validateAgainstStandard(standardId, context, keywords);
    allCheckResults.push(...checkResults);
    summaries.push(calculateStandardSummary(standardId, checkResults));
  }

  // Calculate overall status
  const overallCompliance = summaries.reduce((sum, s) => sum + s.compliancePercentage, 0) / summaries.length;
  let overallStatus: ComplianceStatus;

  if (summaries.some((s) => s.overallStatus === 'non_compliant')) {
    overallStatus = 'non_compliant';
  } else if (overallCompliance >= COMPLIANCE_THRESHOLDS.compliant) {
    overallStatus = 'compliant';
  } else if (overallCompliance >= COMPLIANCE_THRESHOLDS.partiallyCompliant) {
    overallStatus = 'partially_compliant';
  } else {
    overallStatus = 'non_compliant';
  }

  return {
    success: true,
    overallStatus,
    summaries,
    errors: [],
  };
}

/**
 * Generate a full compliance report for an analysis.
 *
 * @param projectId - Project ID
 * @param analysisId - Analysis ID
 * @param entries - Analysis entries
 * @param standards - Standards to assess
 * @param userId - ID of user generating the report
 * @param options - Additional options
 * @returns Complete compliance report
 */
export function generateComplianceReport(
  projectId: string,
  analysisId: string | undefined,
  entries: AnalysisEntry[],
  standards: RegulatoryStandardId[],
  userId: string,
  options: { hasLOPA?: boolean } = {}
): ComplianceReport {
  // Build analysis context
  const context = buildAnalysisContext(entries);
  context.hasLOPA = options.hasLOPA ?? false;

  // Extract keywords for matching
  const keywords = extractAnalysisKeywords(entries);

  // Validate against each standard
  const allCheckResults: ComplianceCheckResult[] = [];
  const standardSummaries: StandardComplianceSummary[] = [];

  for (const standardId of standards) {
    const checkResults = validateAgainstStandard(standardId, context, keywords);
    allCheckResults.push(...checkResults);
    standardSummaries.push(calculateStandardSummary(standardId, checkResults));
  }

  // Identify critical gaps
  const criticalGaps = identifyCriticalGaps(allCheckResults);

  // Calculate overall status
  const assessedSummaries = standardSummaries.filter((s) => s.overallStatus !== 'not_assessed');
  const overallCompliance = assessedSummaries.length > 0
    ? assessedSummaries.reduce((sum, s) => sum + s.compliancePercentage, 0) / assessedSummaries.length
    : 0;

  let overallStatus: ComplianceStatus;
  if (criticalGaps.some((g) => g.severity === 'critical')) {
    overallStatus = 'non_compliant';
  } else if (overallCompliance >= COMPLIANCE_THRESHOLDS.compliant) {
    overallStatus = 'compliant';
  } else if (overallCompliance >= COMPLIANCE_THRESHOLDS.partiallyCompliant) {
    overallStatus = 'partially_compliant';
  } else if (assessedSummaries.length === 0) {
    overallStatus = 'not_assessed';
  } else {
    overallStatus = 'non_compliant';
  }

  return {
    id: uuidv4(),
    projectId,
    analysisId,
    standardsAssessed: standards,
    standardSummaries,
    checkResults: allCheckResults,
    overallStatus,
    overallCompliancePercentage: Math.round(overallCompliance),
    criticalGaps,
    generatedAt: new Date(),
    generatedById: userId,
  };
}

/**
 * Get clauses relevant to a specific analysis entry.
 *
 * @param entry - Analysis entry
 * @param standards - Standards to check
 * @returns Array of relevant clauses with their standard IDs
 */
export function getRelevantClausesForEntry(
  entry: AnalysisEntry,
  standards: RegulatoryStandardId[]
): Array<{ standardId: RegulatoryStandardId; clause: RegulatoryClause }> {
  const relevantClauses: Array<{ standardId: RegulatoryStandardId; clause: RegulatoryClause }> = [];

  // Determine relevance areas based on entry content
  const areas: HazopsRelevanceArea[] = [];

  if (entry.causes.length > 0 || entry.consequences.length > 0) {
    areas.push('hazard_identification');
  }
  if (entry.riskRanking) {
    areas.push('risk_assessment', 'risk_ranking');
    if (entry.riskRanking.riskLevel === 'high') {
      areas.push('lopa', 'sil_determination');
    }
  }
  if (entry.safeguards.length > 0) {
    areas.push('safeguards');
  }
  if (entry.recommendations.length > 0) {
    areas.push('recommendations', 'follow_up');
  }

  // Get clauses for each area
  for (const area of areas) {
    const areaClasuses = getClausesByRelevanceArea(area);
    for (const { standardId, clause } of areaClasuses) {
      if (standards.includes(standardId)) {
        // Avoid duplicates
        if (!relevantClauses.some((r) => r.standardId === standardId && r.clause.id === clause.id)) {
          relevantClauses.push({ standardId, clause });
        }
      }
    }
  }

  return relevantClauses;
}

/**
 * Check if an analysis entry addresses a specific clause.
 *
 * @param entry - Analysis entry to check
 * @param clause - Regulatory clause
 * @returns Whether the entry addresses the clause requirements
 */
export function doesEntryAddressClause(
  entry: AnalysisEntry,
  clause: RegulatoryClause
): { addresses: boolean; evidence: string } {
  const keywords = extractAnalysisKeywords([entry]);
  const relevantFields = new Set<string>();

  for (const area of clause.hazopsRelevance) {
    const fields = RELEVANCE_AREA_TO_ANALYSIS_FIELDS[area];
    fields.forEach((f) => relevantFields.add(f));
  }

  const matchCount = countKeywordMatches(clause, keywords, Array.from(relevantFields));
  const threshold = Math.max(1, clause.keywords.length * 0.3);

  if (matchCount >= threshold) {
    return {
      addresses: true,
      evidence: `Entry matches ${matchCount} clause keywords.`,
    };
  }

  return {
    addresses: false,
    evidence: `Entry does not sufficiently address clause requirements.`,
  };
}

/**
 * Get compliance status for all standards.
 * Quick check without full report generation.
 *
 * @param entries - Analysis entries
 * @param standards - Standards to check (defaults to all mandatory standards)
 * @returns Quick compliance status summary
 */
export function getQuickComplianceStatus(
  entries: AnalysisEntry[],
  standards?: RegulatoryStandardId[]
): {
  overallStatus: ComplianceStatus;
  percentageComplete: number;
  criticalGapCount: number;
  standardStatuses: Array<{ standardId: RegulatoryStandardId; status: ComplianceStatus }>;
} {
  // Default to all mandatory standards if not specified
  const standardsToCheck = standards ?? getAllRegulatoryStandards()
    .filter((s) => s.mandatory)
    .map((s) => s.id);

  const result = validateCompliance(entries, standardsToCheck);

  const criticalGapCount = result.summaries.reduce(
    (count, s) => count + s.nonCompliantCount,
    0
  );

  return {
    overallStatus: result.overallStatus,
    percentageComplete: result.summaries.length > 0
      ? Math.round(result.summaries.reduce((sum, s) => sum + s.compliancePercentage, 0) / result.summaries.length)
      : 0,
    criticalGapCount,
    standardStatuses: result.summaries.map((s) => ({
      standardId: s.standardId,
      status: s.overallStatus,
    })),
  };
}

/**
 * Get missing requirements for compliance.
 * Identifies what needs to be completed for full compliance.
 *
 * @param entries - Analysis entries
 * @param standards - Standards to check
 * @returns List of missing requirements grouped by category
 */
export function getMissingRequirements(
  entries: AnalysisEntry[],
  _standards: RegulatoryStandardId[]
): {
  documentation: string[];
  riskAssessment: string[];
  safeguards: string[];
  recommendations: string[];
  lopa: string[];
} {
  const missing = {
    documentation: [] as string[],
    riskAssessment: [] as string[],
    safeguards: [] as string[],
    recommendations: [] as string[],
    lopa: [] as string[],
  };

  const context = buildAnalysisContext(entries);

  // Check documentation completeness
  const entriesWithoutCauses = entries.filter((e) => e.causes.length === 0);
  if (entriesWithoutCauses.length > 0) {
    missing.documentation.push(`${entriesWithoutCauses.length} entries missing causes documentation.`);
  }

  const entriesWithoutConsequences = entries.filter((e) => e.consequences.length === 0);
  if (entriesWithoutConsequences.length > 0) {
    missing.documentation.push(`${entriesWithoutConsequences.length} entries missing consequences documentation.`);
  }

  // Check risk assessment
  const entriesWithoutRisk = entries.filter((e) => e.riskRanking === null);
  if (entriesWithoutRisk.length > 0) {
    missing.riskAssessment.push(`${entriesWithoutRisk.length} entries require risk assessment.`);
  }

  // Check safeguards
  const entriesWithoutSafeguards = entries.filter((e) => e.safeguards.length === 0);
  if (entriesWithoutSafeguards.length > 0) {
    missing.safeguards.push(`${entriesWithoutSafeguards.length} entries missing safeguard documentation.`);
  }

  // Check recommendations for high-risk
  const highRiskWithoutRecs = entries.filter(
    (e) => e.riskRanking?.riskLevel === 'high' && e.recommendations.length === 0
  );
  if (highRiskWithoutRecs.length > 0) {
    missing.recommendations.push(`${highRiskWithoutRecs.length} high-risk entries require recommendations.`);
  }

  // Check LOPA for high severity
  const highSeverityEntries = entries.filter(
    (e) => e.riskRanking && (e.riskRanking.severity >= 4)
  );
  if (highSeverityEntries.length > 0 && !context.hasLOPA) {
    missing.lopa.push(`${highSeverityEntries.length} entries with severity ≥ 4 require LOPA analysis.`);
  }

  return missing;
}
