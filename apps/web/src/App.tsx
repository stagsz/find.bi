import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  DashboardPage,
  UnauthorizedPage,
  ProfilePage,
  SettingsPage,
  AdminPage,
  ProjectsPage,
  ProjectDetailPage,
  AnalysisWorkspacePage,
  RiskDashboardPage,
  ComplianceValidationPage,
  ComplianceDashboardPage,
  ReportGenerationCenterPage,
} from './pages';
import { ProtectedRoute, PublicRoute } from './components/auth';
import { AppLayout } from './components/layout';

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
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
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

        {/* Protected routes with sidebar layout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard - main landing page */}
          <Route path="/" element={<DashboardPage />} />

          {/* Profile page - accessible to all authenticated users */}
          <Route path="/profile" element={<ProfilePage />} />

          {/* Settings page - accessible to all authenticated users */}
          <Route path="/settings" element={<SettingsPage />} />

          {/* Unauthorized page - accessible to all authenticated users */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Projects routes - accessible to all authenticated users */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route
            path="/projects/:projectId/analyses/:analysisId"
            element={<AnalysisWorkspacePage />}
          />
          <Route path="/projects/:projectId/risk-dashboard" element={<RiskDashboardPage />} />
          <Route path="/projects/:projectId/compliance" element={<ComplianceValidationPage />} />
          <Route
            path="/projects/:projectId/compliance-dashboard"
            element={<ComplianceDashboardPage />}
          />
          <Route path="/projects/:projectId/reports" element={<ReportGenerationCenterPage />} />

          {/* Admin routes - require administrator role */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute minRole="administrator">
                <AdminPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all: redirect unknown routes to dashboard (auth guard handles login redirect) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
