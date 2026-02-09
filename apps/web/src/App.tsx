import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './pages';

/**
 * Main application component with routing.
 *
 * Public routes:
 * - /login - Login page
 * - /register - Registration page
 * - /forgot-password - Password reset request page
 * - /reset-password - Password reset confirmation page (with token)
 *
 * Protected routes (TODO: AUTH-13):
 * - / - Dashboard (requires authentication)
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Placeholder: redirect root to login for now */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Catch-all: redirect unknown routes to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
