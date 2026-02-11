/**
 * Likelihood level dropdown selector component.
 *
 * Displays a 1-5 likelihood scale with descriptions for risk assessment.
 * Each option shows the likelihood level number, label, and a brief description.
 *
 * Likelihood Scale (per industry standard HazOps methodology):
 * - 1: Rare - Unlikely to occur during plant lifetime
 * - 2: Unlikely - Could occur once in plant lifetime
 * - 3: Possible - Could occur several times during plant lifetime
 * - 4: Likely - Expected to occur multiple times per year
 * - 5: Almost Certain - Expected to occur frequently
 */

import { Select, type ComboboxItem } from '@mantine/core';
import {
  LIKELIHOOD_LEVELS,
  LIKELIHOOD_LABELS,
  LIKELIHOOD_DESCRIPTIONS,
  type LikelihoodLevel,
} from '@hazop/types';

/**
 * Select option with likelihood value and description.
 */
interface LikelihoodOption extends ComboboxItem {
  value: string;
  label: string;
  description: string;
}

/**
 * Likelihood selector options with labels and descriptions.
 */
const LIKELIHOOD_OPTIONS: LikelihoodOption[] = LIKELIHOOD_LEVELS.map((level) => ({
  value: String(level),
  label: `${level} - ${LIKELIHOOD_LABELS[level]}`,
  description: LIKELIHOOD_DESCRIPTIONS[level],
}));

/**
 * Color coding for likelihood levels (background and text).
 * Uses semantic colors appropriate for industrial safety applications.
 */
const LIKELIHOOD_COLORS: Record<LikelihoodLevel, { bg: string; text: string }> = {
  1: { bg: 'bg-green-50', text: 'text-green-800' },
  2: { bg: 'bg-lime-50', text: 'text-lime-800' },
  3: { bg: 'bg-amber-50', text: 'text-amber-800' },
  4: { bg: 'bg-orange-50', text: 'text-orange-800' },
  5: { bg: 'bg-red-50', text: 'text-red-800' },
};

/**
 * Props for the LikelihoodSelector component.
 */
interface LikelihoodSelectorProps {
  /** Currently selected likelihood level (1-5) or null if not set */
  value: LikelihoodLevel | null;

  /** Callback when likelihood level changes */
  onChange: (value: LikelihoodLevel | null) => void;

  /** Optional placeholder text when no value selected */
  placeholder?: string;

  /** Whether the selector is disabled */
  disabled?: boolean;

  /** Optional error message to display */
  error?: string;

  /** Optional label for the field */
  label?: string;

  /** Whether the field is required */
  required?: boolean;

  /** Size of the selector (xs, sm, md, lg) */
  size?: 'xs' | 'sm' | 'md' | 'lg';

  /** Optional className for additional styling */
  className?: string;
}

/**
 * Dropdown selector for likelihood level (1-5 scale).
 * Shows label and description for each likelihood level.
 */
export function LikelihoodSelector({
  value,
  onChange,
  placeholder = 'Select likelihood',
  disabled = false,
  error,
  label,
  required = false,
  size = 'sm',
  className = '',
}: LikelihoodSelectorProps) {
  /**
   * Handle selection change.
   * Converts string value back to LikelihoodLevel number.
   */
  const handleChange = (selectedValue: string | null) => {
    if (selectedValue === null || selectedValue === '') {
      onChange(null);
    } else {
      const numValue = parseInt(selectedValue, 10);
      if (numValue >= 1 && numValue <= 5) {
        onChange(numValue as LikelihoodLevel);
      }
    }
  };

  /**
   * Render option with likelihood info and description.
   */
  const renderOption = ({ option }: { option: ComboboxItem }) => {
    const likelihoodOption = option as LikelihoodOption;
    const level = parseInt(likelihoodOption.value, 10) as LikelihoodLevel;
    const colors = LIKELIHOOD_COLORS[level];

    return (
      <div className="py-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-semibold ${colors.bg} ${colors.text}`}
          >
            {level}
          </span>
          <span className="font-medium text-slate-900">{LIKELIHOOD_LABELS[level]}</span>
        </div>
        <div className="ml-7 text-xs text-slate-500 mt-0.5">{likelihoodOption.description}</div>
      </div>
    );
  };

  return (
    <div className={className}>
      <Select
        label={label}
        placeholder={placeholder}
        size={size}
        data={LIKELIHOOD_OPTIONS}
        value={value !== null ? String(value) : null}
        onChange={handleChange}
        disabled={disabled}
        error={error}
        required={required}
        clearable
        renderOption={renderOption}
        styles={{
          input: {
            borderRadius: '4px',
            '&:focus': {
              borderColor: '#1e40af',
            },
          },
          label: {
            fontSize: '0.75rem',
            fontWeight: 500,
            color: '#334155',
            marginBottom: '4px',
          },
          error: {
            fontSize: '0.75rem',
          },
        }}
      />
    </div>
  );
}

/**
 * Display-only likelihood badge component.
 * Shows the likelihood level with appropriate color coding.
 */
interface LikelihoodBadgeProps {
  /** Likelihood level (1-5) */
  value: LikelihoodLevel;

  /** Whether to show the full label or just the number */
  showLabel?: boolean;

  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
}

export function LikelihoodBadge({ value, showLabel = true, size = 'sm' }: LikelihoodBadgeProps) {
  const colors = LIKELIHOOD_COLORS[value];

  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${colors.bg} ${colors.text} ${sizeClasses[size]}`}
    >
      <span className="font-semibold">{value}</span>
      {showLabel && <span>- {LIKELIHOOD_LABELS[value]}</span>}
    </span>
  );
}
