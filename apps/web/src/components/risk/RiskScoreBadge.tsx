/**
 * Risk score display badge component.
 *
 * Displays a color-coded badge showing the calculated risk score (1-125)
 * and the corresponding risk level (Low, Medium, High).
 *
 * Risk Score Calculation: Severity × Likelihood × Detectability
 * - Low Risk: 1-20 (green)
 * - Medium Risk: 21-60 (amber)
 * - High Risk: 61-125 (red)
 */

import {
  RISK_LEVEL_LABELS,
  RISK_THRESHOLDS,
  type RiskLevel,
} from '@hazop/types';

/**
 * Color coding for risk levels (background and text).
 * Uses semantic colors for industrial safety: green for safe, amber for caution, red for danger.
 */
const RISK_LEVEL_COLORS: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  high: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
};

/**
 * Determine risk level from a risk score.
 * Uses the defined thresholds: Low (1-20), Medium (21-60), High (61-125)
 */
export function getRiskLevelFromScore(score: number): RiskLevel {
  if (score <= RISK_THRESHOLDS.low.max) {
    return 'low';
  } else if (score <= RISK_THRESHOLDS.medium.max) {
    return 'medium';
  }
  return 'high';
}

/**
 * Props for the RiskScoreBadge component.
 */
interface RiskScoreBadgeProps {
  /** Calculated risk score (1-125) */
  riskScore: number;

  /** Optional pre-calculated risk level. If not provided, will be derived from score. */
  riskLevel?: RiskLevel;

  /** Whether to show the risk level label (e.g., "Low Risk") */
  showLabel?: boolean;

  /** Whether to show the numeric score */
  showScore?: boolean;

  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';

  /** Optional className for additional styling */
  className?: string;
}

/**
 * Display-only badge showing risk score with color coding.
 * Shows numeric score and risk level label with appropriate semantic colors.
 */
export function RiskScoreBadge({
  riskScore,
  riskLevel: providedRiskLevel,
  showLabel = true,
  showScore = true,
  size = 'sm',
  className = '',
}: RiskScoreBadgeProps) {
  // Use provided risk level or derive from score
  const riskLevel = providedRiskLevel ?? getRiskLevelFromScore(riskScore);
  const colors = RISK_LEVEL_COLORS[riskLevel];

  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const scoreSizeClasses = {
    xs: 'min-w-[1.5rem]',
    sm: 'min-w-[2rem]',
    md: 'min-w-[2.5rem]',
    lg: 'min-w-[3rem]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-medium border ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses[size]} ${className}`}
    >
      {showScore && (
        <span className={`font-semibold text-center ${scoreSizeClasses[size]}`}>
          {riskScore}
        </span>
      )}
      {showLabel && <span>{RISK_LEVEL_LABELS[riskLevel]}</span>}
    </span>
  );
}

/**
 * Props for the RiskScoreCompact component.
 */
interface RiskScoreCompactProps {
  /** Calculated risk score (1-125) */
  riskScore: number;

  /** Optional pre-calculated risk level. If not provided, will be derived from score. */
  riskLevel?: RiskLevel;

  /** Size variant */
  size?: 'xs' | 'sm' | 'md';

  /** Optional className for additional styling */
  className?: string;
}

/**
 * Compact risk score indicator showing only a colored dot and the score.
 * Useful for table cells and tight spaces.
 */
export function RiskScoreCompact({
  riskScore,
  riskLevel: providedRiskLevel,
  size = 'sm',
  className = '',
}: RiskScoreCompactProps) {
  const riskLevel = providedRiskLevel ?? getRiskLevelFromScore(riskScore);
  const colors = RISK_LEVEL_COLORS[riskLevel];

  const dotSizeClasses = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
  };

  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`${dotSizeClasses[size]} rounded-full ${colors.bg.replace('bg-', 'bg-').replace('-50', '-500')}`}
        title={RISK_LEVEL_LABELS[riskLevel]}
      />
      <span className={`font-medium ${textSizeClasses[size]} ${colors.text}`}>
        {riskScore}
      </span>
    </span>
  );
}

/**
 * Props for the RiskLevelBadge component.
 */
interface RiskLevelBadgeProps {
  /** Risk level to display */
  riskLevel: RiskLevel;

  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';

  /** Optional className for additional styling */
  className?: string;
}

/**
 * Display-only badge showing just the risk level (without score).
 * Useful when displaying aggregated or summary risk information.
 */
export function RiskLevelBadge({
  riskLevel,
  size = 'sm',
  className = '',
}: RiskLevelBadgeProps) {
  const colors = RISK_LEVEL_COLORS[riskLevel];

  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded font-medium border ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses[size]} ${className}`}
    >
      {RISK_LEVEL_LABELS[riskLevel]}
    </span>
  );
}
