import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated, selectIsInitialized } from '../../store/auth.store';
import { LoadingScreen } from '../LoadingScreen';

/**
 * Props for the ProtectedRoute component.
 */
interface ProtectedRouteProps {
  /** The protected content to render if authenticated */
  children: React.ReactNode;
  /** Minimum role required to access this route (optional) */
  minRole?: 'viewer' | 'analyst' | 'lead_analyst' | 'administrator';
}

/**
 * Route guard component that protects routes requiring authentication.
 *
 * Features:
 * - Redirects unauthenticated users to the login page
 * - Preserves the intended destination in location state for post-login redirect
 * - Shows loading screen while checking auth state
 * - Supports optional role-based access control
 *
 * @example
 * ```tsx
 * // Basic protection
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <DashboardPage />
 *   </ProtectedRoute>
 * } />
 *
 * // Role-based protection
 * <Route path="/admin" element={
 *   <ProtectedRoute minRole="administrator">
 *     <AdminPage />
 *   </ProtectedRoute>
 * } />
 * ```
 */
export function ProtectedRoute({ children, minRole }: ProtectedRouteProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isInitialized = useAuthStore(selectIsInitialized);
  const canAccess = useAuthStore((state) => state.canAccess);

  // Show loading screen while auth state is being determined
  if (!isInitialized) {
    return <LoadingScreen />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access if minRole is specified
  if (minRole && !canAccess(minRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
