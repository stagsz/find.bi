import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { projectsService, type ProjectListItem } from '../../services/projects.service';
import { analysesService, type AnalysisListItem } from '../../services/analyses.service';
import { documentsService, type ListDocumentsResponse } from '../../services/documents.service';

/**
 * Activity type for the timeline.
 */
type ActivityType =
  | 'project_created'
  | 'project_updated'
  | 'analysis_created'
  | 'analysis_updated'
  | 'analysis_submitted'
  | 'analysis_approved'
  | 'analysis_rejected'
  | 'document_uploaded';

/**
 * Unified activity item for the timeline.
 */
interface ActivityItem {
  /** Unique identifier for the activity */
  id: string;
  /** Type of activity */
  type: ActivityType;
  /** Title text for display */
  title: string;
  /** Secondary description text */
  description: string;
  /** Timestamp of the activity */
  timestamp: string;
  /** Link to navigate to (project, analysis, document) */
  link: string;
}

/**
 * Activity type display configuration.
 */
const ACTIVITY_CONFIG: Record<
  ActivityType,
  { icon: string; label: string; colorClass: string }
> = {
  project_created: {
    icon: '+',
    label: 'Project created',
    colorClass: 'bg-green-100 text-green-700',
  },
  project_updated: {
    icon: '~',
    label: 'Project updated',
    colorClass: 'bg-blue-100 text-blue-700',
  },
  analysis_created: {
    icon: '+',
    label: 'Analysis created',
    colorClass: 'bg-green-100 text-green-700',
  },
  analysis_updated: {
    icon: '~',
    label: 'Analysis updated',
    colorClass: 'bg-blue-100 text-blue-700',
  },
  analysis_submitted: {
    icon: '→',
    label: 'Submitted for review',
    colorClass: 'bg-amber-100 text-amber-700',
  },
  analysis_approved: {
    icon: '✓',
    label: 'Analysis approved',
    colorClass: 'bg-green-100 text-green-700',
  },
  analysis_rejected: {
    icon: '×',
    label: 'Analysis rejected',
    colorClass: 'bg-red-100 text-red-700',
  },
  document_uploaded: {
    icon: '↑',
    label: 'Document uploaded',
    colorClass: 'bg-slate-100 text-slate-700',
  },
};

/**
 * Activity Timeline Widget for the dashboard.
 *
 * Displays a chronological timeline of recent user activities including:
 * - Project creation and updates
 * - Analysis creation, updates, and status changes
 * - Document uploads
 *
 * Design follows regulatory document aesthetic:
 * - Clean white background with subtle borders
 * - Clear typographic hierarchy
 * - Activity type indicators with icons
 * - Loading skeleton states
 * - Empty state messaging
 */
export function ActivityTimelineWidget() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch and aggregate activities from multiple sources.
   * Strategy: fetch projects, analyses, and documents, then merge into timeline.
   */
  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First fetch all user's projects
      const projectsResult = await projectsService.listProjects(
        {}, // no filters
        { sortBy: 'updated_at', sortOrder: 'desc' },
        { page: 1, limit: 50 }
      );

      if (!projectsResult.success || !projectsResult.data) {
        setError('Failed to load activity data');
        setIsLoading(false);
        return;
      }

      const projects = projectsResult.data.data;

      if (projects.length === 0) {
        setActivities([]);
        setIsLoading(false);
        return;
      }

      const allActivities: ActivityItem[] = [];

      // Add project activities
      projects.forEach((project: ProjectListItem) => {
        // Check if project was recently created (createdAt within 7 days of updatedAt)
        const createdDate = new Date(project.createdAt);
        const updatedDate = new Date(project.updatedAt);
        const daysDiff = (updatedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff < 1) {
          // Project was just created
          allActivities.push({
            id: `project-created-${project.id}`,
            type: 'project_created',
            title: project.name,
            description: project.description || 'New project created',
            timestamp: project.createdAt,
            link: `/projects/${project.id}`,
          });
        } else {
          // Project was updated
          allActivities.push({
            id: `project-updated-${project.id}`,
            type: 'project_updated',
            title: project.name,
            description: `Status: ${project.status.replace('_', ' ')}`,
            timestamp: project.updatedAt,
            link: `/projects/${project.id}`,
          });
        }
      });

      // Fetch analyses and documents from each project (in parallel)
      const dataPromises = projects.map(async (project: ProjectListItem) => {
        const [analysesResult, documentsResult] = await Promise.all([
          analysesService.listAnalyses(
            project.id,
            {}, // no filters
            { sortBy: 'updated_at', sortOrder: 'desc' },
            { page: 1, limit: 10 }
          ),
          documentsService.listDocuments(
            project.id,
            {}, // no filters
            { sortBy: 'created_at', sortOrder: 'desc' },
            { page: 1, limit: 5 }
          ),
        ]);

        const projectActivities: ActivityItem[] = [];

        // Add analysis activities
        if (analysesResult.success && analysesResult.data) {
          analysesResult.data.data.forEach((analysis: AnalysisListItem) => {
            // Determine activity type based on status and timestamps
            let activityType: ActivityType;
            let activityTimestamp: string;

            if (analysis.status === 'approved' && analysis.approvedAt) {
              activityType = 'analysis_approved';
              activityTimestamp = analysis.approvedAt;
            } else if (analysis.status === 'rejected') {
              activityType = 'analysis_rejected';
              activityTimestamp = analysis.updatedAt;
            } else if (analysis.status === 'in_review' && analysis.submittedAt) {
              activityType = 'analysis_submitted';
              activityTimestamp = analysis.submittedAt;
            } else {
              // Determine if created or updated
              const createdDate = new Date(analysis.createdAt);
              const updatedDate = new Date(analysis.updatedAt);
              const diffMs = updatedDate.getTime() - createdDate.getTime();
              const diffMins = Math.floor(diffMs / 60000);

              if (diffMins < 5) {
                activityType = 'analysis_created';
                activityTimestamp = analysis.createdAt;
              } else {
                activityType = 'analysis_updated';
                activityTimestamp = analysis.updatedAt;
              }
            }

            projectActivities.push({
              id: `analysis-${activityType}-${analysis.id}`,
              type: activityType,
              title: analysis.name,
              description: `${project.name} • ${analysis.entryCount} entries`,
              timestamp: activityTimestamp,
              link: `/projects/${project.id}/analyses/${analysis.id}`,
            });
          });
        }

        // Add document activities
        if (documentsResult.success && documentsResult.data) {
          const docsData = documentsResult.data as ListDocumentsResponse;
          docsData.data.forEach((doc) => {
            projectActivities.push({
              id: `document-uploaded-${doc.id}`,
              type: 'document_uploaded',
              title: doc.filename,
              description: project.name,
              timestamp: doc.createdAt,
              link: `/projects/${project.id}`,
            });
          });
        }

        return projectActivities;
      });

      const allProjectActivities = await Promise.all(dataPromises);

      // Merge all activities and sort by timestamp (most recent first)
      const mergedActivities = [...allActivities, ...allProjectActivities.flat()]
        .sort((a, b) => {
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          return dateB - dateA;
        })
        // Remove duplicate entries (same item might appear as both created and updated)
        .filter((activity, index, self) => {
          // Keep unique by combining type prefix with entity id
          const entityId = activity.id.split('-').slice(2).join('-');
          const entityType = activity.id.split('-')[0];
          return (
            index ===
            self.findIndex((a) => {
              const aEntityId = a.id.split('-').slice(2).join('-');
              const aEntityType = a.id.split('-')[0];
              return aEntityType === entityType && aEntityId === entityId;
            })
          );
        })
        .slice(0, 8); // Show only top 8 most recent activities

      setActivities(mergedActivities);
    } catch (err) {
      setError('Failed to load activity data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

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
            Recent Activity
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-6 h-6 bg-slate-200 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded" />
                </div>
                <div className="h-3 w-12 bg-slate-100 rounded flex-shrink-0" />
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
            Recent Activity
          </h3>
        </div>
        <div className="p-4">
          <div className="text-center py-4 text-red-600">
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={fetchActivities}
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
   * Empty state when no activity exists.
   */
  if (activities.length === 0) {
    return (
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Recent Activity
          </h3>
        </div>
        <div className="p-4">
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No recent activity.</p>
            <p className="text-xs text-slate-400 mt-1">
              Your activity timeline will appear here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  /**
   * Main content with activity timeline.
   */
  return (
    <section className="bg-white border border-slate-200 rounded">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          Recent Activity
        </h3>
      </div>
      <div className="divide-y divide-slate-100">
        {activities.map((activity) => {
          const config = ACTIVITY_CONFIG[activity.type];
          return (
            <Link
              key={activity.id}
              to={activity.link}
              className="block px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Activity type icon */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium ${config.colorClass}`}
                >
                  {config.icon}
                </div>

                {/* Activity content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {activity.title}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    <span>{config.label}</span>
                    <span className="mx-1">•</span>
                    <span className="truncate">{activity.description}</span>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="text-xs text-slate-400 flex-shrink-0">
                  {formatRelativeTime(activity.timestamp)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
