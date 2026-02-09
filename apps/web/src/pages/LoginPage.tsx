import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TextInput, PasswordInput, Button, Checkbox, Alert } from '@mantine/core';
import type { LoginRequest } from '@hazop/types';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

/**
 * Login page component with email/password form.
 *
 * Features:
 * - Email and password input fields with validation
 * - "Remember me" checkbox for extended session
 * - Error display for failed login attempts
 * - Loading state during authentication
 * - Link to registration page
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { isLoading, error } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  /**
   * Validate form inputs before submission.
   */
  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
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

    const credentials: LoginRequest = {
      email: email.trim(),
      password,
      rememberMe,
    };

    const result = await authService.login(credentials);

    if (result.success) {
      navigate('/');
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

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden mb-8">
            <h1 className="text-xl font-semibold text-slate-900">HazOp Assistant</h1>
            <p className="text-slate-500 text-sm">Industrial Safety Analysis Platform</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
            <p className="text-slate-500 mt-1">Enter your credentials to access your account</p>
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
                if (validationErrors.email) {
                  setValidationErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              error={validationErrors.email || getFieldError('email')}
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

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (validationErrors.password) {
                  setValidationErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              error={validationErrors.password || getFieldError('password')}
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

            <div className="flex items-center justify-between">
              <Checkbox
                label="Remember me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.currentTarget.checked)}
                disabled={isLoading}
                styles={{
                  label: {
                    color: '#475569',
                  },
                }}
              />

              <Link
                to="/forgot-password"
                className="text-sm text-blue-700 hover:text-blue-800 font-medium"
              >
                Forgot password?
              </Link>
            </div>

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
              Sign in
            </Button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-8">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-blue-700 hover:text-blue-800 font-medium">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
