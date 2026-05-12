/**
 * ConnectionsPage - Manage external database connections.
 *
 * Allows users to add, test, browse, and delete external PostgreSQL, MySQL,
 * and SQLite connections. Connected tables can be browsed inline.
 */

import { useCallback, useEffect, useState } from "react";
import { listWorkspaces } from "@/services/workspaces";
import {
  listConnections,
  testConnection,
  createConnection,
  deleteConnection,
  listConnectionTables,
  type ExternalConnection,
  type TestConnectionResult,
  type ConnectionPayload,
} from "@/services/connections";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnType = "postgresql" | "mysql" | "sqlite";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function connTypeBadge(type: ConnType) {
  const colors: Record<ConnType, string> = {
    postgresql: "text-blue-400 border-blue-400/40 bg-blue-400/10",
    mysql: "text-orange-400 border-orange-400/40 bg-orange-400/10",
    sqlite: "text-green-400 border-green-400/40 bg-green-400/10",
  };
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider ${colors[type] ?? ""}`}
    >
      {type}
    </span>
  );
}

// ─── ConnectionItem ───────────────────────────────────────────────────────────

function ConnectionItem({
  conn,
  workspaceId,
  onDeleted,
}: {
  conn: ExternalConnection;
  workspaceId: string;
  onDeleted: () => void;
}) {
  const [tables, setTables] = useState<string[] | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tablesError, setTablesError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const handleBrowse = useCallback(async () => {
    if (tables !== null) {
      setTables(null);
      return;
    }
    setLoadingTables(true);
    setTablesError("");
    try {
      const t = await listConnectionTables(workspaceId, conn.id);
      setTables(t);
    } catch {
      setTablesError("Failed to load tables.");
    } finally {
      setLoadingTables(false);
    }
  }, [workspaceId, conn.id, tables]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Delete connection "${conn.name}"?`)) return;
    setDeleting(true);
    try {
      await deleteConnection(workspaceId, conn.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }, [workspaceId, conn.id, conn.name, onDeleted]);

  return (
    <div
      data-testid={`connection-item-${conn.id}`}
      className="rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-[#F0EDE4]">
              {conn.name}
            </span>
            {connTypeBadge(conn.conn_type)}
          </div>
          <p className="mt-0.5 font-mono text-[0.65rem] text-[#6B6860]">
            {conn.conn_type === "sqlite"
              ? conn.database
              : `${conn.host ?? ""}:${conn.port ?? ""} / ${conn.database}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid={`browse-tables-${conn.id}`}
            disabled={loadingTables}
            onClick={() => void handleBrowse()}
            className="rounded border border-[#2A2A2A] bg-[#0E0E0E] px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860] transition-colors hover:border-[#F5A623]/40 hover:text-[#F5A623] disabled:opacity-50"
          >
            {loadingTables ? "Loading..." : tables !== null ? "Hide" : "Browse"}
          </button>
          <button
            type="button"
            data-testid={`import-connection-${conn.id}`}
            onClick={() => setShowImport((p) => !p)}
            className="rounded border border-[#2A2A2A] bg-[#0E0E0E] px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860] transition-colors hover:border-[#F5A623]/40 hover:text-[#F5A623]"
          >
            Import
          </button>
          <button
            type="button"
            data-testid={`delete-connection-${conn.id}`}
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="rounded border border-[#E84393]/30 bg-[#E84393]/10 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-[#E84393] transition-colors hover:bg-[#E84393]/20 disabled:opacity-50"
          >
            {deleting ? "..." : "Delete"}
          </button>
        </div>
      </div>

      {tablesError && (
        <p className="mt-2 font-mono text-[0.65rem] text-[#E84393]">{tablesError}</p>
      )}

      {tables !== null && tables.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tables.map((t) => (
            <span
              key={t}
              className="rounded bg-[#0E0E0E] border border-[#2A2A2A] px-2 py-0.5 font-mono text-[0.6rem] text-[#F5A623]"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {tables !== null && tables.length === 0 && (
        <p className="mt-2 font-mono text-[0.65rem] text-[#6B6860]">No tables found.</p>
      )}

      {showImport && (
        <div className="mt-3 rounded-md border border-[#F5A623]/20 bg-[#0E0E0E] px-3 py-2">
          <p className="font-mono text-[0.65rem] text-[#6B6860]">
            Query import coming soon. Export data from your source database and upload as CSV instead.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── AddConnectionForm ────────────────────────────────────────────────────────

const CONN_TYPES: ConnType[] = ["postgresql", "mysql", "sqlite"];
const DEFAULT_PORTS: Record<ConnType, number | undefined> = {
  postgresql: 5432,
  mysql: 3306,
  sqlite: undefined,
};

function AddConnectionForm({
  workspaceId,
  onSaved,
}: {
  workspaceId: string;
  onSaved: () => void;
}) {
  const [connType, setConnType] = useState<ConnType>("postgresql");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState<string>("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const isSqlite = connType === "sqlite";

  const handleTypeChange = useCallback((t: ConnType) => {
    setConnType(t);
    setPort(String(DEFAULT_PORTS[t] ?? ""));
    setTestResult(null);
  }, []);

  const buildPayload = useCallback(
    (): Omit<ConnectionPayload, "name"> => ({
      conn_type: connType,
      ...(isSqlite ? {} : { host, port: port ? parseInt(port, 10) : undefined }),
      database,
      ...(isSqlite ? {} : { username, password }),
    }),
    [connType, isSqlite, host, port, database, username, password],
  );

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setFormError("");
    try {
      const result = await testConnection(workspaceId, buildPayload());
      setTestResult(result);
    } catch {
      setFormError("Test request failed.");
    } finally {
      setTesting(false);
    }
  }, [workspaceId, buildPayload]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setFormError("Connection name is required.");
      return;
    }
    if (!database.trim()) {
      setFormError("Database is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await createConnection(workspaceId, { name: name.trim(), ...buildPayload() });
      setName("");
      setHost("");
      setPort(String(DEFAULT_PORTS[connType] ?? ""));
      setDatabase("");
      setUsername("");
      setPassword("");
      setTestResult(null);
      onSaved();
    } catch {
      setFormError("Failed to save connection.");
    } finally {
      setSaving(false);
    }
  }, [workspaceId, name, database, connType, buildPayload, onSaved]);

  return (
    <div
      data-testid="add-connection-form"
      className="rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-4"
    >
      <p className="mb-4 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860]">
        Add Connection
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
            Name
          </label>
          <input
            data-testid="connection-name-input"
            type="text"
            placeholder="Production DB"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
          />
        </div>

        {/* Type */}
        <div>
          <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
            Type
          </label>
          <select
            data-testid="connection-type-select"
            value={connType}
            onChange={(e) => handleTypeChange(e.target.value as ConnType)}
            className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] focus:border-[#F5A623]/50 focus:outline-none"
          >
            {CONN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Database */}
        <div>
          <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
            {isSqlite ? "File Path" : "Database"}
          </label>
          <input
            data-testid="connection-database-input"
            type="text"
            placeholder={isSqlite ? "/path/to/file.db" : "mydb"}
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
          />
        </div>

        {/* Host + Port (non-sqlite) */}
        {!isSqlite && (
          <>
            <div>
              <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                Host
              </label>
              <input
                data-testid="connection-host-input"
                type="text"
                placeholder="localhost"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                Port
              </label>
              <input
                data-testid="connection-port-input"
                type="number"
                placeholder="5432"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                Username
              </label>
              <input
                data-testid="connection-username-input"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                Password
              </label>
              <input
                data-testid="connection-password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
              />
            </div>
          </>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div
          data-testid="connection-test-result"
          className={`mt-3 rounded-md border px-3 py-2 font-mono text-[0.65rem] ${
            testResult.success
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-[#E84393]/30 bg-[#E84393]/10 text-[#E84393]"
          }`}
        >
          {testResult.success
            ? `Connected — ${testResult.tables.length} table${testResult.tables.length !== 1 ? "s" : ""} found`
            : `Connection failed: ${testResult.error ?? "unknown error"}`}
        </div>
      )}

      {formError && (
        <p className="mt-2 font-mono text-[0.65rem] text-[#E84393]">{formError}</p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          data-testid="test-connection-button"
          disabled={testing || !database.trim()}
          onClick={() => void handleTest()}
          className="rounded border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860] transition-colors hover:border-[#F5A623]/40 hover:text-[#F5A623] disabled:opacity-50"
        >
          {testing ? "Testing..." : "Test Connection"}
        </button>
        <button
          type="button"
          data-testid="save-connection-button"
          disabled={saving || !name.trim() || !database.trim()}
          onClick={() => void handleSave()}
          className="rounded border border-[#F5A623]/40 bg-[#F5A623]/10 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-[#F5A623] transition-colors hover:bg-[#F5A623]/20 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Connection"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ConnectionsPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<ExternalConnection[]>([]);

  const loadConnections = useCallback(async (wsId: string) => {
    try {
      const conns = await listConnections(wsId);
      setConnections(conns);
    } catch {
      // Non-fatal — show empty list
      setConnections([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listWorkspaces()
      .then((ws) => {
        if (cancelled) return;
        if (ws.length === 0) {
          setError("No workspace found.");
          setLoading(false);
          return;
        }
        const wsId = ws[0].id;
        setWorkspaceId(wsId);
        return loadConnections(wsId);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load workspace.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [loadConnections]);

  const handleSaved = useCallback(() => {
    if (workspaceId) void loadConnections(workspaceId);
  }, [workspaceId, loadConnections]);

  const handleDeleted = useCallback(() => {
    if (workspaceId) void loadConnections(workspaceId);
  }, [workspaceId, loadConnections]);

  if (loading) {
    return (
      <div data-testid="connections-page" className="flex h-full items-center justify-center">
        <p className="font-mono text-sm text-[#6B6860]">Loading...</p>
      </div>
    );
  }

  return (
    <div data-testid="connections-page" className="p-6 max-w-3xl">
      <h1 className="mb-6 font-mono text-xl font-bold uppercase tracking-widest text-[#F5A623]">
        Connections
      </h1>

      {error && (
        <div className="mb-4 rounded-md border border-[#E84393]/40 bg-[#E84393]/10 px-4 py-2 font-mono text-sm text-[#E84393]">
          {error}
        </div>
      )}

      {/* Connection list */}
      <div
        data-testid="connections-list"
        className="mb-6 flex flex-col gap-3"
      >
        {connections.length === 0 && !error ? (
          <p className="font-mono text-sm text-[#6B6860]">
            No connections yet. Add one below.
          </p>
        ) : (
          connections.map((conn) => (
            <ConnectionItem
              key={conn.id}
              conn={conn}
              workspaceId={workspaceId!}
              onDeleted={handleDeleted}
            />
          ))
        )}
      </div>

      {/* Add form */}
      {workspaceId && (
        <AddConnectionForm workspaceId={workspaceId} onSaved={handleSaved} />
      )}
    </div>
  );
}

export default ConnectionsPage;
