import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TextInput, Button, Alert } from '@mantine/core';
import { useAuthStore, selectUser } from '../store/auth.store';
import { userService } from '../services/user.service';
import { authService } from '../services/auth.service';

/**
 * Profile page component for viewing and editing user profile.
 *
 * Features:
 * - Display user profile information
 * - Edit name, email, and organization
 * - Client-side and server-side validation
 * - Success/error feedback
 * - Link back to dashboard
 */
export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore(selectUser);
  const { isLoading, error } = useAuthStore();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    email?: string;
    organization?: string;
  }>({});

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setOrganization(user.organization);
    }
  }, [user]);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  /**
   * Validate form inputs before submission.
   */
  const validateForm = (): boolean => {
    const errors: {
      name?: string;
      email?: string;
      organization?: string;
    } = {};

    // Name validation
    if (!name.trim()) {
      errors.name = 'Name is required';
    }

    // Email validation
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
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
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    const result = await userService.updateProfile({
      name: name.trim(),
      email: email.trim(),
      organization: organization.trim(),
    });

    if (result.success) {
      setSuccessMessage('Profile updated successfully');
      setIsEditing(false);
    }
  };

  /**
   * Cancel editing and reset form to current user data.
   */
  const handleCancel = () => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setOrganization(user.organization);
    }
    setValidationErrors({});
    setSuccessMessage(null);
    useAuthStore.getState().setError(null);
    setIsEditing(false);
  };

  /**
   * Get field-specific error from API response.
   */
  const getFieldError = (field: string): string | undefined => {
    if (!error?.errors) return undefined;
    const fieldError = error.errors.find((e) => e.field === field);
    return fieldError?.message;
  };

  /**
   * Format date for display.
   */
  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <Link to="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
                HazOp Assistant
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                {user?.name} ({user?.role.replace('_', ' ')})
              </span>
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                onClick={handleLogout}
                loading={isLoading}
                styles={{
                  root: {
                    borderRadius: '4px',
                  },
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link to="/" className="text-sm text-blue-700 hover:text-blue-800">
            Dashboard
          </Link>
          <span className="text-sm text-slate-400 mx-2">/</span>
          <span className="text-sm text-slate-600">Profile</span>
        </nav>

        <div className="bg-white rounded border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h1 className="text-xl font-semibold text-slate-900">Profile Settings</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your account information
            </p>
          </div>

          <div className="p-6">
            {/* Success Message */}
            {successMessage && (
              <Alert
                color="green"
                variant="light"
                className="mb-6"
                styles={{
                  root: { borderRadius: '4px' },
                }}
                onClose={() => setSuccessMessage(null)}
                withCloseButton
              >
                {successMessage}
              </Alert>
            )}

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

            {isEditing ? (
              /* Edit Mode */
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

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    loading={isLoading}
                    styles={{
                      root: {
                        backgroundColor: '#1e40af',
                        borderRadius: '4px',
                        height: '38px',
                        '&:hover': {
                          backgroundColor: '#1e3a8a',
                        },
                      },
                    }}
                  >
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="subtle"
                    color="gray"
                    onClick={handleCancel}
                    disabled={isLoading}
                    styles={{
                      root: {
                        borderRadius: '4px',
                        height: '38px',
                      },
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              /* View Mode */
              <div>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Full name</dt>
                    <dd className="mt-1 text-sm text-slate-900">{user?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Email address</dt>
                    <dd className="mt-1 text-sm text-slate-900">{user?.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Organization</dt>
                    <dd className="mt-1 text-sm text-slate-900">{user?.organization || 'Not specified'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Role</dt>
                    <dd className="mt-1 text-sm text-slate-900 capitalize">
                      {user?.role.replace('_', ' ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Member since</dt>
                    <dd className="mt-1 text-sm text-slate-900">{formatDate(user?.createdAt)}</dd>
                  </div>
                </dl>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <Button
                    onClick={() => setIsEditing(true)}
                    styles={{
                      root: {
                        backgroundColor: '#1e40af',
                        borderRadius: '4px',
                        height: '38px',
                        '&:hover': {
                          backgroundColor: '#1e3a8a',
                        },
                      },
                    }}
                  >
                    Edit profile
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account status section */}
        <div className="bg-white rounded border border-slate-200 mt-6">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Account Status</h2>
          </div>
          <div className="p-6">
            <dl className="space-y-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-slate-500">Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                      user?.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-slate-500">User ID</dt>
                <dd className="text-sm text-slate-600 font-mono">{user?.id}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-slate-500">Last updated</dt>
                <dd className="text-sm text-slate-600">{formatDate(user?.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
