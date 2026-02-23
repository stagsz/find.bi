import { useState, useEffect, useMemo, useCallback } from "react";
import { useDuckDB } from "@/hooks/useDuckDB";
import type { QueryResult } from "@/hooks/useDuckDB";
import type { DashboardCardConfig } from "./DashboardGrid";
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

export interface CardRendererProps {
  config: DashboardCardConfig;
  className?: string;
  style?: React.CSSProperties;
}

function CardRenderer({ config, className, style }: CardRendererProps) {
  const { query, isReady } = useDuckDB();

  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const executeQuery = useCallback(async () => {
    if (!config.query.trim() || !isReady) return;
    setLoading(true);
    setError(null);
    try {
      const result = await query(config.query);
      setQueryResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setQueryResult(null);
    } finally {
      setLoading(false);
    }
  }, [config.query, query, isReady]);

  // Execute query on mount and when query changes
  useEffect(() => {
    if (config.type === "text") return;
    executeQuery();
  }, [config.type, executeQuery]);

  const records = useMemo(
    () =>
      queryResult ? toRecords(queryResult.columns, queryResult.rows) : [],
    [queryResult],
  );

  const chartStyle = useMemo(
    () => ({ width: "100%", height: "100%", ...style }),
    [style],
  );

  // Text card — no SQL needed
  if (config.type === "text") {
    return (
      <div
        data-testid="card-renderer-text"
        className={`p-3 text-sm text-gray-700 ${className ?? ""}`}
        style={style}
      >
        {config.columnMappings.content || "No content"}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div
        data-testid="card-renderer-loading"
        className={`flex h-full items-center justify-center text-sm text-gray-400 ${className ?? ""}`}
        style={style}
      >
        <svg
          className="mr-2 h-4 w-4 animate-spin text-blue-500"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Loading...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        data-testid="card-renderer-error"
        className={`flex h-full items-center justify-center p-3 text-sm text-red-500 ${className ?? ""}`}
        style={style}
      >
        <span className="max-w-full truncate" title={error}>
          {error}
        </span>
      </div>
    );
  }

  // No data state
  if (!queryResult || records.length === 0) {
    return (
      <div
        data-testid="card-renderer-empty"
        className={`flex h-full items-center justify-center text-sm text-gray-400 ${className ?? ""}`}
        style={style}
      >
        No data
      </div>
    );
  }

  const m = config.columnMappings;
  const columns = queryResult.columns;

  switch (config.type) {
    case "bar":
      if (!m.xField || !m.yField) return null;
      return (
        <BarChart
          data={records}
          xField={m.xField}
          yField={m.yField}
          horizontal={m.horizontal === "true"}
          className={className}
          style={chartStyle}
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
          className={className}
          style={chartStyle}
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
          className={className}
          style={chartStyle}
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
          className={className}
          style={chartStyle}
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
          className={className}
          style={chartStyle}
        />
      );

    case "radar": {
      if (columns.length < 2) return null;
      const indicatorCol = columns[0];
      const numericCols = columns.slice(1);
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
      return (
        <RadarChart
          data={data}
          indicators={indicators}
          className={className}
          style={chartStyle}
        />
      );
    }

    case "kpi": {
      if (!m.valueField) return null;
      const firstRow = records[0];
      const val = firstRow?.[m.valueField];
      return (
        <KPICard
          title={config.title}
          value={val != null ? String(val) : "-"}
          unit={m.unit || undefined}
          className={className}
          style={style}
        />
      );
    }

    case "table": {
      const colDefs: ColumnDef[] = columns.map((c) => ({
        key: c,
        name: c,
      }));
      return (
        <DataTable
          columns={colDefs}
          rows={records}
          sortable
          pageSize={50}
          className={className}
          style={style}
        />
      );
    }

    default:
      return null;
  }
}

export default CardRenderer;
