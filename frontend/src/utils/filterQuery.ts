import type { FilterConfig, FilterValue } from "@/hooks/useFilters";
import type { DateRangeValue } from "@/components/dashboard/filters";

/**
 * Escape a string value for safe inclusion in a SQL literal.
 * Doubles single quotes to prevent SQL injection.
 */
export function escapeSQL(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Check if a filter value is "active" (non-default / non-empty).
 */
function isActiveValue(_type: FilterConfig["type"], value: FilterValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  // DateRangeValue
  if (typeof value === "object" && "start" in value) {
    return value.start.length > 0 || value.end.length > 0;
  }
  return false;
}

/**
 * Build a WHERE clause condition for a single filter.
 * Returns null if the filter should not produce a condition.
 */
function buildCondition(
  filter: FilterConfig,
  value: FilterValue,
): string | null {
  if (!filter.column) return null;
  if (!isActiveValue(filter.type, value)) return null;

  const col = `"${escapeSQL(filter.column)}"`;

  switch (filter.type) {
    case "dateRange": {
      const range = value as DateRangeValue;
      const parts: string[] = [];
      if (range.start) {
        parts.push(`${col} >= '${escapeSQL(range.start)}'`);
      }
      if (range.end) {
        parts.push(`${col} <= '${escapeSQL(range.end)}'`);
      }
      return parts.length > 0 ? parts.join(" AND ") : null;
    }

    case "dropdown": {
      const v = value as string;
      return `${col} = '${escapeSQL(v)}'`;
    }

    case "multiSelect": {
      const vals = value as string[];
      if (vals.length === 0) return null;
      const escaped = vals.map((v) => `'${escapeSQL(v)}'`).join(", ");
      return `${col} IN (${escaped})`;
    }

    case "search": {
      const v = value as string;
      if (!v) return null;
      return `CAST(${col} AS VARCHAR) ILIKE '%${escapeSQL(v)}%'`;
    }

    default:
      return null;
  }
}

/**
 * Build a filtered SQL query by wrapping the base query with WHERE clauses
 * from active filters. Only filters with a non-empty `column` and active
 * values produce conditions. Returns the original query unchanged if no
 * active filters apply.
 */
export function buildFilteredQuery(
  baseQuery: string,
  filters: FilterConfig[],
  values: Record<string, FilterValue>,
): string {
  const conditions: string[] = [];

  for (const filter of filters) {
    const val = values[filter.id];
    const condition = buildCondition(filter, val);
    if (condition) {
      conditions.push(condition);
    }
  }

  if (conditions.length === 0) {
    return baseQuery;
  }

  const whereClause = conditions.join(" AND ");
  return `SELECT * FROM (${baseQuery}) AS _filtered WHERE ${whereClause}`;
}

export { isActiveValue };
