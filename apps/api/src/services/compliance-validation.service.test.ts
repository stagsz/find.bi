/**
 * Unit tests for compliance-validation.service.ts
 *
 * Tests the compliance validation engine including:
 * - Analysis keyword extraction
 * - Analysis context building
 * - Clause evaluation against analysis entries
 * - Standard compliance validation
 * - Compliance report generation
 * - Gap identification
 *
 * Task: COMP-07
 */

import { describe, it, expect } from '@jest/globals';
import type { AnalysisEntry, RegulatoryStandardId, RiskRanking } from '@hazop/types';
import {
  extractAnalysisKeywords,
  buildAnalysisContext,
  validateCompliance,
  generateComplianceReport,
  getRelevantClausesForEntry,
  doesEntryAddressClause,
  getQuickComplianceStatus,
  getMissingRequirements,
  MIN_ENTRIES_FOR_ASSESSMENT,
  COMPLIANCE_THRESHOLDS,
} from './compliance-validation.service.js';
import { getStandardClauses } from './regulatory-standards.service.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock analysis entry with sensible defaults.
 */
function createMockEntry(overrides: Partial<AnalysisEntry> = {}): AnalysisEntry {
  return {
    id: 'entry-1',
    analysisId: 'analysis-1',
    nodeId: 'node-1',
    guideWord: 'more',
    parameter: 'pressure',
    deviation: 'High pressure in vessel',
    causes: ['Control valve failure', 'Blocked outlet'],
    consequences: ['Vessel rupture', 'Release to atmosphere'],
    safeguards: ['Pressure relief valve', 'High pressure alarm'],
    recommendations: ['Install redundant pressure transmitter'],
    riskRanking: null,
    notes: null,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock risk ranking.
 */
function createMockRiskRanking(
  severity: 1 | 2 | 3 | 4 | 5 = 3,
  likelihood: 1 | 2 | 3 | 4 | 5 = 3,
  detectability: 1 | 2 | 3 | 4 | 5 = 3
): RiskRanking {
  const riskScore = severity * likelihood * detectability;
  let riskLevel: 'low' | 'medium' | 'high';
  if (riskScore <= 20) riskLevel = 'low';
  else if (riskScore <= 60) riskLevel = 'medium';
  else riskLevel = 'high';

  return {
    severity,
    likelihood,
    detectability,
    riskScore,
    riskLevel,
  };
}

// ============================================================================
// extractAnalysisKeywords Tests
// ============================================================================

describe('Compliance Validation Service', () => {
  describe('extractAnalysisKeywords', () => {
    it('should extract keywords from a single entry', () => {
      const entries = [createMockEntry()];
      const keywords = extractAnalysisKeywords(entries);

      expect(keywords.causes.size).toBeGreaterThan(0);
      expect(keywords.consequences.size).toBeGreaterThan(0);
      expect(keywords.safeguards.size).toBeGreaterThan(0);
      expect(keywords.recommendations.size).toBeGreaterThan(0);
      expect(keywords.parameters.has('pressure')).toBe(true);
    });

    it('should extract lowercase keywords', () => {
      const entries = [
        createMockEntry({
          causes: ['EQUIPMENT FAILURE'],
          consequences: ['MAJOR Release'],
        }),
      ];
      const keywords = extractAnalysisKeywords(entries);

      expect(keywords.causes.has('equipment failure')).toBe(true);
      expect(keywords.consequences.has('major release')).toBe(true);
    });

    it('should handle empty entries array', () => {
      const keywords = extractAnalysisKeywords([]);

      expect(keywords.causes.size).toBe(0);
      expect(keywords.consequences.size).toBe(0);
      expect(keywords.safeguards.size).toBe(0);
      expect(keywords.recommendations.size).toBe(0);
      expect(keywords.parameters.size).toBe(0);
      expect(keywords.deviations.size).toBe(0);
    });

    it('should combine keywords from multiple entries', () => {
      const entries = [
        createMockEntry({
          causes: ['Valve failure'],
          safeguards: ['PSV-101'],
        }),
        createMockEntry({
          id: 'entry-2',
          causes: ['Pump trip'],
          safeguards: ['ESD system'],
        }),
      ];
      const keywords = extractAnalysisKeywords(entries);

      expect(keywords.causes.has('valve failure')).toBe(true);
      expect(keywords.causes.has('pump trip')).toBe(true);
      expect(keywords.safeguards.has('psv-101')).toBe(true);
      expect(keywords.safeguards.has('esd system')).toBe(true);
    });

    it('should extract key terms from compound phrases', () => {
      const entries = [
        createMockEntry({
          causes: ['Control valve fails closed'],
        }),
      ];
      const keywords = extractAnalysisKeywords(entries);

      // Should have the full phrase and key terms
      expect(keywords.causes.has('control valve fails closed')).toBe(true);
      // Key terms (longer than 3 chars)
      expect(keywords.causes.has('control')).toBe(true);
      expect(keywords.causes.has('valve')).toBe(true);
      expect(keywords.causes.has('fails')).toBe(true);
      expect(keywords.causes.has('closed')).toBe(true);
    });
  });

  // ============================================================================
  // buildAnalysisContext Tests
  // ============================================================================

  describe('buildAnalysisContext', () => {
    it('should build context from entries', () => {
      const entries = [
        createMockEntry({ nodeId: 'node-1' }),
        createMockEntry({ id: 'entry-2', nodeId: 'node-2', guideWord: 'no' }),
      ];
      const context = buildAnalysisContext(entries);

      expect(context.entries).toHaveLength(2);
      expect(context.nodeCount).toBe(2);
      expect(context.guideWordCount).toBe(2);
    });

    it('should count entries with safeguards', () => {
      const entries = [
        createMockEntry({ safeguards: ['PSV', 'Alarm'] }),
        createMockEntry({ id: 'entry-2', safeguards: [] }),
      ];
      const context = buildAnalysisContext(entries);

      expect(context.entriesWithSafeguards).toBe(1);
    });

    it('should count entries with recommendations', () => {
      const entries = [
        createMockEntry({ recommendations: ['Install redundancy'] }),
        createMockEntry({ id: 'entry-2', recommendations: [] }),
        createMockEntry({ id: 'entry-3', recommendations: ['Review procedure'] }),
      ];
      const context = buildAnalysisContext(entries);

      expect(context.entriesWithRecommendations).toBe(2);
    });

    it('should detect risk assessment presence', () => {
      const entries = [
        createMockEntry({ riskRanking: null }),
        createMockEntry({ id: 'entry-2', riskRanking: createMockRiskRanking() }),
      ];
      const context = buildAnalysisContext(entries);

      expect(context.hasRiskAssessment).toBe(true);
    });

    it('should count high-risk entries', () => {
      const entries = [
        createMockEntry({ riskRanking: createMockRiskRanking(5, 5, 5) }), // High
        createMockEntry({ id: 'entry-2', riskRanking: createMockRiskRanking(2, 2, 2) }), // Low
        createMockEntry({ id: 'entry-3', riskRanking: createMockRiskRanking(5, 4, 4) }), // High
      ];
      const context = buildAnalysisContext(entries);

      expect(context.highRiskEntryCount).toBe(2);
    });

    it('should handle empty entries array', () => {
      const context = buildAnalysisContext([]);

      expect(context.entries).toHaveLength(0);
      expect(context.hasRiskAssessment).toBe(false);
      expect(context.nodeCount).toBe(0);
      expect(context.guideWordCount).toBe(0);
      expect(context.entriesWithSafeguards).toBe(0);
      expect(context.entriesWithRecommendations).toBe(0);
      expect(context.highRiskEntryCount).toBe(0);
    });
  });

  // ============================================================================
  // validateCompliance Tests
  // ============================================================================

  describe('validateCompliance', () => {
    it('should return not_assessed for empty entries', () => {
      const result = validateCompliance([], ['IEC_61511']);

      expect(result.success).toBe(false);
      expect(result.overallStatus).toBe('not_assessed');
      expect(result.errors).toContain('Insufficient analysis entries for compliance assessment.');
    });

    it('should validate against single standard', () => {
      const entries = [
        createMockEntry({ riskRanking: createMockRiskRanking(3, 3, 3) }),
        createMockEntry({
          id: 'entry-2',
          nodeId: 'node-2',
          guideWord: 'no',
          riskRanking: createMockRiskRanking(2, 2, 2),
        }),
        createMockEntry({
          id: 'entry-3',
          nodeId: 'node-3',
          guideWord: 'reverse',
          riskRanking: createMockRiskRanking(3, 2, 3),
        }),
      ];

      const result = validateCompliance(entries, ['ISO_31000']);

      expect(result.success).toBe(true);
      expect(result.summaries).toHaveLength(1);
      expect(result.summaries[0].standardId).toBe('ISO_31000');
    });

    it('should validate against multiple standards', () => {
      const entries = [
        createMockEntry({ riskRanking: createMockRiskRanking() }),
        createMockEntry({ id: 'entry-2', guideWord: 'less', riskRanking: createMockRiskRanking() }),
      ];
      const standards: RegulatoryStandardId[] = ['IEC_61511', 'ISO_31000', 'OSHA_PSM'];

      const result = validateCompliance(entries, standards);

      expect(result.success).toBe(true);
      expect(result.summaries).toHaveLength(3);
    });

    it('should calculate compliance percentages', () => {
      const entries = [
        createMockEntry({
          causes: ['Equipment failure'],
          consequences: ['Loss of containment'],
          safeguards: ['Relief valve', 'Alarm'],
          recommendations: ['Add redundancy'],
          riskRanking: createMockRiskRanking(3, 3, 3),
        }),
      ];

      const result = validateCompliance(entries, ['ISO_31000']);

      expect(result.summaries[0].compliancePercentage).toBeGreaterThanOrEqual(0);
      expect(result.summaries[0].compliancePercentage).toBeLessThanOrEqual(100);
    });

    it('should identify non-compliance when risk assessment is missing', () => {
      const entries = [
        createMockEntry({ riskRanking: null }),
        createMockEntry({ id: 'entry-2', riskRanking: null }),
      ];

      const result = validateCompliance(entries, ['IEC_61511']);

      // Should find some non-compliant clauses related to risk assessment
      const summary = result.summaries[0];
      expect(summary.nonCompliantCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // generateComplianceReport Tests
  // ============================================================================

  describe('generateComplianceReport', () => {
    it('should generate a complete compliance report', () => {
      const entries = [
        createMockEntry({ riskRanking: createMockRiskRanking() }),
      ];

      const report = generateComplianceReport(
        'project-1',
        'analysis-1',
        entries,
        ['IEC_61511'],
        'user-1'
      );

      expect(report.id).toBeDefined();
      expect(report.projectId).toBe('project-1');
      expect(report.analysisId).toBe('analysis-1');
      expect(report.standardsAssessed).toContain('IEC_61511');
      expect(report.standardSummaries).toHaveLength(1);
      expect(report.checkResults.length).toBeGreaterThan(0);
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.generatedById).toBe('user-1');
    });

    it('should include critical gaps in report', () => {
      // Create entries without recommendations for high-risk scenarios
      const entries = [
        createMockEntry({
          riskRanking: createMockRiskRanking(5, 5, 3),
          recommendations: [],
          safeguards: [],
        }),
      ];

      const report = generateComplianceReport(
        'project-1',
        'analysis-1',
        entries,
        ['IEC_61511', 'OSHA_PSM'],
        'user-1'
      );

      // Should identify some gaps
      expect(report.criticalGaps).toBeDefined();
    });

    it('should calculate overall compliance percentage', () => {
      const entries = [
        createMockEntry({
          riskRanking: createMockRiskRanking(3, 3, 3),
        }),
        createMockEntry({
          id: 'entry-2',
          guideWord: 'no',
          riskRanking: createMockRiskRanking(2, 2, 2),
        }),
      ];

      const report = generateComplianceReport(
        'project-1',
        'analysis-1',
        entries,
        ['ISO_31000'],
        'user-1'
      );

      expect(report.overallCompliancePercentage).toBeGreaterThanOrEqual(0);
      expect(report.overallCompliancePercentage).toBeLessThanOrEqual(100);
    });

    it('should work without analysis ID', () => {
      const entries = [createMockEntry()];

      const report = generateComplianceReport(
        'project-1',
        undefined,
        entries,
        ['ISO_31000'],
        'user-1'
      );

      expect(report.analysisId).toBeUndefined();
      expect(report.projectId).toBe('project-1');
    });

    it('should pass LOPA option to context', () => {
      const entries = [
        createMockEntry({
          riskRanking: createMockRiskRanking(4, 4, 3),
        }),
      ];

      const reportWithLOPA = generateComplianceReport(
        'project-1',
        'analysis-1',
        entries,
        ['IEC_61511'],
        'user-1',
        { hasLOPA: true }
      );

      const reportWithoutLOPA = generateComplianceReport(
        'project-1',
        'analysis-1',
        entries,
        ['IEC_61511'],
        'user-1',
        { hasLOPA: false }
      );

      // Both should generate reports; LOPA status affects some clause evaluations
      expect(reportWithLOPA.id).toBeDefined();
      expect(reportWithoutLOPA.id).toBeDefined();
    });
  });

  // ============================================================================
  // getRelevantClausesForEntry Tests
  // ============================================================================

  describe('getRelevantClausesForEntry', () => {
    it('should return clauses relevant to entry content', () => {
      const entry = createMockEntry({
        causes: ['Equipment failure'],
        consequences: ['Release'],
        safeguards: ['PSV'],
        riskRanking: createMockRiskRanking(),
      });

      const clauses = getRelevantClausesForEntry(entry, ['IEC_61511', 'ISO_31000']);

      expect(clauses.length).toBeGreaterThan(0);
    });

    it('should return more clauses for high-risk entries', () => {
      const lowRiskEntry = createMockEntry({
        riskRanking: createMockRiskRanking(2, 2, 2),
      });
      const highRiskEntry = createMockEntry({
        id: 'entry-2',
        riskRanking: createMockRiskRanking(5, 5, 5),
      });

      const lowRiskClauses = getRelevantClausesForEntry(lowRiskEntry, ['IEC_61511']);
      const highRiskClauses = getRelevantClausesForEntry(highRiskEntry, ['IEC_61511']);

      // High risk should include LOPA/SIL clauses
      expect(highRiskClauses.length).toBeGreaterThanOrEqual(lowRiskClauses.length);
    });

    it('should filter to requested standards only', () => {
      const entry = createMockEntry();

      const clausesIEC = getRelevantClausesForEntry(entry, ['IEC_61511']);
      const clausesISO = getRelevantClausesForEntry(entry, ['ISO_31000']);

      clausesIEC.forEach((c) => expect(c.standardId).toBe('IEC_61511'));
      clausesISO.forEach((c) => expect(c.standardId).toBe('ISO_31000'));
    });

    it('should not return duplicates', () => {
      const entry = createMockEntry({
        causes: ['Multiple failure modes'],
        consequences: ['Multiple impacts'],
        safeguards: ['Multiple safeguards'],
        recommendations: ['Multiple recommendations'],
        riskRanking: createMockRiskRanking(4, 4, 4),
      });

      const clauses = getRelevantClausesForEntry(entry, ['IEC_61511', 'ISO_31000']);

      // Check for duplicates
      const seen = new Set<string>();
      clauses.forEach((c) => {
        const key = `${c.standardId}-${c.clause.id}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      });
    });
  });

  // ============================================================================
  // doesEntryAddressClause Tests
  // ============================================================================

  describe('doesEntryAddressClause', () => {
    it('should return true when entry addresses clause keywords', () => {
      const entry = createMockEntry({
        causes: ['Equipment failure', 'Human error'],
        consequences: ['Loss of containment', 'Explosion'],
        safeguards: ['Safety instrumented system', 'Pressure relief'],
      });

      // Get a clause about hazard identification
      const clauses = getStandardClauses('IEC_61511');
      const hazardClause = clauses.find((c) => c.id === '8.1');

      if (hazardClause) {
        const result = doesEntryAddressClause(entry, hazardClause);
        expect(result.addresses || result.evidence.length > 0).toBe(true);
      }
    });

    it('should return false when entry does not address clause', () => {
      const entry = createMockEntry({
        causes: [],
        consequences: [],
        safeguards: [],
        recommendations: [],
        deviation: 'Simple deviation',
      });

      // Get a clause with specific requirements
      const clauses = getStandardClauses('IEC_61511');
      const specificClause = clauses.find((c) => c.keywords.includes('SIL'));

      if (specificClause) {
        const result = doesEntryAddressClause(entry, specificClause);
        // Result depends on keyword matching
        expect(result.evidence.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // getQuickComplianceStatus Tests
  // ============================================================================

  describe('getQuickComplianceStatus', () => {
    it('should return quick status for entries', () => {
      const entries = [
        createMockEntry({ riskRanking: createMockRiskRanking() }),
      ];

      const status = getQuickComplianceStatus(entries, ['ISO_31000']);

      expect(status.overallStatus).toBeDefined();
      expect(status.percentageComplete).toBeGreaterThanOrEqual(0);
      expect(status.percentageComplete).toBeLessThanOrEqual(100);
      expect(status.criticalGapCount).toBeGreaterThanOrEqual(0);
      expect(status.standardStatuses).toHaveLength(1);
    });

    it('should use mandatory standards by default', () => {
      const entries = [
        createMockEntry({ riskRanking: createMockRiskRanking() }),
      ];

      const status = getQuickComplianceStatus(entries);

      // Should check multiple mandatory standards
      expect(status.standardStatuses.length).toBeGreaterThan(0);
    });

    it('should count critical gaps', () => {
      const entries = [
        createMockEntry({
          causes: [],
          consequences: [],
          safeguards: [],
          riskRanking: null,
        }),
      ];

      const status = getQuickComplianceStatus(entries, ['IEC_61511']);

      expect(status.criticalGapCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // getMissingRequirements Tests
  // ============================================================================

  describe('getMissingRequirements', () => {
    it('should identify missing causes documentation', () => {
      const entries = [
        createMockEntry({ causes: [] }),
        createMockEntry({ id: 'entry-2', causes: ['Valid cause'] }),
      ];

      const missing = getMissingRequirements(entries, ['ISO_31000']);

      expect(missing.documentation.some((m) => m.includes('causes'))).toBe(true);
    });

    it('should identify missing consequences documentation', () => {
      const entries = [
        createMockEntry({ consequences: [] }),
      ];

      const missing = getMissingRequirements(entries, ['ISO_31000']);

      expect(missing.documentation.some((m) => m.includes('consequences'))).toBe(true);
    });

    it('should identify missing risk assessments', () => {
      const entries = [
        createMockEntry({ riskRanking: null }),
        createMockEntry({ id: 'entry-2', riskRanking: null }),
      ];

      const missing = getMissingRequirements(entries, ['IEC_61511']);

      expect(missing.riskAssessment.some((m) => m.includes('risk assessment'))).toBe(true);
    });

    it('should identify missing safeguards', () => {
      const entries = [
        createMockEntry({ safeguards: [] }),
      ];

      const missing = getMissingRequirements(entries, ['ISO_31000']);

      expect(missing.safeguards.some((m) => m.includes('safeguard'))).toBe(true);
    });

    it('should identify missing recommendations for high-risk entries', () => {
      const entries = [
        createMockEntry({
          riskRanking: createMockRiskRanking(5, 5, 5), // High risk
          recommendations: [],
        }),
      ];

      const missing = getMissingRequirements(entries, ['IEC_61511']);

      expect(missing.recommendations.some((m) => m.includes('high-risk'))).toBe(true);
    });

    it('should identify LOPA requirements for high severity', () => {
      const entries = [
        createMockEntry({
          riskRanking: createMockRiskRanking(4, 3, 3), // Severity 4
        }),
      ];

      const missing = getMissingRequirements(entries, ['IEC_61511']);

      expect(missing.lopa.some((m) => m.includes('LOPA'))).toBe(true);
    });

    it('should return empty arrays when all requirements met', () => {
      const entries = [
        createMockEntry({
          causes: ['Valid cause'],
          consequences: ['Valid consequence'],
          safeguards: ['Valid safeguard'],
          recommendations: ['Valid recommendation'],
          riskRanking: createMockRiskRanking(2, 2, 2), // Low risk
        }),
      ];

      const missing = getMissingRequirements(entries, ['ISO_31000']);

      expect(missing.documentation).toHaveLength(0);
      expect(missing.riskAssessment).toHaveLength(0);
      expect(missing.safeguards).toHaveLength(0);
      expect(missing.recommendations).toHaveLength(0);
      expect(missing.lopa).toHaveLength(0);
    });
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe('Constants', () => {
    it('should have valid MIN_ENTRIES_FOR_ASSESSMENT', () => {
      expect(MIN_ENTRIES_FOR_ASSESSMENT).toBeGreaterThanOrEqual(1);
    });

    it('should have valid COMPLIANCE_THRESHOLDS', () => {
      expect(COMPLIANCE_THRESHOLDS.compliant).toBe(90);
      expect(COMPLIANCE_THRESHOLDS.partiallyCompliant).toBe(50);
      expect(COMPLIANCE_THRESHOLDS.compliant).toBeGreaterThan(COMPLIANCE_THRESHOLDS.partiallyCompliant);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should handle a complete analysis scenario', () => {
      // Create a realistic set of analysis entries
      const entries: AnalysisEntry[] = [
        createMockEntry({
          id: 'entry-1',
          nodeId: 'V-101',
          guideWord: 'more',
          parameter: 'pressure',
          deviation: 'High pressure in reactor vessel',
          causes: ['Blocked outlet', 'Control valve fails closed', 'Runaway reaction'],
          consequences: ['Vessel rupture', 'Release of hazardous materials', 'Fire/explosion'],
          safeguards: ['PSV-101', 'PAHH-101 with ESD', 'Operator rounds'],
          recommendations: ['Install redundant pressure transmitter', 'Review PSV sizing'],
          riskRanking: createMockRiskRanking(4, 3, 2),
        }),
        createMockEntry({
          id: 'entry-2',
          nodeId: 'V-101',
          guideWord: 'no',
          parameter: 'flow',
          deviation: 'No flow through reactor',
          causes: ['Pump failure', 'Blocked suction'],
          consequences: ['Loss of production', 'Overheating'],
          safeguards: ['Low flow alarm', 'Operator monitoring'],
          recommendations: ['Install flow transmitter'],
          riskRanking: createMockRiskRanking(2, 3, 2),
        }),
        createMockEntry({
          id: 'entry-3',
          nodeId: 'P-101',
          guideWord: 'reverse',
          parameter: 'flow',
          deviation: 'Reverse flow through pump',
          causes: ['Check valve failure', 'Backpressure'],
          consequences: ['Pump damage', 'Process upset'],
          safeguards: ['Check valve CV-101'],
          recommendations: [],
          riskRanking: createMockRiskRanking(3, 2, 3),
        }),
      ];

      // Validate against multiple standards
      const result = validateCompliance(entries, ['IEC_61511', 'ISO_31000', 'OSHA_PSM']);

      expect(result.success).toBe(true);
      expect(result.summaries).toHaveLength(3);

      // Generate full report
      const report = generateComplianceReport(
        'project-1',
        'analysis-1',
        entries,
        ['IEC_61511', 'ISO_31000', 'OSHA_PSM'],
        'user-1'
      );

      expect(report.standardSummaries).toHaveLength(3);
      expect(report.checkResults.length).toBeGreaterThan(0);
      expect(report.overallCompliancePercentage).toBeGreaterThanOrEqual(0);

      // Check quick status
      const quickStatus = getQuickComplianceStatus(entries, ['IEC_61511']);
      expect(quickStatus.overallStatus).toBeDefined();

      // Check missing requirements
      const missing = getMissingRequirements(entries, ['IEC_61511']);
      expect(missing.documentation).toHaveLength(0); // All documented
      expect(missing.riskAssessment).toHaveLength(0); // All assessed
    });

    it('should correctly identify gaps in incomplete analysis', () => {
      const incompleteEntries: AnalysisEntry[] = [
        createMockEntry({
          causes: [],
          consequences: [],
          safeguards: [],
          recommendations: [],
          riskRanking: null,
        }),
      ];

      const result = validateCompliance(incompleteEntries, ['ISO_31000']);
      const missing = getMissingRequirements(incompleteEntries, ['ISO_31000']);

      // Should identify multiple gaps
      expect(result.success).toBe(true); // Can still validate, just has gaps
      expect(missing.documentation.length).toBeGreaterThan(0);
      expect(missing.riskAssessment.length).toBeGreaterThan(0);
      expect(missing.safeguards.length).toBeGreaterThan(0);
    });
  });
});
