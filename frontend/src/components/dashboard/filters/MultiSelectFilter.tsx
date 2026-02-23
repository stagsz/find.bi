import { useCallback } from "react";

export interface MultiSelectOption {
  label: string;
  value: string;
}

export interface MultiSelectFilterProps {
  /** Filter label displayed above the checkbox list */
  label: string;
  /** Available options */
  options: MultiSelectOption[];
  /** Currently selected values */
  value: string[];
  /** Called when selection changes */
  onChange: (value: string[]) => void;
  /** Maximum visible items before scrolling */
  maxVisible?: number;
  /** Additional CSS classes */
  className?: string;
}

function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  maxVisible = 6,
  className,
}: MultiSelectFilterProps) {
  const handleToggle = useCallback(
    (optionValue: string) => {
      if (value.includes(optionValue)) {
        onChange(value.filter((v) => v !== optionValue));
      } else {
        onChange([...value, optionValue]);
      }
    },
    [value, onChange],
  );

  const handleSelectAll = useCallback(() => {
    onChange(options.map((o) => o.value));
  }, [options, onChange]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const allSelected = options.length > 0 && value.length === options.length;

  return (
    <div
      data-testid="multiselect-filter"
      className={`flex flex-col gap-1 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between">
        <label
          data-testid="multiselect-label"
          className="text-xs font-medium text-gray-600"
        >
          {label}
        </label>
        <div className="flex gap-2">
          {!allSelected && options.length > 0 && (
            <button
              data-testid="multiselect-select-all"
              type="button"
              className="text-xs text-gray-400 hover:text-gray-600"
              onClick={handleSelectAll}
            >
              All
            </button>
          )}
          {value.length > 0 && (
            <button
              data-testid="multiselect-clear"
              type="button"
              className="text-xs text-gray-400 hover:text-gray-600"
              onClick={handleClearAll}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div
        data-testid="multiselect-options"
        className="flex flex-col gap-0.5 overflow-y-auto rounded-md border border-gray-300 px-2 py-1"
        style={{ maxHeight: `${maxVisible * 28}px` }}
      >
        {options.length === 0 && (
          <span
            data-testid="multiselect-empty"
            className="py-1 text-xs text-gray-400"
          >
            No options
          </span>
        )}
        {options.map((opt) => (
          <label
            key={opt.value}
            data-testid={`multiselect-option-${opt.value}`}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={value.includes(opt.value)}
              onChange={() => handleToggle(opt.value)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
      {value.length > 0 && (
        <span data-testid="multiselect-count" className="text-xs text-gray-400">
          {value.length} selected
        </span>
      )}
    </div>
  );
}

export type { MultiSelectOption as MultiSelectFilterOption };
export default MultiSelectFilter;
