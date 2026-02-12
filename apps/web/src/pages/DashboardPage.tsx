import { Button } from '@mantine/core';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore, selectUser } from '../store/auth.store';
import {
  ProjectSummaryCards,
  RecentAnalysesWidget,
  RiskOverviewWidget,
  PendingActionsWidget,
  ActivityTimelineWidget,
} from '../components/dashboard';
import { ErrorBoundary } from '../components/errors';

/**
 * Dashboard page - the main landing page for authenticated users.
 *
 * Displays a comprehensive overview of the user's HazOps work:
 * - Project summary cards (active, completed, draft counts)
 * - Recent analyses widget with status indicators
 * - Risk overview chart showing risk distribution
 * - Pending actions widget for items needing review
 * - Activity timeline showing recent system activity
 *
 * Layout uses a responsive grid:
 * - Top row: Project summary cards (full width)
 * - Middle row: Recent analyses (left) + Risk overview (right)
 * - Bottom row: Pending actions (left) + Activity timeline (right)
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(selectUser);

  /**
   * Format date for display.
   */
  const formatDate = (): string => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
          <p className="text-slate-500 mt-1">{formatDate()}</p>
        </div>

        {/* Welcome banner */}
        <div className="bg-white border border-slate-200 rounded p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Welcome back, {user?.name}</h3>
              <p className="text-slate-500 mt-1">
                Here's an overview of your HazOps analysis work.
              </p>
            </div>
            <Button
              onClick={() => navigate('/projects')}
              styles={{
                root: {
                  borderRadius: '4px',
                  backgroundColor: '#1e40af',
                  '&:hover': {
                    backgroundColor: '#1e3a8a',
                  },
                },
              }}
            >
              View All Projects
            </Button>
          </div>
        </div>

        {/* Project summary cards row */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
            Project Overview
          </h3>
          <ErrorBoundary
            fallbackVariant="widget"
            fallbackTitle="Failed to load project summary"
          >
            <ProjectSummaryCards />
          </ErrorBoundary>
        </section>

        {/* Middle row: Recent analyses + Risk overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recent analyses widget */}
          <ErrorBoundary
            fallbackVariant="widget"
            fallbackTitle="Failed to load recent analyses"
          >
            <RecentAnalysesWidget />
          </ErrorBoundary>

          {/* Risk overview chart */}
          <ErrorBoundary
            fallbackVariant="widget"
            fallbackTitle="Failed to load risk overview"
          >
            <RiskOverviewWidget />
          </ErrorBoundary>
        </div>

        {/* Bottom row: Pending actions + Activity timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending actions widget */}
          <ErrorBoundary
            fallbackVariant="widget"
            fallbackTitle="Failed to load pending actions"
          >
            <PendingActionsWidget />
          </ErrorBoundary>

          {/* Activity timeline widget */}
          <ErrorBoundary
            fallbackVariant="widget"
            fallbackTitle="Failed to load activity timeline"
          >
            <ActivityTimelineWidget />
          </ErrorBoundary>
        </div>

        {/* Quick links section */}
        <section className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/projects"
              className="bg-white border border-slate-200 rounded p-4 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <div className="text-sm font-medium text-slate-900">Browse Projects</div>
              <div className="text-xs text-slate-500 mt-1">View and manage your projects</div>
            </Link>

            <Link
              to="/profile"
              className="bg-white border border-slate-200 rounded p-4 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <div className="text-sm font-medium text-slate-900">Profile Settings</div>
              <div className="text-xs text-slate-500 mt-1">Update your account details</div>
            </Link>

            {(user?.role === 'administrator' || user?.role === 'lead_analyst') && (
              <Link
                to="/admin"
                className="bg-white border border-slate-200 rounded p-4 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <div className="text-sm font-medium text-slate-900">Administration</div>
                <div className="text-xs text-slate-500 mt-1">Manage users and settings</div>
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

