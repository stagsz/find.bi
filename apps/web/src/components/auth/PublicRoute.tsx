import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated, selectIsInitialized } from '../../store/auth.store';
import { LoadingScreen } from '../LoadingScreen';

/**
 * Props for the PublicRoute component.
 */
interface PublicRouteProps {
  /** The public content to render if not authenticated */
  children: React.ReactNode;
}

/**
 * Route guard component for public-only routes (login, register, etc.).
 *
 * Redirects authenticated users away from public-only pages to the dashboard
 * or to the originally requested page (if coming from a protected route).
 *
 * @example
 * ```tsx
 * <Route path="/login" element={
 *   <PublicRoute>
 *     <LoginPage />
 *   </PublicRoute>
 * } />
 * ```
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isInitialized = useAuthStore(selectIsInitialized);

  // Show loading screen while auth state is being determined
  if (!isInitialized) {
    return <LoadingScreen />;
  }

  // Redirect authenticated users to their intended destination or dashboard
  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
}
