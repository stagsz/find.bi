import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import type { QueryResult } from "./useDuckDB";

const mockClose = vi.fn().mockResolvedValue(undefined);
const mockQueryFn = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  query: mockQueryFn,
  close: mockClose,
});

const mocks = vi.hoisted(() => ({
  initDuckDB: vi.fn(),
}));

vi.mock("@/services/duckdb", () => ({
  initDuckDB: mocks.initDuckDB,
}));

import { DuckDBProvider, useDuckDB } from "./useDuckDB";

function wrapper({ children }: { children: ReactNode }) {
  return <DuckDBProvider>{children}</DuckDBProvider>;
}

function createMockTable(columns: string[], data: unknown[][]) {
  return {
    schema: {
      fields: columns.map((name) => ({ name })),
    },
    numRows: data.length,
    getChildAt(colIdx: number) {
      return {
        get(rowIdx: number) {
          return data[rowIdx]?.[colIdx];
        },
      };
    },
  };
}

describe("useDuckDB", () => {
  const mockDb = { connect: mockConnect };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initDuckDB.mockResolvedValue(mockDb);
    mockConnect.mockResolvedValue({
      query: mockQueryFn,
      close: mockClose,
    });
  });

  it("throws when used outside DuckDBProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useDuckDB())).toThrow(
      "useDuckDB must be used within a DuckDBProvider",
    );
    spy.mockRestore();
  });

  it("initializes DuckDB on mount and reports ready", async () => {
    const { result } = renderHook(() => useDuckDB(), { wrapper });

    expect(result.current.isReady).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    await act(async () => {});

    expect(result.current.isReady).toBe(true);
    expect(result.current.initError).toBeNull();
    expect(mocks.initDuckDB).toHaveBeenCalledOnce();
  });

  it("reports initialization error", async () => {
    mocks.initDuckDB.mockRejectedValue(new Error("WASM load failed"));

    const { result } = renderHook(() => useDuckDB(), { wrapper });

    await act(async () => {});

    expect(result.current.isReady).toBe(false);
    expect(result.current.initError).toBe("WASM load failed");
  });

  it("reports non-Error initialization failure as string", async () => {
    mocks.initDuckDB.mockRejectedValue("string error");

    const { result } = renderHook(() => useDuckDB(), { wrapper });

    await act(async () => {});

    expect(result.current.initError).toBe("string error");
  });

  describe("query", () => {
    it("executes SQL and returns columns, rows, and duration", async () => {
      const mockTable = createMockTable(
        ["name", "age"],
        [
          ["Alice", 30],
          ["Bob", 25],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);

      const { result } = renderHook(() => useDuckDB(), { wrapper });
      await act(async () => {});

      let queryResult!: QueryResult;
      await act(async () => {
        queryResult = await result.current.query(
          "SELECT name, age FROM users",
        );
      });

      expect(queryResult.columns).toEqual(["name", "age"]);
      expect(queryResult.rows).toEqual([
        ["Alice", 30],
        ["Bob", 25],
      ]);
      expect(queryResult.duration).toBeGreaterThanOrEqual(0);
      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockQueryFn).toHaveBeenCalledWith("SELECT name, age FROM users");
      expect(mockClose).toHaveBeenCalledOnce();
    });

    it("handles empty result set", async () => {
      const mockTable = createMockTable(["id", "value"], []);
      mockQueryFn.mockResolvedValue(mockTable);

      const { result } = renderHook(() => useDuckDB(), { wrapper });
      await act(async () => {});

      let queryResult!: QueryResult;
      await act(async () => {
        queryResult = await result.current.query(
          "SELECT id, value FROM empty_table",
        );
      });

      expect(queryResult.columns).toEqual(["id", "value"]);
      expect(queryResult.rows).toEqual([]);
      expect(queryResult.duration).toBeGreaterThanOrEqual(0);
    });

    it("handles single column single row result", async () => {
      const mockTable = createMockTable(["count"], [[42]]);
      mockQueryFn.mockResolvedValue(mockTable);

      const { result } = renderHook(() => useDuckDB(), { wrapper });
      await act(async () => {});

      let queryResult!: QueryResult;
      await act(async () => {
        queryResult = await result.current.query(
          "SELECT COUNT(*) as count FROM t",
        );
      });

      expect(queryResult.columns).toEqual(["count"]);
      expect(queryResult.rows).toEqual([[42]]);
    });

    it("handles null values in results", async () => {
      const mockTable = createMockTable(
        ["name", "value"],
        [
          ["Alice", null],
          [null, 10],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);

      const { result } = renderHook(() => useDuckDB(), { wrapper });
      await act(async () => {});

      let queryResult!: QueryResult;
      await act(async () => {
        queryResult = await result.current.query(
          "SELECT name, value FROM t",
        );
      });

      expect(queryResult.rows).toEqual([
        ["Alice", null],
        [null, 10],
      ]);
    });

    it("loading is false after query completes", async () => {
      const mockTable = createMockTable(["x"], [[1]]);
      mockQueryFn.mockResolvedValue(mockTable);

      const { result } = renderHook(() => useDuckDB(), { wrapper });
      await act(async () => {});

      expect(result.current.loading).toBe(false);

      await act(async () => {
        await result.current.query("SELECT 1");
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("sets error state on query failure", async () => {
      mockQueryFn.mockRejectedValue(new Error("SQL syntax error"));

      const { result } = renderHook(() => useDuckDB(), { wrapper });
      await act(async () => {});

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.query("INVALID SQL");
        } catch (e) {
          thrownError = e as Error;
        }
      });

      expect(thrownError?.message).toBe("SQL syntax error");
      expect(result.current.error).toBe("SQL syntax error");
      expect(result.current.loading).toBe(false);
    });

    it("clears previous error on new query", async () => {
      mockQueryFn.mockRejectedValueOnce(new Error("first error"));

      const { result } = renderHook(() => useDuckDB(), { wrapper });
      await act(async () => {});

      await act(async () => {
        try {
          await result.current.query("BAD SQL");
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe("first error");

      const mockTable = createMockTable(["x"], [[1]]);
      mockQueryFn.mockResolvedValueOnce(mockTable);

      await act(async () => {
        await result.current.query("SELECT 1");
      });

      expect(result.current.error).toBeNull();
    });

    it("throws when DuckDB is not initialized", async () => {
      mocks.initDuckDB.mockReturnValue(new Promise(() => {})); // never resolves

      const { result } = renderHook(() => useDuckDB(), { wrapper });

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.query("SELECT 1");
        } catch (e) {
          thrownError = e as Error;
        }
      });

      expect(thrownError?.message).toBe("DuckDB is not initialized");
    });

    it("closes connection even on query failure", async () => {
      mockQueryFn.mockRejectedValue(new Error("query failed"));

      const { result } = renderHook(() => useDuckDB(), { wrapper });
      await act(async () => {});

      await act(async () => {
        try {
          await result.current.query("FAIL");
        } catch {
          // expected
        }
      });

      expect(mockClose).toHaveBeenCalledOnce();
    });

    it("sets error for non-Error query failure", async () => {
      mockQueryFn.mockRejectedValue("string failure");

      const { result } = renderHook(() => useDuckDB(), { wrapper });
      await act(async () => {});

      await act(async () => {
        try {
          await result.current.query("FAIL");
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe("string failure");
    });
  });
});
