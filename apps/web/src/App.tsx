import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  DashboardPage,
  UnauthorizedPage,
  ProfilePage,
  AdminPage,
} from './pages';
import { ProtectedRoute, PublicRoute } from './components/auth';

/**
 * Main application component with routing.
 *
 * Public routes (redirect authenticated users to dashboard):
 * - /login - Login page
 * - /register - Registration page
 * - /forgot-password - Password reset request page
 * - /reset-password - Password reset confirmation page (with token)
 *
 * Protected routes (require authentication):
 * - / - Dashboard (any authenticated user)
 * - /profile - User profile page (any authenticated user)
 * - /unauthorized - Shown when user lacks role permissions
 *
 * Role-protected routes (require specific minimum role):
 * - /admin - Administrator only (user management)
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - redirect authenticated users away */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          }
        />

        {/* Protected routes - require authentication */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Profile page - accessible to all authenticated users */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Unauthorized page - accessible to all authenticated users */}
        <Route
          path="/unauthorized"
          element={
            <ProtectedRoute>
              <UnauthorizedPage />
            </ProtectedRoute>
          }
        />

        {/* Admin routes - require administrator role */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute minRole="administrator">
              <AdminPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all: redirect unknown routes to dashboard (auth guard handles login redirect) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
