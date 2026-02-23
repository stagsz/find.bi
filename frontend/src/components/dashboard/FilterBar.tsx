import { useState, useCallback, useRef, useEffect } from "react";
import { useFilters } from "@/hooks/useFilters";
import type { FilterType, FilterConfig, FilterValue } from "@/hooks/useFilters";
import type { DateRangeValue } from "@/components/dashboard/filters";
import {
  DateRangeFilter,
  DropdownFilter,
  MultiSelectFilter,
  SearchFilter,
} from "@/components/dashboard/filters";

const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  dateRange: "Date Range",
  dropdown: "Dropdown",
  multiSelect: "Multi Select",
  search: "Search",
};

const FILTER_TYPES: FilterType[] = [
  "dateRange",
  "dropdown",
  "multiSelect",
  "search",
];

interface FilterBarProps {
  /** Whether the dashboard is in edit mode (shows add/remove controls) */
  editMode?: boolean;
  /** Additional CSS classes */
  className?: string;
}

function FilterBar({ editMode = false, className }: FilterBarProps) {
  const {
    filters,
    values,
    addFilter,
    removeFilter,
    updateFilterValue,
    clearAllValues,
  } = useFilters();

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!addMenuOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [addMenuOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!addMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [addMenuOpen]);

  const handleAddFilter = useCallback(
    (type: FilterType) => {
      addFilter({
        type,
        label: FILTER_TYPE_LABELS[type],
        column: "",
      });
      setAddMenuOpen(false);
    },
    [addFilter],
  );

  const handleValueChange = useCallback(
    (id: string, value: FilterValue) => {
      updateFilterValue(id, value);
    },
    [updateFilterValue],
  );

  const hasActiveValues = filters.some((f) => {
    const val = values[f.id];
    if (val === null || val === undefined) return false;
    if (typeof val === "string") return val.length > 0;
    if (Array.isArray(val)) return val.length > 0;
    // DateRangeValue
    if (typeof val === "object" && "start" in val) {
      return val.start.length > 0 || val.end.length > 0;
    }
    return false;
  });

  // Don't render anything if no filters and not in edit mode
  if (filters.length === 0 && !editMode) {
    return null;
  }

  return (
    <div
      data-testid="filter-bar"
      className={`flex flex-wrap items-end gap-3 border-b border-gray-200 bg-gray-50 px-6 py-3 ${className ?? ""}`}
    >
      {/* Render each active filter */}
      {filters.map((filter) => (
        <div
          key={filter.id}
          data-testid={`filter-instance-${filter.id}`}
          className="relative flex items-end gap-1"
        >
          {renderFilter(filter, values[filter.id], handleValueChange)}
          {editMode && (
            <button
              data-testid={`remove-filter-${filter.id}`}
              type="button"
              className="mb-0.5 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              onClick={() => removeFilter(filter.id)}
              aria-label={`Remove ${filter.label} filter`}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {/* Clear all button */}
      {hasActiveValues && (
        <button
          data-testid="clear-all-filters"
          type="button"
          className="mb-0.5 self-end text-xs text-gray-400 hover:text-gray-600"
          onClick={clearAllValues}
        >
          Clear all
        </button>
      )}

      {/* Add filter dropdown */}
      {editMode && (
        <div ref={menuRef} className="relative self-end">
          <button
            data-testid="add-filter-button"
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700"
            onClick={() => setAddMenuOpen((prev) => !prev)}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Add Filter
          </button>
          {addMenuOpen && (
            <div
              data-testid="add-filter-menu"
              className="absolute left-0 top-full z-10 mt-1 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
            >
              {FILTER_TYPES.map((type) => (
                <button
                  key={type}
                  data-testid={`add-filter-option-${type}`}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => handleAddFilter(type)}
                >
                  {FILTER_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderFilter(
  config: FilterConfig,
  value: FilterValue | undefined,
  onChange: (id: string, value: FilterValue) => void,
) {
  switch (config.type) {
    case "dateRange":
      return (
        <DateRangeFilter
          label={config.label}
          value={(value as DateRangeValue | null) ?? null}
          onChange={(v) => onChange(config.id, v)}
        />
      );
    case "dropdown":
      return (
        <DropdownFilter
          label={config.label}
          options={config.options ?? []}
          value={(value as string | null) ?? null}
          onChange={(v) => onChange(config.id, v)}
        />
      );
    case "multiSelect":
      return (
        <MultiSelectFilter
          label={config.label}
          options={config.options ?? []}
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(config.id, v)}
        />
      );
    case "search":
      return (
        <SearchFilter
          label={config.label}
          value={(value as string) ?? ""}
          onChange={(v) => onChange(config.id, v)}
        />
      );
  }
}

export default FilterBar;
export type { FilterBarProps };
export { FILTER_TYPE_LABELS, FILTER_TYPES };
