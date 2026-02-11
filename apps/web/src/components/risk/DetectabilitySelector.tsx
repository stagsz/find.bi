/**
 * Detectability level dropdown selector component.
 *
 * Displays a 1-5 detectability scale with descriptions for risk assessment.
 * Each option shows the detectability level number, label, and a brief description.
 *
 * Detectability Scale (per industry standard HazOps methodology):
 * - 1: Almost Certain - Deviation will almost certainly be detected before impact
 * - 2: High - Good chance of detection before impact
 * - 3: Moderate - May or may not be detected before impact
 * - 4: Low - Unlikely to be detected before impact
 * - 5: Undetectable - No means of detection before impact
 */

import { Select, type ComboboxItem } from '@mantine/core';
import {
  DETECTABILITY_LEVELS,
  DETECTABILITY_LABELS,
  DETECTABILITY_DESCRIPTIONS,
  type DetectabilityLevel,
} from '@hazop/types';

/**
 * Select option with detectability value and description.
 */
interface DetectabilityOption extends ComboboxItem {
  value: string;
  label: string;
  description: string;
}

/**
 * Detectability selector options with labels and descriptions.
 */
const DETECTABILITY_OPTIONS: DetectabilityOption[] = DETECTABILITY_LEVELS.map((level) => ({
  value: String(level),
  label: `${level} - ${DETECTABILITY_LABELS[level]}`,
  description: DETECTABILITY_DESCRIPTIONS[level],
}));

/**
 * Color coding for detectability levels (background and text).
 * Uses semantic colors appropriate for industrial safety applications.
 */
const DETECTABILITY_COLORS: Record<DetectabilityLevel, { bg: string; text: string }> = {
  1: { bg: 'bg-green-50', text: 'text-green-800' },
  2: { bg: 'bg-lime-50', text: 'text-lime-800' },
  3: { bg: 'bg-amber-50', text: 'text-amber-800' },
  4: { bg: 'bg-orange-50', text: 'text-orange-800' },
  5: { bg: 'bg-red-50', text: 'text-red-800' },
};

/**
 * Props for the DetectabilitySelector component.
 */
interface DetectabilitySelectorProps {
  /** Currently selected detectability level (1-5) or null if not set */
  value: DetectabilityLevel | null;

  /** Callback when detectability level changes */
  onChange: (value: DetectabilityLevel | null) => void;

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
 * Dropdown selector for detectability level (1-5 scale).
 * Shows label and description for each detectability level.
 */
export function DetectabilitySelector({
  value,
  onChange,
  placeholder = 'Select detectability',
  disabled = false,
  error,
  label,
  required = false,
  size = 'sm',
  className = '',
}: DetectabilitySelectorProps) {
  /**
   * Handle selection change.
   * Converts string value back to DetectabilityLevel number.
   */
  const handleChange = (selectedValue: string | null) => {
    if (selectedValue === null || selectedValue === '') {
      onChange(null);
    } else {
      const numValue = parseInt(selectedValue, 10);
      if (numValue >= 1 && numValue <= 5) {
        onChange(numValue as DetectabilityLevel);
      }
    }
  };

  /**
   * Render option with detectability info and description.
   */
  const renderOption = ({ option }: { option: ComboboxItem }) => {
    const detectabilityOption = option as DetectabilityOption;
    const level = parseInt(detectabilityOption.value, 10) as DetectabilityLevel;
    const colors = DETECTABILITY_COLORS[level];

    return (
      <div className="py-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-semibold ${colors.bg} ${colors.text}`}
          >
            {level}
          </span>
          <span className="font-medium text-slate-900">{DETECTABILITY_LABELS[level]}</span>
        </div>
        <div className="ml-7 text-xs text-slate-500 mt-0.5">{detectabilityOption.description}</div>
      </div>
    );
  };

  return (
    <div className={className}>
      <Select
        label={label}
        placeholder={placeholder}
        size={size}
        data={DETECTABILITY_OPTIONS}
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
 * Display-only detectability badge component.
 * Shows the detectability level with appropriate color coding.
 */
interface DetectabilityBadgeProps {
  /** Detectability level (1-5) */
  value: DetectabilityLevel;

  /** Whether to show the full label or just the number */
  showLabel?: boolean;

  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
}

export function DetectabilityBadge({ value, showLabel = true, size = 'sm' }: DetectabilityBadgeProps) {
  const colors = DETECTABILITY_COLORS[value];

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
      {showLabel && <span>- {DETECTABILITY_LABELS[value]}</span>}
    </span>
  );
}
