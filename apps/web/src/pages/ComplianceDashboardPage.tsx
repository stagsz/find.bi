/**
 * Compliance Dashboard Page.
 *
 * Displays comprehensive compliance analytics for a project including:
 * - Overall compliance statistics
 * - Compliance distribution by status (pie chart)
 * - Standard-by-standard breakdown (bar chart)
 * - Compliance by jurisdiction
 * - Compliance by regulatory category
 * - Detailed standards table with metrics
 *
 * This differs from ComplianceValidationPage in that it focuses on
 * analytics and visualization rather than a checklist workflow.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Button, Alert, MultiSelect } from '@mantine/core';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuthStore, selectUser } from '../store/auth.store';
import { authService } from '../services/auth.service';
import {
  complianceService,
  type ProjectComplianceStatus,
} from '../services/compliance.service';
import type {
  ApiError,
  RegulatoryStandardId,
  ComplianceStatus,
  StandardComplianceSummary,
  RegulatoryCategory,
  RegulatoryJurisdiction,
} from '@hazop/types';
import {
  REGULATORY_STANDARD_IDS,
  REGULATORY_STANDARD_NAMES,
  REGULATORY_STANDARD_CATEGORIES,
  REGULATORY_STANDARD_JURISDICTIONS,
  REGULATORY_CATEGORY_LABELS,
  REGULATORY_JURISDICTION_LABELS,
  COMPLIANCE_STATUS_LABELS,
  COMPLIANCE_STATUS_COLORS,
} from '@hazop/types';
import { MetricCardSkeleton, ChartSkeleton, TableRowSkeleton, CardSkeleton } from '../components/skeletons';

/**
 * Colors for compliance status in charts.
 */
const STATUS_CHART_COLORS: Record<ComplianceStatus, string> = {
  compliant: '#22c55e',
  partially_compliant: '#f59e0b',
  non_compliant: '#ef4444',
  not_applicable: '#6b7280',
  not_assessed: '#9ca3af',
};

/**
 * Background styles for compliance status.
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
 * StatCard component for displaying key metrics.
 */
interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  status?: ComplianceStatus;
}

function StatCard({ label, value, subValue, status }: StatCardProps) {
  const baseClasses = 'p-4 border rounded';
  const colorClasses = status
    ? `${STATUS_STYLES[status].bg} ${STATUS_STYLES[status].text} ${STATUS_STYLES[status].border}`
    : 'bg-white border-slate-200';

  return (
    <div className={`${baseClasses} ${colorClasses}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {subValue && <div className="text-xs opacity-70 mt-1">{subValue}</div>}
    </div>
  );
}

/**
 * Circular gauge for compliance percentage.
 */
interface ComplianceGaugeProps {
  percentage: number;
  status: ComplianceStatus;
}

function ComplianceGauge({ percentage, status }: ComplianceGaugeProps) {
  const outer = 140;
  const stroke = 12;
  const radius = (outer - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(percentage, 0), 100);
  const offset = circumference - (progress / 100) * circumference;
  const color = COMPLIANCE_STATUS_COLORS[status];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: outer, height: outer }}>
      <svg className="absolute transform -rotate-90" width={outer} height={outer}>
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-semibold" style={{ color }}>
          {percentage.toFixed(0)}%
        </div>
        <div className="text-xs text-slate-500">Compliant</div>
      </div>
    </div>
  );
}

/**
 * Compliance status badge.
 */
interface StatusBadgeProps {
  status: ComplianceStatus;
  size?: 'sm' | 'md';
}

function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status];
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span className={`inline-flex items-center rounded font-medium border ${styles.bg} ${styles.text} ${styles.border} ${sizeClasses}`}>
      {COMPLIANCE_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Compliance Dashboard Page component.
 */
export function ComplianceDashboardPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const currentUser = useAuthStore(selectUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Compliance state
  const [complianceStatus, setComplianceStatus] = useState<ProjectComplianceStatus | null>(null);
  const [isLoadingCompliance, setIsLoadingCompliance] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Filter state
  const [selectedStandards, setSelectedStandards] = useState<string[]>([]);

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

    const result = await complianceService.getProjectCompliance(projectId, standards);

    if (result.success && result.data) {
      setComplianceStatus(result.data.data);
    } else {
      setError(result.error || { code: 'INTERNAL_ERROR', message: 'Failed to load compliance status' });
    }

    setIsLoadingCompliance(false);
  }, [projectId, selectedStandards]);

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
    const totalClauses = totalCompliant + totalPartial + totalNonCompliant + totalNA + totalNotAssessed;

    // Count standards by status
    const compliantStandards = complianceStatus.summaries.filter(s => s.overallStatus === 'compliant').length;
    const partialStandards = complianceStatus.summaries.filter(s => s.overallStatus === 'partially_compliant').length;
    const nonCompliantStandards = complianceStatus.summaries.filter(s => s.overallStatus === 'non_compliant').length;

    return {
      totalCompliant,
      totalPartial,
      totalNonCompliant,
      totalNA,
      totalNotAssessed,
      totalClauses,
      compliantStandards,
      partialStandards,
      nonCompliantStandards,
    };
  }, [complianceStatus]);

  /**
   * Prepare status distribution data for pie chart.
   */
  const getStatusDistributionData = useCallback(() => {
    if (!summaryStats) return [];
    return [
      { name: 'Compliant', value: summaryStats.totalCompliant, color: STATUS_CHART_COLORS.compliant },
      { name: 'Partial', value: summaryStats.totalPartial, color: STATUS_CHART_COLORS.partially_compliant },
      { name: 'Non-Compliant', value: summaryStats.totalNonCompliant, color: STATUS_CHART_COLORS.non_compliant },
      { name: 'N/A', value: summaryStats.totalNA, color: STATUS_CHART_COLORS.not_applicable },
      { name: 'Not Assessed', value: summaryStats.totalNotAssessed, color: STATUS_CHART_COLORS.not_assessed },
    ].filter(d => d.value > 0);
  }, [summaryStats]);

  /**
   * Prepare standard breakdown data for bar chart.
   */
  const getStandardBreakdownData = useCallback(() => {
    if (!complianceStatus) return [];
    return complianceStatus.summaries.map((summary) => ({
      name: REGULATORY_STANDARD_NAMES[summary.standardId],
      shortName: summary.standardId.replace('_', ' '),
      compliant: summary.compliantCount,
      partial: summary.partiallyCompliantCount,
      nonCompliant: summary.nonCompliantCount,
      na: summary.notApplicableCount,
      notAssessed: summary.notAssessedCount,
      percentage: summary.compliancePercentage,
    }));
  }, [complianceStatus]);

  /**
   * Group summaries by jurisdiction.
   */
  const getJurisdictionData = useMemo(() => {
    if (!complianceStatus) return [];

    const jurisdictionMap = new Map<RegulatoryJurisdiction, {
      count: number;
      compliant: number;
      total: number;
    }>();

    complianceStatus.summaries.forEach((summary) => {
      const jurisdiction = REGULATORY_STANDARD_JURISDICTIONS[summary.standardId];
      const existing = jurisdictionMap.get(jurisdiction) || { count: 0, compliant: 0, total: 0 };
      jurisdictionMap.set(jurisdiction, {
        count: existing.count + 1,
        compliant: existing.compliant + summary.compliantCount + summary.partiallyCompliantCount,
        total: existing.total + summary.totalClauses - summary.notApplicableCount - summary.notAssessedCount,
      });
    });

    return Array.from(jurisdictionMap.entries()).map(([jurisdiction, data]) => ({
      jurisdiction,
      label: REGULATORY_JURISDICTION_LABELS[jurisdiction],
      standardCount: data.count,
      percentage: data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 0,
    }));
  }, [complianceStatus]);

  /**
   * Group summaries by category.
   */
  const getCategoryData = useMemo(() => {
    if (!complianceStatus) return [];

    const categoryMap = new Map<RegulatoryCategory, {
      count: number;
      compliant: number;
      total: number;
    }>();

    complianceStatus.summaries.forEach((summary) => {
      const category = REGULATORY_STANDARD_CATEGORIES[summary.standardId];
      const existing = categoryMap.get(category) || { count: 0, compliant: 0, total: 0 };
      categoryMap.set(category, {
        count: existing.count + 1,
        compliant: existing.compliant + summary.compliantCount + summary.partiallyCompliantCount,
        total: existing.total + summary.totalClauses - summary.notApplicableCount - summary.notAssessedCount,
      });
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      label: REGULATORY_CATEGORY_LABELS[category],
      standardCount: data.count,
      percentage: data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 0,
    }));
  }, [complianceStatus]);

  /**
   * Custom tooltip for pie chart.
   */
  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = summaryStats?.totalClauses || 1;
      const percentage = ((data.value / total) * 100).toFixed(1);
      return (
        <div className="bg-white p-2 border border-slate-200 rounded shadow-sm text-sm">
          <span className="font-medium">{data.name}:</span> {data.value} clauses ({percentage}%)
        </div>
      );
    }
    return null;
  };

  // Loading state
  if (isLoadingCompliance && !complianceStatus) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
                HazOp Assistant
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page title skeleton */}
          <div className="mb-8 animate-pulse">
            <div className="h-8 w-56 bg-slate-200 rounded mb-2" />
            <div className="h-4 w-72 bg-slate-100 rounded" />
          </div>

          {/* Overall status summary skeleton */}
          <div className="bg-white border border-slate-200 rounded p-6 mb-8 animate-pulse">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-36 h-36 bg-slate-200 rounded-full" />
                <div>
                  <div className="h-4 w-24 bg-slate-200 rounded mb-2" />
                  <div className="h-6 w-32 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <MetricCardSkeleton key={i} showTrend={false} />
                ))}
              </div>
            </div>
          </div>

          {/* Charts row skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded p-6">
              <div className="h-5 w-44 bg-slate-200 rounded mb-4 animate-pulse" />
              <ChartSkeleton type="pie" height={256} />
            </div>
            <div className="bg-white border border-slate-200 rounded p-6">
              <div className="h-5 w-40 bg-slate-200 rounded mb-4 animate-pulse" />
              <ChartSkeleton type="bar" height={256} />
            </div>
          </div>

          {/* Jurisdiction and Category skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <CardSkeleton showHeader lines={4} />
            <CardSkeleton showHeader lines={4} />
          </div>

          {/* Table skeleton */}
          <div className="bg-white border border-slate-200 rounded p-6">
            <div className="h-5 w-56 bg-slate-200 rounded mb-4 animate-pulse" />
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Standard', 'Status', 'Total', 'Compliant', 'Partial', 'Non-Compliant', 'N/A', 'Not Assessed', '%'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 font-medium text-slate-600 text-sm">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={9} columnWidths={['wide', 'medium', 'narrow', 'narrow', 'narrow', 'narrow', 'narrow', 'narrow', 'narrow']} />
                ))}
              </tbody>
            </table>
          </div>
        </main>
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
                {complianceStatus?.projectName || 'Project'}
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-sm text-slate-900 font-medium">Compliance Dashboard</span>
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
            <h1 className="text-2xl font-semibold text-slate-900">Compliance Dashboard</h1>
            <p className="text-slate-500 mt-1">
              Regulatory compliance analytics for {complianceStatus?.projectName || 'project'}
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
            <Link to={`/projects/${projectId}/compliance`}>
              <Button
                variant="outline"
                size="sm"
                styles={{ root: { borderRadius: '4px' } }}
              >
                Validation View
              </Button>
            </Link>
          </div>
        </div>

        {complianceStatus && summaryStats && (
          <>
            {/* Overall status summary */}
            <div className="bg-white border border-slate-200 rounded p-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Gauge and status */}
                <div className="flex items-center gap-6">
                  <ComplianceGauge
                    percentage={complianceStatus.overallPercentage}
                    status={complianceStatus.overallStatus}
                  />
                  <div>
                    <div className="text-sm text-slate-500 uppercase tracking-wide mb-1">
                      Overall Status
                    </div>
                    <StatusBadge status={complianceStatus.overallStatus} />
                    <div className="text-xs text-slate-500 mt-2">
                      Last checked: {formatDate(complianceStatus.checkedAt)}
                    </div>
                  </div>
                </div>

                {/* Right: Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <StatCard
                    label="Standards"
                    value={complianceStatus.standardsChecked.length}
                    subValue={`of ${REGULATORY_STANDARD_IDS.length}`}
                  />
                  <StatCard
                    label="Analyses"
                    value={complianceStatus.analysisCount}
                    subValue={`${complianceStatus.entryCount} entries`}
                  />
                  <StatCard
                    label="Clauses"
                    value={summaryStats.totalClauses}
                    subValue="assessed"
                  />
                  <StatCard
                    label="Compliant"
                    value={summaryStats.totalCompliant}
                    status="compliant"
                  />
                  <StatCard
                    label="Partial"
                    value={summaryStats.totalPartial}
                    status="partially_compliant"
                  />
                  <StatCard
                    label="Non-Compliant"
                    value={summaryStats.totalNonCompliant}
                    status="non_compliant"
                  />
                </div>
              </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Status Distribution Pie Chart */}
              <div className="bg-white border border-slate-200 rounded p-6">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
                  Clause Status Distribution
                </h2>
                {summaryStats.totalClauses > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getStatusDistributionData()}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {getStatusDistributionData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    No clause data available
                  </div>
                )}
              </div>

              {/* Standard-by-Standard Bar Chart */}
              <div className="bg-white border border-slate-200 rounded p-6">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
                  Compliance by Standard
                </h2>
                {complianceStatus.summaries.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getStandardBreakdownData()} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#64748b" />
                        <YAxis
                          dataKey="shortName"
                          type="category"
                          tick={{ fontSize: 10 }}
                          stroke="#64748b"
                          width={80}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="compliant" name="Compliant" fill={STATUS_CHART_COLORS.compliant} stackId="stack" />
                        <Bar dataKey="partial" name="Partial" fill={STATUS_CHART_COLORS.partially_compliant} stackId="stack" />
                        <Bar dataKey="nonCompliant" name="Non-Compliant" fill={STATUS_CHART_COLORS.non_compliant} stackId="stack" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    No standards assessed
                  </div>
                )}
              </div>
            </div>

            {/* Jurisdiction and Category breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* By Jurisdiction */}
              <div className="bg-white border border-slate-200 rounded p-6">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
                  Compliance by Jurisdiction
                </h2>
                {getJurisdictionData.length > 0 ? (
                  <div className="space-y-3">
                    {getJurisdictionData.map((item) => (
                      <div key={item.jurisdiction} className="flex items-center justify-between p-3 border border-slate-200 rounded">
                        <div>
                          <div className="font-medium text-slate-900">{item.label}</div>
                          <div className="text-xs text-slate-500">{item.standardCount} standard{item.standardCount !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${item.percentage}%`,
                                backgroundColor: item.percentage >= 80 ? STATUS_CHART_COLORS.compliant
                                  : item.percentage >= 50 ? STATUS_CHART_COLORS.partially_compliant
                                  : STATUS_CHART_COLORS.non_compliant,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700 w-12 text-right">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No jurisdiction data available
                  </div>
                )}
              </div>

              {/* By Category */}
              <div className="bg-white border border-slate-200 rounded p-6">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
                  Compliance by Category
                </h2>
                {getCategoryData.length > 0 ? (
                  <div className="space-y-3">
                    {getCategoryData.map((item) => (
                      <div key={item.category} className="flex items-center justify-between p-3 border border-slate-200 rounded">
                        <div>
                          <div className="font-medium text-slate-900">{item.label}</div>
                          <div className="text-xs text-slate-500">{item.standardCount} standard{item.standardCount !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${item.percentage}%`,
                                backgroundColor: item.percentage >= 80 ? STATUS_CHART_COLORS.compliant
                                  : item.percentage >= 50 ? STATUS_CHART_COLORS.partially_compliant
                                  : STATUS_CHART_COLORS.non_compliant,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700 w-12 text-right">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No category data available
                  </div>
                )}
              </div>
            </div>

            {/* Standards Detail Table */}
            {complianceStatus.summaries.length > 0 && (
              <div className="bg-white border border-slate-200 rounded p-6">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
                  Standard-by-Standard Breakdown
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 font-medium text-slate-600">Standard</th>
                        <th className="text-center py-2 px-3 font-medium text-slate-600">Status</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">Total</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">
                          <span className="text-green-600">Compliant</span>
                        </th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">
                          <span className="text-amber-600">Partial</span>
                        </th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">
                          <span className="text-red-600">Non-Compliant</span>
                        </th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">N/A</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">Not Assessed</th>
                        <th className="text-right py-2 px-3 font-medium text-slate-600">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complianceStatus.summaries.map((summary) => (
                        <tr key={summary.standardId} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-900">
                              {summary.standardName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {REGULATORY_JURISDICTION_LABELS[REGULATORY_STANDARD_JURISDICTIONS[summary.standardId]]}
                              {' · '}
                              {REGULATORY_CATEGORY_LABELS[REGULATORY_STANDARD_CATEGORIES[summary.standardId]]}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <StatusBadge status={summary.overallStatus} size="sm" />
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-900">
                            {summary.totalClauses}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-green-600">
                            {summary.compliantCount}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-amber-600">
                            {summary.partiallyCompliantCount}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-red-600">
                            {summary.nonCompliantCount}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">
                            {summary.notApplicableCount}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {summary.notAssessedCount}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className="font-medium"
                              style={{
                                color: summary.compliancePercentage >= 80
                                  ? STATUS_CHART_COLORS.compliant
                                  : summary.compliancePercentage >= 50
                                  ? STATUS_CHART_COLORS.partially_compliant
                                  : STATUS_CHART_COLORS.non_compliant,
                              }}
                            >
                              {summary.compliancePercentage.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state for no entries */}
            {complianceStatus.entryCount === 0 && (
              <div className="bg-white border border-slate-200 rounded p-8 text-center">
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
                  Create analysis entries with causes, consequences, safeguards, and risk assessments to enable compliance analytics.
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
