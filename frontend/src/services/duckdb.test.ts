import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOpen = vi.fn().mockResolvedValue(undefined);
const mockInstantiate = vi.fn().mockResolvedValue(null);
const mockTerminate = vi.fn().mockResolvedValue(undefined);
const mockConnect = vi.fn().mockResolvedValue({});

const MockAsyncDuckDB = vi.fn().mockImplementation(() => ({
  open: mockOpen,
  instantiate: mockInstantiate,
  terminate: mockTerminate,
  connect: mockConnect,
}));

const mockSelectBundle = vi.fn().mockResolvedValue({
  mainModule: "/duckdb-eh.wasm",
  mainWorker: "/duckdb-browser-eh.worker.js",
  pthreadWorker: null,
});

vi.mock("@duckdb/duckdb-wasm", () => ({
  AsyncDuckDB: MockAsyncDuckDB,
  ConsoleLogger: vi.fn(),
  selectBundle: mockSelectBundle,
  DuckDBAccessMode: {
    UNDEFINED: 0,
    AUTOMATIC: 1,
    READ_ONLY: 2,
    READ_WRITE: 3,
  },
}));

vi.mock("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url", () => ({
  default: "/duckdb-mvp.wasm",
}));
vi.mock("@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url", () => ({
  default: "/duckdb-browser-mvp.worker.js",
}));
vi.mock("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url", () => ({
  default: "/duckdb-eh.wasm",
}));
vi.mock("@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url", () => ({
  default: "/duckdb-browser-eh.worker.js",
}));

// Worker is not available in jsdom, provide a stub
vi.stubGlobal(
  "Worker",
  vi.fn().mockImplementation(() => ({})),
);

describe("duckdb service", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset module state between tests by re-importing
    vi.resetModules();
  });

  async function importFresh() {
    return await import("@/services/duckdb");
  }

  describe("initDuckDB", () => {
    it("initializes DuckDB-WASM with worker and opens database", async () => {
      const { initDuckDB } = await importFresh();
      const instance = await initDuckDB();

      expect(mockSelectBundle).toHaveBeenCalledOnce();
      expect(MockAsyncDuckDB).toHaveBeenCalledOnce();
      expect(mockInstantiate).toHaveBeenCalledWith(
        "/duckdb-eh.wasm",
        null,
      );
      expect(mockOpen).toHaveBeenCalledOnce();
      expect(instance).toBeDefined();
    });

    it("returns the same instance on subsequent calls", async () => {
      const { initDuckDB } = await importFresh();
      const first = await initDuckDB();
      const second = await initDuckDB();

      expect(first).toBe(second);
      expect(MockAsyncDuckDB).toHaveBeenCalledOnce();
    });

    it("deduplicates concurrent init calls", async () => {
      const { initDuckDB } = await importFresh();
      const [a, b] = await Promise.all([initDuckDB(), initDuckDB()]);

      expect(a).toBe(b);
      expect(MockAsyncDuckDB).toHaveBeenCalledOnce();
    });

    it("passes BigInt and Decimal cast config to open", async () => {
      const { initDuckDB } = await importFresh();
      await initDuckDB();

      expect(mockOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            castBigIntToDouble: true,
            castDecimalToDouble: true,
          },
        }),
      );
    });

    it("uses in-memory mode when not cross-origin isolated", async () => {
      vi.stubGlobal("crossOriginIsolated", false);
      const { initDuckDB } = await importFresh();
      await initDuckDB();

      const config = mockOpen.mock.calls[0][0];
      expect(config.path).toBeUndefined();
      vi.unstubAllGlobals();
      vi.stubGlobal(
        "Worker",
        vi.fn().mockImplementation(() => ({})),
      );
    });

    it("enables OPFS persistence when cross-origin isolated", async () => {
      vi.stubGlobal("crossOriginIsolated", true);
      const { initDuckDB } = await importFresh();
      await initDuckDB();

      const config = mockOpen.mock.calls[0][0];
      expect(config.path).toBe("opfs://findbi.db");
      expect(config.accessMode).toBe(3); // READ_WRITE
      vi.unstubAllGlobals();
      vi.stubGlobal(
        "Worker",
        vi.fn().mockImplementation(() => ({})),
      );
    });

    it("resets initPromise on instantiation failure so retry works", async () => {
      mockInstantiate.mockRejectedValueOnce(new Error("WASM load failed"));

      const { initDuckDB } = await importFresh();
      await expect(initDuckDB()).rejects.toThrow("WASM load failed");

      // After failure, a new call should retry
      mockInstantiate.mockResolvedValueOnce(null);
      const instance = await initDuckDB();
      expect(instance).toBeDefined();
      expect(MockAsyncDuckDB).toHaveBeenCalledTimes(2);
    });
  });

  describe("getDB", () => {
    it("returns null before initialization", async () => {
      const { getDB } = await importFresh();
      expect(getDB()).toBeNull();
    });

    it("returns the instance after initialization", async () => {
      const { initDuckDB, getDB } = await importFresh();
      const instance = await initDuckDB();
      expect(getDB()).toBe(instance);
    });
  });

  describe("isOPFSAvailable", () => {
    it("returns false when crossOriginIsolated is false", async () => {
      vi.stubGlobal("crossOriginIsolated", false);
      const { isOPFSAvailable } = await importFresh();
      expect(isOPFSAvailable()).toBe(false);
      vi.unstubAllGlobals();
      vi.stubGlobal(
        "Worker",
        vi.fn().mockImplementation(() => ({})),
      );
    });

    it("returns true when crossOriginIsolated is true", async () => {
      vi.stubGlobal("crossOriginIsolated", true);
      const { isOPFSAvailable } = await importFresh();
      expect(isOPFSAvailable()).toBe(true);
      vi.unstubAllGlobals();
      vi.stubGlobal(
        "Worker",
        vi.fn().mockImplementation(() => ({})),
      );
    });
  });

  describe("resetDuckDB", () => {
    it("terminates the instance and allows reinitialization", async () => {
      const { initDuckDB, resetDuckDB, getDB } = await importFresh();
      await initDuckDB();
      expect(getDB()).not.toBeNull();

      await resetDuckDB();
      expect(getDB()).toBeNull();
      expect(mockTerminate).toHaveBeenCalledOnce();

      // Can reinitialize after reset
      await initDuckDB();
      expect(getDB()).not.toBeNull();
      expect(MockAsyncDuckDB).toHaveBeenCalledTimes(2);
    });

    it("is a no-op when not initialized", async () => {
      const { resetDuckDB } = await importFresh();
      await expect(resetDuckDB()).resolves.toBeUndefined();
      expect(mockTerminate).not.toHaveBeenCalled();
    });
  });

  describe("loadTable", () => {
    function createMockDb(queryFn = vi.fn().mockResolvedValue(undefined)) {
      const closeFn = vi.fn().mockResolvedValue(undefined);
      return {
        db: {
          registerFileBuffer: vi.fn().mockResolvedValue(undefined),
          connect: vi.fn().mockResolvedValue({
            query: queryFn,
            close: closeFn,
          }),
        },
        queryFn,
        closeFn,
      };
    }

    function stubFetch(
      ok = true,
      contentType = "application/octet-stream",
      data = new ArrayBuffer(10),
    ) {
      const mockResponse = {
        ok,
        statusText: ok ? "OK" : "Not Found",
        headers: new Headers({ "content-type": contentType }),
        arrayBuffer: vi.fn().mockResolvedValue(data),
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
      return mockResponse;
    }

    function restoreGlobals() {
      vi.unstubAllGlobals();
      vi.stubGlobal(
        "Worker",
        vi.fn().mockImplementation(() => ({})),
      );
    }

    it("fetches file with auth token and creates Parquet table", async () => {
      const { db, queryFn, closeFn } = createMockDb();
      stubFetch();
      const { loadTable } = await importFresh();

      await loadTable(
        db,
        "my_table",
        "http://localhost/api/data/export/my_table?format=parquet",
        "test-token",
      );

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost/api/data/export/my_table?format=parquet",
        { headers: { Authorization: "Bearer test-token" } },
      );
      expect(db.registerFileBuffer).toHaveBeenCalledWith(
        "_load_my_table.parquet",
        expect.any(Uint8Array),
      );
      expect(queryFn).toHaveBeenCalledWith(
        `CREATE OR REPLACE TABLE "my_table" AS SELECT * FROM read_parquet('_load_my_table.parquet')`,
      );
      expect(closeFn).toHaveBeenCalledOnce();
      restoreGlobals();
    });

    it("detects CSV from content-type header", async () => {
      const { db, queryFn } = createMockDb();
      stubFetch(true, "text/csv");
      const { loadTable } = await importFresh();

      await loadTable(db, "data", "http://localhost/file", null);

      expect(db.registerFileBuffer).toHaveBeenCalledWith(
        "_load_data.csv",
        expect.any(Uint8Array),
      );
      expect(queryFn).toHaveBeenCalledWith(
        `CREATE OR REPLACE TABLE "data" AS SELECT * FROM read_csv_auto('_load_data.csv')`,
      );
      restoreGlobals();
    });

    it("detects CSV from URL query parameter", async () => {
      const { db, queryFn } = createMockDb();
      stubFetch();
      const { loadTable } = await importFresh();

      await loadTable(db, "data", "http://localhost/export?format=csv", null);

      expect(db.registerFileBuffer).toHaveBeenCalledWith(
        "_load_data.csv",
        expect.any(Uint8Array),
      );
      expect(queryFn).toHaveBeenCalledWith(
        expect.stringContaining("read_csv_auto"),
      );
      restoreGlobals();
    });

    it("sends no auth header when token is null", async () => {
      const { db } = createMockDb();
      stubFetch();
      const { loadTable } = await importFresh();

      await loadTable(db, "t", "http://localhost/file", null);

      expect(fetch).toHaveBeenCalledWith("http://localhost/file", {
        headers: {},
      });
      restoreGlobals();
    });

    it("sends no auth header when token is undefined", async () => {
      const { db } = createMockDb();
      stubFetch();
      const { loadTable } = await importFresh();

      await loadTable(db, "t", "http://localhost/file");

      expect(fetch).toHaveBeenCalledWith("http://localhost/file", {
        headers: {},
      });
      restoreGlobals();
    });

    it("throws on fetch failure", async () => {
      const { db } = createMockDb();
      stubFetch(false);
      const { loadTable } = await importFresh();

      await expect(
        loadTable(db, "t", "http://localhost/file"),
      ).rejects.toThrow("Failed to fetch table data: Not Found");
      restoreGlobals();
    });

    it("closes connection even on query failure", async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error("SQL error"));
      const { db, closeFn } = createMockDb(queryFn);
      stubFetch();
      const { loadTable } = await importFresh();

      await expect(
        loadTable(db, "t", "http://localhost/file"),
      ).rejects.toThrow("SQL error");
      expect(closeFn).toHaveBeenCalledOnce();
      restoreGlobals();
    });
  });
});
