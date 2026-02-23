import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DashboardListPage from "./DashboardListPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  listDashboards: vi.fn(),
  createDashboard: vi.fn(),
  deleteDashboard: vi.fn(),
  importDashboard: vi.fn(),
}));

vi.mock("@/services/workspaces", () => ({
  listWorkspaces: (...args: unknown[]) => mocks.listWorkspaces(...args),
}));

vi.mock("@/services/dashboards", () => ({
  listDashboards: (...args: unknown[]) => mocks.listDashboards(...args),
  createDashboard: (...args: unknown[]) => mocks.createDashboard(...args),
  deleteDashboard: (...args: unknown[]) => mocks.deleteDashboard(...args),
  importDashboard: (...args: unknown[]) => mocks.importDashboard(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboards"]}>
      <Routes>
        <Route path="/dashboards" element={<DashboardListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const SAMPLE_WORKSPACE = { id: "ws-1", name: "Default", duckdb_path: "/tmp/default.db", created_at: "2024-01-01" };

const SAMPLE_DASHBOARDS = [
  {
    id: "d-1",
    workspace_id: "ws-1",
    name: "Sales",
    layout_json: {},
    cards_json: {},
    filters_json: {},
    created_at: "2024-01-01T00:00:00",
    updated_at: "2024-01-02T00:00:00",
  },
  {
    id: "d-2",
    workspace_id: "ws-1",
    name: "Marketing",
    layout_json: {},
    cards_json: {},
    filters_json: {},
    created_at: "2024-01-01T00:00:00",
    updated_at: "2024-01-03T00:00:00",
  },
];

describe("DashboardListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listWorkspaces.mockResolvedValue([SAMPLE_WORKSPACE]);
    mocks.listDashboards.mockResolvedValue(SAMPLE_DASHBOARDS);
  });

  // --- Loading ---

  it("shows loading state initially", () => {
    mocks.listWorkspaces.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByTestId("dashboards-loading")).toBeInTheDocument();
  });

  // --- Loaded with dashboards ---

  it("renders dashboard list after loading", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-list-page")).toBeInTheDocument();
    });
  });

  it("shows dashboard cards", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Sales")).toBeInTheDocument();
    });
    expect(screen.getByText("Marketing")).toBeInTheDocument();
  });

  it("fetches workspaces and then dashboards", async () => {
    renderPage();
    await waitFor(() => {
      expect(mocks.listWorkspaces).toHaveBeenCalled();
    });
    expect(mocks.listDashboards).toHaveBeenCalledWith("ws-1");
  });

  // --- Empty state ---

  it("shows empty state when no dashboards", async () => {
    mocks.listDashboards.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("dashboards-empty")).toBeInTheDocument();
    });
    expect(screen.getByText("No dashboards yet")).toBeInTheDocument();
  });

  // --- Error ---

  it("shows error when workspaces fail to load", async () => {
    mocks.listWorkspaces.mockRejectedValue(new Error("Network error"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("dashboards-error")).toBeInTheDocument();
    });
  });

  it("shows error when no workspaces found", async () => {
    mocks.listWorkspaces.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("dashboards-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/no workspace found/i)).toBeInTheDocument();
  });

  // --- Create dashboard ---

  it("shows create form when New Dashboard button is clicked", async () => {
    renderPage();
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByTestId("new-dashboard-button")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("new-dashboard-button"));
    expect(screen.getByTestId("create-dashboard-form")).toBeInTheDocument();
  });

  it("creates dashboard and navigates to it", async () => {
    const createdDash = { ...SAMPLE_DASHBOARDS[0], id: "d-new", name: "New Dash" };
    mocks.createDashboard.mockResolvedValue(createdDash);
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId("new-dashboard-button")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("new-dashboard-button"));
    await user.type(screen.getByTestId("create-dashboard-input"), "New Dash");
    await user.click(screen.getByTestId("create-dashboard-confirm"));

    await waitFor(() => {
      expect(mocks.createDashboard).toHaveBeenCalledWith({
        workspace_id: "ws-1",
        name: "New Dash",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboards/d-new");
  });

  it("hides create form when Cancel is clicked", async () => {
    renderPage();
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByTestId("new-dashboard-button")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("new-dashboard-button"));
    expect(screen.getByTestId("create-dashboard-form")).toBeInTheDocument();

    await user.click(screen.getByTestId("create-dashboard-cancel"));
    expect(screen.queryByTestId("create-dashboard-form")).not.toBeInTheDocument();
  });

  // --- Delete dashboard ---

  it("deletes a dashboard and removes it from the list", async () => {
    mocks.deleteDashboard.mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText("Sales")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("delete-dashboard-d-1"));

    await waitFor(() => {
      expect(mocks.deleteDashboard).toHaveBeenCalledWith("d-1");
    });
    expect(screen.queryByText("Sales")).not.toBeInTheDocument();
    expect(screen.getByText("Marketing")).toBeInTheDocument();
  });

  // --- Navigation ---

  it("navigates to dashboard when card is clicked", async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText("Sales")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("dashboard-card-d-1"));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboards/d-1");
  });

  // --- Import dashboard ---

  it("shows import button", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("import-dashboard-button")).toBeInTheDocument();
    });
  });

  it("has hidden file input for import", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("import-file-input")).toBeInTheDocument();
    });
    const input = screen.getByTestId("import-file-input") as HTMLInputElement;
    expect(input.type).toBe("file");
    expect(input.accept).toBe(".json");
  });

  it("imports dashboard from file and navigates to it", async () => {
    const importedDash = { ...SAMPLE_DASHBOARDS[0], id: "d-imported", name: "Imported" };
    mocks.importDashboard.mockResolvedValue(importedDash);
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("import-dashboard-button")).toBeInTheDocument();
    });

    const exportData = {
      version: 1,
      name: "Imported",
      layout_json: { items: [] },
      cards_json: { cards: [] },
      filters_json: {},
    };
    const file = new File([JSON.stringify(exportData)], "dashboard.json", {
      type: "application/json",
    });

    const input = screen.getByTestId("import-file-input") as HTMLInputElement;
    // Use fireEvent for hidden file inputs (userEvent.upload may not work reliably with hidden inputs)
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(mocks.importDashboard).toHaveBeenCalledWith("ws-1", exportData);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboards/d-imported");
  });

  // --- Title ---

  it("shows page title", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Dashboards")).toBeInTheDocument();
    });
  });
});
