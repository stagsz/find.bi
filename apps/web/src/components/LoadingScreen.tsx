import { Loader } from '@mantine/core';

/**
 * Full-screen loading indicator displayed during initial auth state check.
 *
 * Used by route guards (ProtectedRoute, PublicRoute) while waiting for
 * the Zustand auth store to hydrate from localStorage.
 */
export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader size="lg" color="blue" />
        <p className="text-slate-500 text-sm mt-4">Loading...</p>
      </div>
    </div>
  );
}
