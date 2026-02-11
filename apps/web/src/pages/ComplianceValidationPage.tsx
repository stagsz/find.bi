/**
 * Compliance Validation Page.
 *
 * Displays regulatory compliance status for a project or analysis with:
 * - Overall compliance status with percentage gauge
 * - Standard-by-standard checklist view
 * - Breakdown counts per standard
 * - Compliance status badges with color coding
 *
 * Can be used at both project level and analysis level via query params.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { Button, Alert, Loader, MultiSelect, Checkbox } from '@mantine/core';
import { useAuthStore, selectUser } from '../store/auth.store';
import { authService } from '../services/auth.service';
import {
  complianceService,
  type ProjectComplianceStatus,
  type AnalysisComplianceStatus,
} from '../services/compliance.service';
import type { ApiError, RegulatoryStandardId, ComplianceStatus, StandardComplianceSummary } from '@hazop/types';
import {
  REGULATORY_STANDARD_IDS,
  REGULATORY_STANDARD_NAMES,
  REGULATORY_STANDARD_TITLES,
  REGULATORY_STANDARD_JURISDICTIONS,
  REGULATORY_JURISDICTION_LABELS,
  COMPLIANCE_STATUS_LABELS,
  COMPLIANCE_STATUS_COLORS,
} from '@hazop/types';

/**
 * Colors for compliance status display.
 */
const STATUS_STYLES: Record<ComplianceStatus, { bg: string; text: string; border: string }> = {
  compliant: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
  },
  partially_compliant: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  non_compliant: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
  },
  not_applicable: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
  },
  not_assessed: {
    bg: 'bg-slate-50',
    text: 'text-slate-400',
    border: 'border-slate-200',
  },
};

/**
 * Icons for compliance status display.
 */
const StatusIcons: Record<ComplianceStatus, React.ReactNode> = {
  compliant: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-600">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  ),
  partially_compliant: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-600">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  non_compliant: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-600">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  ),
  not_applicable: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-400">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-4a1 1 0 10-2 0v4zm1 4a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  not_assessed: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-300">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3a1 1 0 00.293.707l2 2a1 1 0 001.414-1.414L11 9.586V7z" clipRule="evenodd" />
    </svg>
  ),
};

/**
 * Compliance status badge component.
 */
interface ComplianceStatusBadgeProps {
  status: ComplianceStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

function ComplianceStatusBadge({ status, size = 'md', showIcon = true }: ComplianceStatusBadgeProps) {
  const styles = STATUS_STYLES[status];
  const label = COMPLIANCE_STATUS_LABELS[status];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  return (
    <span className={`inline-flex items-center rounded font-medium border ${styles.bg} ${styles.text} ${styles.border} ${sizeClasses[size]}`}>
      {showIcon && <span className="flex-shrink-0">{StatusIcons[status]}</span>}
      <span>{label}</span>
    </span>
  );
}

/**
 * Circular progress gauge for compliance percentage.
 */
interface ComplianceGaugeProps {
  percentage: number;
  status: ComplianceStatus;
  size?: 'sm' | 'md' | 'lg';
}

function ComplianceGauge({ percentage, status, size = 'md' }: ComplianceGaugeProps) {
  const sizes = {
    sm: { outer: 80, stroke: 8 },
    md: { outer: 120, stroke: 10 },
    lg: { outer: 160, stroke: 12 },
  };

  const { outer, stroke } = sizes[size];
  const radius = (outer - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(percentage, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  // Determine color based on status
  const statusColor = COMPLIANCE_STATUS_COLORS[status];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: outer, height: outer }}>
      {/* Background circle */}
      <svg className="absolute transform -rotate-90" width={outer} height={outer}>
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        {/* Progress circle */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke={statusColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      {/* Percentage text */}
      <div className="text-center">
        <div className={`font-semibold ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-xl' : 'text-lg'}`} style={{ color: statusColor }}>
          {percentage.toFixed(0)}%
        </div>
        <div className={`text-slate-500 ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>Compliant</div>
      </div>
    </div>
  );
}

/**
 * Standard compliance checklist row component.
 */
interface StandardChecklistRowProps {
  summary: StandardComplianceSummary;
  expanded: boolean;
  onToggle: () => void;
}

function StandardChecklistRow({ summary, expanded, onToggle }: StandardChecklistRowProps) {
  const styles = STATUS_STYLES[summary.overallStatus];
  const jurisdiction = REGULATORY_STANDARD_JURISDICTIONS[summary.standardId];
  const jurisdictionLabel = REGULATORY_JURISDICTION_LABELS[jurisdiction];
  const standardTitle = REGULATORY_STANDARD_TITLES[summary.standardId];

  return (
    <div className={`border ${styles.border} rounded mb-2 overflow-hidden`}>
      {/* Header row */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${styles.bg} hover:opacity-90`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="flex-shrink-0">{StatusIcons[summary.overallStatus]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${styles.text}`}>{summary.standardName}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/50 text-slate-600">
                {jurisdictionLabel}
              </span>
            </div>
            {!expanded && (
              <div className="text-xs text-slate-500 truncate mt-0.5">{standardTitle}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Compliance percentage */}
          <div className="text-right">
            <div className={`text-lg font-semibold ${styles.text}`}>
              {summary.compliancePercentage.toFixed(0)}%
            </div>
          </div>

          {/* Expand/collapse icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="p-4 bg-white border-t border-slate-200">
          {/* Standard title */}
          <div className="text-sm text-slate-600 mb-4">{standardTitle}</div>

          {/* Breakdown counts */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
              <div className="text-lg font-semibold text-green-700">{summary.compliantCount}</div>
              <div className="text-xs text-green-600">Compliant</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
              <div className="text-lg font-semibold text-amber-700">{summary.partiallyCompliantCount}</div>
              <div className="text-xs text-amber-600">Partial</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
              <div className="text-lg font-semibold text-red-700">{summary.nonCompliantCount}</div>
              <div className="text-xs text-red-600">Non-Compliant</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
              <div className="text-lg font-semibold text-slate-600">{summary.notApplicableCount}</div>
              <div className="text-xs text-slate-500">N/A</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
              <div className="text-lg font-semibold text-slate-400">{summary.notAssessedCount}</div>
              <div className="text-xs text-slate-400">Not Assessed</div>
            </div>
          </div>

          {/* Total clauses */}
          <div className="flex items-center justify-between text-sm text-slate-500 pt-2 border-t border-slate-100">
            <span>Total clauses assessed: {summary.totalClauses}</span>
            <ComplianceStatusBadge status={summary.overallStatus} size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Stat card component.
 */
interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  className?: string;
}

function StatCard({ label, value, subValue, className = '' }: StatCardProps) {
  return (
    <div className={`p-4 border border-slate-200 rounded bg-white ${className}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      {subValue && <div className="text-xs text-slate-500 mt-1">{subValue}</div>}
    </div>
  );
}

/**
 * Format date for display.
 */
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Compliance Validation Page component.
 */
export function ComplianceValidationPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const analysisId = searchParams.get('analysisId');

  const currentUser = useAuthStore(selectUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Compliance state
  const [complianceStatus, setComplianceStatus] = useState<ProjectComplianceStatus | AnalysisComplianceStatus | null>(null);
  const [isLoadingCompliance, setIsLoadingCompliance] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Filter state
  const [selectedStandards, setSelectedStandards] = useState<string[]>([]);
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  // Standard options for filter
  const standardOptions = useMemo(() => {
    return REGULATORY_STANDARD_IDS.map((id) => ({
      value: id,
      label: REGULATORY_STANDARD_NAMES[id],
    }));
  }, []);

  /**
   * Fetch compliance status from the API.
   */
  const fetchCompliance = useCallback(async () => {
    if (!projectId) {
      setError({ code: 'NOT_FOUND', message: 'Project ID is required' });
      setIsLoadingCompliance(false);
      return;
    }

    setIsLoadingCompliance(true);
    setError(null);

    const standards = selectedStandards.length > 0
      ? selectedStandards as RegulatoryStandardId[]
      : undefined;

    let result;
    if (analysisId) {
      result = await complianceService.getAnalysisCompliance(analysisId, standards);
    } else {
      result = await complianceService.getProjectCompliance(projectId, standards);
    }

    if (result.success && result.data) {
      setComplianceStatus(result.data.data);
    } else {
      setError(result.error || { code: 'INTERNAL_ERROR', message: 'Failed to load compliance status' });
    }

    setIsLoadingCompliance(false);
  }, [projectId, analysisId, selectedStandards]);

  /**
   * Load compliance on mount and when filters change.
   */
  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  /**
   * Handle logout.
   */
  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  /**
   * Toggle expanded state for a standard.
   */
  const toggleStandard = useCallback((standardId: string) => {
    setExpandedStandards((prev) => {
      const next = new Set(prev);
      if (next.has(standardId)) {
        next.delete(standardId);
      } else {
        next.add(standardId);
      }
      return next;
    });
  }, []);

  /**
   * Toggle expand all.
   */
  const handleExpandAll = useCallback((checked: boolean) => {
    setExpandAll(checked);
    if (checked && complianceStatus) {
      setExpandedStandards(new Set(complianceStatus.summaries.map((s) => s.standardId)));
    } else {
      setExpandedStandards(new Set());
    }
  }, [complianceStatus]);

  /**
   * Refresh compliance data.
   */
  const handleRefresh = useCallback(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!complianceStatus) return null;

    const totalCompliant = complianceStatus.summaries.reduce((acc, s) => acc + s.compliantCount, 0);
    const totalPartial = complianceStatus.summaries.reduce((acc, s) => acc + s.partiallyCompliantCount, 0);
    const totalNonCompliant = complianceStatus.summaries.reduce((acc, s) => acc + s.nonCompliantCount, 0);
    const totalNA = complianceStatus.summaries.reduce((acc, s) => acc + s.notApplicableCount, 0);
    const totalNotAssessed = complianceStatus.summaries.reduce((acc, s) => acc + s.notAssessedCount, 0);

    return {
      totalCompliant,
      totalPartial,
      totalNonCompliant,
      totalNA,
      totalNotAssessed,
      totalClauses: totalCompliant + totalPartial + totalNonCompliant + totalNA + totalNotAssessed,
    };
  }, [complianceStatus]);

  // Determine display title based on context
  const displayTitle = analysisId
    ? `Compliance - ${(complianceStatus as AnalysisComplianceStatus)?.analysisName || 'Analysis'}`
    : `Compliance - ${(complianceStatus as ProjectComplianceStatus)?.projectName || 'Project'}`;

  // Loading state
  if (isLoadingCompliance && !complianceStatus) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader size="lg" color="blue" />
          <p className="mt-4 text-slate-600">Loading compliance status...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !complianceStatus) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
                HazOp Assistant
              </Link>
              <div className="flex items-center gap-4">
                <Link to="/profile" className="text-sm text-slate-600 hover:text-slate-900">
                  {currentUser?.name}
                </Link>
                <Button
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={handleLogout}
                  loading={isLoading}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Alert color="red" title="Error" mb="md">
            {error.message}
          </Alert>
          <Button
            variant="outline"
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            Back to Project
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
                HazOp Assistant
              </Link>
              <span className="text-slate-400">/</span>
              <Link
                to={`/projects/${projectId}`}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                {(complianceStatus as ProjectComplianceStatus)?.projectName || 'Project'}
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-sm text-slate-900 font-medium">Compliance Validation</span>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/profile" className="text-sm text-slate-600 hover:text-slate-900">
                {currentUser?.name} ({currentUser?.role.replace('_', ' ')})
              </Link>
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                onClick={handleLogout}
                loading={isLoading}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page title and filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Compliance Validation</h1>
            <p className="text-slate-500 mt-1">
              Regulatory compliance assessment against industry standards
            </p>
          </div>

          <div className="flex items-center gap-3">
            <MultiSelect
              placeholder="Filter by standard"
              data={standardOptions}
              value={selectedStandards}
              onChange={setSelectedStandards}
              searchable
              clearable
              maxDropdownHeight={400}
              w={300}
              styles={{
                input: { borderRadius: '4px' },
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              loading={isLoadingCompliance}
              styles={{ root: { borderRadius: '4px' } }}
            >
              Refresh
            </Button>
          </div>
        </div>

        {complianceStatus && (
          <>
            {/* Overall status summary */}
            <div className="bg-white border border-slate-200 rounded p-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Gauge and status */}
                <div className="flex items-center gap-6">
                  <ComplianceGauge
                    percentage={complianceStatus.overallPercentage}
                    status={complianceStatus.overallStatus}
                    size="lg"
                  />
                  <div>
                    <div className="text-sm text-slate-500 uppercase tracking-wide mb-1">
                      Overall Status
                    </div>
                    <ComplianceStatusBadge status={complianceStatus.overallStatus} size="lg" />
                    <div className="text-xs text-slate-500 mt-2">
                      Last checked: {formatDate(complianceStatus.checkedAt)}
                    </div>
                  </div>
                </div>

                {/* Right: Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Standards"
                    value={complianceStatus.standardsChecked.length}
                    subValue={`of ${REGULATORY_STANDARD_IDS.length}`}
                  />
                  <StatCard
                    label="Analyses"
                    value={'analysisCount' in complianceStatus ? complianceStatus.analysisCount : '-'}
                    subValue={`${complianceStatus.entryCount} entries`}
                  />
                  <StatCard
                    label="With LOPA"
                    value={complianceStatus.lopaCount}
                    subValue={complianceStatus.hasLOPA ? 'Yes' : 'No'}
                  />
                  <StatCard
                    label="Total Clauses"
                    value={summaryStats?.totalClauses || 0}
                    subValue={`${summaryStats?.totalCompliant || 0} compliant`}
                  />
                </div>
              </div>
            </div>

            {/* Standards checklist */}
            <div className="bg-white border border-slate-200 rounded">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                    Standards Checklist
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {complianceStatus.summaries.length} standards assessed
                  </p>
                </div>
                <Checkbox
                  label="Expand all"
                  checked={expandAll}
                  onChange={(e) => handleExpandAll(e.target.checked)}
                  size="sm"
                  styles={{
                    label: { fontSize: '0.75rem', color: '#64748b' },
                  }}
                />
              </div>

              <div className="p-4">
                {complianceStatus.summaries.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>No standards have been assessed yet.</p>
                    <p className="text-sm mt-1">
                      Create analysis entries with risk assessments to enable compliance validation.
                    </p>
                  </div>
                ) : (
                  complianceStatus.summaries.map((summary) => (
                    <StandardChecklistRow
                      key={summary.standardId}
                      summary={summary}
                      expanded={expandedStandards.has(summary.standardId)}
                      onToggle={() => toggleStandard(summary.standardId)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Compliance breakdown summary */}
            {summaryStats && summaryStats.totalClauses > 0 && (
              <div className="mt-8 bg-white border border-slate-200 rounded p-6">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
                  Overall Breakdown
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-green-50 border border-green-200 rounded">
                    <div className="text-2xl font-semibold text-green-700">{summaryStats.totalCompliant}</div>
                    <div className="text-sm text-green-600">Compliant</div>
                    <div className="text-xs text-green-500 mt-1">
                      {((summaryStats.totalCompliant / summaryStats.totalClauses) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center p-4 bg-amber-50 border border-amber-200 rounded">
                    <div className="text-2xl font-semibold text-amber-700">{summaryStats.totalPartial}</div>
                    <div className="text-sm text-amber-600">Partially Compliant</div>
                    <div className="text-xs text-amber-500 mt-1">
                      {((summaryStats.totalPartial / summaryStats.totalClauses) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center p-4 bg-red-50 border border-red-200 rounded">
                    <div className="text-2xl font-semibold text-red-700">{summaryStats.totalNonCompliant}</div>
                    <div className="text-sm text-red-600">Non-Compliant</div>
                    <div className="text-xs text-red-500 mt-1">
                      {((summaryStats.totalNonCompliant / summaryStats.totalClauses) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center p-4 bg-slate-50 border border-slate-200 rounded">
                    <div className="text-2xl font-semibold text-slate-600">{summaryStats.totalNA}</div>
                    <div className="text-sm text-slate-500">Not Applicable</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {((summaryStats.totalNA / summaryStats.totalClauses) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center p-4 bg-slate-50 border border-slate-200 rounded">
                    <div className="text-2xl font-semibold text-slate-400">{summaryStats.totalNotAssessed}</div>
                    <div className="text-sm text-slate-400">Not Assessed</div>
                    <div className="text-xs text-slate-300 mt-1">
                      {((summaryStats.totalNotAssessed / summaryStats.totalClauses) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state for no entries */}
            {complianceStatus.entryCount === 0 && (
              <div className="mt-8 bg-white border border-slate-200 rounded p-8 text-center">
                <div className="text-slate-400 mb-4">
                  <svg
                    className="w-12 h-12 mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Analysis Data</h3>
                <p className="text-slate-500 mb-4">
                  Create analysis entries with causes, consequences, safeguards, and risk assessments to enable compliance validation.
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/projects/${projectId}`)}
                >
                  Go to Project
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
