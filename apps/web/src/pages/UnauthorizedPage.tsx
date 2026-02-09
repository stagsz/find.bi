import { Button } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

/**
 * Unauthorized page displayed when a user lacks permission to access a route.
 *
 * This page is shown when:
 * - A user tries to access a role-restricted route without sufficient privileges
 * - The ProtectedRoute guard denies access based on minRole check
 */
export function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <span className="text-6xl font-bold text-slate-300">403</span>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Access Denied</h1>

        <p className="text-slate-500 mb-8">
          You do not have permission to view this page. This area requires elevated privileges that
          your current role does not provide.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="filled"
            onClick={() => navigate('/')}
            styles={{
              root: {
                backgroundColor: '#1e40af',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: '#1e3a8a',
                },
              },
            }}
          >
            Go to Dashboard
          </Button>

          <Button
            variant="outline"
            color="gray"
            onClick={() => navigate(-1)}
            styles={{
              root: {
                borderRadius: '4px',
              },
            }}
          >
            Go Back
          </Button>
        </div>

        <p className="text-slate-400 text-sm mt-8">
          If you believe this is an error, contact your administrator.
        </p>
      </div>
    </div>
  );
}
