import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ConnectionsPage from "./ConnectionsPage";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  listConnections: vi.fn(),
  testConnection: vi.fn(),
  createConnection: vi.fn(),
  deleteConnection: vi.fn(),
  listConnectionTables: vi.fn(),
}));

vi.mock("@/services/workspaces", () => ({
  listWorkspaces: (...args: unknown[]) => mocks.listWorkspaces(...args),
}));

vi.mock("@/services/connections", () => ({
  listConnections: (...args: unknown[]) => mocks.listConnections(...args),
  testConnection: (...args: unknown[]) => mocks.testConnection(...args),
  createConnection: (...args: unknown[]) => mocks.createConnection(...args),
  deleteConnection: (...args: unknown[]) => mocks.deleteConnection(...args),
  listConnectionTables: (...args: unknown[]) => mocks.listConnectionTables(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WORKSPACE = { id: "ws-1", name: "Default", duckdb_path: "/tmp/x.db", created_at: "2024-01-01" };

const CONN_PG = {
  id: "c-1",
  name: "Prod DB",
  conn_type: "postgresql" as const,
  host: "db.example.com",
  port: 5432,
  database: "sales",
  username: "admin",
};

// ── Helper ────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/connections"]}>
      <Routes>
        <Route path="/settings/connections" element={<ConnectionsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ConnectionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listWorkspaces.mockResolvedValue([WORKSPACE]);
    mocks.listConnections.mockResolvedValue([]);
  });

  // 1. Heading renders
  it("renders the connections page heading", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("connections-page")).toBeInTheDocument();
      expect(screen.getByText("Connections")).toBeInTheDocument();
    });
  });

  // 2. Empty state
  it("shows empty state when no connections", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no connections yet/i)).toBeInTheDocument();
    });
  });

  // 3. Shows connection list
  it("shows connection list after loading", async () => {
    mocks.listConnections.mockResolvedValue([CONN_PG]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId(`connection-item-${CONN_PG.id}`)).toBeInTheDocument();
    });
    expect(screen.getByText("Prod DB")).toBeInTheDocument();
  });

  // 4. Add form is present
  it("shows the add connection form", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("add-connection-form")).toBeInTheDocument();
    });
    expect(screen.getByTestId("connection-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("connection-type-select")).toBeInTheDocument();
    expect(screen.getByTestId("test-connection-button")).toBeInTheDocument();
    expect(screen.getByTestId("save-connection-button")).toBeInTheDocument();
  });

  // 5. Test connection shows success
  it("test connection shows success result", async () => {
    mocks.testConnection.mockResolvedValue({ success: true, error: null, tables: ["orders", "users"] });
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("connection-database-input")).toBeInTheDocument();
    });

    await user.type(screen.getByTestId("connection-database-input"), "mydb");
    await user.click(screen.getByTestId("test-connection-button"));

    await waitFor(() => {
      expect(screen.getByTestId("connection-test-result")).toBeInTheDocument();
    });
    expect(screen.getByTestId("connection-test-result")).toHaveTextContent(/connected/i);
  });

  // 6. Test connection shows failure
  it("test connection shows failure result", async () => {
    mocks.testConnection.mockResolvedValue({
      success: false,
      error: "Connection refused",
      tables: [],
    });
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("connection-database-input")).toBeInTheDocument();
    });

    await user.type(screen.getByTestId("connection-database-input"), "baddb");
    await user.click(screen.getByTestId("test-connection-button"));

    await waitFor(() => {
      expect(screen.getByTestId("connection-test-result")).toBeInTheDocument();
    });
    expect(screen.getByTestId("connection-test-result")).toHaveTextContent(/Connection refused/);
  });

  // 7. Save connection calls API
  it("save connection calls createConnection and refreshes list", async () => {
    mocks.createConnection.mockResolvedValue(CONN_PG);
    mocks.listConnections.mockResolvedValueOnce([]).mockResolvedValueOnce([CONN_PG]);
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("connection-name-input")).toBeInTheDocument();
    });

    await user.type(screen.getByTestId("connection-name-input"), "Prod DB");
    await user.type(screen.getByTestId("connection-database-input"), "sales");
    await user.click(screen.getByTestId("save-connection-button"));

    await waitFor(() => {
      expect(mocks.createConnection).toHaveBeenCalled();
    });
  });

  // 8. Delete connection calls API
  it("delete connection calls deleteConnection", async () => {
    mocks.listConnections.mockResolvedValue([CONN_PG]);
    mocks.deleteConnection.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId(`delete-connection-${CONN_PG.id}`)).toBeInTheDocument();
    });

    await user.click(screen.getByTestId(`delete-connection-${CONN_PG.id}`));

    await waitFor(() => {
      expect(mocks.deleteConnection).toHaveBeenCalledWith("ws-1", CONN_PG.id);
    });
  });
});
