import { Button } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, selectUser } from '../store/auth.store';
import { authService } from '../services/auth.service';

/**
 * Dashboard page - the main landing page for authenticated users.
 *
 * This is a placeholder component that will be expanded in Phase 10 (DASH-01).
 * Currently displays user info and logout functionality.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(selectUser);
  const isLoading = useAuthStore((state) => state.isLoading);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
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
              <span className="text-sm text-slate-600">
                {user?.name} ({user?.role.replace('_', ' ')})
              </span>
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
        <div className="bg-white rounded border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Welcome, {user?.name}</h2>
          <p className="text-slate-500 mb-6">
            This is a placeholder dashboard. Full dashboard functionality will be implemented in
            Phase 10.
          </p>

          <div className="bg-slate-50 rounded border border-slate-200 p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Account Details</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Name</dt>
                <dd className="text-slate-900 font-medium">{user?.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-900 font-medium">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Role</dt>
                <dd className="text-slate-900 font-medium capitalize">
                  {user?.role.replace('_', ' ')}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Organization</dt>
                <dd className="text-slate-900 font-medium">
                  {user?.organization || 'Not specified'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
