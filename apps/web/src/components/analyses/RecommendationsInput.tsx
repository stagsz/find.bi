import { useState, useCallback, useEffect, useMemo } from 'react';
import { TextInput, Checkbox, Button, Alert, Loader } from '@mantine/core';
import type { GuideWord, EquipmentType, PreparedAnswer, ApiError } from '@hazop/types';
import { GUIDE_WORD_LABELS } from '@hazop/types';
import { preparedRecommendationsService } from '../../services/prepared-recommendations.service';

/**
 * Props for the RecommendationsInput component.
 */
export interface RecommendationsInputProps {
  /** User-visible node identifier (e.g., "P-101") */
  nodeIdentifier: string;

  /** Equipment type of the selected node */
  equipmentType: EquipmentType;

  /** Selected guide word */
  guideWord: GuideWord;

  /** Currently selected recommendations */
  value: string[];

  /** Callback when selected recommendations change */
  onChange: (recommendations: string[]) => void;

  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * RecommendationsInput component for selecting recommendations in HazOps analysis.
 *
 * Features:
 * - Fetches context-aware prepared recommendations based on equipment type and guide word
 * - Multi-select checkboxes for prepared recommendations
 * - Search/filter within prepared recommendations
 * - Shows common recommendations prominently at the top
 * - Allows adding custom recommendations
 * - Displays recommendation descriptions on hover/focus
 */
export function RecommendationsInput({
  nodeIdentifier,
  equipmentType,
  guideWord,
  value,
  onChange,
  disabled = false,
}: RecommendationsInputProps) {
  // Prepared recommendations state
  const [preparedRecommendations, setPreparedRecommendations] = useState<PreparedAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [customRecommendation, setCustomRecommendation] = useState('');
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);

  /**
   * Fetch prepared recommendations when context changes.
   */
  useEffect(() => {
    let isMounted = true;

    const fetchRecommendations = async () => {
      setIsLoading(true);
      setError(null);

      const result = await preparedRecommendationsService.getByContext(equipmentType, guideWord);

      if (!isMounted) return;

      if (result.success && result.data) {
        setPreparedRecommendations(result.data.answers);
      } else {
        setError(result.error || { code: 'UNKNOWN', message: 'Failed to load prepared recommendations' });
      }

      setIsLoading(false);
    };

    fetchRecommendations();

    return () => {
      isMounted = false;
    };
  }, [equipmentType, guideWord]);

  /**
   * Filter recommendations based on search query.
   */
  const filteredRecommendations = useMemo(() => {
    if (!searchQuery.trim()) {
      return preparedRecommendations;
    }

    const searchLower = searchQuery.toLowerCase();
    return preparedRecommendations.filter(
      (recommendation) =>
        recommendation.text.toLowerCase().includes(searchLower) ||
        (recommendation.description && recommendation.description.toLowerCase().includes(searchLower))
    );
  }, [preparedRecommendations, searchQuery]);

  /**
   * Separate common recommendations from others for display priority.
   */
  const { commonRecommendations, otherRecommendations } = useMemo(() => {
    const common = filteredRecommendations.filter((r) => r.isCommon);
    const others = filteredRecommendations.filter((r) => !r.isCommon);
    return { commonRecommendations: common, otherRecommendations: others };
  }, [filteredRecommendations]);

  /**
   * Determine which recommendations to display based on showAllRecommendations toggle.
   */
  const displayedOtherRecommendations = useMemo(() => {
    if (showAllRecommendations || searchQuery.trim()) {
      return otherRecommendations;
    }
    // Show first 5 other recommendations when collapsed
    return otherRecommendations.slice(0, 5);
  }, [otherRecommendations, showAllRecommendations, searchQuery]);

  const hasMoreRecommendations = otherRecommendations.length > 5 && !showAllRecommendations && !searchQuery.trim();

  /**
   * Handle toggling a recommendation selection.
   */
  const handleToggleRecommendation = useCallback(
    (recommendationText: string) => {
      if (disabled) return;

      const isSelected = value.includes(recommendationText);
      if (isSelected) {
        onChange(value.filter((r) => r !== recommendationText));
      } else {
        onChange([...value, recommendationText]);
      }
    },
    [value, onChange, disabled]
  );

  /**
   * Handle adding a custom recommendation.
   */
  const handleAddCustomRecommendation = useCallback(() => {
    const trimmedRecommendation = customRecommendation.trim();
    if (!trimmedRecommendation || disabled) return;

    // Check if already selected
    if (value.includes(trimmedRecommendation)) {
      setCustomRecommendation('');
      return;
    }

    onChange([...value, trimmedRecommendation]);
    setCustomRecommendation('');
  }, [customRecommendation, value, onChange, disabled]);

  /**
   * Handle Enter key in custom recommendation input.
   */
  const handleCustomRecommendationKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomRecommendation();
      }
    },
    [handleAddCustomRecommendation]
  );

  /**
   * Check if a recommendation text is from the prepared list.
   */
  const isPreparedRecommendation = useCallback(
    (recommendationText: string) => {
      return preparedRecommendations.some((r) => r.text === recommendationText);
    },
    [preparedRecommendations]
  );

  /**
   * Get custom recommendations (selected recommendations that aren't from prepared list).
   */
  const customRecommendations = useMemo(() => {
    return value.filter((r) => !isPreparedRecommendation(r));
  }, [value, isPreparedRecommendation]);

  return (
    <div className="recommendations-input">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Recommendations</h4>
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
          <span className="ml-2 text-sm text-slate-500">Loading recommendations...</span>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
        <>
          {/* Search Input */}
          <div className="mb-3">
            <TextInput
              placeholder="Search recommendations..."
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

          {/* Common Recommendations Section */}
          {commonRecommendations.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Common Recommendations
              </div>
              <div className="space-y-1">
                {commonRecommendations.map((recommendation) => (
                  <RecommendationCheckboxItem
                    key={recommendation.id}
                    recommendation={recommendation}
                    isSelected={value.includes(recommendation.text)}
                    onToggle={() => handleToggleRecommendation(recommendation.text)}
                    disabled={disabled}
                    isCommon={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Recommendations Section */}
          {displayedOtherRecommendations.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Other Recommendations
              </div>
              <div className="space-y-1">
                {displayedOtherRecommendations.map((recommendation) => (
                  <RecommendationCheckboxItem
                    key={recommendation.id}
                    recommendation={recommendation}
                    isSelected={value.includes(recommendation.text)}
                    onToggle={() => handleToggleRecommendation(recommendation.text)}
                    disabled={disabled}
                    isCommon={false}
                  />
                ))}
              </div>

              {/* Show More Button */}
              {hasMoreRecommendations && (
                <button
                  type="button"
                  onClick={() => setShowAllRecommendations(true)}
                  className="mt-2 text-sm text-blue-700 hover:text-blue-800 font-medium"
                  disabled={disabled}
                >
                  Show {otherRecommendations.length - 5} more recommendations...
                </button>
              )}

              {/* Collapse Button */}
              {showAllRecommendations && otherRecommendations.length > 5 && !searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setShowAllRecommendations(false)}
                  className="mt-2 text-sm text-slate-500 hover:text-slate-700"
                  disabled={disabled}
                >
                  Show less
                </button>
              )}
            </div>
          )}

          {/* No Results */}
          {filteredRecommendations.length === 0 && searchQuery.trim() && (
            <div className="text-sm text-slate-500 text-center py-4">
              No recommendations match "{searchQuery}"
            </div>
          )}

          {/* Custom Recommendations Section */}
          {customRecommendations.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Custom Recommendations
              </div>
              <div className="space-y-1">
                {customRecommendations.map((recommendationText) => (
                  <div
                    key={recommendationText}
                    className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200"
                  >
                    <Checkbox
                      checked={true}
                      onChange={() => handleToggleRecommendation(recommendationText)}
                      disabled={disabled}
                      size="sm"
                      styles={{
                        input: {
                          borderRadius: '3px',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        },
                      }}
                    />
                    <span className="text-sm text-slate-900">{recommendationText}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Custom Recommendation */}
          <div className="border-t border-slate-200 pt-3 mt-3">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Add Custom Recommendation
            </div>
            <div className="flex gap-2">
              <TextInput
                placeholder="Enter a custom recommendation..."
                value={customRecommendation}
                onChange={(e) => setCustomRecommendation(e.target.value)}
                onKeyDown={handleCustomRecommendationKeyDown}
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
                onClick={handleAddCustomRecommendation}
                disabled={!customRecommendation.trim() || disabled}
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
              Press Enter to add a recommendation not in the prepared list
            </p>
          </div>
        </>
      )}

      {disabled && (
        <p className="text-xs text-amber-600 mt-3">
          Recommendations can only be modified when the analysis is in draft status.
        </p>
      )}
    </div>
  );
}

/**
 * Props for RecommendationCheckboxItem component.
 */
interface RecommendationCheckboxItemProps {
  recommendation: PreparedAnswer;
  isSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
  isCommon: boolean;
}

/**
 * Individual recommendation checkbox item with description tooltip.
 */
function RecommendationCheckboxItem({
  recommendation,
  isSelected,
  onToggle,
  disabled,
  isCommon,
}: RecommendationCheckboxItemProps) {
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
        <div className="text-sm text-slate-900">{recommendation.text}</div>
        {recommendation.description && (
          <div className="text-xs text-slate-500 mt-0.5">{recommendation.description}</div>
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
