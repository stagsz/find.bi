/**
 * Report preview component.
 *
 * Displays detailed information about a generated report including:
 * - Metadata: name, analysis, project, format, status, timestamps
 * - Generation parameters: included sections, filters, custom content
 * - Progress indicator for pending/generating reports
 * - Error details for failed reports
 * - Download action for completed reports
 *
 * Designed for use in modals, side panels, or dedicated detail views.
 */

import { Button, Alert, Divider } from '@mantine/core';
import { ReportProgressIndicator } from './ReportProgressIndicator';
import type {
  ReportWithDetails,
  ReportFormat,
  ReportStatus,
  ReportParameters,
} from '@hazop/types';
import {
  REPORT_FORMAT_LABELS,
  REPORT_FORMAT_EXTENSIONS,
} from '@hazop/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the ReportPreview component.
 */
export interface ReportPreviewProps {
  /** The report to display */
  report: ReportWithDetails;

  /** Progress percentage for generating reports */
  progress?: number;

  /** Optional callback when download is requested */
  onDownload?: (reportId: string) => void;

  /** Optional callback when close/dismiss is requested */
  onClose?: () => void;

  /** Whether to show action buttons (download, close) */
  showActions?: boolean;

  /** Optional className for additional styling */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Status colors for report status badges.
 */
const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  generating: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

/**
 * Status labels for display.
 */
const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending',
  generating: 'Generating',
  completed: 'Completed',
  failed: 'Failed',
};

/**
 * Format colors for format badges.
 */
const FORMAT_COLORS: Record<ReportFormat, string> = {
  pdf: 'bg-red-50 text-red-700 border-red-200',
  word: 'bg-blue-50 text-blue-700 border-blue-200',
  excel: 'bg-green-50 text-green-700 border-green-200',
  powerpoint: 'bg-orange-50 text-orange-700 border-orange-200',
};

/**
 * Format icons (abbreviations).
 */
const FORMAT_ICONS: Record<ReportFormat, string> = {
  pdf: 'PDF',
  word: 'DOC',
  excel: 'XLS',
  powerpoint: 'PPT',
};

/**
 * Parameter labels for display.
 */
const PARAMETER_LABELS: Record<keyof ReportParameters, string> = {
  includeRiskMatrix: 'Risk Matrix',
  includeCompliance: 'Compliance Results',
  includeLopa: 'LOPA Analysis',
  includePidImages: 'P&ID Images',
  includeNodeCoordinates: 'Node Coordinates',
  includeNotes: 'Notes',
  includeRecommendations: 'Recommendations',
  riskLevelFilter: 'Risk Level Filter',
  nodeFilter: 'Node Filter',
  customTitle: 'Custom Title',
  customFooter: 'Custom Footer',
};

/**
 * Risk level labels for display.
 */
const RISK_LEVEL_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format date for display.
 */
function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Get included sections from parameters.
 */
function getIncludedSections(parameters: ReportParameters): string[] {
  const sections: string[] = [];
  const includeKeys: (keyof ReportParameters)[] = [
    'includeRiskMatrix',
    'includeCompliance',
    'includeLopa',
    'includePidImages',
    'includeNodeCoordinates',
    'includeNotes',
    'includeRecommendations',
  ];

  for (const key of includeKeys) {
    if (parameters[key] === true) {
      sections.push(PARAMETER_LABELS[key]);
    }
  }

  return sections;
}

/**
 * Get excluded sections from parameters.
 */
function getExcludedSections(parameters: ReportParameters): string[] {
  const sections: string[] = [];
  const includeKeys: (keyof ReportParameters)[] = [
    'includeRiskMatrix',
    'includeCompliance',
    'includeLopa',
    'includePidImages',
    'includeNodeCoordinates',
    'includeNotes',
    'includeRecommendations',
  ];

  for (const key of includeKeys) {
    if (parameters[key] === false) {
      sections.push(PARAMETER_LABELS[key]);
    }
  }

  return sections;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Format badge component.
 */
interface FormatBadgeProps {
  format: ReportFormat;
  showLabel?: boolean;
}

function FormatBadge({ format, showLabel = false }: FormatBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${FORMAT_COLORS[format]}`}
    >
      {FORMAT_ICONS[format]}
      {showLabel && <span className="ml-1">{REPORT_FORMAT_LABELS[format]}</span>}
    </span>
  );
}

/**
 * Status badge component.
 */
interface StatusBadgeProps {
  status: ReportStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Metadata row component.
 */
interface MetadataRowProps {
  label: string;
  value: React.ReactNode;
}

function MetadataRow({ label, value }: MetadataRowProps) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900 font-medium text-right">{value}</span>
    </div>
  );
}

/**
 * Section header component.
 */
interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
      {title}
    </h4>
  );
}

/**
 * Check/cross indicator component.
 */
interface IndicatorProps {
  enabled: boolean;
  label: string;
}

function Indicator({ enabled, label }: IndicatorProps) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span
        className={`w-4 h-4 flex items-center justify-center rounded-full text-xs ${
          enabled
            ? 'bg-green-100 text-green-600'
            : 'bg-slate-100 text-slate-400'
        }`}
      >
        {enabled ? '✓' : '−'}
      </span>
      <span className={`text-sm ${enabled ? 'text-slate-700' : 'text-slate-400'}`}>
        {label}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ReportPreview component.
 *
 * Provides a detailed view of report information including metadata,
 * generation parameters, progress, and actions.
 */
export function ReportPreview({
  report,
  progress,
  onDownload,
  onClose,
  showActions = true,
  className = '',
}: ReportPreviewProps) {
  const parameters = report.parameters || {};
  const includedSections = getIncludedSections(parameters);
  const hasFilters =
    (parameters.riskLevelFilter && parameters.riskLevelFilter.length > 0) ||
    (parameters.nodeFilter && parameters.nodeFilter.length > 0);
  const hasCustomContent = parameters.customTitle || parameters.customFooter;

  const isInProgress = report.status === 'pending' || report.status === 'generating';
  const isFailed = report.status === 'failed';
  const isCompleted = report.status === 'completed';

  return (
    <div className={`bg-white border border-slate-200 rounded ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-slate-900">{report.name}</h3>
          <div className="flex items-center gap-2">
            <FormatBadge format={report.format} />
            <StatusBadge status={report.status} />
          </div>
        </div>
        <p className="text-sm text-slate-500">
          {report.projectName} / {report.analysisName}
        </p>
      </div>

      {/* Progress indicator for pending/generating */}
      {isInProgress && (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <ReportProgressIndicator
            status={report.status}
            progress={progress}
            size="md"
            showMessage={true}
          />
        </div>
      )}

      {/* Error display for failed reports */}
      {isFailed && report.errorMessage && (
        <div className="px-4 py-3 border-b border-slate-100">
          <Alert color="red" variant="light" title="Generation Failed">
            {report.errorMessage}
          </Alert>
        </div>
      )}

      {/* Content sections */}
      <div className="p-4 space-y-4">
        {/* Report Metadata */}
        <div>
          <SectionHeader title="Report Details" />
          <div className="bg-slate-50 rounded p-3 divide-y divide-slate-100">
            <MetadataRow
              label="Format"
              value={
                <span className="flex items-center gap-2">
                  {REPORT_FORMAT_LABELS[report.format]}
                  <span className="text-xs text-slate-400">
                    ({REPORT_FORMAT_EXTENSIONS[report.format]})
                  </span>
                </span>
              }
            />
            <MetadataRow label="Template" value={report.templateUsed} />
            <MetadataRow label="Requested" value={formatDate(report.requestedAt)} />
            {isCompleted && (
              <>
                <MetadataRow label="Completed" value={formatDate(report.generatedAt)} />
                <MetadataRow label="File Size" value={formatFileSize(report.fileSize)} />
              </>
            )}
            <MetadataRow
              label="Generated By"
              value={
                <span>
                  {report.generatedByName}
                  <span className="text-slate-400 text-xs ml-1">
                    ({report.generatedByEmail})
                  </span>
                </span>
              }
            />
          </div>
        </div>

        <Divider />

        {/* Included Content */}
        <div>
          <SectionHeader title="Included Content" />
          <div className="grid grid-cols-2 gap-x-4">
            <Indicator
              enabled={parameters.includeRiskMatrix !== false}
              label="Risk Matrix"
            />
            <Indicator
              enabled={parameters.includeCompliance !== false}
              label="Compliance Results"
            />
            <Indicator
              enabled={parameters.includeLopa !== false}
              label="LOPA Analysis"
            />
            <Indicator
              enabled={parameters.includePidImages !== false}
              label="P&ID Images"
            />
            <Indicator
              enabled={parameters.includeNodeCoordinates === true}
              label="Node Coordinates"
            />
            <Indicator
              enabled={parameters.includeNotes !== false}
              label="Notes"
            />
            <Indicator
              enabled={parameters.includeRecommendations !== false}
              label="Recommendations"
            />
          </div>
        </div>

        {/* Applied Filters */}
        {hasFilters && (
          <>
            <Divider />
            <div>
              <SectionHeader title="Applied Filters" />
              <div className="space-y-2">
                {parameters.riskLevelFilter && parameters.riskLevelFilter.length > 0 && (
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Risk Levels:</span>
                    <div className="flex flex-wrap gap-1">
                      {parameters.riskLevelFilter.map((level) => (
                        <span
                          key={level}
                          className={`px-2 py-0.5 text-xs rounded ${
                            level === 'high'
                              ? 'bg-red-100 text-red-700'
                              : level === 'medium'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {RISK_LEVEL_LABELS[level]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {parameters.nodeFilter && parameters.nodeFilter.length > 0 && (
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">
                      Nodes ({parameters.nodeFilter.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {parameters.nodeFilter.slice(0, 5).map((nodeId) => (
                        <span
                          key={nodeId}
                          className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
                        >
                          {nodeId}
                        </span>
                      ))}
                      {parameters.nodeFilter.length > 5 && (
                        <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                          +{parameters.nodeFilter.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Custom Content */}
        {hasCustomContent && (
          <>
            <Divider />
            <div>
              <SectionHeader title="Custom Content" />
              <div className="space-y-2">
                {parameters.customTitle && (
                  <div>
                    <span className="text-xs text-slate-500 block">Custom Title:</span>
                    <span className="text-sm text-slate-700">{parameters.customTitle}</span>
                  </div>
                )}
                {parameters.customFooter && (
                  <div>
                    <span className="text-xs text-slate-500 block">Custom Footer:</span>
                    <span className="text-sm text-slate-700">{parameters.customFooter}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          {onClose && (
            <Button variant="subtle" color="gray" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
          {isCompleted && onDownload && (
            <Button size="sm" onClick={() => onDownload(report.id)}>
              Download Report
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
