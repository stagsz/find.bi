import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AnalysisStatus } from '@hazop/types';
import { ANALYSIS_STATUS_LABELS } from '@hazop/types';
import { projectsService, type ProjectListItem } from '../../services/projects.service';
import { analysesService, type AnalysisListItem } from '../../services/analyses.service';

/**
 * Analysis status badge colors matching AnalysesTab patterns.
 */
const STATUS_COLORS: Record<AnalysisStatus, string> = {
  draft: 'bg-blue-100 text-blue-800',
  in_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

/**
 * Extended analysis item with project info for dashboard display.
 */
interface RecentAnalysis extends AnalysisListItem {
  /** Project ID this analysis belongs to */
  projectId: string;
  /** Project name for display */
  projectName: string;
}

/**
 * Recent Analyses Widget for the dashboard.
 *
 * Displays the most recently updated analyses across all user projects.
 * Each item shows:
 * - Analysis name and description
 * - Status badge (draft, in_review, approved, rejected)
 * - Project name
 * - Entry count
 * - Last updated time
 *
 * Design follows regulatory document aesthetic:
 * - Clean white background with subtle borders
 * - Clear typographic hierarchy
 * - Loading skeleton states
 * - Empty state messaging
 */
export function RecentAnalysesWidget() {
  const [analyses, setAnalyses] = useState<RecentAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch recent analyses from all user projects.
   * Strategy: fetch all projects, then get recent analyses from each.
   */
  const fetchRecentAnalyses = useCallback(async () => {
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
        setAnalyses([]);
        setIsLoading(false);
        return;
      }

      // Fetch recent analyses from each project (in parallel)
      const analysesPromises = projects.map(async (project: ProjectListItem) => {
        const result = await analysesService.listAnalyses(
          project.id,
          {}, // no filters
          { sortBy: 'updated_at', sortOrder: 'desc' },
          { page: 1, limit: 5 } // Get top 5 from each project
        );

        if (result.success && result.data) {
          return result.data.data.map((analysis) => ({
            ...analysis,
            projectId: project.id,
            projectName: project.name,
          }));
        }
        return [];
      });

      const allAnalyses = await Promise.all(analysesPromises);

      // Flatten and sort by updated_at descending
      const flattenedAnalyses = allAnalyses
        .flat()
        .sort((a, b) => {
          const dateA = new Date(a.updatedAt).getTime();
          const dateB = new Date(b.updatedAt).getTime();
          return dateB - dateA;
        })
        .slice(0, 5); // Show only top 5 most recent

      setAnalyses(flattenedAnalyses);
    } catch (err) {
      setError('Failed to load recent analyses');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentAnalyses();
  }, [fetchRecentAnalyses]);

  /**
   * Format relative time for display.
   * Shows "Just now", "X minutes ago", "X hours ago", or date.
   */
  const formatRelativeTime = (date: Date | string): string => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return then.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  /**
   * Loading skeleton state.
   */
  if (isLoading) {
    return (
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Recent Analyses
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
                    <div className="h-3 w-1/2 bg-slate-100 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
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
            Recent Analyses
          </h3>
        </div>
        <div className="p-4">
          <div className="text-center py-4 text-red-600">
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={fetchRecentAnalyses}
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
   * Empty state when no analyses exist.
   */
  if (analyses.length === 0) {
    return (
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Recent Analyses
          </h3>
        </div>
        <div className="p-4">
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No recent analyses to display.</p>
            <p className="text-xs text-slate-400 mt-1">
              Create a new analysis to get started.
            </p>
          </div>
        </div>
      </section>
    );
  }

  /**
   * Main content with analysis list.
   */
  return (
    <section className="bg-white border border-slate-200 rounded">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Recent Analyses
        </h3>
        <Link
          to="/projects"
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          View all
        </Link>
      </div>
      <div className="divide-y divide-slate-100">
        {analyses.map((analysis) => (
          <Link
            key={analysis.id}
            to={`/projects/${analysis.projectId}/analyses/${analysis.id}`}
            className="block px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {analysis.name}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[analysis.status]}`}
                  >
                    {ANALYSIS_STATUS_LABELS[analysis.status]}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  {analysis.projectName}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-xs text-slate-500">
                  {formatRelativeTime(analysis.updatedAt)}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {analysis.entryCount} {analysis.entryCount === 1 ? 'entry' : 'entries'}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
