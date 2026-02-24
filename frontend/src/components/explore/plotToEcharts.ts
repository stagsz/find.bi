import type { PlotSpec, MarkDef } from "./PlotRenderer";
import type { DashboardCardConfig } from "@/components/dashboard/DashboardGrid";

type ChartType = DashboardCardConfig["type"];

interface MarkMapping {
  chartType: ChartType;
  horizontal?: boolean;
}

/** Maps Observable Plot mark types to ECharts dashboard card types */
const MARK_TYPE_MAP: Record<string, MarkMapping> = {
  barY: { chartType: "bar" },
  barX: { chartType: "bar", horizontal: true },
  dot: { chartType: "scatter" },
  dotX: { chartType: "scatter" },
  dotY: { chartType: "scatter" },
  line: { chartType: "line" },
  lineX: { chartType: "line" },
  lineY: { chartType: "line" },
  area: { chartType: "area" },
  areaX: { chartType: "area" },
  areaY: { chartType: "area" },
  cell: { chartType: "table" },
  cellX: { chartType: "table" },
  cellY: { chartType: "table" },
  rect: { chartType: "bar" },
  rectX: { chartType: "bar", horizontal: true },
  rectY: { chartType: "bar" },
};

/** Mark types that are decorative/auxiliary and should be skipped when finding the primary mark */
const DECORATIVE_MARKS = new Set([
  "frame",
  "ruleX",
  "ruleY",
  "tip",
  "text",
  "textX",
  "textY",
  "tickX",
  "tickY",
  "link",
]);

/** Find the primary (first data-bearing, non-decorative) mark from a PlotSpec */
function findPrimaryMark(spec: PlotSpec): MarkDef | null {
  for (const mark of spec.marks) {
    if (!DECORATIVE_MARKS.has(mark.type) && MARK_TYPE_MAP[mark.type]) {
      return mark;
    }
  }
  return null;
}

/** Extract ECharts column mappings from a Plot mark's options */
function extractMappings(
  mark: MarkDef,
  chartType: ChartType,
  horizontal: boolean,
): Record<string, string> {
  const opts = mark.options ?? {};
  const mappings: Record<string, string> = {};

  switch (chartType) {
    case "bar":
      if (opts.x) mappings.xField = String(opts.x);
      if (opts.y) mappings.yField = String(opts.y);
      if (horizontal) mappings.horizontal = "true";
      break;
    case "line":
    case "area":
      if (opts.x) mappings.xField = String(opts.x);
      if (opts.y) mappings.yField = String(opts.y);
      break;
    case "scatter":
      if (opts.x) mappings.xField = String(opts.x);
      if (opts.y) mappings.yField = String(opts.y);
      if (opts.r) mappings.sizeField = String(opts.r);
      if (opts.fill && typeof opts.fill === "string") {
        mappings.colorField = String(opts.fill);
      }
      break;
    case "pie":
      if (opts.x) mappings.nameField = String(opts.x);
      else if (opts.fill && typeof opts.fill === "string")
        mappings.nameField = String(opts.fill);
      if (opts.y) mappings.valueField = String(opts.y);
      break;
    // table: no explicit mappings needed
  }

  return mappings;
}

/** Escape a value for use in a SQL VALUES clause */
function escapeSql(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Generate a DuckDB SQL query from embedded mark data using a VALUES clause */
function generateSqlFromData(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) return "";

  const columns = Object.keys(data[0]);
  if (columns.length === 0) return "";

  const valueRows = data.map(
    (row) => `(${columns.map((col) => escapeSql(row[col])).join(", ")})`,
  );

  const quotedCols = columns.map((c) => `"${c}"`).join(", ");
  return `SELECT * FROM (VALUES ${valueRows.join(", ")}) AS t(${quotedCols})`;
}

export interface PromoteResult {
  type: ChartType;
  title: string;
  query: string;
  columnMappings: Record<string, string>;
}

/** Convert a PlotSpec into a DashboardCardConfig-compatible result for promotion */
function convertPlotSpec(
  spec: PlotSpec,
  title?: string,
): PromoteResult | null {
  const mark = findPrimaryMark(spec);
  if (!mark) return null;

  const mapping = MARK_TYPE_MAP[mark.type];
  if (!mapping) return null;

  const { chartType, horizontal } = mapping;
  const columnMappings = extractMappings(mark, chartType, horizontal ?? false);

  const data = mark.data ?? [];
  const query = generateSqlFromData(data);

  // Non-table chart types need a query to produce data
  if (!query && chartType !== "table") return null;

  return {
    type: chartType,
    title: title ?? "Promoted Chart",
    query,
    columnMappings,
  };
}

export {
  convertPlotSpec,
  findPrimaryMark,
  extractMappings,
  generateSqlFromData,
  escapeSql,
  MARK_TYPE_MAP,
  DECORATIVE_MARKS,
};
