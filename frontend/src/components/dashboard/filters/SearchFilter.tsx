import { useCallback, useEffect, useRef } from "react";

export interface SearchFilterProps {
  /** Filter label displayed above the input */
  label: string;
  /** Current search value */
  value: string;
  /** Called when search value changes */
  onChange: (value: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Debounce delay in milliseconds (0 = no debounce) */
  debounceMs?: number;
  /** Additional CSS classes */
  className?: string;
}

function SearchFilter({
  label,
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 0,
  className,
}: SearchFilterProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (debounceMs > 0) {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          onChangeRef.current(newValue);
          timerRef.current = null;
        }, debounceMs);
      } else {
        onChangeRef.current(newValue);
      }
    },
    [debounceMs],
  );

  const handleClear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onChange("");
  }, [onChange]);

  return (
    <div
      data-testid="search-filter"
      className={`flex flex-col gap-1 ${className ?? ""}`}
    >
      <label
        data-testid="search-label"
        className="text-xs font-medium text-gray-600"
      >
        {label}
      </label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.58 3.58a.75.75 0 1 1-1.06 1.06l-3.58-3.58A7 7 0 0 1 2 9Z"
            clipRule="evenodd"
          />
        </svg>
        <input
          data-testid="search-input"
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="block w-full rounded-md border border-gray-300 py-1 pl-7 pr-7 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label={label}
        />
        {value && (
          <button
            data-testid="search-clear"
            type="button"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
            onClick={handleClear}
            aria-label={`Clear ${label} filter`}
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
    </div>
  );
}

export default SearchFilter;
