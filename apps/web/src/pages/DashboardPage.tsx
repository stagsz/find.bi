import { Button } from '@mantine/core';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore, selectUser } from '../store/auth.store';
import { authService } from '../services/auth.service';
import { ProjectSummaryCards } from '../components/dashboard';

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
  const isLoading = useAuthStore((state) => state.isLoading);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

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
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">HazOp Assistant</h1>
            </div>

            <div className="flex items-center gap-4">
              <Link
                to="/profile"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                {user?.name} ({user?.role.replace('_', ' ')})
              </Link>
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                onClick={handleLogout}
                loading={isLoading}
                styles={{
                  root: {
                    borderRadius: '4px',
                  },
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

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
          <ProjectSummaryCards />
        </section>

        {/* Middle row: Recent analyses + Risk overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recent analyses widget - DASH-03 placeholder */}
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

          {/* Risk overview chart - DASH-04 placeholder */}
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
                  Risk distribution will appear once analyses are created.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom row: Pending actions + Activity timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending actions widget - DASH-05 placeholder */}
          <section className="bg-white border border-slate-200 rounded">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                Pending Actions
              </h3>
            </div>
            <div className="p-4">
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">No pending actions.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Items requiring your attention will appear here.
                </p>
              </div>
            </div>
          </section>

          {/* Activity timeline widget - DASH-06 placeholder */}
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
                  Activity timeline will show your recent actions.
                </p>
              </div>
            </div>
          </section>
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
