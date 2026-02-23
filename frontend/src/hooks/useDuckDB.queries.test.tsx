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
  loadTableService: vi.fn(),
  getAccessToken: vi.fn(),
}));

vi.mock("@/services/duckdb", () => ({
  initDuckDB: mocks.initDuckDB,
  loadTable: mocks.loadTableService,
}));

vi.mock("@/services/api", () => ({
  getAccessToken: mocks.getAccessToken,
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

async function setupHook() {
  const { result } = renderHook(() => useDuckDB(), { wrapper });
  await act(async () => {});
  expect(result.current.isReady).toBe(true);
  return result;
}

async function executeQuery(
  result: { current: ReturnType<typeof useDuckDB> },
  sql: string,
): Promise<QueryResult> {
  let queryResult!: QueryResult;
  await act(async () => {
    queryResult = await result.current.query(sql);
  });
  return queryResult;
}

describe("DuckDB query execution", () => {
  const mockDb = { connect: mockConnect };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initDuckDB.mockResolvedValue(mockDb);
    mockConnect.mockResolvedValue({
      query: mockQueryFn,
      close: mockClose,
    });
  });

  describe("SELECT queries", () => {
    it("returns all columns and rows for SELECT *", async () => {
      const mockTable = createMockTable(
        ["id", "name", "email", "active"],
        [
          [1, "Alice", "alice@test.com", true],
          [2, "Bob", "bob@test.com", false],
          [3, "Carol", "carol@test.com", true],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(result, "SELECT * FROM users");

      expect(qr.columns).toEqual(["id", "name", "email", "active"]);
      expect(qr.rows).toHaveLength(3);
      expect(qr.rows[0]).toEqual([1, "Alice", "alice@test.com", true]);
      expect(qr.rows[1]).toEqual([2, "Bob", "bob@test.com", false]);
      expect(qr.rows[2]).toEqual([3, "Carol", "carol@test.com", true]);
      expect(mockQueryFn).toHaveBeenCalledWith("SELECT * FROM users");
    });

    it("returns projected columns for SELECT with specific fields", async () => {
      const mockTable = createMockTable(
        ["name", "email"],
        [
          ["Alice", "alice@test.com"],
          ["Bob", "bob@test.com"],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT name, email FROM users",
      );

      expect(qr.columns).toEqual(["name", "email"]);
      expect(qr.rows).toHaveLength(2);
    });

    it("handles SELECT with WHERE clause filtering", async () => {
      const mockTable = createMockTable(
        ["name", "age"],
        [["Alice", 30]],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT name, age FROM users WHERE age > 25",
      );

      expect(qr.columns).toEqual(["name", "age"]);
      expect(qr.rows).toEqual([["Alice", 30]]);
    });

    it("handles SELECT with ORDER BY returning sorted results", async () => {
      const mockTable = createMockTable(
        ["name", "revenue"],
        [
          ["East", 50000],
          ["North", 30000],
          ["South", 20000],
          ["West", 10000],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT name, revenue FROM regions ORDER BY revenue DESC",
      );

      expect(qr.rows).toHaveLength(4);
      expect(qr.rows[0][1]).toBe(50000);
      expect(qr.rows[3][1]).toBe(10000);
    });

    it("handles SELECT with LIMIT", async () => {
      const mockTable = createMockTable(
        ["id", "name"],
        [
          [1, "First"],
          [2, "Second"],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT id, name FROM large_table LIMIT 2",
      );

      expect(qr.rows).toHaveLength(2);
      expect(mockQueryFn).toHaveBeenCalledWith(
        "SELECT id, name FROM large_table LIMIT 2",
      );
    });

    it("handles aliased columns in SELECT", async () => {
      const mockTable = createMockTable(
        ["full_name", "total"],
        [["Alice", 100]],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT name AS full_name, amount AS total FROM orders",
      );

      expect(qr.columns).toEqual(["full_name", "total"]);
      expect(qr.rows).toEqual([["Alice", 100]]);
    });

    it("handles DISTINCT query", async () => {
      const mockTable = createMockTable(
        ["region"],
        [["East"], ["North"], ["South"], ["West"]],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT DISTINCT region FROM sales",
      );

      expect(qr.columns).toEqual(["region"]);
      expect(qr.rows).toHaveLength(4);
    });
  });

  describe("GROUP BY queries", () => {
    it("returns grouped result with single group column", async () => {
      const mockTable = createMockTable(
        ["region", "total_revenue"],
        [
          ["East", 150000],
          ["West", 120000],
          ["North", 90000],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT region, SUM(revenue) AS total_revenue FROM sales GROUP BY region",
      );

      expect(qr.columns).toEqual(["region", "total_revenue"]);
      expect(qr.rows).toHaveLength(3);
      expect(qr.rows[0]).toEqual(["East", 150000]);
    });

    it("returns grouped result with multiple group columns", async () => {
      const mockTable = createMockTable(
        ["region", "category", "total_sales"],
        [
          ["East", "Electronics", 50000],
          ["East", "Clothing", 30000],
          ["West", "Electronics", 45000],
          ["West", "Clothing", 25000],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT region, category, SUM(amount) AS total_sales FROM sales GROUP BY region, category",
      );

      expect(qr.columns).toEqual(["region", "category", "total_sales"]);
      expect(qr.rows).toHaveLength(4);
      expect(qr.rows[0]).toEqual(["East", "Electronics", 50000]);
    });

    it("handles GROUP BY with HAVING clause", async () => {
      const mockTable = createMockTable(
        ["region", "total"],
        [["East", 150000]],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT region, SUM(revenue) AS total FROM sales GROUP BY region HAVING SUM(revenue) > 100000",
      );

      expect(qr.columns).toEqual(["region", "total"]);
      expect(qr.rows).toHaveLength(1);
      expect(qr.rows[0]).toEqual(["East", 150000]);
    });

    it("handles GROUP BY with ORDER BY on aggregated column", async () => {
      const mockTable = createMockTable(
        ["category", "count"],
        [
          ["A", 100],
          ["B", 75],
          ["C", 50],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT category, COUNT(*) AS count FROM products GROUP BY category ORDER BY count DESC",
      );

      expect(qr.rows[0][1]).toBe(100);
      expect(qr.rows[2][1]).toBe(50);
    });
  });

  describe("aggregation queries", () => {
    it("handles COUNT aggregation", async () => {
      const mockTable = createMockTable(["total_count"], [[1500]]);
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT COUNT(*) AS total_count FROM orders",
      );

      expect(qr.columns).toEqual(["total_count"]);
      expect(qr.rows).toEqual([[1500]]);
    });

    it("handles SUM aggregation", async () => {
      const mockTable = createMockTable(["total_revenue"], [[425000.5]]);
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT SUM(revenue) AS total_revenue FROM sales",
      );

      expect(qr.columns).toEqual(["total_revenue"]);
      expect(qr.rows).toEqual([[425000.5]]);
    });

    it("handles AVG aggregation", async () => {
      const mockTable = createMockTable(["avg_price"], [[29.99]]);
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT AVG(price) AS avg_price FROM products",
      );

      expect(qr.columns).toEqual(["avg_price"]);
      expect(qr.rows).toEqual([[29.99]]);
    });

    it("handles MIN and MAX aggregations", async () => {
      const mockTable = createMockTable(
        ["min_price", "max_price"],
        [[5.99, 199.99]],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT MIN(price) AS min_price, MAX(price) AS max_price FROM products",
      );

      expect(qr.columns).toEqual(["min_price", "max_price"]);
      expect(qr.rows).toEqual([[5.99, 199.99]]);
    });

    it("handles multiple aggregations in single query", async () => {
      const mockTable = createMockTable(
        ["count", "total", "average", "minimum", "maximum"],
        [[100, 5000, 50.0, 10, 200]],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT COUNT(*) AS count, SUM(amount) AS total, AVG(amount) AS average, MIN(amount) AS minimum, MAX(amount) AS maximum FROM transactions",
      );

      expect(qr.columns).toHaveLength(5);
      expect(qr.rows).toEqual([[100, 5000, 50.0, 10, 200]]);
    });

    it("handles aggregation returning null for empty table", async () => {
      const mockTable = createMockTable(
        ["total", "average"],
        [[null, null]],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT SUM(amount) AS total, AVG(amount) AS average FROM empty_table",
      );

      expect(qr.rows).toEqual([[null, null]]);
    });

    it("handles COUNT DISTINCT", async () => {
      const mockTable = createMockTable(["unique_regions"], [[4]]);
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT COUNT(DISTINCT region) AS unique_regions FROM sales",
      );

      expect(qr.rows).toEqual([[4]]);
    });
  });

  describe("JOIN queries", () => {
    it("handles INNER JOIN between two tables", async () => {
      const mockTable = createMockTable(
        ["order_id", "customer_name", "amount"],
        [
          [1, "Alice", 100],
          [2, "Bob", 200],
          [3, "Alice", 150],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT o.id AS order_id, c.name AS customer_name, o.amount FROM orders o INNER JOIN customers c ON o.customer_id = c.id",
      );

      expect(qr.columns).toEqual(["order_id", "customer_name", "amount"]);
      expect(qr.rows).toHaveLength(3);
      expect(qr.rows[0]).toEqual([1, "Alice", 100]);
    });

    it("handles LEFT JOIN with null values for unmatched rows", async () => {
      const mockTable = createMockTable(
        ["customer_name", "order_count"],
        [
          ["Alice", 5],
          ["Bob", 3],
          ["Carol", null],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT c.name AS customer_name, COUNT(o.id) AS order_count FROM customers c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.name",
      );

      expect(qr.columns).toEqual(["customer_name", "order_count"]);
      expect(qr.rows[2]).toEqual(["Carol", null]);
    });

    it("handles JOIN with aggregation", async () => {
      const mockTable = createMockTable(
        ["category", "total_revenue"],
        [
          ["Electronics", 250000],
          ["Clothing", 180000],
          ["Books", 75000],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT c.name AS category, SUM(p.price * o.quantity) AS total_revenue FROM orders o JOIN products p ON o.product_id = p.id JOIN categories c ON p.category_id = c.id GROUP BY c.name ORDER BY total_revenue DESC",
      );

      expect(qr.columns).toEqual(["category", "total_revenue"]);
      expect(qr.rows).toHaveLength(3);
      expect(qr.rows[0]).toEqual(["Electronics", 250000]);
    });

    it("handles self JOIN", async () => {
      const mockTable = createMockTable(
        ["employee", "manager"],
        [
          ["Bob", "Alice"],
          ["Carol", "Alice"],
          ["Dave", "Bob"],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT e.name AS employee, m.name AS manager FROM employees e JOIN employees m ON e.manager_id = m.id",
      );

      expect(qr.columns).toEqual(["employee", "manager"]);
      expect(qr.rows).toHaveLength(3);
    });

    it("handles JOIN returning empty result when no matches", async () => {
      const mockTable = createMockTable(
        ["order_id", "product_name"],
        [],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT o.id AS order_id, p.name AS product_name FROM orders o JOIN products p ON o.product_id = p.id WHERE p.discontinued = true",
      );

      expect(qr.columns).toEqual(["order_id", "product_name"]);
      expect(qr.rows).toEqual([]);
    });
  });

  describe("result shape verification", () => {
    it("column count matches row width for all rows", async () => {
      const mockTable = createMockTable(
        ["a", "b", "c", "d", "e"],
        [
          [1, "x", true, 3.14, null],
          [2, "y", false, 2.71, "val"],
          [3, "z", true, 1.0, null],
        ],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(result, "SELECT a, b, c, d, e FROM t");

      expect(qr.columns).toHaveLength(5);
      for (const row of qr.rows) {
        expect(row).toHaveLength(qr.columns.length);
      }
    });

    it("preserves data types across mixed-type result", async () => {
      const mockTable = createMockTable(
        ["int_col", "str_col", "float_col", "bool_col", "null_col"],
        [[42, "hello", 3.14, true, null]],
      );
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT int_col, str_col, float_col, bool_col, null_col FROM types_table",
      );

      const row = qr.rows[0];
      expect(typeof row[0]).toBe("number");
      expect(typeof row[1]).toBe("string");
      expect(typeof row[2]).toBe("number");
      expect(typeof row[3]).toBe("boolean");
      expect(row[4]).toBeNull();
    });

    it("handles large result set row count", async () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => [
        i,
        `row_${i}`,
      ]);
      const mockTable = createMockTable(["id", "label"], largeData);
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        "SELECT id, label FROM large_table",
      );

      expect(qr.rows).toHaveLength(1000);
      expect(qr.rows[0]).toEqual([0, "row_0"]);
      expect(qr.rows[999]).toEqual([999, "row_999"]);
    });

    it("duration is a positive number", async () => {
      const mockTable = createMockTable(["x"], [[1]]);
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(result, "SELECT 1 AS x");

      expect(typeof qr.duration).toBe("number");
      expect(qr.duration).toBeGreaterThanOrEqual(0);
    });

    it("handles many columns in wide result", async () => {
      const colCount = 20;
      const columns = Array.from({ length: colCount }, (_, i) => `col_${i}`);
      const row = Array.from({ length: colCount }, (_, i) => i * 10);
      const mockTable = createMockTable(columns, [row]);
      mockQueryFn.mockResolvedValue(mockTable);
      const result = await setupHook();

      const qr = await executeQuery(
        result,
        `SELECT ${columns.join(", ")} FROM wide_table`,
      );

      expect(qr.columns).toHaveLength(colCount);
      expect(qr.rows[0]).toHaveLength(colCount);
      expect(qr.rows[0][0]).toBe(0);
      expect(qr.rows[0][19]).toBe(190);
    });
  });

  describe("sequential query execution", () => {
    it("can execute multiple queries in sequence", async () => {
      const table1 = createMockTable(["count"], [[10]]);
      const table2 = createMockTable(["total"], [[500]]);
      mockQueryFn.mockResolvedValueOnce(table1).mockResolvedValueOnce(table2);
      const result = await setupHook();

      const qr1 = await executeQuery(
        result,
        "SELECT COUNT(*) AS count FROM orders",
      );
      const qr2 = await executeQuery(
        result,
        "SELECT SUM(amount) AS total FROM orders",
      );

      expect(qr1.rows).toEqual([[10]]);
      expect(qr2.rows).toEqual([[500]]);
      expect(mockQueryFn).toHaveBeenCalledTimes(2);
    });

    it("each query opens and closes its own connection", async () => {
      const table = createMockTable(["x"], [[1]]);
      mockQueryFn.mockResolvedValue(table);
      const result = await setupHook();

      await executeQuery(result, "SELECT 1 AS x");
      await executeQuery(result, "SELECT 1 AS x");

      expect(mockConnect).toHaveBeenCalledTimes(2);
      expect(mockClose).toHaveBeenCalledTimes(2);
    });

    it("error in one query does not affect subsequent queries", async () => {
      mockQueryFn.mockRejectedValueOnce(new Error("syntax error"));
      const successTable = createMockTable(["result"], [[42]]);
      mockQueryFn.mockResolvedValueOnce(successTable);
      const result = await setupHook();

      await act(async () => {
        try {
          await result.current.query("BAD SQL");
        } catch {
          // expected
        }
      });
      expect(result.current.error).toBe("syntax error");

      const qr = await executeQuery(result, "SELECT 42 AS result");

      expect(qr.rows).toEqual([[42]]);
      expect(result.current.error).toBeNull();
    });
  });
});
