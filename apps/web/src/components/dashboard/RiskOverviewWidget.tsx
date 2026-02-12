import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { RiskLevel, ProjectRiskDashboard } from '@hazop/types';
import { projectsService, type ProjectListItem } from '../../services/projects.service';

/**
 * Risk level colors matching the design system.
 */
const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#22c55e', // green-500
  medium: '#f59e0b', // amber-500
  high: '#ef4444', // red-500
};

/**
 * Aggregated risk data for the pie chart.
 */
interface RiskData {
  name: string;
  value: number;
  count: number;
  color: string;
}

/**
 * Aggregated statistics across all projects.
 */
interface AggregatedStats {
  totalEntries: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  projectCount: number;
}

/**
 * Risk Overview Widget for the main dashboard.
 *
 * Displays aggregated risk distribution across all user projects as a pie chart.
 * Shows:
 * - Pie chart with high/medium/low risk percentages
 * - Total entry counts per risk level
 * - Quick summary statistics
 *
 * Design follows regulatory document aesthetic:
 * - Clean white background with subtle borders
 * - Professional color-coding for risk levels
 * - Loading skeleton states
 * - Empty state messaging
 */
export function RiskOverviewWidget() {
  const [chartData, setChartData] = useState<RiskData[]>([]);
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch and aggregate risk data from all user projects.
   */
  const fetchRiskData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First fetch all user's projects
      const projectsResult = await projectsService.listProjects(
        {}, // no filters
        { sortBy: 'updated_at', sortOrder: 'desc' },
        { page: 1, limit: 100 }
      );

      if (!projectsResult.success || !projectsResult.data) {
        setError('Failed to load projects');
        setIsLoading(false);
        return;
      }

      const projects = projectsResult.data.data;

      if (projects.length === 0) {
        setChartData([]);
        setStats(null);
        setIsLoading(false);
        return;
      }

      // Fetch risk dashboard for each project (in parallel)
      const riskPromises = projects.map(async (project: ProjectListItem) => {
        const result = await projectsService.getRiskDashboard(project.id);
        if (result.success && result.data) {
          return result.data.dashboard;
        }
        return null;
      });

      const riskDashboards = await Promise.all(riskPromises);

      // Aggregate risk statistics across all projects
      const aggregated: AggregatedStats = {
        totalEntries: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        projectCount: projects.length,
      };

      riskDashboards.forEach((dashboard: ProjectRiskDashboard | null) => {
        if (dashboard?.statistics) {
          aggregated.totalEntries += dashboard.statistics.totalEntries;
          aggregated.highRiskCount += dashboard.statistics.highRiskCount;
          aggregated.mediumRiskCount += dashboard.statistics.mediumRiskCount;
          aggregated.lowRiskCount += dashboard.statistics.lowRiskCount;
        }
      });

      setStats(aggregated);

      // Calculate percentages for pie chart
      const total = aggregated.highRiskCount + aggregated.mediumRiskCount + aggregated.lowRiskCount;

      if (total === 0) {
        setChartData([]);
        setIsLoading(false);
        return;
      }

      const data: RiskData[] = [
        {
          name: 'High',
          value: Number(((aggregated.highRiskCount / total) * 100).toFixed(1)),
          count: aggregated.highRiskCount,
          color: RISK_COLORS.high,
        },
        {
          name: 'Medium',
          value: Number(((aggregated.mediumRiskCount / total) * 100).toFixed(1)),
          count: aggregated.mediumRiskCount,
          color: RISK_COLORS.medium,
        },
        {
          name: 'Low',
          value: Number(((aggregated.lowRiskCount / total) * 100).toFixed(1)),
          count: aggregated.lowRiskCount,
          color: RISK_COLORS.low,
        },
      ].filter((d) => d.count > 0);

      setChartData(data);
    } catch (err) {
      setError('Failed to load risk data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiskData();
  }, [fetchRiskData]);

  /**
   * Custom tooltip for the pie chart.
   */
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: RiskData }>;
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-slate-200 rounded shadow-sm text-sm">
          <span className="font-medium">{data.name} Risk:</span> {data.value}% ({data.count}{' '}
          {data.count === 1 ? 'entry' : 'entries'})
        </div>
      );
    }
    return null;
  };

  /**
   * Loading skeleton state.
   */
  if (isLoading) {
    return (
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Risk Overview
          </h3>
        </div>
        <div className="p-4">
          <div className="animate-pulse">
            <div className="flex justify-center">
              <div className="w-40 h-40 bg-slate-200 rounded-full" />
            </div>
            <div className="mt-4 flex justify-center gap-4">
              <div className="h-4 w-16 bg-slate-200 rounded" />
              <div className="h-4 w-16 bg-slate-200 rounded" />
              <div className="h-4 w-16 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  /**
   * Error state.
   */
  if (error) {
    return (
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Risk Overview
          </h3>
        </div>
        <div className="p-4">
          <div className="text-center py-4 text-red-600">
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={fetchRiskData}
              className="text-xs text-blue-600 hover:text-blue-800 mt-2"
            >
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  /**
   * Empty state when no risk data exists.
   */
  if (chartData.length === 0) {
    return (
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Risk Overview
          </h3>
        </div>
        <div className="p-4">
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No risk data available.</p>
            <p className="text-xs text-slate-400 mt-1">
              Risk distribution will appear once analyses with risk assessments are created.
            </p>
          </div>
        </div>
      </section>
    );
  }

  /**
   * Main content with pie chart and statistics.
   */
  return (
    <section className="bg-white border border-slate-200 rounded">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Risk Overview
        </h3>
        <Link to="/projects" className="text-xs text-blue-600 hover:text-blue-800">
          View projects
        </Link>
      </div>
      <div className="p-4">
        {/* Pie chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => (
                  <span className="text-xs text-slate-600">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics summary */}
        {stats && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-red-600">{stats.highRiskCount}</div>
                <div className="text-xs text-slate-500">High Risk</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-amber-600">{stats.mediumRiskCount}</div>
                <div className="text-xs text-slate-500">Medium Risk</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-600">{stats.lowRiskCount}</div>
                <div className="text-xs text-slate-500">Low Risk</div>
              </div>
            </div>
            <div className="mt-3 text-center text-xs text-slate-400">
              Across {stats.projectCount} {stats.projectCount === 1 ? 'project' : 'projects'} with{' '}
              {stats.totalEntries} {stats.totalEntries === 1 ? 'entry' : 'entries'}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
