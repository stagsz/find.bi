import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { PasswordInput, Button, Alert } from '@mantine/core';
import type { ResetPasswordRequest } from '@hazop/types';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

/**
 * Reset password page component.
 *
 * Users arrive at this page from the password reset email link.
 * The token is passed as a URL query parameter.
 *
 * Features:
 * - Token validation from URL
 * - New password input with confirmation
 * - Password strength validation
 * - Success redirect to login
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoading, error } = useAuthStore();

  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [success, setSuccess] = useState(false);

  // Clear any stale auth errors on mount
  useEffect(() => {
    useAuthStore.getState().setError(null);
  }, []);

  /**
   * Validate password format and requirements.
   */
  const validateForm = (): boolean => {
    const errors: { newPassword?: string; confirmPassword?: string } = {};

    if (!newPassword) {
      errors.newPassword = 'Password is required';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one number';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!token) {
      return;
    }

    const data: ResetPasswordRequest = {
      token,
      newPassword,
    };

    const result = await authService.resetPassword(data);

    if (result.success) {
      setSuccess(true);
    }
  };

  /**
   * Get field-specific error from API response.
   */
  const getFieldError = (field: string): string | undefined => {
    if (!error?.errors) return undefined;
    const fieldError = error.errors.find((e) => e.field === field);
    return fieldError?.message;
  };

  // No token in URL - show error
  if (!token) {
    return (
      <div className="min-h-screen flex">
        {/* Left panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-800 p-12 flex-col justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">HazOp Assistant</h1>
            <p className="text-slate-400 mt-1">Industrial Safety Analysis Platform</p>
          </div>

          <div className="text-slate-300">
            <p className="text-lg font-medium mb-4">
              Structured hazard and operability analysis for process safety
            </p>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li>P&ID interpretation and node analysis</li>
              <li>Guide word methodology (IEC 61882)</li>
              <li>Risk assessment with LOPA validation</li>
              <li>Regulatory compliance (IEC 61511, ISO 31000, OSHA PSM)</li>
              <li>Professional report generation</li>
            </ul>
          </div>

          <p className="text-slate-500 text-xs">
            Compliant with industry standards for process hazard analysis
          </p>
        </div>

        {/* Right panel - Error message */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md">
            {/* Mobile branding */}
            <div className="lg:hidden mb-8">
              <h1 className="text-xl font-semibold text-slate-900">HazOp Assistant</h1>
              <p className="text-slate-500 text-sm">Industrial Safety Analysis Platform</p>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-900">Invalid reset link</h2>
              <p className="text-slate-500 mt-2">
                This password reset link is invalid or has expired.
              </p>
            </div>

            <Alert
              color="red"
              variant="light"
              className="mb-6"
              styles={{
                root: { borderRadius: '4px' },
              }}
            >
              The reset token is missing from the URL. Please use the link from your email or
              request a new password reset.
            </Alert>

            <div className="space-y-4">
              <Button
                fullWidth
                component={Link}
                to="/forgot-password"
                styles={{
                  root: {
                    backgroundColor: '#1e40af',
                    borderRadius: '4px',
                    height: '42px',
                    '&:hover': {
                      backgroundColor: '#1e3a8a',
                    },
                  },
                }}
              >
                Request new reset link
              </Button>

              <Button
                fullWidth
                variant="outline"
                component={Link}
                to="/login"
                styles={{
                  root: {
                    borderColor: '#1e40af',
                    color: '#1e40af',
                    borderRadius: '4px',
                    height: '42px',
                    '&:hover': {
                      backgroundColor: '#eff6ff',
                    },
                  },
                }}
              >
                Return to sign in
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state - show confirmation and redirect
  if (success) {
    return (
      <div className="min-h-screen flex">
        {/* Left panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-800 p-12 flex-col justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">HazOp Assistant</h1>
            <p className="text-slate-400 mt-1">Industrial Safety Analysis Platform</p>
          </div>

          <div className="text-slate-300">
            <p className="text-lg font-medium mb-4">
              Structured hazard and operability analysis for process safety
            </p>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li>P&ID interpretation and node analysis</li>
              <li>Guide word methodology (IEC 61882)</li>
              <li>Risk assessment with LOPA validation</li>
              <li>Regulatory compliance (IEC 61511, ISO 31000, OSHA PSM)</li>
              <li>Professional report generation</li>
            </ul>
          </div>

          <p className="text-slate-500 text-xs">
            Compliant with industry standards for process hazard analysis
          </p>
        </div>

        {/* Right panel - Success message */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md">
            {/* Mobile branding */}
            <div className="lg:hidden mb-8">
              <h1 className="text-xl font-semibold text-slate-900">HazOp Assistant</h1>
              <p className="text-slate-500 text-sm">Industrial Safety Analysis Platform</p>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-900">Password reset complete</h2>
              <p className="text-slate-500 mt-2">
                Your password has been successfully reset. You can now sign in with your new
                password.
              </p>
            </div>

            <Alert
              color="green"
              variant="light"
              className="mb-6"
              styles={{
                root: { borderRadius: '4px' },
              }}
            >
              Password has been reset successfully.
            </Alert>

            <Button
              fullWidth
              onClick={() => navigate('/login')}
              styles={{
                root: {
                  backgroundColor: '#1e40af',
                  borderRadius: '4px',
                  height: '42px',
                  '&:hover': {
                    backgroundColor: '#1e3a8a',
                  },
                },
              }}
            >
              Sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Form state - show password inputs
  return (
    <div className="min-h-screen flex">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-800 p-12 flex-col justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">HazOp Assistant</h1>
          <p className="text-slate-400 mt-1">Industrial Safety Analysis Platform</p>
        </div>

        <div className="text-slate-300">
          <p className="text-lg font-medium mb-4">
            Structured hazard and operability analysis for process safety
          </p>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li>P&ID interpretation and node analysis</li>
            <li>Guide word methodology (IEC 61882)</li>
            <li>Risk assessment with LOPA validation</li>
            <li>Regulatory compliance (IEC 61511, ISO 31000, OSHA PSM)</li>
            <li>Professional report generation</li>
          </ul>
        </div>

        <p className="text-slate-500 text-xs">
          Compliant with industry standards for process hazard analysis
        </p>
      </div>

      {/* Right panel - Reset password form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden mb-8">
            <h1 className="text-xl font-semibold text-slate-900">HazOp Assistant</h1>
            <p className="text-slate-500 text-sm">Industrial Safety Analysis Platform</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">Create new password</h2>
            <p className="text-slate-500 mt-1">
              Enter a new password for your account. Your password must be at least 8 characters
              and include uppercase, lowercase, and numbers.
            </p>
          </div>

          {/* API Error Alert */}
          {error && (
            <Alert
              color="red"
              variant="light"
              className="mb-6"
              styles={{
                root: { borderRadius: '4px' },
              }}
            >
              {error.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <PasswordInput
              label="New password"
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (validationErrors.newPassword) {
                  setValidationErrors((prev) => ({ ...prev, newPassword: undefined }));
                }
              }}
              error={validationErrors.newPassword || getFieldError('newPassword')}
              disabled={isLoading}
              required
              styles={{
                label: {
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: '#1e293b',
                },
                input: {
                  borderRadius: '4px',
                },
              }}
            />

            <PasswordInput
              label="Confirm password"
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (validationErrors.confirmPassword) {
                  setValidationErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
              error={validationErrors.confirmPassword}
              disabled={isLoading}
              required
              styles={{
                label: {
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: '#1e293b',
                },
                input: {
                  borderRadius: '4px',
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              styles={{
                root: {
                  backgroundColor: '#1e40af',
                  borderRadius: '4px',
                  height: '42px',
                  '&:hover': {
                    backgroundColor: '#1e3a8a',
                  },
                },
              }}
            >
              Reset password
            </Button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-8">
            Remember your password?{' '}
            <Link to="/login" className="text-blue-700 hover:text-blue-800 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
