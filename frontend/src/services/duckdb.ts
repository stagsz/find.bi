import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};

let db: duckdb.AsyncDuckDB | null = null;
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null;

/**
 * Initialize DuckDB-WASM with Web Worker.
 * Uses the best available bundle (EH > MVP) based on browser capabilities.
 * When cross-origin isolated, enables OPFS persistence and multi-threading.
 * Returns the singleton AsyncDuckDB instance.
 */
export async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
      const worker = new Worker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      const instance = new duckdb.AsyncDuckDB(logger, worker);

      await instance.instantiate(bundle.mainModule, bundle.pthreadWorker);

      const config: duckdb.DuckDBConfig = {
        query: {
          castBigIntToDouble: true,
          castDecimalToDouble: true,
        },
      };

      // OPFS persistence when cross-origin isolated (SharedArrayBuffer available)
      if (typeof crossOriginIsolated !== "undefined" && crossOriginIsolated) {
        config.path = "opfs://findbi.db";
        config.accessMode = duckdb.DuckDBAccessMode.READ_WRITE;
      }

      await instance.open(config);
      db = instance;
      return instance;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/** Returns the initialized DuckDB instance, or null if not yet initialized. */
export function getDB(): duckdb.AsyncDuckDB | null {
  return db;
}

/** Returns true if cross-origin isolation is active (OPFS + threading available). */
export function isOPFSAvailable(): boolean {
  return typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
}

/** Terminate the DuckDB instance and reset state. */
export async function resetDuckDB(): Promise<void> {
  if (db) {
    await db.terminate();
    db = null;
    initPromise = null;
  }
}
