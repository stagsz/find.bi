import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { DateRangeValue } from "@/components/dashboard/filters";

// --- Filter types ---

export type FilterType = "dateRange" | "dropdown" | "multiSelect" | "search";

export interface FilterConfig {
  /** Unique identifier for this filter instance */
  id: string;
  /** Type of filter component to render */
  type: FilterType;
  /** Display label for the filter */
  label: string;
  /** Target column name in the data this filter applies to */
  column: string;
  /** Options for dropdown and multiSelect filters */
  options?: { label: string; value: string }[];
}

export type FilterValue =
  | DateRangeValue
  | string
  | string[]
  | null;

export interface FiltersState {
  /** Ordered list of active filter configurations */
  filters: FilterConfig[];
  /** Current value of each filter, keyed by filter id */
  values: Record<string, FilterValue>;
}

export interface FiltersContextValue {
  /** All active filter configurations */
  filters: FilterConfig[];
  /** Current filter values keyed by filter id */
  values: Record<string, FilterValue>;
  /** Add a new filter to the bar */
  addFilter: (config: Omit<FilterConfig, "id">) => string;
  /** Remove a filter by id */
  removeFilter: (id: string) => void;
  /** Update the value of a specific filter */
  updateFilterValue: (id: string, value: FilterValue) => void;
  /** Clear all filter values (keep filter configs) */
  clearAllValues: () => void;
  /** Remove all filters entirely */
  removeAllFilters: () => void;
}

// --- Default values per filter type ---

function defaultValue(type: FilterType): FilterValue {
  switch (type) {
    case "dateRange":
      return null;
    case "dropdown":
      return null;
    case "multiSelect":
      return [];
    case "search":
      return "";
  }
}

// --- Context ---

const FiltersContext = createContext<FiltersContextValue | null>(null);

function generateFilterId(): string {
  return `filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [values, setValues] = useState<Record<string, FilterValue>>({});

  const addFilter = useCallback(
    (config: Omit<FilterConfig, "id">): string => {
      const id = generateFilterId();
      const newFilter: FilterConfig = { ...config, id };
      setFilters((prev) => [...prev, newFilter]);
      setValues((prev) => ({ ...prev, [id]: defaultValue(config.type) }));
      return id;
    },
    [],
  );

  const removeFilter = useCallback((id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
    setValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const updateFilterValue = useCallback(
    (id: string, value: FilterValue) => {
      setValues((prev) => ({ ...prev, [id]: value }));
    },
    [],
  );

  const clearAllValues = useCallback(() => {
    setValues((prev) => {
      const cleared: Record<string, FilterValue> = {};
      for (const key of Object.keys(prev)) {
        const filter = filters.find((f) => f.id === key);
        if (filter) {
          cleared[key] = defaultValue(filter.type);
        }
      }
      return cleared;
    });
  }, [filters]);

  const removeAllFilters = useCallback(() => {
    setFilters([]);
    setValues({});
  }, []);

  const value = useMemo(
    () => ({
      filters,
      values,
      addFilter,
      removeFilter,
      updateFilterValue,
      clearAllValues,
      removeAllFilters,
    }),
    [
      filters,
      values,
      addFilter,
      removeFilter,
      updateFilterValue,
      clearAllValues,
      removeAllFilters,
    ],
  );

  return (
    <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
  );
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) {
    throw new Error("useFilters must be used within a FiltersProvider");
  }
  return ctx;
}

export { generateFilterId };
