import { Button } from '@mantine/core';
import { IconAlertTriangle, IconRefresh, IconHome, IconArrowLeft } from '@tabler/icons-react';

/**
 * Props for the ErrorFallback component.
 */
export interface ErrorFallbackProps {
  /**
   * The error that was thrown.
   */
  error?: Error;

  /**
   * Callback to attempt recovery (typically re-renders the children).
   */
  resetError?: () => void;

  /**
   * The visual variant of the fallback UI.
   * - 'page': Full-page error display (min-height: screen)
   * - 'section': Section-level error (medium padding)
   * - 'widget': Compact inline error (minimal padding)
   */
  variant?: 'page' | 'section' | 'widget';

  /**
   * Custom title to display. Defaults to context-appropriate message.
   */
  title?: string;

  /**
   * Custom description. If not provided, shows generic message.
   */
  description?: string;

  /**
   * Whether to show the error details (stack trace) in development mode.
   * Defaults to true in development, false in production.
   */
  showDetails?: boolean;

  /**
   * Optional navigation callback (e.g., go to dashboard).
   */
  onNavigateHome?: () => void;

  /**
   * Optional back navigation callback.
   */
  onGoBack?: () => void;
}

/**
 * ErrorFallback component displays a user-friendly error message when
 * an error boundary catches an exception.
 *
 * Designed to match the HazOp Assistant regulatory document aesthetic:
 * - Clean, professional appearance
 * - Clear error communication
 * - Actionable recovery options
 *
 * Usage with ErrorBoundary:
 * ```tsx
 * <ErrorBoundary
 *   fallback={({ error, resetError }) => (
 *     <ErrorFallback error={error} resetError={resetError} variant="section" />
 *   )}
 * >
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export function ErrorFallback({
  error,
  resetError,
  variant = 'section',
  title,
  description,
  showDetails = import.meta.env.DEV,
  onNavigateHome,
  onGoBack,
}: ErrorFallbackProps) {
  const isDev = import.meta.env.DEV;

  // Default titles based on variant
  const defaultTitle = {
    page: 'Something went wrong',
    section: 'Unable to load this section',
    widget: 'Error loading content',
  }[variant];

  // Default descriptions based on variant
  const defaultDescription = {
    page: 'An unexpected error has occurred. Our team has been notified and is working to resolve the issue.',
    section: 'An error occurred while loading this content. Please try again or contact support if the problem persists.',
    widget: 'Failed to load. Try refreshing.',
  }[variant];

  const displayTitle = title || defaultTitle;
  const displayDescription = description || defaultDescription;

  // Page-level full-screen error
  if (variant === 'page') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-lg w-full text-center">
          {/* Error Icon */}
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-50 border border-red-200 mb-6">
            <IconAlertTriangle size={32} stroke={1.5} className="text-red-600" />
          </div>

          {/* Error Code */}
          <div className="mb-4">
            <span className="text-5xl font-bold text-slate-300">Error</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">
            {displayTitle}
          </h1>

          {/* Description */}
          <p className="text-slate-500 mb-8 leading-relaxed">
            {displayDescription}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {resetError && (
              <Button
                variant="filled"
                leftSection={<IconRefresh size={16} stroke={2} />}
                onClick={resetError}
                styles={{
                  root: {
                    backgroundColor: '#1e40af',
                    borderRadius: '4px',
                    '&:hover': {
                      backgroundColor: '#1e3a8a',
                    },
                  },
                }}
              >
                Try Again
              </Button>
            )}

            {onNavigateHome && (
              <Button
                variant="outline"
                color="gray"
                leftSection={<IconHome size={16} stroke={2} />}
                onClick={onNavigateHome}
                styles={{
                  root: {
                    borderRadius: '4px',
                  },
                }}
              >
                Go to Dashboard
              </Button>
            )}

            {onGoBack && (
              <Button
                variant="outline"
                color="gray"
                leftSection={<IconArrowLeft size={16} stroke={2} />}
                onClick={onGoBack}
                styles={{
                  root: {
                    borderRadius: '4px',
                  },
                }}
              >
                Go Back
              </Button>
            )}
          </div>

          {/* Error Details (dev only) */}
          {showDetails && error && isDev && (
            <div className="mt-8 text-left">
              <details className="bg-slate-100 border border-slate-200 rounded p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-700 mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="mt-3 space-y-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Message
                    </span>
                    <p className="text-sm text-red-700 font-mono mt-1">
                      {error.message}
                    </p>
                  </div>
                  {error.stack && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Stack Trace
                      </span>
                      <pre className="text-xs text-slate-600 font-mono mt-1 overflow-auto max-h-48 whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {/* Support Text */}
          <p className="text-slate-400 text-sm mt-8">
            If this problem persists, please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  // Section-level error
  if (variant === 'section') {
    return (
      <div className="bg-white border border-slate-200 rounded p-6">
        <div className="flex items-start gap-4">
          {/* Error Icon */}
          <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-red-50 border border-red-200">
            <IconAlertTriangle size={20} stroke={1.5} className="text-red-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              {displayTitle}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {displayDescription}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {resetError && (
                <Button
                  size="sm"
                  variant="light"
                  color="blue"
                  leftSection={<IconRefresh size={14} stroke={2} />}
                  onClick={resetError}
                  styles={{
                    root: {
                      borderRadius: '4px',
                    },
                  }}
                >
                  Try Again
                </Button>
              )}
            </div>

            {/* Error Details (dev only) */}
            {showDetails && error && isDev && (
              <details className="mt-4 bg-slate-50 border border-slate-200 rounded p-3">
                <summary className="cursor-pointer text-xs font-medium text-slate-600">
                  Show Error Details
                </summary>
                <p className="text-xs text-red-700 font-mono mt-2 break-all">
                  {error.message}
                </p>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Widget-level compact error
  return (
    <div className="bg-red-50 border border-red-200 rounded p-3">
      <div className="flex items-center gap-2">
        <IconAlertTriangle size={16} stroke={1.5} className="text-red-600 flex-shrink-0" />
        <span className="text-sm text-red-700 flex-1">
          {displayTitle}
        </span>
        {resetError && (
          <button
            type="button"
            onClick={resetError}
            className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
          >
            <IconRefresh size={12} stroke={2} />
            Retry
          </button>
        )}
      </div>
      {showDetails && error && isDev && (
        <p className="text-xs text-red-600 font-mono mt-1 truncate">
          {error.message}
        </p>
      )}
    </div>
  );
}
