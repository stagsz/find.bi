export interface DropdownOption {
  label: string;
  value: string;
}

export interface DropdownFilterProps {
  /** Filter label displayed above the dropdown */
  label: string;
  /** Available options to select from */
  options: DropdownOption[];
  /** Currently selected value (null = no selection) */
  value: string | null;
  /** Called when selection changes */
  onChange: (value: string | null) => void;
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

function DropdownFilter({
  label,
  options,
  value,
  onChange,
  placeholder = "All",
  className,
}: DropdownFilterProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    onChange(selected === "" ? null : selected);
  };

  return (
    <div
      data-testid="dropdown-filter"
      className={`flex flex-col gap-1 ${className ?? ""}`}
    >
      <label
        data-testid="dropdown-label"
        className="text-xs font-medium text-gray-600"
      >
        {label}
      </label>
      <select
        data-testid="dropdown-select"
        value={value ?? ""}
        onChange={handleChange}
        className="block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-label={label}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export type { DropdownOption as DropdownFilterOption };
export default DropdownFilter;
