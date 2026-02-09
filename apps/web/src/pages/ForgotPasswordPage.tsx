import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TextInput, Button, Alert } from '@mantine/core';
import type { ForgotPasswordRequest } from '@hazop/types';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

/**
 * Forgot password page component.
 *
 * Features:
 * - Email input field with validation
 * - Success message after submission
 * - Development mode shows reset link directly
 * - Link back to login page
 */
export function ForgotPasswordPage() {
  const { isLoading, error } = useAuthStore();

  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | undefined>();

  /**
   * Validate email format.
   */
  const validateForm = (): boolean => {
    if (!email.trim()) {
      setValidationError('Email is required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError('Please enter a valid email address');
      return false;
    }

    setValidationError(undefined);
    return true;
  };

  /**
   * Handle form submission.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const data: ForgotPasswordRequest = {
      email: email.trim(),
    };

    const result = await authService.forgotPassword(data);

    if (result.success) {
      setSubmitted(true);
      // In development, capture the reset URL for easy testing
      if (result.data._dev?.resetUrl) {
        setDevResetUrl(result.data._dev.resetUrl);
      }
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

  // Success state - show confirmation message
  if (submitted) {
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
              <h2 className="text-2xl font-semibold text-slate-900">Check your email</h2>
              <p className="text-slate-500 mt-2">
                If an account exists for <span className="font-medium">{email}</span>, you will
                receive a password reset link shortly.
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
              Password reset instructions have been sent.
            </Alert>

            {/* Development mode: show reset link directly */}
            {devResetUrl && (
              <Alert
                color="blue"
                variant="light"
                className="mb-6"
                styles={{
                  root: { borderRadius: '4px' },
                }}
              >
                <p className="text-sm font-medium mb-2">Development Mode</p>
                <p className="text-sm">
                  Reset link:{' '}
                  <a
                    href={devResetUrl}
                    className="text-blue-700 hover:underline break-all"
                  >
                    {devResetUrl}
                  </a>
                </p>
              </Alert>
            )}

            <div className="space-y-4">
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

              <p className="text-center text-slate-500 text-sm">
                Didn&apos;t receive the email?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setDevResetUrl(undefined);
                  }}
                  className="text-blue-700 hover:text-blue-800 font-medium"
                >
                  Try again
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form state - show email input
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

      {/* Right panel - Forgot password form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden mb-8">
            <h1 className="text-xl font-semibold text-slate-900">HazOp Assistant</h1>
            <p className="text-slate-500 text-sm">Industrial Safety Analysis Platform</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">Reset your password</h2>
            <p className="text-slate-500 mt-1">
              Enter your email address and we&apos;ll send you a link to reset your password.
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
            <TextInput
              label="Email address"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (validationError) {
                  setValidationError(undefined);
                }
              }}
              error={validationError || getFieldError('email')}
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
                  '&:focus': {
                    borderColor: '#1e40af',
                  },
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
              Send reset link
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
