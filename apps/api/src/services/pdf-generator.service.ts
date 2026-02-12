/**
 * PDF document generator service for HazOps reports.
 *
 * Generates professional PDF documents from HazOps analysis data using pdf-lib.
 * Supports customizable content through ReportParameters and multiple templates.
 *
 * Document structure:
 * 1. Cover page with title, project info, dates
 * 2. Executive summary with risk distribution
 * 3. Analysis entries table (core HazOps data)
 * 4. Risk matrix visualization (optional)
 * 5. Compliance status (optional)
 * 6. Recommendations summary (optional)
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
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
 * Input data for PDF document generation.
 */
export interface PdfGeneratorInput {
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
 * Result from PDF document generation.
 */
export interface PdfGeneratorResult {
  /** Generated PDF file as Buffer */
  buffer: Buffer;

  /** MIME type for the generated file */
  mimeType: string;

  /** Suggested filename for download */
  filename: string;
}

// ============================================================================
// Style Constants
// ============================================================================

/** Professional colors for the document (RGB normalized 0-1) */
const COLORS = {
  primary: rgb(0.118, 0.227, 0.373), // Navy blue (#1e3a5f)
  secondary: rgb(0.290, 0.404, 0.522), // (#4a6785)
  text: rgb(0.2, 0.2, 0.2), // (#333333)
  textLight: rgb(0.4, 0.4, 0.4), // (#666666)
  border: rgb(0.8, 0.8, 0.8), // (#cccccc)
  headerBg: rgb(0.941, 0.957, 0.973), // (#f0f4f8)
  riskHigh: rgb(0.996, 0.886, 0.886), // Light red (#fee2e2)
  riskMedium: rgb(0.996, 0.953, 0.780), // Light amber (#fef3c7)
  riskLow: rgb(0.863, 0.988, 0.906), // Light green (#dcfce7)
  riskHighText: rgb(0.863, 0.149, 0.149), // (#dc2626)
  riskMediumText: rgb(0.851, 0.467, 0.024), // (#d97706)
  riskLowText: rgb(0.086, 0.639, 0.290), // (#16a34a)
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
};

/** Page dimensions and margins (in points, 72 points = 1 inch) */
const PAGE = {
  width: 612, // Letter size (8.5 inches)
  height: 792, // Letter size (11 inches)
  margin: 72, // 1 inch margins
  get contentWidth() {
    return this.width - 2 * this.margin;
  },
  get contentHeight() {
    return this.height - 2 * this.margin;
  },
};

/** Font sizes */
const FONT_SIZE = {
  title: 28,
  subtitle: 16,
  heading1: 18,
  heading2: 14,
  body: 10,
  small: 9,
  footer: 8,
};

/** Line heights */
const LINE_HEIGHT = {
  title: 36,
  subtitle: 24,
  heading1: 26,
  heading2: 20,
  body: 14,
  small: 12,
  footer: 10,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for risk level.
 */
function getRiskLevelColor(level: RiskLevel | null): { bg: ReturnType<typeof rgb>; text: ReturnType<typeof rgb> } {
  switch (level) {
    case 'high':
      return { bg: COLORS.riskHigh, text: COLORS.riskHighText };
    case 'medium':
      return { bg: COLORS.riskMedium, text: COLORS.riskMediumText };
    case 'low':
      return { bg: COLORS.riskLow, text: COLORS.riskLowText };
    default:
      return { bg: COLORS.white, text: COLORS.textLight };
  }
}

/**
 * Format a date for display in the document.
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
 * Truncate text to fit within a given width.
 */
function truncateText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string {
  let truncated = text;
  const ellipsis = '...';
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, fontSize);

  while (truncated.length > 0 && font.widthOfTextAtSize(truncated, fontSize) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  if (truncated !== text && truncated.length > 0) {
    // Make room for ellipsis
    while (truncated.length > 0 && font.widthOfTextAtSize(truncated + ellipsis, fontSize) > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + ellipsis;
  }

  return text;
}

/**
 * Wrap text into multiple lines that fit within a given width.
 */
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // Handle words that are too long
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        lines.push(truncateText(word, maxWidth, font, fontSize));
        currentLine = '';
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Draw a filled rectangle.
 */
function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: ReturnType<typeof rgb>,
  borderColor?: ReturnType<typeof rgb>
): void {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color,
    borderColor,
    borderWidth: borderColor ? 0.5 : 0,
  });
}

/**
 * Draw centered text.
 */
function drawCenteredText(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  fontSize: number,
  color: ReturnType<typeof rgb>
): void {
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const x = (PAGE.width - textWidth) / 2;
  page.drawText(text, { x, y, font, size: fontSize, color });
}

/**
 * Draw page footer with page numbers.
 */
function drawPageFooter(
  page: PDFPage,
  pageNumber: number,
  totalPages: number,
  font: PDFFont
): void {
  const footerY = PAGE.margin / 2;
  const text = `Page ${pageNumber} of ${totalPages}`;
  drawCenteredText(page, text, footerY, font, FONT_SIZE.footer, COLORS.textLight);

  // Draw separator line
  page.drawLine({
    start: { x: PAGE.margin, y: PAGE.margin - 10 },
    end: { x: PAGE.width - PAGE.margin, y: PAGE.margin - 10 },
    thickness: 0.5,
    color: COLORS.border,
  });
}

// ============================================================================
// Section Builders
// ============================================================================

interface DrawContext {
  doc: PDFDocument;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  };
  pages: PDFPage[];
  currentY: number;
}

/**
 * Add a new page to the document.
 */
function addPage(ctx: DrawContext): PDFPage {
  const page = ctx.doc.addPage([PAGE.width, PAGE.height]);
  ctx.pages.push(page);
  ctx.currentY = PAGE.height - PAGE.margin;
  return page;
}

/**
 * Get current page or add new one if needed.
 */
function getCurrentPage(ctx: DrawContext, neededHeight: number): PDFPage {
  if (ctx.pages.length === 0 || ctx.currentY - neededHeight < PAGE.margin) {
    return addPage(ctx);
  }
  return ctx.pages[ctx.pages.length - 1];
}

/**
 * Create the cover page.
 */
function createCoverPage(ctx: DrawContext, input: PdfGeneratorInput): void {
  const { analysis, project, parameters, fonts } = { ...input, fonts: ctx.fonts };
  const page = addPage(ctx);
  const title = parameters.customTitle ?? `HazOps Analysis Report: ${analysis.name}`;

  let y = PAGE.height - 150;

  // Title
  const titleLines = wrapText(title, PAGE.contentWidth, fonts.bold, FONT_SIZE.title);
  for (const line of titleLines) {
    drawCenteredText(page, line, y, fonts.bold, FONT_SIZE.title, COLORS.primary);
    y -= LINE_HEIGHT.title;
  }

  // Subtitle
  y -= 20;
  drawCenteredText(page, 'Hazard and Operability Study', y, fonts.regular, FONT_SIZE.subtitle, COLORS.secondary);
  y -= 60;

  // Project info
  drawCenteredText(page, `Project: ${project.name}`, y, fonts.bold, 12, COLORS.text);
  y -= 20;
  drawCenteredText(page, `Organization: ${project.organization}`, y, fonts.regular, 12, COLORS.text);
  y -= 40;

  // Document info
  drawCenteredText(page, `P&ID Document: ${analysis.documentName}`, y, fonts.regular, 11, COLORS.textLight);
  y -= 18;
  drawCenteredText(page, `Lead Analyst: ${analysis.leadAnalystName}`, y, fonts.regular, 11, COLORS.textLight);
  y -= 18;
  const statusText = analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1).replace('_', ' ');
  drawCenteredText(page, `Status: ${statusText}`, y, fonts.regular, 11, COLORS.textLight);
  y -= 40;

  // Dates
  drawCenteredText(page, `Created: ${formatDate(analysis.createdAt)}`, y, fonts.regular, 10, COLORS.textLight);
  y -= 16;
  drawCenteredText(page, `Report Generated: ${formatDate(new Date())}`, y, fonts.regular, 10, COLORS.textLight);

  // Mark that we should start new page for content
  ctx.currentY = PAGE.margin;
}

/**
 * Create the executive summary section.
 */
function createExecutiveSummary(ctx: DrawContext, input: PdfGeneratorInput): void {
  const { analysis, riskSummary, parameters, fonts } = { ...input, fonts: ctx.fonts };
  const page = addPage(ctx);
  let y = ctx.currentY;

  // Section heading
  page.drawText('Executive Summary', {
    x: PAGE.margin,
    y,
    font: fonts.bold,
    size: FONT_SIZE.heading1,
    color: COLORS.primary,
  });
  y -= LINE_HEIGHT.heading1 + 10;

  // Analysis overview
  const overviewText = `This HazOps analysis was conducted on ${analysis.documentName} to identify potential hazards and operability issues. The analysis examined ${analysis.totalNodes} nodes using standard guide words (NO, MORE, LESS, REVERSE, EARLY, LATE, OTHER THAN).`;
  const overviewLines = wrapText(overviewText, PAGE.contentWidth, fonts.regular, FONT_SIZE.body);
  for (const line of overviewLines) {
    page.drawText(line, { x: PAGE.margin, y, font: fonts.regular, size: FONT_SIZE.body, color: COLORS.text });
    y -= LINE_HEIGHT.body;
  }
  y -= 10;

  // Analysis progress
  const progressText = `Analysis Progress: ${analysis.analyzedNodes} of ${analysis.totalNodes} nodes analyzed (${analysis.totalEntries} total entries)`;
  page.drawText(progressText, { x: PAGE.margin, y, font: fonts.regular, size: FONT_SIZE.body, color: COLORS.text });
  y -= LINE_HEIGHT.body + 20;

  // Risk summary if available
  if (riskSummary && parameters.includeRiskMatrix !== false) {
    page.drawText('Risk Distribution', {
      x: PAGE.margin,
      y,
      font: fonts.bold,
      size: FONT_SIZE.heading2,
      color: COLORS.secondary,
    });
    y -= LINE_HEIGHT.heading2 + 10;

    // Risk distribution table
    const tableX = PAGE.margin;
    const colWidths = [180, 100, 100];
    const rowHeight = 22;

    // Header row
    drawRect(page, tableX, y - rowHeight, colWidths[0], rowHeight, COLORS.headerBg, COLORS.border);
    drawRect(page, tableX + colWidths[0], y - rowHeight, colWidths[1], rowHeight, COLORS.headerBg, COLORS.border);
    drawRect(page, tableX + colWidths[0] + colWidths[1], y - rowHeight, colWidths[2], rowHeight, COLORS.headerBg, COLORS.border);

    page.drawText('Risk Level', { x: tableX + 5, y: y - 15, font: fonts.bold, size: FONT_SIZE.small, color: COLORS.primary });
    page.drawText('Count', { x: tableX + colWidths[0] + 30, y: y - 15, font: fonts.bold, size: FONT_SIZE.small, color: COLORS.primary });
    page.drawText('Percentage', { x: tableX + colWidths[0] + colWidths[1] + 20, y: y - 15, font: fonts.bold, size: FONT_SIZE.small, color: COLORS.primary });
    y -= rowHeight;

    // Data rows
    const riskData = [
      { label: 'High Risk', count: analysis.highRiskCount, color: COLORS.riskHigh, textColor: COLORS.riskHighText },
      { label: 'Medium Risk', count: analysis.mediumRiskCount, color: COLORS.riskMedium, textColor: COLORS.riskMediumText },
      { label: 'Low Risk', count: analysis.lowRiskCount, color: COLORS.riskLow, textColor: COLORS.riskLowText },
    ];

    for (const risk of riskData) {
      drawRect(page, tableX, y - rowHeight, colWidths[0], rowHeight, risk.color, COLORS.border);
      drawRect(page, tableX + colWidths[0], y - rowHeight, colWidths[1], rowHeight, risk.color, COLORS.border);
      drawRect(page, tableX + colWidths[0] + colWidths[1], y - rowHeight, colWidths[2], rowHeight, risk.color, COLORS.border);

      page.drawText(risk.label, { x: tableX + 5, y: y - 15, font: fonts.bold, size: FONT_SIZE.small, color: risk.textColor });
      page.drawText(String(risk.count), { x: tableX + colWidths[0] + 40, y: y - 15, font: fonts.regular, size: FONT_SIZE.small, color: COLORS.text });

      const percentage = riskSummary.assessedEntries > 0
        ? `${((risk.count / riskSummary.assessedEntries) * 100).toFixed(1)}%`
        : 'N/A';
      page.drawText(percentage, { x: tableX + colWidths[0] + colWidths[1] + 30, y: y - 15, font: fonts.regular, size: FONT_SIZE.small, color: COLORS.text });
      y -= rowHeight;
    }

    // Statistical summary
    if (riskSummary.averageRiskScore !== null) {
      y -= 15;
      const statsText = `Average Risk Score: ${riskSummary.averageRiskScore.toFixed(1)} | Maximum Risk Score: ${riskSummary.maxRiskScore ?? 'N/A'}`;
      page.drawText(statsText, { x: PAGE.margin, y, font: fonts.regular, size: FONT_SIZE.small, color: COLORS.textLight });
    }
  }

  ctx.currentY = y;
}

/**
 * Create the analysis entries section.
 */
function createAnalysisEntriesSection(ctx: DrawContext, input: PdfGeneratorInput): void {
  const { entries, nodes, parameters, fonts } = { ...input, fonts: ctx.fonts };

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

  // Start new page for entries
  let page = addPage(ctx);
  let y = ctx.currentY;

  // Section heading
  page.drawText('Analysis Entries', {
    x: PAGE.margin,
    y,
    font: fonts.bold,
    size: FONT_SIZE.heading1,
    color: COLORS.primary,
  });
  y -= LINE_HEIGHT.heading1 + 10;

  if (filteredEntries.length === 0) {
    page.drawText('No analysis entries match the specified filters.', {
      x: PAGE.margin,
      y,
      font: fonts.regular,
      size: FONT_SIZE.body,
      color: COLORS.textLight,
    });
    ctx.currentY = y;
    return;
  }

  // Group entries by node
  const entriesByNode = new Map<string, AnalysisEntry[]>();
  for (const entry of filteredEntries) {
    const nodeEntries = entriesByNode.get(entry.nodeId) ?? [];
    nodeEntries.push(entry);
    entriesByNode.set(entry.nodeId, nodeEntries);
  }

  // Table column widths
  const colWidths = [55, 55, 80, 90, 90, 50];
  const rowHeight = 24;

  for (const [nodeId, nodeEntries] of entriesByNode) {
    const node = nodes.get(nodeId);
    const nodeIdentifier = node?.nodeId ?? 'Unknown Node';
    const nodeDescription = node?.description ?? '';
    const equipmentType = node?.equipmentType
      ? EQUIPMENT_TYPE_LABELS[node.equipmentType as keyof typeof EQUIPMENT_TYPE_LABELS] ?? node.equipmentType
      : 'Unknown';

    // Check if we need a new page for node header + at least one entry row
    const neededHeight = LINE_HEIGHT.heading2 + LINE_HEIGHT.body + rowHeight * 2 + 40;
    if (y - neededHeight < PAGE.margin) {
      page = addPage(ctx);
      y = ctx.currentY;
    }

    // Node header
    y -= 20;
    page.drawText(`Node: ${nodeIdentifier} - ${truncateText(nodeDescription, 350, fonts.bold, FONT_SIZE.heading2)}`, {
      x: PAGE.margin,
      y,
      font: fonts.bold,
      size: FONT_SIZE.heading2,
      color: COLORS.secondary,
    });
    y -= LINE_HEIGHT.heading2;

    page.drawText(`Equipment Type: ${equipmentType}`, {
      x: PAGE.margin,
      y,
      font: fonts.regular,
      size: FONT_SIZE.small,
      color: COLORS.textLight,
    });
    y -= LINE_HEIGHT.body + 10;

    // Table header
    const tableX = PAGE.margin;
    const headers = ['Guide Word', 'Parameter', 'Deviation', 'Causes', 'Consequences', 'Risk'];

    // Draw header row
    let x = tableX;
    for (let i = 0; i < headers.length; i++) {
      drawRect(page, x, y - rowHeight, colWidths[i], rowHeight, COLORS.headerBg, COLORS.border);
      const headerText = truncateText(headers[i], colWidths[i] - 6, fonts.bold, FONT_SIZE.small);
      page.drawText(headerText, { x: x + 3, y: y - 16, font: fonts.bold, size: FONT_SIZE.small, color: COLORS.primary });
      x += colWidths[i];
    }
    y -= rowHeight;

    // Data rows
    for (const entry of nodeEntries) {
      // Check if we need a new page
      if (y - rowHeight < PAGE.margin) {
        page = addPage(ctx);
        y = ctx.currentY;

        // Redraw header on new page
        x = tableX;
        for (let i = 0; i < headers.length; i++) {
          drawRect(page, x, y - rowHeight, colWidths[i], rowHeight, COLORS.headerBg, COLORS.border);
          const headerText = truncateText(headers[i], colWidths[i] - 6, fonts.bold, FONT_SIZE.small);
          page.drawText(headerText, { x: x + 3, y: y - 16, font: fonts.bold, size: FONT_SIZE.small, color: COLORS.primary });
          x += colWidths[i];
        }
        y -= rowHeight;
      }

      const guideWordLabel = GUIDE_WORD_LABELS[entry.guideWord as GuideWord] ?? entry.guideWord;
      const causesText = entry.causes.length > 0 ? entry.causes.join('; ') : '-';
      const consequencesText = entry.consequences.length > 0 ? entry.consequences.join('; ') : '-';
      const riskColors = getRiskLevelColor(entry.riskRanking?.riskLevel ?? null);
      const riskText = entry.riskRanking
        ? `${RISK_LEVEL_LABELS[entry.riskRanking.riskLevel]} (${entry.riskRanking.riskScore})`
        : 'N/A';

      const rowData = [
        guideWordLabel,
        entry.parameter,
        entry.deviation,
        causesText,
        consequencesText,
        riskText,
      ];

      x = tableX;
      for (let i = 0; i < rowData.length; i++) {
        const bgColor = i === 5 && entry.riskRanking ? riskColors.bg : COLORS.white;
        const textColor = i === 5 && entry.riskRanking ? riskColors.text : COLORS.text;

        drawRect(page, x, y - rowHeight, colWidths[i], rowHeight, bgColor, COLORS.border);
        const cellText = truncateText(rowData[i], colWidths[i] - 6, fonts.regular, FONT_SIZE.small);
        page.drawText(cellText, { x: x + 3, y: y - 16, font: fonts.regular, size: FONT_SIZE.small, color: textColor });
        x += colWidths[i];
      }
      y -= rowHeight;
    }

    // Add safeguards and recommendations if enabled
    if (parameters.includeRecommendations !== false) {
      for (const entry of nodeEntries) {
        if (entry.safeguards.length > 0 || entry.recommendations.length > 0) {
          if (y - 40 < PAGE.margin) {
            page = addPage(ctx);
            y = ctx.currentY;
          }

          const guideWordLabel = GUIDE_WORD_LABELS[entry.guideWord as GuideWord] ?? entry.guideWord;
          y -= 10;

          page.drawText(`${guideWordLabel} - ${entry.parameter}:`, {
            x: PAGE.margin + 10,
            y,
            font: fonts.bold,
            size: FONT_SIZE.small,
            color: COLORS.text,
          });
          y -= LINE_HEIGHT.small;

          if (entry.safeguards.length > 0) {
            const safeguardsText = `Safeguards: ${entry.safeguards.join('; ')}`;
            const safeguardsLines = wrapText(safeguardsText, PAGE.contentWidth - 20, fonts.regular, FONT_SIZE.small);
            for (const line of safeguardsLines) {
              page.drawText(line, { x: PAGE.margin + 15, y, font: fonts.regular, size: FONT_SIZE.small, color: COLORS.text });
              y -= LINE_HEIGHT.small;
            }
          }

          if (entry.recommendations.length > 0) {
            const recsText = `Recommendations: ${entry.recommendations.join('; ')}`;
            const recsLines = wrapText(recsText, PAGE.contentWidth - 20, fonts.regular, FONT_SIZE.small);
            for (const line of recsLines) {
              page.drawText(line, { x: PAGE.margin + 15, y, font: fonts.regular, size: FONT_SIZE.small, color: COLORS.text });
              y -= LINE_HEIGHT.small;
            }
          }
        }
      }
    }

    // Add notes if enabled
    if (parameters.includeNotes !== false) {
      for (const entry of nodeEntries) {
        if (entry.notes) {
          if (y - 30 < PAGE.margin) {
            page = addPage(ctx);
            y = ctx.currentY;
          }

          const guideWordLabel = GUIDE_WORD_LABELS[entry.guideWord as GuideWord] ?? entry.guideWord;
          y -= 5;

          const noteText = `Note (${guideWordLabel} - ${entry.parameter}): ${entry.notes}`;
          const noteLines = wrapText(noteText, PAGE.contentWidth - 20, fonts.regular, FONT_SIZE.small);
          for (const line of noteLines) {
            page.drawText(line, { x: PAGE.margin + 10, y, font: fonts.regular, size: FONT_SIZE.small, color: COLORS.textLight });
            y -= LINE_HEIGHT.small;
          }
        }
      }
    }
  }

  ctx.currentY = y;
}

/**
 * Create the compliance status section.
 */
function createComplianceSection(ctx: DrawContext, input: PdfGeneratorInput): void {
  const { complianceData, parameters, fonts } = { ...input, fonts: ctx.fonts };

  if (!parameters.includeCompliance || !complianceData) {
    return;
  }

  // Start new page for compliance
  let page = addPage(ctx);
  let y = ctx.currentY;

  // Section heading
  page.drawText('Regulatory Compliance Status', {
    x: PAGE.margin,
    y,
    font: fonts.bold,
    size: FONT_SIZE.heading1,
    color: COLORS.primary,
  });
  y -= LINE_HEIGHT.heading1 + 10;

  // Overall status
  const statusColors: Record<string, { bg: ReturnType<typeof rgb>; text: ReturnType<typeof rgb> }> = {
    compliant: { bg: COLORS.riskLow, text: COLORS.riskLowText },
    non_compliant: { bg: COLORS.riskHigh, text: COLORS.riskHighText },
    partial: { bg: COLORS.riskMedium, text: COLORS.riskMediumText },
  };

  const overallStatusLabel =
    complianceData.overallStatus === 'compliant'
      ? 'Compliant'
      : complianceData.overallStatus === 'non_compliant'
        ? 'Non-Compliant'
        : 'Partially Compliant';

  const statusColor = statusColors[complianceData.overallStatus]?.text ?? COLORS.text;

  page.drawText('Overall Compliance Status: ', {
    x: PAGE.margin,
    y,
    font: fonts.bold,
    size: 12,
    color: COLORS.text,
  });

  const labelWidth = fonts.bold.widthOfTextAtSize('Overall Compliance Status: ', 12);
  page.drawText(overallStatusLabel, {
    x: PAGE.margin + labelWidth,
    y,
    font: fonts.bold,
    size: 12,
    color: statusColor,
  });
  y -= 30;

  // Standards table
  if (complianceData.standards.length > 0) {
    const colWidths = [140, 80, 50, 150];
    const rowHeight = 22;
    const tableX = PAGE.margin;
    const headers = ['Standard', 'Status', 'Gaps', 'Key Recommendations'];

    // Header row
    let x = tableX;
    for (let i = 0; i < headers.length; i++) {
      drawRect(page, x, y - rowHeight, colWidths[i], rowHeight, COLORS.headerBg, COLORS.border);
      page.drawText(headers[i], { x: x + 3, y: y - 15, font: fonts.bold, size: FONT_SIZE.small, color: COLORS.primary });
      x += colWidths[i];
    }
    y -= rowHeight;

    // Data rows
    for (const standard of complianceData.standards) {
      if (y - rowHeight < PAGE.margin) {
        page = addPage(ctx);
        y = ctx.currentY;

        // Redraw header
        x = tableX;
        for (let i = 0; i < headers.length; i++) {
          drawRect(page, x, y - rowHeight, colWidths[i], rowHeight, COLORS.headerBg, COLORS.border);
          page.drawText(headers[i], { x: x + 3, y: y - 15, font: fonts.bold, size: FONT_SIZE.small, color: COLORS.primary });
          x += colWidths[i];
        }
        y -= rowHeight;
      }

      const statusLabel =
        standard.status === 'compliant'
          ? 'Compliant'
          : standard.status === 'non_compliant'
            ? 'Non-Compliant'
            : standard.status === 'partial'
              ? 'Partial'
              : 'N/A';

      const colors = statusColors[standard.status] ?? { bg: COLORS.white, text: COLORS.textLight };
      const recsText = standard.recommendations.length > 0
        ? standard.recommendations.slice(0, 2).join('; ')
        : '-';

      x = tableX;
      // Standard name
      drawRect(page, x, y - rowHeight, colWidths[0], rowHeight, COLORS.white, COLORS.border);
      page.drawText(truncateText(standard.standardName, colWidths[0] - 6, fonts.bold, FONT_SIZE.small), {
        x: x + 3,
        y: y - 15,
        font: fonts.bold,
        size: FONT_SIZE.small,
        color: COLORS.text,
      });
      x += colWidths[0];

      // Status
      drawRect(page, x, y - rowHeight, colWidths[1], rowHeight, colors.bg, COLORS.border);
      page.drawText(statusLabel, { x: x + 3, y: y - 15, font: fonts.regular, size: FONT_SIZE.small, color: colors.text });
      x += colWidths[1];

      // Gaps
      drawRect(page, x, y - rowHeight, colWidths[2], rowHeight, COLORS.white, COLORS.border);
      page.drawText(String(standard.gapsCount), { x: x + 15, y: y - 15, font: fonts.regular, size: FONT_SIZE.small, color: COLORS.text });
      x += colWidths[2];

      // Recommendations
      drawRect(page, x, y - rowHeight, colWidths[3], rowHeight, COLORS.white, COLORS.border);
      page.drawText(truncateText(recsText, colWidths[3] - 6, fonts.regular, FONT_SIZE.small), {
        x: x + 3,
        y: y - 15,
        font: fonts.regular,
        size: FONT_SIZE.small,
        color: COLORS.text,
      });

      y -= rowHeight;
    }
  }

  ctx.currentY = y;
}

/**
 * Create the recommendations summary section.
 */
function createRecommendationsSummary(ctx: DrawContext, input: PdfGeneratorInput): void {
  const { entries, nodes, parameters, fonts } = { ...input, fonts: ctx.fonts };

  if (parameters.includeRecommendations === false) {
    return;
  }

  // Collect all recommendations
  const allRecommendations: Array<{
    nodeId: string;
    nodeIdentifier: string;
    guideWord: string;
    parameter: string;
    recommendation: string;
    riskLevel: RiskLevel | null;
  }> = [];

  for (const entry of entries) {
    const node = nodes.get(entry.nodeId);
    for (const recommendation of entry.recommendations) {
      allRecommendations.push({
        nodeId: entry.nodeId,
        nodeIdentifier: node?.nodeId ?? 'Unknown',
        guideWord: GUIDE_WORD_LABELS[entry.guideWord as GuideWord] ?? entry.guideWord,
        parameter: entry.parameter,
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

  // Start new page
  let page = addPage(ctx);
  let y = ctx.currentY;

  // Section heading
  page.drawText('Recommendations Summary', {
    x: PAGE.margin,
    y,
    font: fonts.bold,
    size: FONT_SIZE.heading1,
    color: COLORS.primary,
  });
  y -= LINE_HEIGHT.heading1 + 5;

  page.drawText(`Total Recommendations: ${allRecommendations.length}`, {
    x: PAGE.margin,
    y,
    font: fonts.regular,
    size: FONT_SIZE.body,
    color: COLORS.text,
  });
  y -= LINE_HEIGHT.body + 15;

  // Table
  const colWidths = [25, 60, 90, 200, 45];
  const rowHeight = 22;
  const tableX = PAGE.margin;
  const headers = ['#', 'Node', 'Context', 'Recommendation', 'Risk'];

  // Header row
  let x = tableX;
  for (let i = 0; i < headers.length; i++) {
    drawRect(page, x, y - rowHeight, colWidths[i], rowHeight, COLORS.headerBg, COLORS.border);
    page.drawText(headers[i], { x: x + 3, y: y - 15, font: fonts.bold, size: FONT_SIZE.small, color: COLORS.primary });
    x += colWidths[i];
  }
  y -= rowHeight;

  // Data rows
  allRecommendations.forEach((rec, index) => {
    if (y - rowHeight < PAGE.margin) {
      page = addPage(ctx);
      y = ctx.currentY;

      // Redraw header
      x = tableX;
      for (let i = 0; i < headers.length; i++) {
        drawRect(page, x, y - rowHeight, colWidths[i], rowHeight, COLORS.headerBg, COLORS.border);
        page.drawText(headers[i], { x: x + 3, y: y - 15, font: fonts.bold, size: FONT_SIZE.small, color: COLORS.primary });
        x += colWidths[i];
      }
      y -= rowHeight;
    }

    const riskColors = getRiskLevelColor(rec.riskLevel);
    const riskText = rec.riskLevel ? RISK_LEVEL_LABELS[rec.riskLevel] : 'N/A';
    const contextText = `${rec.guideWord} - ${rec.parameter}`;

    const rowData = [
      String(index + 1),
      rec.nodeIdentifier,
      contextText,
      rec.recommendation,
      riskText,
    ];

    x = tableX;
    for (let i = 0; i < rowData.length; i++) {
      const bgColor = i === 4 && rec.riskLevel ? riskColors.bg : COLORS.white;
      const textColor = i === 4 && rec.riskLevel ? riskColors.text : (i === 1 ? COLORS.text : COLORS.text);
      const fontToUse = i === 1 ? fonts.bold : fonts.regular;

      drawRect(page, x, y - rowHeight, colWidths[i], rowHeight, bgColor, COLORS.border);
      const cellText = truncateText(rowData[i], colWidths[i] - 6, fontToUse, FONT_SIZE.small);
      page.drawText(cellText, { x: x + 3, y: y - 15, font: fontToUse, size: FONT_SIZE.small, color: textColor });
      x += colWidths[i];
    }
    y -= rowHeight;
  });

  ctx.currentY = y;
}

/**
 * Add footer content and end marker.
 */
function createFooterContent(ctx: DrawContext, input: PdfGeneratorInput): void {
  const { parameters, fonts } = { ...input, fonts: ctx.fonts };
  let page = ctx.pages[ctx.pages.length - 1];
  let y = ctx.currentY;

  // Custom footer if specified
  if (parameters.customFooter) {
    if (y - 50 < PAGE.margin) {
      page = addPage(ctx);
      y = ctx.currentY;
    }

    y -= 30;
    const footerLines = wrapText(parameters.customFooter, PAGE.contentWidth, fonts.regular, FONT_SIZE.small);
    for (const line of footerLines) {
      drawCenteredText(page, line, y, fonts.regular, FONT_SIZE.small, COLORS.textLight);
      y -= LINE_HEIGHT.small;
    }
  }

  // End marker
  y -= 30;
  drawCenteredText(page, '--- End of Report ---', y, fonts.regular, FONT_SIZE.small, COLORS.textLight);

  ctx.currentY = y;
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generate a PDF document from HazOps analysis data.
 *
 * @param input - Input data for document generation
 * @returns Generated document as Buffer with metadata
 */
export async function generatePdfDocument(
  input: PdfGeneratorInput
): Promise<PdfGeneratorResult> {
  const { analysis, parameters } = input;

  // Create PDF document
  const doc = await PDFDocument.create();

  // Set metadata
  const title = parameters.customTitle ?? `HazOps Analysis Report: ${analysis.name}`;
  doc.setTitle(title);
  doc.setSubject(`HazOps Analysis Report for ${analysis.name}`);
  doc.setCreator('HazOp Assistant');
  doc.setProducer('HazOp Assistant - pdf-lib');
  doc.setCreationDate(new Date());

  // Embed fonts
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Create drawing context
  const ctx: DrawContext = {
    doc,
    fonts: { regular: regularFont, bold: boldFont },
    pages: [],
    currentY: PAGE.height - PAGE.margin,
  };

  // Build document sections
  createCoverPage(ctx, input);
  createExecutiveSummary(ctx, input);
  createAnalysisEntriesSection(ctx, input);
  createComplianceSection(ctx, input);
  createRecommendationsSummary(ctx, input);
  createFooterContent(ctx, input);

  // Add page footers with page numbers
  const totalPages = ctx.pages.length;
  for (let i = 0; i < totalPages; i++) {
    drawPageFooter(ctx.pages[i], i + 1, totalPages, regularFont);
  }

  // Generate buffer
  const pdfBytes = await doc.save();

  // Generate filename
  const sanitizedName = analysis.name
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `HazOps_Report_${sanitizedName}_${timestamp}.pdf`;

  return {
    buffer: Buffer.from(pdfBytes),
    mimeType: 'application/pdf',
    filename,
  };
}
