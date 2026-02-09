import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TextInput, PasswordInput, Button, Alert, Select } from '@mantine/core';
import type { RegisterRequest, UserRole } from '@hazop/types';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

/**
 * Role options for the registration form.
 * Excludes administrator as that role cannot be self-assigned.
 */
const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'analyst',
    label: 'Analyst',
    description: 'Conduct HazOps analyses and create reports',
  },
  {
    value: 'lead_analyst',
    label: 'Lead Analyst',
    description: 'Manage projects and review analyses',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to projects and reports',
  },
];

/**
 * Registration page component with user registration form.
 *
 * Features:
 * - Email, password, confirm password, name, and organization fields
 * - Optional role selection (defaults to analyst)
 * - Password strength validation
 * - Error display for failed registration attempts
 * - Loading state during registration
 * - Link to login page
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const { isLoading, error } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState<UserRole>('analyst');
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    name?: string;
    organization?: string;
  }>({});

  /**
   * Validate form inputs before submission.
   */
  const validateForm = (): boolean => {
    const errors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      name?: string;
      organization?: string;
    } = {};

    // Email validation
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    // Confirm password validation
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Name validation
    if (!name.trim()) {
      errors.name = 'Name is required';
    }

    // Organization validation
    if (!organization.trim()) {
      errors.organization = 'Organization is required';
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

    const registration: RegisterRequest = {
      email: email.trim(),
      password,
      name: name.trim(),
      organization: organization.trim(),
      role,
    };

    const result = await authService.register(registration);

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
            Join your team in conducting structured hazard analysis
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

      {/* Right panel - Registration form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden mb-8">
            <h1 className="text-xl font-semibold text-slate-900">HazOp Assistant</h1>
            <p className="text-slate-500 text-sm">Industrial Safety Analysis Platform</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">Create account</h2>
            <p className="text-slate-500 mt-1">Register to request access to the platform</p>
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
              label="Full name"
              placeholder="John Smith"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationErrors.name) {
                  setValidationErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              error={validationErrors.name || getFieldError('name')}
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

            <TextInput
              label="Organization"
              placeholder="Acme Industries"
              value={organization}
              onChange={(e) => {
                setOrganization(e.target.value);
                if (validationErrors.organization) {
                  setValidationErrors((prev) => ({ ...prev, organization: undefined }));
                }
              }}
              error={validationErrors.organization || getFieldError('organization')}
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

            <Select
              label="Requested role"
              placeholder="Select a role"
              value={role}
              onChange={(value) => setRole(value as UserRole)}
              data={ROLE_OPTIONS.map((r) => ({
                value: r.value,
                label: r.label,
              }))}
              disabled={isLoading}
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
              label="Password"
              placeholder="At least 8 characters"
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

            <PasswordInput
              label="Confirm password"
              placeholder="Re-enter your password"
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
              Create account
            </Button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-700 hover:text-blue-800 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
