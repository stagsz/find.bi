/**
 * Report progress indicator component.
 *
 * Displays the progress of report generation with:
 * - Progress bar visualization for generating reports
 * - Status-specific messaging and styling
 * - Optional estimated time remaining
 *
 * Designed for reuse across the report generation workflow, including
 * active report cards, report detail views, and inline status displays.
 */

import { Progress } from '@mantine/core';
import type { ReportStatus } from '@hazop/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the ReportProgressIndicator component.
 */
export interface ReportProgressIndicatorProps {
  /** Current status of the report */
  status: ReportStatus;

  /** Progress percentage (0-100), only used when status is 'generating' */
  progress?: number;

  /** Estimated seconds remaining, shown when available */
  estimatedSecondsRemaining?: number;

  /** Optional size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Show detailed status message */
  showMessage?: boolean;

  /** Optional className for additional styling */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Status messages for each report status.
 */
const STATUS_MESSAGES: Record<ReportStatus, string> = {
  pending: 'Waiting in queue...',
  generating: 'Generating report...',
  completed: 'Report ready',
  failed: 'Generation failed',
};

/**
 * Progress bar colors for each status.
 */
const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: 'gray',
  generating: 'blue',
  completed: 'green',
  failed: 'red',
};

/**
 * Size configurations.
 */
const SIZE_CONFIG = {
  sm: {
    progressSize: 'xs' as const,
    textSize: 'text-xs',
    spacing: 'mt-1',
  },
  md: {
    progressSize: 'sm' as const,
    textSize: 'text-sm',
    spacing: 'mt-1.5',
  },
  lg: {
    progressSize: 'md' as const,
    textSize: 'text-sm',
    spacing: 'mt-2',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get progress percentage based on status.
 * Returns the provided progress for generating status, or
 * status-appropriate defaults for other statuses.
 */
function getProgressValue(status: ReportStatus, progress?: number): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'generating':
      return progress ?? 50;
    case 'completed':
      return 100;
    case 'failed':
      return 0;
  }
}

/**
 * Format estimated time remaining in human-readable format.
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `~${seconds}s remaining`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes}m remaining`;
}

/**
 * Get status-specific message with optional progress percentage.
 */
function getStatusMessage(
  status: ReportStatus,
  progress?: number,
  estimatedSecondsRemaining?: number
): string {
  const baseMessage = STATUS_MESSAGES[status];

  if (status === 'generating') {
    const parts: string[] = [];

    if (progress !== undefined) {
      parts.push(`${progress}% complete`);
    }

    if (estimatedSecondsRemaining !== undefined && estimatedSecondsRemaining > 0) {
      parts.push(formatTimeRemaining(estimatedSecondsRemaining));
    }

    return parts.length > 0 ? parts.join(' - ') : baseMessage;
  }

  return baseMessage;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ReportProgressIndicator component.
 *
 * Provides visual feedback on report generation progress with appropriate
 * styling and messaging for each status state.
 */
export function ReportProgressIndicator({
  status,
  progress,
  estimatedSecondsRemaining,
  size = 'md',
  showMessage = true,
  className = '',
}: ReportProgressIndicatorProps) {
  const config = SIZE_CONFIG[size];
  const progressValue = getProgressValue(status, progress);
  const color = STATUS_COLORS[status];

  // Determine if the progress bar should be animated (only during generation)
  const isAnimated = status === 'generating';
  const isStriped = status === 'generating' || status === 'pending';

  // Determine text color based on status
  const textColorClass =
    status === 'failed'
      ? 'text-red-600'
      : status === 'completed'
        ? 'text-green-600'
        : 'text-slate-500';

  return (
    <div className={className}>
      {/* Progress bar - hidden for failed status */}
      {status !== 'failed' && (
        <Progress
          value={progressValue}
          size={config.progressSize}
          color={color}
          striped={isStriped}
          animated={isAnimated}
          aria-label={`Report generation progress: ${progressValue}%`}
        />
      )}

      {/* Status message */}
      {showMessage && (
        <p className={`${config.textSize} ${textColorClass} ${config.spacing}`}>
          {getStatusMessage(status, progress, estimatedSecondsRemaining)}
        </p>
      )}
    </div>
  );
}
