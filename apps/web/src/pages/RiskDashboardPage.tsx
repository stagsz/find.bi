import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Button, Alert, Loader } from '@mantine/core';
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
import { projectsService } from '../services/projects.service';
import { RiskMatrix, RiskScoreBadge } from '../components/risk';
import type {
  ProjectRiskDashboard,
  ApiError,
  RiskLevel,
  GuideWord,
} from '@hazop/types';
import { GUIDE_WORD_LABELS, RISK_LEVEL_LABELS } from '@hazop/types';

/**
 * Risk level colors for charts.
 */
const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

/**
 * Risk level background colors for display.
 */
const RISK_BG_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-50 text-green-800 border-green-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  high: 'bg-red-50 text-red-800 border-red-200',
};

/**
 * Format risk level for display.
 */
function formatRiskLevel(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level];
}

/**
 * Get risk level from score.
 */
function getRiskLevelFromScore(score: number): RiskLevel {
  if (score <= 20) return 'low';
  if (score <= 60) return 'medium';
  return 'high';
}

/**
 * Format date for display.
 */
const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * StatCard component for displaying key metrics.
 */
interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  riskLevel?: RiskLevel;
}

function StatCard({ label, value, subValue, riskLevel }: StatCardProps) {
  const baseClasses = 'p-4 border rounded';
  const colorClasses = riskLevel
    ? RISK_BG_COLORS[riskLevel]
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
 * Risk dashboard page with charts and metrics.
 *
 * Displays comprehensive risk analysis data including:
 * - Overall statistics (total entries, risk counts)
 * - Risk distribution pie chart
 * - Risk by guide word bar chart
 * - 5x5 risk matrix overview
 * - High risk entries table
 * - Analysis summaries
 */
export function RiskDashboardPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const currentUser = useAuthStore(selectUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Dashboard state
  const [dashboard, setDashboard] = useState<ProjectRiskDashboard | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Fetch risk dashboard data from the API.
   */
  const fetchDashboard = useCallback(async () => {
    if (!projectId) {
      setError({ code: 'NOT_FOUND', message: 'Project ID is required' });
      setIsLoadingDashboard(false);
      return;
    }

    setIsLoadingDashboard(true);
    setError(null);

    const result = await projectsService.getRiskDashboard(projectId);

    if (result.success && result.data) {
      setDashboard(result.data.dashboard);
    } else {
      setError(result.error || { code: 'NOT_FOUND', message: 'Failed to load risk dashboard' });
    }

    setIsLoadingDashboard(false);
  }, [projectId]);

  /**
   * Load dashboard on mount and when projectId changes.
   */
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /**
   * Handle logout.
   */
  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  /**
   * Prepare distribution data for pie chart.
   */
  const getDistributionData = () => {
    if (!dashboard?.distribution) return [];
    return [
      { name: 'Low', value: dashboard.distribution.low, color: RISK_COLORS.low },
      { name: 'Medium', value: dashboard.distribution.medium, color: RISK_COLORS.medium },
      { name: 'High', value: dashboard.distribution.high, color: RISK_COLORS.high },
    ].filter((d) => d.value > 0);
  };

  /**
   * Prepare guide word data for bar chart.
   */
  const getGuideWordData = () => {
    if (!dashboard?.byGuideWord) return [];
    return dashboard.byGuideWord.map((gw) => ({
      name: GUIDE_WORD_LABELS[gw.guideWord as GuideWord] || gw.guideWord,
      low: gw.lowRiskCount,
      medium: gw.mediumRiskCount,
      high: gw.highRiskCount,
      total: gw.entryCount,
    }));
  };

  /**
   * Custom tooltip for pie chart.
   */
  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-slate-200 rounded shadow-sm text-sm">
          <span className="font-medium">{data.name}:</span> {data.value.toFixed(1)}%
        </div>
      );
    }
    return null;
  };

  // Loading state
  if (isLoadingDashboard) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader size="lg" color="blue" />
          <p className="mt-4 text-slate-600">Loading risk dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !dashboard) {
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
            {error?.message || 'Failed to load risk dashboard'}
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

  const { statistics, distribution, byGuideWord, highestRiskEntries, analysisSummaries } = dashboard;

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
                {dashboard.projectName}
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-sm text-slate-900 font-medium">Risk Dashboard</span>
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
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Risk Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Comprehensive risk analysis for {dashboard.projectName}
          </p>
        </div>

        {/* Statistics summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            label="Total Analyses"
            value={statistics.totalAnalyses}
            subValue={`${statistics.approvedAnalyses} approved`}
          />
          <StatCard
            label="Total Entries"
            value={statistics.totalEntries}
            subValue={`${statistics.assessedEntries} assessed`}
          />
          <StatCard
            label="High Risk"
            value={statistics.highRiskCount}
            riskLevel="high"
          />
          <StatCard
            label="Medium Risk"
            value={statistics.mediumRiskCount}
            riskLevel="medium"
          />
          <StatCard
            label="Low Risk"
            value={statistics.lowRiskCount}
            riskLevel="low"
          />
          <StatCard
            label="Avg Score"
            value={statistics.averageRiskScore?.toFixed(1) || '-'}
            subValue={`Max: ${statistics.maxRiskScore || '-'}`}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Risk Distribution Pie Chart */}
          <div className="bg-white border border-slate-200 rounded p-6">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
              Risk Distribution
            </h2>
            {distribution ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getDistributionData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                    >
                      {getDistributionData().map((entry, index) => (
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
                No risk data available
              </div>
            )}
          </div>

          {/* Risk Matrix Overview */}
          <div className="bg-white border border-slate-200 rounded p-6">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
              Risk Matrix Overview
            </h2>
            <div className="flex items-center justify-center">
              <RiskMatrix
                interactive={false}
                showScores={true}
                size="md"
              />
            </div>
            <div className="mt-4 text-center text-sm text-slate-500">
              Standard 5×5 Severity vs. Likelihood matrix
            </div>
          </div>
        </div>

        {/* Risk by Guide Word Chart */}
        {byGuideWord.length > 0 && (
          <div className="bg-white border border-slate-200 rounded p-6 mb-8">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
              Risk by Guide Word
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getGuideWordData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="#64748b"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="high" name="High" fill={RISK_COLORS.high} stackId="stack" />
                  <Bar dataKey="medium" name="Medium" fill={RISK_COLORS.medium} stackId="stack" />
                  <Bar dataKey="low" name="Low" fill={RISK_COLORS.low} stackId="stack" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* High Risk Entries Table */}
        {highestRiskEntries.length > 0 && (
          <div className="bg-white border border-slate-200 rounded p-6 mb-8">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
              Highest Risk Entries (Top 20)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Node</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Guide Word</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Parameter</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Analysis</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Score</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600">Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {highestRiskEntries.map((entry) => (
                    <tr key={entry.entryId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-900">
                        {entry.nodeIdentifier}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {GUIDE_WORD_LABELS[entry.guideWord as GuideWord] || entry.guideWord}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{entry.parameter}</td>
                      <td className="py-2 px-3 text-slate-600">{entry.analysisName}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">
                        {entry.riskRanking.riskScore}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <RiskScoreBadge
                          score={entry.riskRanking.riskScore}
                          level={entry.riskRanking.riskLevel}
                          variant="badge"
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analysis Summaries */}
        {analysisSummaries.length > 0 && (
          <div className="bg-white border border-slate-200 rounded p-6">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
              Analysis Summaries
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Analysis</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Lead</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Entries</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">High</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Medium</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Low</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Max Score</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisSummaries.map((summary) => (
                    <tr key={summary.analysisId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <Link
                          to={`/projects/${projectId}/analyses/${summary.analysisId}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {summary.analysisName}
                        </Link>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                          summary.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : summary.status === 'in_review'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {summary.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700">{summary.leadAnalystName}</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {summary.entryCount}
                        <span className="text-slate-400 ml-1">
                          ({summary.assessedCount})
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-red-600">
                        {summary.highRiskCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-amber-600">
                        {summary.mediumRiskCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-green-600">
                        {summary.lowRiskCount}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {summary.maxRiskScore ? (
                          <RiskScoreBadge
                            score={summary.maxRiskScore}
                            level={summary.overallRiskLevel || getRiskLevelFromScore(summary.maxRiskScore)}
                            variant="compact"
                            size="sm"
                          />
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {formatDate(summary.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {statistics.totalEntries === 0 && (
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Risk Data Yet</h3>
            <p className="text-slate-500 mb-4">
              Start by creating analysis entries with risk assessments.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate(`/projects/${projectId}`)}
            >
              Go to Project
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
