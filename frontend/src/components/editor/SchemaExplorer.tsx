import { useCallback, useEffect, useState } from "react";
import api from "@/services/api";

interface ColumnInfo {
  name: string;
  type: string;
  duckdb_type: string;
}

interface DataSource {
  table_name: string;
  columns: ColumnInfo[];
  row_count: number;
}

interface SchemaExplorerProps {
  workspaceId: string | null;
  onColumnClick?: (tableName: string, columnName: string) => void;
  className?: string;
}

function SchemaExplorer({
  workspaceId,
  onColumnClick,
  className,
}: SchemaExplorerProps) {
  const [tables, setTables] = useState<DataSource[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSchema = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<DataSource[]>("/api/data/sources", {
        params: { workspace_id: workspaceId },
      });
      setTables(res.data);
    } catch {
      setError("Failed to load schema");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  const toggleTable = useCallback((tableName: string) => {
    setExpanded((prev) => ({ ...prev, [tableName]: !prev[tableName] }));
  }, []);

  const handleColumnClick = useCallback(
    (tableName: string, columnName: string) => {
      onColumnClick?.(tableName, columnName);
    },
    [onColumnClick],
  );

  return (
    <div
      className={`flex flex-col overflow-hidden ${className ?? ""}`}
      data-testid="schema-explorer"
    >
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-1.5">
        <span className="text-xs font-medium text-gray-500">Schema</span>
        <button
          type="button"
          onClick={fetchSchema}
          className="rounded p-0.5 text-gray-400 hover:text-gray-600"
          data-testid="schema-refresh"
          title="Refresh schema"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div
            className="px-3 py-4 text-center text-xs text-gray-400"
            data-testid="schema-loading"
          >
            Loading...
          </div>
        )}

        {error && (
          <div
            className="px-3 py-4 text-center text-xs text-red-500"
            data-testid="schema-error"
          >
            {error}
          </div>
        )}

        {!loading && !error && tables.length === 0 && (
          <div
            className="px-3 py-4 text-center text-xs text-gray-400"
            data-testid="schema-empty"
          >
            No tables found
          </div>
        )}

        {!loading &&
          tables.map((table) => (
            <div key={table.table_name} data-testid="schema-table">
              <button
                type="button"
                onClick={() => toggleTable(table.table_name)}
                className="flex w-full items-center gap-1 px-2 py-1 text-left text-xs hover:bg-gray-100"
                data-testid={`schema-table-toggle-${table.table_name}`}
              >
                <svg
                  className={`h-3 w-3 flex-shrink-0 text-gray-400 transition-transform ${
                    expanded[table.table_name] ? "rotate-90" : ""
                  }`}
                  viewBox="0 0 12 12"
                  fill="currentColor"
                  data-testid={`schema-table-arrow-${table.table_name}`}
                >
                  <path d="M4 2l5 4-5 4V2z" />
                </svg>
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span className="truncate font-medium text-gray-800">
                  {table.table_name}
                </span>
                <span className="ml-auto flex-shrink-0 text-[10px] text-gray-400">
                  {table.row_count.toLocaleString()}
                </span>
              </button>

              {expanded[table.table_name] && (
                <div data-testid={`schema-columns-${table.table_name}`}>
                  {table.columns.map((col) => (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() =>
                        handleColumnClick(table.table_name, col.name)
                      }
                      className="flex w-full items-center gap-1.5 py-0.5 pl-7 pr-2 text-left text-xs hover:bg-blue-50"
                      data-testid={`schema-column-${table.table_name}-${col.name}`}
                      title={`${col.name} (${col.duckdb_type}) — click to insert`}
                    >
                      <span className="truncate text-gray-600">{col.name}</span>
                      <span className="ml-auto flex-shrink-0 font-mono text-[10px] text-gray-400">
                        {col.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

export type { SchemaExplorerProps, DataSource, ColumnInfo };
export default SchemaExplorer;
