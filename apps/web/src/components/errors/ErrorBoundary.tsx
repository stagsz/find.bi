import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorFallback, ErrorFallbackProps } from './ErrorFallback';

/**
 * Props for error fallback render function.
 */
export interface FallbackRenderProps {
  error: Error;
  resetError: () => void;
}

/**
 * Props for the ErrorBoundary component.
 */
export interface ErrorBoundaryProps {
  /**
   * Children to render when there's no error.
   */
  children: ReactNode;

  /**
   * Custom fallback render function. If not provided, uses ErrorFallback component.
   */
  fallback?: (props: FallbackRenderProps) => ReactNode;

  /**
   * Fallback variant to use with default ErrorFallback component.
   * Only used when custom fallback is not provided.
   */
  fallbackVariant?: ErrorFallbackProps['variant'];

  /**
   * Called when an error is caught. Useful for error logging/reporting.
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Called when the error boundary resets (user clicks "Try Again").
   */
  onReset?: () => void;

  /**
   * Custom title for the default fallback UI.
   */
  fallbackTitle?: string;

  /**
   * Custom description for the default fallback UI.
   */
  fallbackDescription?: string;

  /**
   * Optional callback for "Go to Dashboard" button in page-level fallback.
   */
  onNavigateHome?: () => void;

  /**
   * Optional callback for "Go Back" button in page-level fallback.
   */
  onGoBack?: () => void;
}

/**
 * State for the ErrorBoundary component.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary catches JavaScript errors in its child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 *
 * This is a class component because React error boundaries require
 * `componentDidCatch` and `getDerivedStateFromError` lifecycle methods
 * which are only available in class components.
 *
 * Usage:
 * ```tsx
 * // Basic usage with default fallback
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 *
 * // With custom fallback variant
 * <ErrorBoundary fallbackVariant="widget">
 *   <SmallWidget />
 * </ErrorBoundary>
 *
 * // With custom fallback render
 * <ErrorBoundary
 *   fallback={({ error, resetError }) => (
 *     <CustomErrorUI error={error} onRetry={resetError} />
 *   )}
 * >
 *   <YourComponent />
 * </ErrorBoundary>
 *
 * // With error logging
 * <ErrorBoundary
 *   onError={(error, errorInfo) => {
 *     logErrorToService(error, errorInfo);
 *   }}
 * >
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 *
 * Note: Error boundaries do NOT catch errors in:
 * - Event handlers (use try-catch instead)
 * - Asynchronous code (promises, setTimeout, etc.)
 * - Server-side rendering
 * - Errors thrown in the error boundary itself
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Update state to trigger fallback UI on next render.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Log error details and call optional error handler.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    // Call optional error handler for external logging
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Reset the error state to retry rendering children.
   */
  resetError = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const {
      children,
      fallback,
      fallbackVariant = 'section',
      fallbackTitle,
      fallbackDescription,
      onNavigateHome,
      onGoBack,
    } = this.props;
    const { hasError, error } = this.state;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback({ error, resetError: this.resetError });
      }

      // Use default ErrorFallback component
      return (
        <ErrorFallback
          error={error}
          resetError={this.resetError}
          variant={fallbackVariant}
          title={fallbackTitle}
          description={fallbackDescription}
          onNavigateHome={onNavigateHome}
          onGoBack={onGoBack}
        />
      );
    }

    return children;
  }
}
