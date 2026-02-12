/**
 * Error boundary components for graceful error handling.
 *
 * These components catch JavaScript errors in their child component trees,
 * display user-friendly fallback UIs, and provide recovery options.
 *
 * Design follows the HazOp Assistant regulatory document aesthetic:
 * - Clean, professional error messages
 * - Clear recovery actions
 * - Appropriate visual hierarchy for different error contexts
 */

export { ErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps, FallbackRenderProps } from './ErrorBoundary';

export { ErrorFallback } from './ErrorFallback';
export type { ErrorFallbackProps } from './ErrorFallback';
