export interface DateRangeValue {
  start: string;
  end: string;
}

export interface DateRangeFilterProps {
  /** Filter label displayed above the inputs */
  label: string;
  /** Current date range value */
  value: DateRangeValue | null;
  /** Called when either date changes */
  onChange: (value: DateRangeValue | null) => void;
  /** Minimum selectable date (YYYY-MM-DD) */
  min?: string;
  /** Maximum selectable date (YYYY-MM-DD) */
  max?: string;
  /** Additional CSS classes */
  className?: string;
}

function DateRangeFilter({
  label,
  value,
  onChange,
  min,
  max,
  className,
}: DateRangeFilterProps) {
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const start = e.target.value;
    if (!start) {
      onChange(null);
      return;
    }
    onChange({ start, end: value?.end ?? "" });
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const end = e.target.value;
    if (!end && !value?.start) {
      onChange(null);
      return;
    }
    onChange({ start: value?.start ?? "", end });
  };

  const handleClear = () => {
    onChange(null);
  };

  return (
    <div
      data-testid="date-range-filter"
      className={`flex flex-col gap-1 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between">
        <label
          data-testid="date-range-label"
          className="text-xs font-medium text-gray-600"
        >
          {label}
        </label>
        {value && (
          <button
            data-testid="date-range-clear"
            type="button"
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={handleClear}
            aria-label={`Clear ${label} filter`}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          data-testid="date-range-start"
          type="date"
          value={value?.start ?? ""}
          onChange={handleStartChange}
          min={min}
          max={value?.end || max}
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label={`${label} start date`}
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          data-testid="date-range-end"
          type="date"
          value={value?.end ?? ""}
          onChange={handleEndChange}
          min={value?.start || min}
          max={max}
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label={`${label} end date`}
        />
      </div>
    </div>
  );
}

export default DateRangeFilter;
