import { useState, useCallback, useEffect, useMemo } from 'react';
import { TextInput, Checkbox, Button, Alert, Loader } from '@mantine/core';
import type { GuideWord, EquipmentType, PreparedAnswer, ApiError } from '@hazop/types';
import { GUIDE_WORD_LABELS } from '@hazop/types';
import { preparedSafeguardsService } from '../../services/prepared-safeguards.service';

/**
 * Props for the SafeguardsInput component.
 */
export interface SafeguardsInputProps {
  /** User-visible node identifier (e.g., "P-101") */
  nodeIdentifier: string;

  /** Equipment type of the selected node */
  equipmentType: EquipmentType;

  /** Selected guide word */
  guideWord: GuideWord;

  /** Currently selected safeguards */
  value: string[];

  /** Callback when selected safeguards change */
  onChange: (safeguards: string[]) => void;

  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * SafeguardsInput component for selecting safeguards in HazOps analysis.
 *
 * Features:
 * - Fetches context-aware prepared safeguards based on equipment type and guide word
 * - Multi-select checkboxes for prepared safeguards
 * - Search/filter within prepared safeguards
 * - Shows common safeguards prominently at the top
 * - Allows adding custom safeguards
 * - Displays safeguard descriptions on hover/focus
 */
export function SafeguardsInput({
  nodeIdentifier,
  equipmentType,
  guideWord,
  value,
  onChange,
  disabled = false,
}: SafeguardsInputProps) {
  // Prepared safeguards state
  const [preparedSafeguards, setPreparedSafeguards] = useState<PreparedAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [customSafeguard, setCustomSafeguard] = useState('');
  const [showAllSafeguards, setShowAllSafeguards] = useState(false);

  /**
   * Fetch prepared safeguards when context changes.
   */
  useEffect(() => {
    let isMounted = true;

    const fetchSafeguards = async () => {
      setIsLoading(true);
      setError(null);

      const result = await preparedSafeguardsService.getByContext(equipmentType, guideWord);

      if (!isMounted) return;

      if (result.success && result.data) {
        setPreparedSafeguards(result.data.answers);
      } else {
        setError(result.error || { code: 'UNKNOWN', message: 'Failed to load prepared safeguards' });
      }

      setIsLoading(false);
    };

    fetchSafeguards();

    return () => {
      isMounted = false;
    };
  }, [equipmentType, guideWord]);

  /**
   * Filter safeguards based on search query.
   */
  const filteredSafeguards = useMemo(() => {
    if (!searchQuery.trim()) {
      return preparedSafeguards;
    }

    const searchLower = searchQuery.toLowerCase();
    return preparedSafeguards.filter(
      (safeguard) =>
        safeguard.text.toLowerCase().includes(searchLower) ||
        (safeguard.description && safeguard.description.toLowerCase().includes(searchLower))
    );
  }, [preparedSafeguards, searchQuery]);

  /**
   * Separate common safeguards from others for display priority.
   */
  const { commonSafeguards, otherSafeguards } = useMemo(() => {
    const common = filteredSafeguards.filter((s) => s.isCommon);
    const others = filteredSafeguards.filter((s) => !s.isCommon);
    return { commonSafeguards: common, otherSafeguards: others };
  }, [filteredSafeguards]);

  /**
   * Determine which safeguards to display based on showAllSafeguards toggle.
   */
  const displayedOtherSafeguards = useMemo(() => {
    if (showAllSafeguards || searchQuery.trim()) {
      return otherSafeguards;
    }
    // Show first 5 other safeguards when collapsed
    return otherSafeguards.slice(0, 5);
  }, [otherSafeguards, showAllSafeguards, searchQuery]);

  const hasMoreSafeguards = otherSafeguards.length > 5 && !showAllSafeguards && !searchQuery.trim();

  /**
   * Handle toggling a safeguard selection.
   */
  const handleToggleSafeguard = useCallback(
    (safeguardText: string) => {
      if (disabled) return;

      const isSelected = value.includes(safeguardText);
      if (isSelected) {
        onChange(value.filter((s) => s !== safeguardText));
      } else {
        onChange([...value, safeguardText]);
      }
    },
    [value, onChange, disabled]
  );

  /**
   * Handle adding a custom safeguard.
   */
  const handleAddCustomSafeguard = useCallback(() => {
    const trimmedSafeguard = customSafeguard.trim();
    if (!trimmedSafeguard || disabled) return;

    // Check if already selected
    if (value.includes(trimmedSafeguard)) {
      setCustomSafeguard('');
      return;
    }

    onChange([...value, trimmedSafeguard]);
    setCustomSafeguard('');
  }, [customSafeguard, value, onChange, disabled]);

  /**
   * Handle Enter key in custom safeguard input.
   */
  const handleCustomSafeguardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomSafeguard();
      }
    },
    [handleAddCustomSafeguard]
  );

  /**
   * Check if a safeguard text is from the prepared list.
   */
  const isPreparedSafeguard = useCallback(
    (safeguardText: string) => {
      return preparedSafeguards.some((s) => s.text === safeguardText);
    },
    [preparedSafeguards]
  );

  /**
   * Get custom safeguards (selected safeguards that aren't from prepared list).
   */
  const customSafeguards = useMemo(() => {
    return value.filter((s) => !isPreparedSafeguard(s));
  }, [value, isPreparedSafeguard]);

  return (
    <div className="safeguards-input">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Safeguards</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {nodeIdentifier} • {GUIDE_WORD_LABELS[guideWord]}
          </p>
        </div>
        {value.length > 0 && (
          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
            {value.length} selected
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert
          color="red"
          variant="light"
          className="mb-3"
          styles={{ root: { borderRadius: '4px' } }}
          onClose={() => setError(null)}
          withCloseButton
        >
          {error.message}
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader size="sm" color="blue" />
          <span className="ml-2 text-sm text-slate-500">Loading safeguards...</span>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
        <>
          {/* Search Input */}
          <div className="mb-3">
            <TextInput
              placeholder="Search safeguards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={disabled}
              size="sm"
              styles={{
                input: {
                  borderRadius: '4px',
                  '&:focus': {
                    borderColor: '#1e40af',
                  },
                },
              }}
              rightSection={
                searchQuery && !disabled ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                ) : null
              }
            />
          </div>

          {/* Common Safeguards Section */}
          {commonSafeguards.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Common Safeguards
              </div>
              <div className="space-y-1">
                {commonSafeguards.map((safeguard) => (
                  <SafeguardCheckboxItem
                    key={safeguard.id}
                    safeguard={safeguard}
                    isSelected={value.includes(safeguard.text)}
                    onToggle={() => handleToggleSafeguard(safeguard.text)}
                    disabled={disabled}
                    isCommon={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Safeguards Section */}
          {displayedOtherSafeguards.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Other Safeguards
              </div>
              <div className="space-y-1">
                {displayedOtherSafeguards.map((safeguard) => (
                  <SafeguardCheckboxItem
                    key={safeguard.id}
                    safeguard={safeguard}
                    isSelected={value.includes(safeguard.text)}
                    onToggle={() => handleToggleSafeguard(safeguard.text)}
                    disabled={disabled}
                    isCommon={false}
                  />
                ))}
              </div>

              {/* Show More Button */}
              {hasMoreSafeguards && (
                <button
                  type="button"
                  onClick={() => setShowAllSafeguards(true)}
                  className="mt-2 text-sm text-blue-700 hover:text-blue-800 font-medium"
                  disabled={disabled}
                >
                  Show {otherSafeguards.length - 5} more safeguards...
                </button>
              )}

              {/* Collapse Button */}
              {showAllSafeguards && otherSafeguards.length > 5 && !searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setShowAllSafeguards(false)}
                  className="mt-2 text-sm text-slate-500 hover:text-slate-700"
                  disabled={disabled}
                >
                  Show less
                </button>
              )}
            </div>
          )}

          {/* No Results */}
          {filteredSafeguards.length === 0 && searchQuery.trim() && (
            <div className="text-sm text-slate-500 text-center py-4">
              No safeguards match "{searchQuery}"
            </div>
          )}

          {/* Custom Safeguards Section */}
          {customSafeguards.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Custom Safeguards
              </div>
              <div className="space-y-1">
                {customSafeguards.map((safeguardText) => (
                  <div
                    key={safeguardText}
                    className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200"
                  >
                    <Checkbox
                      checked={true}
                      onChange={() => handleToggleSafeguard(safeguardText)}
                      disabled={disabled}
                      size="sm"
                      styles={{
                        input: {
                          borderRadius: '3px',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        },
                      }}
                    />
                    <span className="text-sm text-slate-900">{safeguardText}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Custom Safeguard */}
          <div className="border-t border-slate-200 pt-3 mt-3">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Add Custom Safeguard
            </div>
            <div className="flex gap-2">
              <TextInput
                placeholder="Enter a custom safeguard..."
                value={customSafeguard}
                onChange={(e) => setCustomSafeguard(e.target.value)}
                onKeyDown={handleCustomSafeguardKeyDown}
                disabled={disabled}
                className="flex-1"
                size="sm"
                styles={{
                  input: {
                    borderRadius: '4px',
                    '&:focus': {
                      borderColor: '#1e40af',
                    },
                  },
                }}
              />
              <Button
                onClick={handleAddCustomSafeguard}
                disabled={!customSafeguard.trim() || disabled}
                size="sm"
                variant="light"
                color="blue"
                styles={{
                  root: {
                    borderRadius: '4px',
                  },
                }}
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Press Enter to add a safeguard not in the prepared list
            </p>
          </div>
        </>
      )}

      {disabled && (
        <p className="text-xs text-amber-600 mt-3">
          Safeguards can only be modified when the analysis is in draft status.
        </p>
      )}
    </div>
  );
}

/**
 * Props for SafeguardCheckboxItem component.
 */
interface SafeguardCheckboxItemProps {
  safeguard: PreparedAnswer;
  isSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
  isCommon: boolean;
}

/**
 * Individual safeguard checkbox item with description tooltip.
 */
function SafeguardCheckboxItem({
  safeguard,
  isSelected,
  onToggle,
  disabled,
  isCommon,
}: SafeguardCheckboxItemProps) {
  return (
    <label
      className={`
        flex items-start gap-2 p-2 rounded cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-200'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-100'}
        ${isCommon && !isSelected ? 'border-l-2 border-l-green-500' : ''}
      `}
    >
      <Checkbox
        checked={isSelected}
        onChange={onToggle}
        disabled={disabled}
        size="sm"
        styles={{
          input: {
            borderRadius: '3px',
            cursor: disabled ? 'not-allowed' : 'pointer',
          },
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-900">{safeguard.text}</div>
        {safeguard.description && (
          <div className="text-xs text-slate-500 mt-0.5">{safeguard.description}</div>
        )}
      </div>
      {isCommon && (
        <span className="shrink-0 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
          Common
        </span>
      )}
    </label>
  );
}
