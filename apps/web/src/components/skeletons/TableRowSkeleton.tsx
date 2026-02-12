/**
 * Props for the TableRowSkeleton component.
 */
export interface TableRowSkeletonProps {
  /** Number of columns in the table */
  columns: number;
  /** Whether to show action buttons at the end */
  showActions?: boolean;
  /** Column widths as percentages or fixed widths (optional) */
  columnWidths?: ('narrow' | 'medium' | 'wide' | 'fill')[];
}

/**
 * Width class mappings for skeleton cells.
 */
const WIDTH_CLASSES = {
  narrow: 'w-12',
  medium: 'w-24',
  wide: 'w-48',
  fill: 'w-3/4',
};

/**
 * A skeleton loading row for data tables.
 *
 * Renders placeholder content that matches the table structure,
 * using animate-pulse for visual feedback during loading.
 *
 * Design follows the regulatory document aesthetic:
 * - Subtle slate gray backgrounds
 * - Consistent with table styling
 * - Clear visual hierarchy between cell types
 */
export function TableRowSkeleton({
  columns,
  showActions = false,
  columnWidths,
}: TableRowSkeletonProps) {
  // Calculate columns to render (excluding action column if showing actions)
  const dataColumns = showActions ? columns - 1 : columns;

  /**
   * Get width class for a column index.
   */
  const getWidthClass = (index: number): string => {
    if (columnWidths && columnWidths[index]) {
      return WIDTH_CLASSES[columnWidths[index]];
    }
    // Default width pattern: first column wide, others medium
    return index === 0 ? 'w-3/4' : 'w-20';
  };

  return (
    <tr className="animate-pulse">
      {Array.from({ length: dataColumns }).map((_, index) => (
        <td key={index} className="px-3 py-4">
          <div className="flex flex-col gap-1">
            <div
              className={`h-4 bg-slate-200 rounded ${getWidthClass(index)}`}
            />
            {/* Second line for primary column (usually first) */}
            {index === 0 && (
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            )}
          </div>
        </td>
      ))}
      {showActions && (
        <td className="px-3 py-4 text-right">
          <div className="flex justify-end gap-2">
            <div className="h-6 w-14 bg-slate-200 rounded" />
          </div>
        </td>
      )}
    </tr>
  );
}

/**
 * Props for the TableSkeleton component.
 */
export interface TableSkeletonProps {
  /** Number of columns in the table */
  columns: number;
  /** Number of rows to display */
  rows?: number;
  /** Whether to show action buttons at the end */
  showActions?: boolean;
  /** Column widths as percentages or fixed widths (optional) */
  columnWidths?: ('narrow' | 'medium' | 'wide' | 'fill')[];
  /** Column headers (optional, for header skeleton) */
  headers?: string[];
}

/**
 * A full table skeleton with header and multiple rows.
 *
 * Provides a complete loading state for data tables,
 * maintaining the visual structure during data fetches.
 */
export function TableSkeleton({
  columns,
  rows = 5,
  showActions = false,
  columnWidths,
  headers,
}: TableSkeletonProps) {
  return (
    <table className="w-full">
      {headers && (
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, index) => (
          <TableRowSkeleton
            key={index}
            columns={columns}
            showActions={showActions}
            columnWidths={columnWidths}
          />
        ))}
      </tbody>
    </table>
  );
}
