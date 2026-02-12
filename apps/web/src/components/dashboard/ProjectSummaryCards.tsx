import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectStatus } from '@hazop/types';
import { projectsService, type ProjectListItem } from '../../services/projects.service';
import { STATUS_COLORS } from '../projects/ProjectCard';

/**
 * Configuration for project summary cards.
 * Defines the status categories to display on the dashboard.
 */
interface SummaryCardConfig {
  /** Project status to filter by */
  status: ProjectStatus;
  /** Display label for the card */
  label: string;
  /** Color for the count indicator (border accent) */
  accentColor: string;
}

/**
 * Card configurations for the dashboard summary.
 * Order matches the layout: Active, Review, Completed, Planning.
 */
const CARD_CONFIGS: SummaryCardConfig[] = [
  {
    status: 'active',
    label: 'Active Projects',
    accentColor: 'border-l-green-500',
  },
  {
    status: 'review',
    label: 'In Review',
    accentColor: 'border-l-amber-500',
  },
  {
    status: 'completed',
    label: 'Completed',
    accentColor: 'border-l-slate-500',
  },
  {
    status: 'planning',
    label: 'Planning',
    accentColor: 'border-l-blue-500',
  },
];

/**
 * Type for project counts by status.
 */
type ProjectCounts = Record<ProjectStatus, number>;

/**
 * Props for an individual summary card.
 */
interface SummaryCardProps {
  label: string;
  count: number;
  isLoading: boolean;
  accentColor: string;
  status: ProjectStatus;
  onClick?: () => void;
}

/**
 * Individual summary card component.
 * Displays count for a specific project status with loading state.
 */
function SummaryCard({
  label,
  count,
  isLoading,
  accentColor,
  status,
  onClick,
}: SummaryCardProps) {
  const statusColorClass = STATUS_COLORS[status].split(' ')[0]; // Get bg color only

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-white border border-slate-200 rounded p-4 border-l-4 ${accentColor} hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
    >
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      {isLoading ? (
        <>
          <div className="h-8 w-12 bg-slate-200 rounded animate-pulse" />
          <div className="text-xs text-slate-400 mt-1">Loading...</div>
        </>
      ) : (
        <>
          <div className="text-2xl font-semibold text-slate-900">{count}</div>
          <div className="text-xs text-slate-400 mt-1">
            {count === 1 ? 'project' : 'projects'}
          </div>
        </>
      )}
    </button>
  );
}

/**
 * Project summary cards component for the dashboard.
 *
 * Displays a grid of 4 cards showing project counts by status:
 * - Active Projects: Currently in active analysis
 * - In Review: Awaiting approval
 * - Completed: Finalized projects
 * - Planning: Draft/setup phase
 *
 * Each card is clickable to navigate to the projects list filtered by status.
 *
 * Design follows regulatory document aesthetic:
 * - Clean white backgrounds with subtle borders
 * - Left accent border indicating status color
 * - Clear typographic hierarchy
 * - Loading skeleton states
 */
export function ProjectSummaryCards() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<ProjectCounts>({
    planning: 0,
    active: 0,
    review: 0,
    completed: 0,
    archived: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all projects and count by status.
   * Fetches with a high limit to get all projects for accurate counts.
   */
  const fetchProjectCounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all projects (use high limit for accurate counts)
      const result = await projectsService.listProjects(
        {}, // no filters - get all
        { sortBy: 'created_at', sortOrder: 'desc' },
        { page: 1, limit: 1000 }
      );

      if (result.success && result.data) {
        // Count projects by status
        const newCounts: ProjectCounts = {
          planning: 0,
          active: 0,
          review: 0,
          completed: 0,
          archived: 0,
        };

        result.data.data.forEach((project: ProjectListItem) => {
          newCounts[project.status]++;
        });

        setCounts(newCounts);
      } else {
        setError(result.error?.message || 'Failed to load projects');
      }
    } catch (err) {
      setError('Failed to load project counts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjectCounts();
  }, [fetchProjectCounts]);

  /**
   * Handle card click to navigate to filtered projects list.
   */
  const handleCardClick = (status: ProjectStatus) => {
    navigate(`/projects?status=${status}`);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {CARD_CONFIGS.map((config) => (
        <SummaryCard
          key={config.status}
          label={config.label}
          count={counts[config.status]}
          isLoading={isLoading}
          accentColor={config.accentColor}
          status={config.status}
          onClick={() => handleCardClick(config.status)}
        />
      ))}
      {error && (
        <div className="col-span-full text-sm text-red-600 text-center py-2">
          {error}
        </div>
      )}
    </div>
  );
}
