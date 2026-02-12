/**
 * PowerPoint presentation generator service for HazOps reports.
 *
 * Generates professional PowerPoint presentations (PPTX format) from HazOps analysis data.
 * Optimized for executive presentations and team briefings.
 *
 * Presentation structure:
 * 1. Title slide with project info
 * 2. Executive summary slide(s) with risk distribution
 * 3. Analysis overview slide(s) grouped by node
 * 4. Risk matrix visualization (optional)
 * 5. Compliance status slide(s) (optional)
 * 6. Recommendations summary slide(s) (optional)
 * 7. Closing slide
 */

import PptxGenJS from 'pptxgenjs';
import type {
  ReportParameters,
  RiskLevel,
  GuideWord,
} from '@hazop/types';
import {
  GUIDE_WORD_LABELS,
  RISK_LEVEL_LABELS,
  EQUIPMENT_TYPE_LABELS,
} from '@hazop/types';
import type {
  HazopAnalysisWithDetailsAndProgress,
  AnalysisEntry,
} from './hazop-analysis.service.js';
import type { ProjectWithCreator } from './project.service.js';
import type {
  ReportNode,
  ReportRiskSummary,
  ReportComplianceData,
} from './word-generator.service.js';

/**
 * Input data for PowerPoint presentation generation.
 */
export interface PowerPointGeneratorInput {
  /** HazOps analysis with details and progress metrics */
  analysis: HazopAnalysisWithDetailsAndProgress;

  /** Project information */
  project: ProjectWithCreator;

  /** All analysis entries */
  entries: AnalysisEntry[];

  /** Nodes map (id -> node data) */
  nodes: Map<string, ReportNode>;

  /** Report generation parameters */
  parameters: ReportParameters;

  /** Risk summary data (if includeRiskMatrix is true) */
  riskSummary?: ReportRiskSummary;

  /** Compliance data (if includeCompliance is true) */
  complianceData?: ReportComplianceData;

  /** Report name/title override */
  reportName?: string;
}

/**
 * Result from PowerPoint presentation generation.
 */
export interface PowerPointGeneratorResult {
  /** Generated PPTX file as Buffer */
  buffer: Buffer;

  /** MIME type for the generated file */
  mimeType: string;

  /** Suggested filename for download */
  filename: string;
}

// ============================================================================
// Style Constants
// ============================================================================

/** Professional colors for the presentation (hex format) */
const COLORS = {
  primary: '1e3a5f', // Navy blue
  secondary: '4a6785',
  text: '333333',
  textLight: '666666',
  white: 'ffffff',
  headerBg: 'f0f4f8',
  riskHigh: 'fee2e2', // Light red
  riskMedium: 'fef3c7', // Light amber
  riskLow: 'dcfce7', // Light green
  riskHighText: 'dc2626',
  riskMediumText: 'd97706',
  riskLowText: '16a34a',
  riskHighDark: 'b91c1c',
  riskMediumDark: 'b45309',
  riskLowDark: '15803d',
};

/** Slide dimensions and margins in inches */
const LAYOUT = {
  marginLeft: 0.5,
  marginRight: 0.5,
  marginTop: 0.5,
  marginBottom: 0.5,
  contentWidth: 9.0, // 10" - margins
  titleY: 0.3,
  subtitleY: 1.2,
  contentStartY: 1.5,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for risk level.
 */
function getRiskLevelColor(level: RiskLevel | null): { bg: string; text: string; dark: string } {
  switch (level) {
    case 'high':
      return { bg: COLORS.riskHigh, text: COLORS.riskHighText, dark: COLORS.riskHighDark };
    case 'medium':
      return { bg: COLORS.riskMedium, text: COLORS.riskMediumText, dark: COLORS.riskMediumDark };
    case 'low':
      return { bg: COLORS.riskLow, text: COLORS.riskLowText, dark: COLORS.riskLowDark };
    default:
      return { bg: COLORS.white, text: COLORS.textLight, dark: COLORS.textLight };
  }
}

/**
 * Format a date for display.
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Truncate text to a maximum length.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Slide Builders
// ============================================================================

/**
 * Create the title slide.
 */
function createTitleSlide(
  pptx: PptxGenJS,
  input: PowerPointGeneratorInput
): void {
  const { analysis, project, parameters } = input;
  const title = parameters.customTitle ?? `HazOps Analysis Report`;
  const subtitle = analysis.name;

  const slide = pptx.addSlide();

  // Background
  slide.background = { color: COLORS.primary };

  // Main title
  slide.addText(title, {
    x: LAYOUT.marginLeft,
    y: 2.0,
    w: LAYOUT.contentWidth,
    h: 1.0,
    fontSize: 44,
    fontFace: 'Arial',
    color: COLORS.white,
    bold: true,
    align: 'center',
  });

  // Analysis name
  slide.addText(subtitle, {
    x: LAYOUT.marginLeft,
    y: 3.2,
    w: LAYOUT.contentWidth,
    h: 0.6,
    fontSize: 28,
    fontFace: 'Arial',
    color: COLORS.white,
    align: 'center',
  });

  // Subtitle
  slide.addText('Hazard and Operability Study', {
    x: LAYOUT.marginLeft,
    y: 3.9,
    w: LAYOUT.contentWidth,
    h: 0.5,
    fontSize: 20,
    fontFace: 'Arial',
    color: COLORS.white,
    italic: true,
    align: 'center',
  });

  // Project info box
  const projectInfoY = 5.0;
  slide.addText([
    { text: `Project: ${project.name}`, options: { breakLine: true } },
    { text: `Organization: ${project.organization}`, options: { breakLine: true } },
    { text: `Lead Analyst: ${analysis.leadAnalystName}`, options: { breakLine: true } },
    { text: `Report Date: ${formatDate(new Date())}`, options: {} },
  ], {
    x: 2.5,
    y: projectInfoY,
    w: 5.0,
    h: 1.5,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.white,
    align: 'center',
    valign: 'middle',
    fill: { color: COLORS.secondary },
  });
}

/**
 * Create the executive summary slide.
 */
function createExecutiveSummarySlide(
  pptx: PptxGenJS,
  input: PowerPointGeneratorInput
): void {
  const { analysis, riskSummary, parameters } = input;
  const slide = pptx.addSlide();

  // Title
  slide.addText('Executive Summary', {
    x: LAYOUT.marginLeft,
    y: LAYOUT.titleY,
    w: LAYOUT.contentWidth,
    h: 0.8,
    fontSize: 32,
    fontFace: 'Arial',
    color: COLORS.primary,
    bold: true,
  });

  // Analysis Overview
  const overviewY = 1.3;
  slide.addText('Analysis Overview', {
    x: LAYOUT.marginLeft,
    y: overviewY,
    w: LAYOUT.contentWidth,
    h: 0.4,
    fontSize: 18,
    fontFace: 'Arial',
    color: COLORS.secondary,
    bold: true,
  });

  // Overview details
  const statusLabel = analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1).replace('_', ' ');
  const completionPercent = analysis.totalNodes > 0
    ? ((analysis.analyzedNodes / analysis.totalNodes) * 100).toFixed(0)
    : '0';

  slide.addText([
    { text: `P&ID Document: ${analysis.documentName}`, options: { breakLine: true } },
    { text: `Status: ${statusLabel}`, options: { breakLine: true } },
    { text: `Progress: ${analysis.analyzedNodes} of ${analysis.totalNodes} nodes (${completionPercent}%)`, options: { breakLine: true } },
    { text: `Total Entries: ${analysis.totalEntries}`, options: {} },
  ], {
    x: LAYOUT.marginLeft,
    y: overviewY + 0.5,
    w: 4.5,
    h: 1.5,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.text,
    valign: 'top',
  });

  // Risk distribution (if available)
  if (riskSummary && parameters.includeRiskMatrix !== false) {
    const riskY = overviewY + 0.5;

    slide.addText('Risk Distribution', {
      x: 5.5,
      y: overviewY,
      w: 4.0,
      h: 0.4,
      fontSize: 18,
      fontFace: 'Arial',
      color: COLORS.secondary,
      bold: true,
    });

    // Risk table
    const riskTableRows: PptxGenJS.TableRow[] = [
      [
        { text: 'Risk Level', options: { fill: { color: COLORS.headerBg }, bold: true } },
        { text: 'Count', options: { fill: { color: COLORS.headerBg }, bold: true } },
        { text: '%', options: { fill: { color: COLORS.headerBg }, bold: true } },
      ],
      [
        { text: 'High', options: { fill: { color: COLORS.riskHigh }, color: COLORS.riskHighText, bold: true } },
        { text: String(analysis.highRiskCount), options: { fill: { color: COLORS.riskHigh } } },
        { text: riskSummary.assessedEntries > 0 ? `${((analysis.highRiskCount / riskSummary.assessedEntries) * 100).toFixed(0)}%` : 'N/A', options: { fill: { color: COLORS.riskHigh } } },
      ],
      [
        { text: 'Medium', options: { fill: { color: COLORS.riskMedium }, color: COLORS.riskMediumText, bold: true } },
        { text: String(analysis.mediumRiskCount), options: { fill: { color: COLORS.riskMedium } } },
        { text: riskSummary.assessedEntries > 0 ? `${((analysis.mediumRiskCount / riskSummary.assessedEntries) * 100).toFixed(0)}%` : 'N/A', options: { fill: { color: COLORS.riskMedium } } },
      ],
      [
        { text: 'Low', options: { fill: { color: COLORS.riskLow }, color: COLORS.riskLowText, bold: true } },
        { text: String(analysis.lowRiskCount), options: { fill: { color: COLORS.riskLow } } },
        { text: riskSummary.assessedEntries > 0 ? `${((analysis.lowRiskCount / riskSummary.assessedEntries) * 100).toFixed(0)}%` : 'N/A', options: { fill: { color: COLORS.riskLow } } },
      ],
    ];

    slide.addTable(riskTableRows, {
      x: 5.5,
      y: riskY,
      w: 4.0,
      colW: [1.5, 1.0, 1.0],
      fontSize: 12,
      fontFace: 'Arial',
      color: COLORS.text,
      align: 'center',
      valign: 'middle',
      border: { pt: 0.5, color: COLORS.textLight },
    });

    // Statistics
    if (riskSummary.averageRiskScore !== null || riskSummary.maxRiskScore !== null) {
      let statsText = '';
      if (riskSummary.averageRiskScore !== null) {
        statsText += `Average Score: ${riskSummary.averageRiskScore.toFixed(1)}`;
      }
      if (riskSummary.maxRiskScore !== null) {
        statsText += statsText ? ' | ' : '';
        statsText += `Max Score: ${riskSummary.maxRiskScore}`;
      }

      slide.addText(statsText, {
        x: 5.5,
        y: riskY + 1.6,
        w: 4.0,
        h: 0.3,
        fontSize: 11,
        fontFace: 'Arial',
        color: COLORS.textLight,
        align: 'center',
      });
    }
  }

  // Key findings
  const findingsY = 3.5;
  slide.addText('Key Findings', {
    x: LAYOUT.marginLeft,
    y: findingsY,
    w: LAYOUT.contentWidth,
    h: 0.4,
    fontSize: 18,
    fontFace: 'Arial',
    color: COLORS.secondary,
    bold: true,
  });

  const findings: string[] = [];
  if (analysis.highRiskCount > 0) {
    findings.push(`${analysis.highRiskCount} high-risk scenario(s) identified requiring immediate attention`);
  }
  if (analysis.mediumRiskCount > 0) {
    findings.push(`${analysis.mediumRiskCount} medium-risk scenario(s) requiring mitigation measures`);
  }
  if (analysis.totalEntries > 0) {
    findings.push(`${analysis.totalEntries} deviation scenarios analyzed across ${analysis.analyzedNodes} nodes`);
  }
  if (findings.length === 0) {
    findings.push('Analysis in progress - no findings yet');
  }

  slide.addText(
    findings.map((f, i) => ({ text: `${i + 1}. ${f}`, options: { bullet: false, breakLine: true } })),
    {
      x: LAYOUT.marginLeft,
      y: findingsY + 0.5,
      w: LAYOUT.contentWidth,
      h: 2.0,
      fontSize: 14,
      fontFace: 'Arial',
      color: COLORS.text,
      valign: 'top',
    }
  );
}

/**
 * Create analysis entries slides grouped by node.
 */
function createAnalysisEntriesSlides(
  pptx: PptxGenJS,
  input: PowerPointGeneratorInput
): void {
  const { entries, nodes, parameters } = input;

  // Filter entries
  let filteredEntries = entries;
  if (parameters.riskLevelFilter && parameters.riskLevelFilter.length > 0) {
    filteredEntries = entries.filter((entry) => {
      if (!entry.riskRanking) return false;
      return parameters.riskLevelFilter!.includes(entry.riskRanking.riskLevel);
    });
  }

  if (parameters.nodeFilter && parameters.nodeFilter.length > 0) {
    filteredEntries = filteredEntries.filter((entry) =>
      parameters.nodeFilter!.includes(entry.nodeId)
    );
  }

  if (filteredEntries.length === 0) {
    const slide = pptx.addSlide();
    slide.addText('Analysis Entries', {
      x: LAYOUT.marginLeft,
      y: LAYOUT.titleY,
      w: LAYOUT.contentWidth,
      h: 0.8,
      fontSize: 32,
      fontFace: 'Arial',
      color: COLORS.primary,
      bold: true,
    });
    slide.addText('No entries match the specified filters.', {
      x: LAYOUT.marginLeft,
      y: 2.5,
      w: LAYOUT.contentWidth,
      h: 0.5,
      fontSize: 16,
      fontFace: 'Arial',
      color: COLORS.textLight,
      italic: true,
      align: 'center',
    });
    return;
  }

  // Group entries by node
  const entriesByNode = new Map<string, AnalysisEntry[]>();
  for (const entry of filteredEntries) {
    const nodeEntries = entriesByNode.get(entry.nodeId) ?? [];
    nodeEntries.push(entry);
    entriesByNode.set(entry.nodeId, nodeEntries);
  }

  // Create slides for each node
  for (const [nodeId, nodeEntries] of entriesByNode) {
    const node = nodes.get(nodeId);
    const nodeIdentifier = node?.nodeId ?? 'Unknown';
    const nodeDescription = node?.description ?? '';
    const equipmentType = node?.equipmentType
      ? EQUIPMENT_TYPE_LABELS[node.equipmentType as keyof typeof EQUIPMENT_TYPE_LABELS] ?? node.equipmentType
      : 'Unknown';

    // May need multiple slides per node if there are many entries
    const entriesPerSlide = 6;
    for (let i = 0; i < nodeEntries.length; i += entriesPerSlide) {
      const slideEntries = nodeEntries.slice(i, i + entriesPerSlide);
      const isFirstSlide = i === 0;
      const slideNumber = Math.floor(i / entriesPerSlide) + 1;
      const totalSlides = Math.ceil(nodeEntries.length / entriesPerSlide);

      const slide = pptx.addSlide();

      // Title
      const titleSuffix = totalSlides > 1 ? ` (${slideNumber}/${totalSlides})` : '';
      slide.addText(`Node: ${nodeIdentifier}${titleSuffix}`, {
        x: LAYOUT.marginLeft,
        y: LAYOUT.titleY,
        w: LAYOUT.contentWidth,
        h: 0.6,
        fontSize: 24,
        fontFace: 'Arial',
        color: COLORS.primary,
        bold: true,
      });

      // Node info (only on first slide)
      if (isFirstSlide) {
        slide.addText(`${nodeDescription} | Equipment: ${equipmentType}`, {
          x: LAYOUT.marginLeft,
          y: LAYOUT.titleY + 0.6,
          w: LAYOUT.contentWidth,
          h: 0.4,
          fontSize: 12,
          fontFace: 'Arial',
          color: COLORS.textLight,
        });
      }

      // Entries table
      const tableY = isFirstSlide ? 1.3 : 1.0;
      const tableRows: PptxGenJS.TableRow[] = [
        [
          { text: 'Guide Word', options: { fill: { color: COLORS.headerBg }, bold: true } },
          { text: 'Parameter', options: { fill: { color: COLORS.headerBg }, bold: true } },
          { text: 'Deviation', options: { fill: { color: COLORS.headerBg }, bold: true } },
          { text: 'Causes', options: { fill: { color: COLORS.headerBg }, bold: true } },
          { text: 'Risk', options: { fill: { color: COLORS.headerBg }, bold: true } },
        ],
      ];

      for (const entry of slideEntries) {
        const guideWordLabel = GUIDE_WORD_LABELS[entry.guideWord as GuideWord] ?? entry.guideWord;
        const causesText = entry.causes.length > 0 ? truncateText(entry.causes.join('; '), 50) : '-';
        const riskColors = getRiskLevelColor(entry.riskRanking?.riskLevel ?? null);
        const riskText = entry.riskRanking
          ? `${RISK_LEVEL_LABELS[entry.riskRanking.riskLevel]} (${entry.riskRanking.riskScore})`
          : 'N/A';

        tableRows.push([
          { text: guideWordLabel, options: { bold: true } },
          { text: entry.parameter },
          { text: truncateText(entry.deviation, 40) },
          { text: causesText },
          {
            text: riskText,
            options: {
              fill: entry.riskRanking ? { color: riskColors.bg } : undefined,
              color: riskColors.text,
              bold: !!entry.riskRanking,
            },
          },
        ]);
      }

      slide.addTable(tableRows, {
        x: LAYOUT.marginLeft,
        y: tableY,
        w: LAYOUT.contentWidth,
        colW: [1.2, 1.3, 2.5, 2.5, 1.5],
        fontSize: 10,
        fontFace: 'Arial',
        color: COLORS.text,
        align: 'left',
        valign: 'middle',
        border: { pt: 0.5, color: COLORS.textLight },
      });
    }
  }
}

/**
 * Create the risk matrix visualization slide.
 */
function createRiskMatrixSlide(
  pptx: PptxGenJS,
  input: PowerPointGeneratorInput
): void {
  const { entries, parameters } = input;

  if (parameters.includeRiskMatrix === false) {
    return;
  }

  const slide = pptx.addSlide();

  // Title
  slide.addText('Risk Matrix Overview', {
    x: LAYOUT.marginLeft,
    y: LAYOUT.titleY,
    w: LAYOUT.contentWidth,
    h: 0.8,
    fontSize: 32,
    fontFace: 'Arial',
    color: COLORS.primary,
    bold: true,
  });

  // Create 5x5 risk matrix
  const matrixX = 1.5;
  const matrixY = 1.5;
  const cellSize = 1.0;

  // Count entries by severity and likelihood
  const matrix: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const entry of entries) {
    if (entry.riskRanking) {
      const s = entry.riskRanking.severity - 1; // 0-4
      const l = entry.riskRanking.likelihood - 1; // 0-4
      if (s >= 0 && s < 5 && l >= 0 && l < 5) {
        matrix[l][s]++;
      }
    }
  }

  // Draw Y-axis label
  slide.addText('Likelihood', {
    x: 0.3,
    y: matrixY + 2.0,
    w: 1.0,
    h: 0.5,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.primary,
    bold: true,
    rotate: 270,
  });

  // Draw X-axis label
  slide.addText('Severity', {
    x: matrixX + 2.0,
    y: matrixY + 5.3,
    w: 1.0,
    h: 0.3,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.primary,
    bold: true,
    align: 'center',
  });

  // Likelihood labels (y-axis, 5 = top = Almost Certain)
  const likelihoodLabels = ['1: Rare', '2: Unlikely', '3: Possible', '4: Likely', '5: Almost Certain'];
  for (let l = 0; l < 5; l++) {
    slide.addText(likelihoodLabels[l], {
      x: matrixX - 1.3,
      y: matrixY + (4 - l) * cellSize + 0.3,
      w: 1.2,
      h: cellSize,
      fontSize: 9,
      fontFace: 'Arial',
      color: COLORS.textLight,
      align: 'right',
      valign: 'middle',
    });
  }

  // Severity labels (x-axis)
  const severityLabels = ['1', '2', '3', '4', '5'];
  for (let s = 0; s < 5; s++) {
    slide.addText(severityLabels[s], {
      x: matrixX + s * cellSize,
      y: matrixY + 5.0,
      w: cellSize,
      h: 0.3,
      fontSize: 10,
      fontFace: 'Arial',
      color: COLORS.textLight,
      align: 'center',
    });
  }

  // Draw matrix cells
  // Risk colors based on S * L (simplified - not using detectability for matrix)
  for (let l = 0; l < 5; l++) {
    for (let s = 0; s < 5; s++) {
      const riskProduct = (l + 1) * (s + 1);
      let cellColor: string;
      if (riskProduct >= 15) {
        cellColor = COLORS.riskHighDark;
      } else if (riskProduct >= 8) {
        cellColor = COLORS.riskMediumDark;
      } else {
        cellColor = COLORS.riskLowDark;
      }

      const count = matrix[l][s];
      const displayY = matrixY + (4 - l) * cellSize;

      // Cell background
      slide.addShape('rect', {
        x: matrixX + s * cellSize,
        y: displayY,
        w: cellSize,
        h: cellSize,
        fill: { color: cellColor, transparency: 40 },
        line: { color: COLORS.textLight, pt: 0.5 },
      });

      // Count if > 0
      if (count > 0) {
        slide.addText(String(count), {
          x: matrixX + s * cellSize,
          y: displayY,
          w: cellSize,
          h: cellSize,
          fontSize: 16,
          fontFace: 'Arial',
          color: COLORS.white,
          bold: true,
          align: 'center',
          valign: 'middle',
        });
      }
    }
  }

  // Legend
  const legendY = 1.5;
  const legendX = 7.5;

  slide.addText('Legend', {
    x: legendX,
    y: legendY,
    w: 2.0,
    h: 0.4,
    fontSize: 14,
    fontFace: 'Arial',
    color: COLORS.secondary,
    bold: true,
  });

  const legendItems = [
    { label: 'High Risk', color: COLORS.riskHighDark },
    { label: 'Medium Risk', color: COLORS.riskMediumDark },
    { label: 'Low Risk', color: COLORS.riskLowDark },
  ];

  legendItems.forEach((item, index) => {
    slide.addShape('rect', {
      x: legendX,
      y: legendY + 0.5 + index * 0.5,
      w: 0.4,
      h: 0.3,
      fill: { color: item.color, transparency: 40 },
      line: { color: COLORS.textLight, pt: 0.5 },
    });
    slide.addText(item.label, {
      x: legendX + 0.5,
      y: legendY + 0.5 + index * 0.5,
      w: 1.5,
      h: 0.3,
      fontSize: 11,
      fontFace: 'Arial',
      color: COLORS.text,
      valign: 'middle',
    });
  });

  // Note about detectability
  slide.addText('Note: Matrix shows Severity × Likelihood. Full risk scores include Detectability factor.', {
    x: LAYOUT.marginLeft,
    y: 6.8,
    w: LAYOUT.contentWidth,
    h: 0.3,
    fontSize: 10,
    fontFace: 'Arial',
    color: COLORS.textLight,
    italic: true,
  });
}

/**
 * Create compliance status slide(s).
 */
function createComplianceSlides(
  pptx: PptxGenJS,
  input: PowerPointGeneratorInput
): void {
  const { complianceData, parameters } = input;

  if (!parameters.includeCompliance || !complianceData) {
    return;
  }

  const slide = pptx.addSlide();

  // Title
  slide.addText('Regulatory Compliance Status', {
    x: LAYOUT.marginLeft,
    y: LAYOUT.titleY,
    w: LAYOUT.contentWidth,
    h: 0.8,
    fontSize: 32,
    fontFace: 'Arial',
    color: COLORS.primary,
    bold: true,
  });

  // Overall status
  const overallStatusLabel =
    complianceData.overallStatus === 'compliant'
      ? 'Compliant'
      : complianceData.overallStatus === 'non_compliant'
        ? 'Non-Compliant'
        : 'Partially Compliant';

  const statusColors: Record<string, { bg: string; text: string }> = {
    compliant: { bg: COLORS.riskLow, text: COLORS.riskLowText },
    non_compliant: { bg: COLORS.riskHigh, text: COLORS.riskHighText },
    partial: { bg: COLORS.riskMedium, text: COLORS.riskMediumText },
  };
  const colors = statusColors[complianceData.overallStatus] ?? { bg: COLORS.white, text: COLORS.textLight };

  slide.addText(`Overall Status: ${overallStatusLabel}`, {
    x: LAYOUT.marginLeft,
    y: 1.3,
    w: 4.0,
    h: 0.5,
    fontSize: 20,
    fontFace: 'Arial',
    color: colors.text,
    bold: true,
    fill: { color: colors.bg },
  });

  // Standards table
  if (complianceData.standards.length > 0) {
    const tableRows: PptxGenJS.TableRow[] = [
      [
        { text: 'Standard', options: { fill: { color: COLORS.headerBg }, bold: true } },
        { text: 'Status', options: { fill: { color: COLORS.headerBg }, bold: true } },
        { text: 'Gaps', options: { fill: { color: COLORS.headerBg }, bold: true } },
        { text: 'Key Recommendations', options: { fill: { color: COLORS.headerBg }, bold: true } },
      ],
    ];

    for (const standard of complianceData.standards) {
      const statusLabel =
        standard.status === 'compliant'
          ? 'Compliant'
          : standard.status === 'non_compliant'
            ? 'Non-Compliant'
            : standard.status === 'partial'
              ? 'Partial'
              : 'N/A';

      const stdColors = statusColors[standard.status] ?? { bg: COLORS.white, text: COLORS.textLight };

      tableRows.push([
        { text: standard.standardName, options: { bold: true } },
        { text: statusLabel, options: { fill: { color: stdColors.bg }, color: stdColors.text } },
        { text: String(standard.gapsCount), options: { align: 'center' } },
        { text: standard.recommendations.length > 0 ? truncateText(standard.recommendations.slice(0, 2).join('; '), 80) : '-' },
      ]);
    }

    slide.addTable(tableRows, {
      x: LAYOUT.marginLeft,
      y: 2.1,
      w: LAYOUT.contentWidth,
      colW: [2.5, 1.5, 0.8, 4.2],
      fontSize: 11,
      fontFace: 'Arial',
      color: COLORS.text,
      align: 'left',
      valign: 'middle',
      border: { pt: 0.5, color: COLORS.textLight },
    });
  }
}

/**
 * Create recommendations summary slide(s).
 */
function createRecommendationsSlides(
  pptx: PptxGenJS,
  input: PowerPointGeneratorInput
): void {
  const { entries, nodes, parameters } = input;

  if (parameters.includeRecommendations === false) {
    return;
  }

  // Collect all recommendations
  const allRecommendations: Array<{
    nodeIdentifier: string;
    guideWord: string;
    recommendation: string;
    riskLevel: RiskLevel | null;
  }> = [];

  for (const entry of entries) {
    const node = nodes.get(entry.nodeId);
    for (const recommendation of entry.recommendations) {
      allRecommendations.push({
        nodeIdentifier: node?.nodeId ?? 'Unknown',
        guideWord: GUIDE_WORD_LABELS[entry.guideWord as GuideWord] ?? entry.guideWord,
        recommendation,
        riskLevel: entry.riskRanking?.riskLevel ?? null,
      });
    }
  }

  if (allRecommendations.length === 0) {
    return;
  }

  // Sort by risk level (high first)
  allRecommendations.sort((a, b) => {
    const levelOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const aOrder = a.riskLevel ? levelOrder[a.riskLevel] ?? 3 : 3;
    const bOrder = b.riskLevel ? levelOrder[b.riskLevel] ?? 3 : 3;
    return aOrder - bOrder;
  });

  // Create slides (max 8 recommendations per slide)
  const recsPerSlide = 8;
  for (let i = 0; i < allRecommendations.length; i += recsPerSlide) {
    const slideRecs = allRecommendations.slice(i, i + recsPerSlide);
    const slideNumber = Math.floor(i / recsPerSlide) + 1;
    const totalSlides = Math.ceil(allRecommendations.length / recsPerSlide);

    const slide = pptx.addSlide();

    // Title
    const titleSuffix = totalSlides > 1 ? ` (${slideNumber}/${totalSlides})` : '';
    slide.addText(`Recommendations Summary${titleSuffix}`, {
      x: LAYOUT.marginLeft,
      y: LAYOUT.titleY,
      w: LAYOUT.contentWidth,
      h: 0.8,
      fontSize: 32,
      fontFace: 'Arial',
      color: COLORS.primary,
      bold: true,
    });

    // Count info
    if (i === 0) {
      slide.addText(`Total: ${allRecommendations.length} recommendations identified`, {
        x: LAYOUT.marginLeft,
        y: 1.0,
        w: LAYOUT.contentWidth,
        h: 0.3,
        fontSize: 12,
        fontFace: 'Arial',
        color: COLORS.textLight,
      });
    }

    // Recommendations table
    const tableRows: PptxGenJS.TableRow[] = [
      [
        { text: '#', options: { fill: { color: COLORS.headerBg }, bold: true } },
        { text: 'Node', options: { fill: { color: COLORS.headerBg }, bold: true } },
        { text: 'Context', options: { fill: { color: COLORS.headerBg }, bold: true } },
        { text: 'Recommendation', options: { fill: { color: COLORS.headerBg }, bold: true } },
        { text: 'Risk', options: { fill: { color: COLORS.headerBg }, bold: true } },
      ],
    ];

    slideRecs.forEach((rec, index) => {
      const riskColors = getRiskLevelColor(rec.riskLevel);
      const riskText = rec.riskLevel ? RISK_LEVEL_LABELS[rec.riskLevel] : 'N/A';

      tableRows.push([
        { text: String(i + index + 1), options: { align: 'center' } },
        { text: rec.nodeIdentifier, options: { bold: true } },
        { text: rec.guideWord },
        { text: truncateText(rec.recommendation, 60) },
        {
          text: riskText,
          options: {
            fill: rec.riskLevel ? { color: riskColors.bg } : undefined,
            color: riskColors.text,
            bold: !!rec.riskLevel,
            align: 'center',
          },
        },
      ]);
    });

    slide.addTable(tableRows, {
      x: LAYOUT.marginLeft,
      y: 1.4,
      w: LAYOUT.contentWidth,
      colW: [0.5, 1.0, 1.2, 5.0, 1.3],
      fontSize: 10,
      fontFace: 'Arial',
      color: COLORS.text,
      align: 'left',
      valign: 'middle',
      border: { pt: 0.5, color: COLORS.textLight },
    });
  }
}

/**
 * Create the closing slide.
 */
function createClosingSlide(
  pptx: PptxGenJS,
  input: PowerPointGeneratorInput
): void {
  const { parameters } = input;
  const slide = pptx.addSlide();

  // Background
  slide.background = { color: COLORS.primary };

  // Thank you text
  slide.addText('End of Report', {
    x: LAYOUT.marginLeft,
    y: 2.5,
    w: LAYOUT.contentWidth,
    h: 1.0,
    fontSize: 44,
    fontFace: 'Arial',
    color: COLORS.white,
    bold: true,
    align: 'center',
  });

  slide.addText('HazOps Analysis Complete', {
    x: LAYOUT.marginLeft,
    y: 3.7,
    w: LAYOUT.contentWidth,
    h: 0.6,
    fontSize: 24,
    fontFace: 'Arial',
    color: COLORS.white,
    align: 'center',
  });

  // Custom footer
  if (parameters.customFooter) {
    slide.addText(parameters.customFooter, {
      x: LAYOUT.marginLeft,
      y: 5.5,
      w: LAYOUT.contentWidth,
      h: 0.5,
      fontSize: 14,
      fontFace: 'Arial',
      color: COLORS.white,
      align: 'center',
      italic: true,
    });
  }

  // Generated by
  slide.addText('Generated by HazOp Assistant', {
    x: LAYOUT.marginLeft,
    y: 6.5,
    w: LAYOUT.contentWidth,
    h: 0.3,
    fontSize: 10,
    fontFace: 'Arial',
    color: COLORS.white,
    align: 'center',
  });
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generate a PowerPoint presentation from HazOps analysis data.
 *
 * @param input - Input data for presentation generation
 * @returns Generated presentation as Buffer with metadata
 */
export async function generatePowerPointPresentation(
  input: PowerPointGeneratorInput
): Promise<PowerPointGeneratorResult> {
  const { analysis, parameters } = input;

  // Create presentation
  const pptx = new PptxGenJS();

  // Set presentation properties
  const title = parameters.customTitle ?? `HazOps Analysis Report: ${analysis.name}`;
  pptx.author = 'HazOp Assistant';
  pptx.title = title;
  pptx.subject = `HazOps Analysis Report for ${analysis.name}`;
  pptx.company = 'HazOp Assistant';

  // Set slide size to widescreen 16:9
  pptx.defineLayout({ name: 'WIDESCREEN', width: 10, height: 7.5 });
  pptx.layout = 'WIDESCREEN';

  // Build slides
  createTitleSlide(pptx, input);
  createExecutiveSummarySlide(pptx, input);
  createAnalysisEntriesSlides(pptx, input);
  createRiskMatrixSlide(pptx, input);
  createComplianceSlides(pptx, input);
  createRecommendationsSlides(pptx, input);
  createClosingSlide(pptx, input);

  // Generate buffer
  const arrayBuffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
  const buffer = Buffer.from(arrayBuffer);

  // Generate filename
  const sanitizedName = analysis.name
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `HazOps_Report_${sanitizedName}_${timestamp}.pptx`;

  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    filename,
  };
}
