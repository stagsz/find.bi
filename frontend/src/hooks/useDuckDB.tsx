import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
import { initDuckDB, loadTable as loadTableService } from "@/services/duckdb";
import { getAccessToken } from "@/services/api";

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  duration: number;
}

interface DuckDBContextValue {
  db: AsyncDuckDB | null;
  isReady: boolean;
  initError: string | null;
}

const DuckDBContext = createContext<DuckDBContextValue | null>(null);

export function DuckDBProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<AsyncDuckDB | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    initDuckDB()
      .then((instance) => {
        if (!cancelled) {
          setDb(instance);
          setIsReady(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setInitError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ db, isReady, initError }),
    [db, isReady, initError],
  );

  return (
    <DuckDBContext.Provider value={value}>{children}</DuckDBContext.Provider>
  );
}

export function useDuckDB() {
  const ctx = useContext(DuckDBContext);
  if (!ctx) {
    throw new Error("useDuckDB must be used within a DuckDBProvider");
  }

  const { db, isReady, initError } = ctx;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useCallback(
    async (sql: string): Promise<QueryResult> => {
      if (!db) {
        throw new Error("DuckDB is not initialized");
      }

      setLoading(true);
      setError(null);

      try {
        const conn = await db.connect();
        try {
          const start = performance.now();
          const result = await conn.query(sql);
          const duration = performance.now() - start;

          const columns = result.schema.fields.map(
            (f: { name: string }) => f.name,
          );
          const rows: unknown[][] = [];
          const numCols = columns.length;
          for (let i = 0; i < result.numRows; i++) {
            const row: unknown[] = new Array(numCols);
            for (let j = 0; j < numCols; j++) {
              row[j] = result.getChildAt(j)?.get(i);
            }
            rows.push(row);
          }

          return { columns, rows, duration };
        } finally {
          await conn.close();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [db],
  );

  const loadTable = useCallback(
    async (tableName: string, fileUrl: string): Promise<void> => {
      if (!db) {
        throw new Error("DuckDB is not initialized");
      }

      setLoading(true);
      setError(null);

      try {
        const token = getAccessToken();
        await loadTableService(db, tableName, fileUrl, token);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [db],
  );

  return useMemo(
    () => ({ query, loadTable, loading, error, isReady, initError }),
    [query, loadTable, loading, error, isReady, initError],
  );
}
