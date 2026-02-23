import { useState, useCallback, useMemo, useEffect } from "react";
import type { DashboardCardConfig } from "./DashboardGrid";
import { useDuckDB } from "@/hooks/useDuckDB";
import type { QueryResult } from "@/hooks/useDuckDB";
import { toRecords } from "@/components/editor/QueryResult";
import BarChart from "@/components/charts/BarChart";
import LineChart from "@/components/charts/LineChart";
import AreaChart from "@/components/charts/AreaChart";
import ScatterChart from "@/components/charts/ScatterChart";
import PieChart from "@/components/charts/PieChart";
import RadarChart from "@/components/charts/RadarChart";
import KPICard from "@/components/charts/KPICard";
import DataTable from "@/components/charts/DataTable";
import type { ColumnDef } from "@/components/charts/DataTable";

type ChartType = DashboardCardConfig["type"];

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "scatter", label: "Scatter" },
  { value: "pie", label: "Pie" },
  { value: "radar", label: "Radar" },
  { value: "kpi", label: "KPI" },
  { value: "table", label: "Table" },
  { value: "text", label: "Text" },
];

interface MappingFieldDef {
  key: string;
  label: string;
  type: "column" | "text" | "toggle";
  required?: boolean;
}

const MAPPING_FIELDS: Record<ChartType, MappingFieldDef[]> = {
  bar: [
    { key: "xField", label: "X Axis (Category)", type: "column", required: true },
    { key: "yField", label: "Y Axis (Value)", type: "column", required: true },
    { key: "horizontal", label: "Horizontal", type: "toggle" },
  ],
  line: [
    { key: "xField", label: "X Axis", type: "column", required: true },
    { key: "yField", label: "Y Axis", type: "column", required: true },
    { key: "smooth", label: "Smooth Curves", type: "toggle" },
  ],
  area: [
    { key: "xField", label: "X Axis", type: "column", required: true },
    { key: "yField", label: "Y Axis", type: "column", required: true },
    { key: "smooth", label: "Smooth Curves", type: "toggle" },
  ],
  scatter: [
    { key: "xField", label: "X Axis", type: "column", required: true },
    { key: "yField", label: "Y Axis", type: "column", required: true },
    { key: "sizeField", label: "Size Field", type: "column" },
    { key: "colorField", label: "Color Field", type: "column" },
  ],
  pie: [
    { key: "nameField", label: "Labels", type: "column", required: true },
    { key: "valueField", label: "Values", type: "column", required: true },
    { key: "donut", label: "Donut Style", type: "toggle" },
  ],
  radar: [],
  kpi: [
    { key: "valueField", label: "Value Column", type: "column", required: true },
    { key: "unit", label: "Unit", type: "text" },
  ],
  table: [],
  text: [],
};

/** Whether the chart type needs an SQL query */
function needsQuery(type: ChartType): boolean {
  return type !== "text";
}

/** Whether explicit column mappings are needed */
function needsMappings(type: ChartType): boolean {
  return MAPPING_FIELDS[type].length > 0;
}

export interface ChartConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: Omit<DashboardCardConfig, "id">) => void;
  initialConfig?: DashboardCardConfig;
}

function ChartConfigDialog({
  open,
  onClose,
  onSave,
  initialConfig,
}: ChartConfigDialogProps) {
  const { query, isReady } = useDuckDB();

  // Form state
  const [title, setTitle] = useState(initialConfig?.title ?? "");
  const [chartType, setChartType] = useState<ChartType>(
    initialConfig?.type ?? "bar",
  );
  const [sqlQuery, setSqlQuery] = useState(initialConfig?.query ?? "");
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>(
    initialConfig?.columnMappings ?? {},
  );

  // Query execution state (dialog-local)
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(initialConfig?.title ?? "");
      setChartType(initialConfig?.type ?? "bar");
      setSqlQuery(initialConfig?.query ?? "");
      setColumnMappings(initialConfig?.columnMappings ?? {});
      setQueryResult(null);
      setQueryError(null);
      setQueryLoading(false);
      setShowPreview(false);
    }
  }, [open, initialConfig]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const availableColumns = useMemo(
    () => queryResult?.columns ?? [],
    [queryResult],
  );

  const records = useMemo(
    () =>
      queryResult ? toRecords(queryResult.columns, queryResult.rows) : [],
    [queryResult],
  );

  const handleRunQuery = useCallback(async () => {
    if (!sqlQuery.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    setShowPreview(false);
    try {
      const result = await query(sqlQuery);
      setQueryResult(result);
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : String(err));
      setQueryResult(null);
    } finally {
      setQueryLoading(false);
    }
  }, [sqlQuery, query]);

  const handleMappingChange = useCallback(
    (key: string, value: string) => {
      setColumnMappings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleToggleMapping = useCallback((key: string) => {
    setColumnMappings((prev) => ({
      ...prev,
      [key]: prev[key] === "true" ? "false" : "true",
    }));
  }, []);

  const handleSave = useCallback(() => {
    onSave({
      type: chartType,
      title: title.trim() || "Untitled Card",
      query: sqlQuery,
      columnMappings,
    });
  }, [onSave, chartType, title, sqlQuery, columnMappings]);

  const canSave = useMemo(() => {
    if (chartType === "text") return true;
    if (!sqlQuery.trim()) return false;
    const fields = MAPPING_FIELDS[chartType];
    for (const field of fields) {
      if (
        field.required &&
        field.type === "column" &&
        !columnMappings[field.key]
      ) {
        return false;
      }
    }
    return true;
  }, [chartType, sqlQuery, columnMappings]);

  const renderPreview = useMemo(() => {
    if (!queryResult || records.length === 0) return null;

    const m = columnMappings;
    const style = { height: 200 };

    switch (chartType) {
      case "bar":
        if (!m.xField || !m.yField) return null;
        return (
          <BarChart
            data={records}
            xField={m.xField}
            yField={m.yField}
            horizontal={m.horizontal === "true"}
            style={style}
          />
        );
      case "line":
        if (!m.xField || !m.yField) return null;
        return (
          <LineChart
            data={records}
            xField={m.xField}
            yField={m.yField}
            smooth={m.smooth === "true"}
            style={style}
          />
        );
      case "area":
        if (!m.xField || !m.yField) return null;
        return (
          <AreaChart
            data={records}
            xField={m.xField}
            yField={m.yField}
            smooth={m.smooth === "true"}
            style={style}
          />
        );
      case "scatter":
        if (!m.xField || !m.yField) return null;
        return (
          <ScatterChart
            data={records}
            xField={m.xField}
            yField={m.yField}
            sizeField={m.sizeField || undefined}
            colorField={m.colorField || undefined}
            style={style}
          />
        );
      case "pie":
        if (!m.nameField || !m.valueField) return null;
        return (
          <PieChart
            data={records}
            nameField={m.nameField}
            valueField={m.valueField}
            donut={m.donut === "true"}
            style={style}
          />
        );
      case "radar": {
        if (availableColumns.length < 2) return null;
        const indicatorCol = availableColumns[0];
        const numericCols = availableColumns.slice(1);
        const indicators = records.map((r) => {
          let maxVal = 0;
          for (const col of numericCols) {
            const v = Number(r[col]);
            if (!isNaN(v) && v > maxVal) maxVal = v;
          }
          return {
            name: String(r[indicatorCol] ?? ""),
            max: Math.ceil(maxVal * 1.2) || 100,
          };
        });
        const data = numericCols.map((col) => ({
          name: col,
          values: records.map((r) => {
            const v = Number(r[col]);
            return isNaN(v) ? 0 : v;
          }),
        }));
        return <RadarChart data={data} indicators={indicators} style={style} />;
      }
      case "kpi": {
        if (!m.valueField) return null;
        const firstRow = records[0];
        const val = firstRow?.[m.valueField];
        return (
          <KPICard
            title={title || "KPI Preview"}
            value={val != null ? String(val) : "-"}
            unit={m.unit || undefined}
          />
        );
      }
      case "table": {
        const colDefs: ColumnDef[] = availableColumns.map((c) => ({
          key: c,
          name: c,
        }));
        return (
          <DataTable columns={colDefs} rows={records} sortable pageSize={10} />
        );
      }
      default:
        return null;
    }
  }, [chartType, columnMappings, queryResult, records, availableColumns, title]);

  if (!open) return null;

  const fields = MAPPING_FIELDS[chartType];
  const showQuerySection = needsQuery(chartType);
  const showMappingSection =
    needsMappings(chartType) && availableColumns.length > 0;

  return (
    <div
      data-testid="chart-config-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="chart-config-dialog"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Configure chart card"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2
            data-testid="dialog-title"
            className="text-lg font-semibold text-gray-900"
          >
            {initialConfig ? "Edit Card" : "Configure Card"}
          </h2>
          <button
            data-testid="dialog-close"
            type="button"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {/* Title */}
          <div>
            <label
              htmlFor="card-title-input"
              className="block text-sm font-medium text-gray-700"
            >
              Title
            </label>
            <input
              id="card-title-input"
              data-testid="config-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Chart type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Chart Type
            </label>
            <div
              data-testid="config-chart-types"
              className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5"
            >
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  data-testid={`chart-type-${ct.value}`}
                  type="button"
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    chartType === ct.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setChartType(ct.value);
                    setColumnMappings({});
                    setShowPreview(false);
                  }}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* SQL Query */}
          {showQuerySection && (
            <div>
              <label
                htmlFor="sql-query-input"
                className="block text-sm font-medium text-gray-700"
              >
                SQL Query
              </label>
              <textarea
                id="sql-query-input"
                data-testid="config-query"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder="SELECT column1, column2 FROM table_name"
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  data-testid="config-run-query"
                  type="button"
                  disabled={!sqlQuery.trim() || queryLoading || !isReady}
                  className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleRunQuery}
                >
                  {queryLoading ? "Running..." : "Run Query"}
                </button>
                {queryResult && (
                  <span
                    data-testid="config-query-info"
                    className="text-xs text-gray-500"
                  >
                    {queryResult.rows.length} row
                    {queryResult.rows.length !== 1 ? "s" : ""},{" "}
                    {queryResult.columns.length} column
                    {queryResult.columns.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {queryError && (
                <div
                  data-testid="config-query-error"
                  className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
                >
                  {queryError}
                </div>
              )}
            </div>
          )}

          {/* Text content (for text type) */}
          {chartType === "text" && (
            <div>
              <label
                htmlFor="text-content-input"
                className="block text-sm font-medium text-gray-700"
              >
                Content
              </label>
              <textarea
                id="text-content-input"
                data-testid="config-text-content"
                value={columnMappings.content ?? ""}
                onChange={(e) =>
                  setColumnMappings((prev) => ({
                    ...prev,
                    content: e.target.value,
                  }))
                }
                placeholder="Enter text or markdown content..."
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Column Mappings */}
          {showMappingSection && (
            <div data-testid="config-mappings">
              <label className="block text-sm font-medium text-gray-700">
                Column Mappings
              </label>
              <div className="mt-2 space-y-3">
                {fields.map((field) => {
                  if (field.type === "toggle") {
                    return (
                      <label
                        key={field.key}
                        data-testid={`mapping-toggle-${field.key}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={columnMappings[field.key] === "true"}
                          onChange={() => handleToggleMapping(field.key)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">
                          {field.label}
                        </span>
                      </label>
                    );
                  }

                  if (field.type === "text") {
                    return (
                      <div
                        key={field.key}
                        data-testid={`mapping-text-${field.key}`}
                      >
                        <label className="block text-xs font-medium text-gray-600">
                          {field.label}
                          {field.required && (
                            <span className="text-red-500"> *</span>
                          )}
                        </label>
                        <input
                          type="text"
                          data-testid={`mapping-input-${field.key}`}
                          value={columnMappings[field.key] ?? ""}
                          onChange={(e) =>
                            handleMappingChange(field.key, e.target.value)
                          }
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    );
                  }

                  // Column select dropdown
                  return (
                    <div
                      key={field.key}
                      data-testid={`mapping-column-${field.key}`}
                    >
                      <label className="block text-xs font-medium text-gray-600">
                        {field.label}
                        {field.required && (
                          <span className="text-red-500"> *</span>
                        )}
                      </label>
                      <select
                        data-testid={`mapping-select-${field.key}`}
                        value={columnMappings[field.key] ?? ""}
                        onChange={(e) =>
                          handleMappingChange(field.key, e.target.value)
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">
                          {field.required ? "Select column..." : "(none)"}
                        </option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview */}
          {showPreview && queryResult && (
            <div data-testid="config-preview">
              <label className="block text-sm font-medium text-gray-700">
                Preview
              </label>
              <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                {renderPreview ?? (
                  <div
                    data-testid="preview-empty"
                    className="flex items-center justify-center py-8 text-sm text-gray-400"
                  >
                    Configure column mappings to see preview
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <button
            data-testid="config-cancel"
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {showQuerySection && queryResult && (
              <button
                data-testid="config-preview-btn"
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowPreview((prev) => !prev)}
              >
                {showPreview ? "Hide Preview" : "Preview"}
              </button>
            )}
            <button
              data-testid="config-save"
              type="button"
              disabled={!canSave}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSave}
            >
              {initialConfig ? "Update" : "Add Card"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChartConfigDialog;
export { CHART_TYPES, MAPPING_FIELDS, needsQuery, needsMappings };
export type { ChartType, MappingFieldDef };
