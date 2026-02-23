import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DashboardPage from "./DashboardPage";

// --- Mocks ---

const mocks = vi.hoisted(() => ({
  addCard: vi.fn().mockReturnValue("card-new-1"),
  updateCard: vi.fn(),
  removeCard: vi.fn(),
  onLayoutChange: vi.fn(),
  setCards: vi.fn(),
  setLayout: vi.fn(),
  cards: [] as Array<{
    id: string;
    type: string;
    title: string;
    query: string;
    columnMappings: Record<string, string>;
  }>,
  layout: [] as Array<{
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>,
  dialogSaveCallback: null as
    | ((config: {
        type: string;
        title: string;
        query: string;
        columnMappings: Record<string, string>;
      }) => void)
    | null,
  dialogCloseCallback: null as (() => void) | null,
  dialogOpen: false,
  dialogInitialConfig: undefined as unknown,
  // Persistence mock state
  persistDashboard: null as { name: string } | null,
  persistLoading: false,
  persistError: null as string | null,
  persistDirty: false,
  persistSaving: false,
  persistSave: vi.fn(),
  // Export mock
  exportDashboard: vi.fn(),
}));

vi.mock("@/hooks/useDashboardCards", () => ({
  default: () => ({
    cards: mocks.cards,
    layout: mocks.layout,
    addCard: mocks.addCard,
    updateCard: mocks.updateCard,
    removeCard: mocks.removeCard,
    onLayoutChange: mocks.onLayoutChange,
    setCards: mocks.setCards,
    setLayout: mocks.setLayout,
  }),
}));

vi.mock("@/hooks/useDashboardPersistence", () => ({
  default: () => ({
    dashboard: mocks.persistDashboard,
    loading: mocks.persistLoading,
    error: mocks.persistError,
    dirty: mocks.persistDirty,
    saving: mocks.persistSaving,
    save: mocks.persistSave,
  }),
}));

vi.mock("@/hooks/useFilters", () => ({
  FiltersProvider: ({ children }: { children: React.ReactNode }) => children,
  useFiltersOptional: () => ({
    filters: [],
    values: {},
    addFilter: () => "",
    removeFilter: () => {},
    updateFilterValue: () => {},
    clearAllValues: () => {},
    removeAllFilters: () => {},
  }),
}));

// Mock DashboardGrid — renders cards and captures props
let capturedGridProps: Record<string, unknown> = {};
vi.mock("@/components/dashboard/DashboardGrid", () => ({
  default: (props: Record<string, unknown>) => {
    capturedGridProps = props;
    const cards = props.cards as typeof mocks.cards;
    const renderCard = props.renderCard as (
      card: (typeof mocks.cards)[0],
    ) => React.ReactNode;
    return (
      <div data-testid="dashboard-grid" data-edit-mode={String(props.editMode)}>
        {cards.map((card) => (
          <div key={card.id} data-testid={`grid-card-${card.id}`}>
            {renderCard ? renderCard(card) : card.title}
          </div>
        ))}
      </div>
    );
  },
}));

// Mock DashboardCard — renders children and captures callbacks
vi.mock("@/components/dashboard/DashboardCard", () => ({
  default: (props: {
    config: (typeof mocks.cards)[0];
    editMode?: boolean;
    onSettings?: (config: (typeof mocks.cards)[0]) => void;
    onRemove?: (id: string) => void;
    children?: React.ReactNode;
  }) => (
    <div
      data-testid={`dashboard-card-${props.config.id}`}
      data-edit-mode={String(props.editMode ?? false)}
    >
      <span data-testid={`card-title-${props.config.id}`}>
        {props.config.title}
      </span>
      <button
        data-testid={`card-settings-btn-${props.config.id}`}
        onClick={() => props.onSettings?.(props.config)}
      >
        Settings
      </button>
      <button
        data-testid={`card-remove-btn-${props.config.id}`}
        onClick={() => props.onRemove?.(props.config.id)}
      >
        Remove
      </button>
      <div data-testid={`card-content-${props.config.id}`}>
        {props.children}
      </div>
    </div>
  ),
}));

// Mock CardRenderer
vi.mock("@/components/dashboard/CardRenderer", () => ({
  default: (props: { config: (typeof mocks.cards)[0] }) => (
    <div data-testid={`card-renderer-${props.config.id}`}>
      Rendered: {props.config.type}
    </div>
  ),
}));

// Mock ChartConfigDialog — captures props and exposes save/close
vi.mock("@/components/dashboard/ChartConfigDialog", () => ({
  default: (props: {
    open: boolean;
    onClose: () => void;
    onSave: (config: {
      type: string;
      title: string;
      query: string;
      columnMappings: Record<string, string>;
    }) => void;
    initialConfig?: unknown;
  }) => {
    mocks.dialogOpen = props.open;
    mocks.dialogSaveCallback = props.onSave;
    mocks.dialogCloseCallback = props.onClose;
    mocks.dialogInitialConfig = props.initialConfig;
    if (!props.open) return null;
    return (
      <div data-testid="chart-config-dialog">
        <span data-testid="dialog-has-initial">
          {props.initialConfig ? "editing" : "creating"}
        </span>
        <button
          data-testid="dialog-save-btn"
          onClick={() =>
            props.onSave({
              type: "bar",
              title: "Test Card",
              query: "SELECT * FROM t",
              columnMappings: { xField: "a", yField: "b" },
            })
          }
        >
          Save
        </button>
        <button data-testid="dialog-close-btn" onClick={props.onClose}>
          Close
        </button>
      </div>
    );
  },
}));

// Mock dashboard service (export)
vi.mock("@/services/dashboards", () => ({
  exportDashboard: (...args: unknown[]) => mocks.exportDashboard(...args),
}));

// Mock FilterBar
vi.mock("@/components/dashboard/FilterBar", () => ({
  default: () => <div data-testid="filter-bar" />,
}));

function renderDashboard(path = "/dashboards") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboards/:id" element={<DashboardPage />} />
        <Route path="/dashboards" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const SAMPLE_CARDS = [
  {
    id: "card-1",
    type: "bar",
    title: "Revenue by Region",
    query: "SELECT region, revenue FROM sales",
    columnMappings: { xField: "region", yField: "revenue" },
  },
  {
    id: "card-2",
    type: "line",
    title: "Trends",
    query: "SELECT month, value FROM trends",
    columnMappings: { xField: "month", yField: "value" },
  },
];

const SAMPLE_LAYOUT = [
  { i: "card-1", x: 0, y: 0, w: 4, h: 3 },
  { i: "card-2", x: 4, y: 0, w: 4, h: 3 },
];

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cards = [];
    mocks.layout = [];
    mocks.dialogSaveCallback = null;
    mocks.dialogCloseCallback = null;
    mocks.dialogOpen = false;
    mocks.dialogInitialConfig = undefined;
    mocks.persistDashboard = null;
    mocks.persistLoading = false;
    mocks.persistError = null;
    mocks.persistDirty = false;
    mocks.persistSaving = false;
    capturedGridProps = {};
  });

  // --- Loading state ---

  it("shows loading state when persistence is loading", () => {
    mocks.persistLoading = true;
    renderDashboard("/dashboards/abc-123");
    expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
  });

  // --- Error state ---

  it("shows error state when persistence has error and no dashboard", () => {
    mocks.persistError = "Not found";
    renderDashboard("/dashboards/abc-123");
    expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();
    expect(screen.getByText("Not found")).toBeInTheDocument();
  });

  // --- Rendering ---

  it("renders the dashboard page container", () => {
    renderDashboard();
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("renders the dashboard header", () => {
    renderDashboard();
    expect(screen.getByTestId("dashboard-header")).toBeInTheDocument();
  });

  it("shows 'New Dashboard' title when no ID in URL", () => {
    renderDashboard("/dashboards");
    expect(screen.getByTestId("dashboard-title")).toHaveTextContent(
      "New Dashboard",
    );
  });

  it("shows dashboard name from persistence when loaded", () => {
    mocks.persistDashboard = { name: "Sales Overview" } as never;
    renderDashboard("/dashboards/abc-123");
    expect(screen.getByTestId("dashboard-title")).toHaveTextContent(
      "Sales Overview",
    );
  });

  it("shows dashboard ID below title when ID is in URL", () => {
    renderDashboard("/dashboards/abc-123");
    expect(screen.getByTestId("dashboard-id")).toHaveTextContent("abc-123");
  });

  it("does not show dashboard ID when no ID in URL", () => {
    renderDashboard("/dashboards");
    expect(screen.queryByTestId("dashboard-id")).not.toBeInTheDocument();
  });

  it("renders the edit mode toggle button", () => {
    renderDashboard();
    expect(screen.getByTestId("edit-mode-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("edit-mode-toggle")).toHaveTextContent("Edit");
  });

  // --- Save status ---

  it("shows 'Saved' when not dirty and has ID", () => {
    mocks.persistDashboard = { name: "Test" } as never;
    renderDashboard("/dashboards/abc-123");
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
  });

  it("shows 'Unsaved changes' when dirty", () => {
    mocks.persistDashboard = { name: "Test" } as never;
    mocks.persistDirty = true;
    renderDashboard("/dashboards/abc-123");
    expect(screen.getByTestId("save-status")).toHaveTextContent(
      "Unsaved changes",
    );
  });

  it("shows 'Saving...' when saving", () => {
    mocks.persistDashboard = { name: "Test" } as never;
    mocks.persistSaving = true;
    renderDashboard("/dashboards/abc-123");
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saving...");
  });

  it("shows Save button when dirty", () => {
    mocks.persistDashboard = { name: "Test" } as never;
    mocks.persistDirty = true;
    renderDashboard("/dashboards/abc-123");
    expect(screen.getByTestId("save-button")).toBeInTheDocument();
  });

  it("does not show Save button when not dirty", () => {
    mocks.persistDashboard = { name: "Test" } as never;
    renderDashboard("/dashboards/abc-123");
    expect(screen.queryByTestId("save-button")).not.toBeInTheDocument();
  });

  it("calls save when Save button is clicked", async () => {
    mocks.persistDashboard = { name: "Test" } as never;
    mocks.persistDirty = true;
    renderDashboard("/dashboards/abc-123");
    const user = userEvent.setup();

    await user.click(screen.getByTestId("save-button"));
    expect(mocks.persistSave).toHaveBeenCalled();
  });

  // --- Error banner ---

  it("shows error banner when there is an error but dashboard exists", () => {
    mocks.persistDashboard = { name: "Test" } as never;
    mocks.persistError = "Save failed";
    renderDashboard("/dashboards/abc-123");
    expect(screen.getByTestId("dashboard-save-error")).toBeInTheDocument();
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });

  // --- Export button ---

  it("shows export button when dashboard has an ID", () => {
    mocks.persistDashboard = { name: "Test" } as never;
    renderDashboard("/dashboards/abc-123");
    expect(screen.getByTestId("export-button")).toBeInTheDocument();
  });

  it("does not show export button when no dashboard ID", () => {
    renderDashboard("/dashboards");
    expect(screen.queryByTestId("export-button")).not.toBeInTheDocument();
  });

  it("calls exportDashboard when Export button is clicked", async () => {
    mocks.persistDashboard = { name: "Test" } as never;
    mocks.exportDashboard.mockResolvedValue({
      version: 1,
      name: "Test",
      layout_json: {},
      cards_json: {},
      filters_json: {},
    });
    renderDashboard("/dashboards/abc-123");
    const user = userEvent.setup();

    await user.click(screen.getByTestId("export-button"));

    expect(mocks.exportDashboard).toHaveBeenCalledWith("abc-123");
  });

  // --- Empty state ---

  it("shows empty state when no cards exist", () => {
    renderDashboard();
    expect(screen.getByTestId("dashboard-empty")).toBeInTheDocument();
    expect(screen.getByText("No cards yet")).toBeInTheDocument();
    expect(
      screen.getByText("Click Edit and then Add Card to get started"),
    ).toBeInTheDocument();
  });

  it("does not show grid when no cards exist", () => {
    renderDashboard();
    expect(screen.queryByTestId("dashboard-grid")).not.toBeInTheDocument();
  });

  // --- Grid with cards ---

  it("renders the grid when cards exist", () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    expect(screen.getByTestId("dashboard-grid")).toBeInTheDocument();
  });

  it("does not show empty state when cards exist", () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    expect(screen.queryByTestId("dashboard-empty")).not.toBeInTheDocument();
  });

  it("renders each card via renderCard callback", () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    expect(screen.getByTestId("dashboard-card-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-card-card-2")).toBeInTheDocument();
  });

  it("renders CardRenderer inside each DashboardCard", () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    expect(screen.getByTestId("card-renderer-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-renderer-card-2")).toBeInTheDocument();
  });

  it("shows card titles via DashboardCard", () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    expect(screen.getByTestId("card-title-card-1")).toHaveTextContent(
      "Revenue by Region",
    );
    expect(screen.getByTestId("card-title-card-2")).toHaveTextContent(
      "Trends",
    );
  });

  it("passes layout to DashboardGrid", () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    expect(capturedGridProps.layout).toBe(SAMPLE_LAYOUT);
  });

  it("passes cards to DashboardGrid", () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    expect(capturedGridProps.cards).toBe(SAMPLE_CARDS);
  });

  it("passes onLayoutChange to DashboardGrid", () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    expect(capturedGridProps.onLayoutChange).toBeDefined();
  });

  // --- Edit mode toggle ---

  it("starts in view mode (edit mode off)", () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    expect(screen.getByTestId("edit-mode-toggle")).toHaveTextContent("Edit");
    expect(screen.getByTestId("dashboard-grid")).toHaveAttribute(
      "data-edit-mode",
      "false",
    );
  });

  it("toggles to edit mode when Edit button is clicked", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("edit-mode-toggle"));

    expect(screen.getByTestId("edit-mode-toggle")).toHaveTextContent(
      "Done Editing",
    );
    expect(screen.getByTestId("dashboard-grid")).toHaveAttribute(
      "data-edit-mode",
      "true",
    );
  });

  it("toggles back to view mode when Done Editing is clicked", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("edit-mode-toggle"));
    await user.click(screen.getByTestId("edit-mode-toggle"));

    expect(screen.getByTestId("edit-mode-toggle")).toHaveTextContent("Edit");
    expect(screen.getByTestId("dashboard-grid")).toHaveAttribute(
      "data-edit-mode",
      "false",
    );
  });

  it("passes editMode to DashboardCard via renderCard", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    // View mode
    expect(screen.getByTestId("dashboard-card-card-1")).toHaveAttribute(
      "data-edit-mode",
      "false",
    );

    // Toggle to edit
    await user.click(screen.getByTestId("edit-mode-toggle"));
    expect(screen.getByTestId("dashboard-card-card-1")).toHaveAttribute(
      "data-edit-mode",
      "true",
    );
  });

  // --- Add Card button ---

  it("does not show Add Card button in view mode", () => {
    renderDashboard();
    expect(screen.queryByTestId("add-card-button")).not.toBeInTheDocument();
  });

  it("shows Add Card button in edit mode", async () => {
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("edit-mode-toggle"));
    expect(screen.getByTestId("add-card-button")).toBeInTheDocument();
  });

  it("hides Add Card button when exiting edit mode", async () => {
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("edit-mode-toggle"));
    expect(screen.getByTestId("add-card-button")).toBeInTheDocument();

    await user.click(screen.getByTestId("edit-mode-toggle"));
    expect(screen.queryByTestId("add-card-button")).not.toBeInTheDocument();
  });

  // --- Add card flow (dialog) ---

  it("opens chart config dialog when Add Card is clicked", async () => {
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("edit-mode-toggle"));
    await user.click(screen.getByTestId("add-card-button"));

    expect(screen.getByTestId("chart-config-dialog")).toBeInTheDocument();
  });

  it("opens dialog in create mode (no initialConfig)", async () => {
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("edit-mode-toggle"));
    await user.click(screen.getByTestId("add-card-button"));

    expect(screen.getByTestId("dialog-has-initial")).toHaveTextContent(
      "creating",
    );
  });

  it("calls addCard when dialog save fires in create mode", async () => {
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("edit-mode-toggle"));
    await user.click(screen.getByTestId("add-card-button"));
    await user.click(screen.getByTestId("dialog-save-btn"));

    expect(mocks.addCard).toHaveBeenCalledWith({
      type: "bar",
      title: "Test Card",
      query: "SELECT * FROM t",
      columnMappings: { xField: "a", yField: "b" },
    });
  });

  it("closes dialog after saving a new card", async () => {
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("edit-mode-toggle"));
    await user.click(screen.getByTestId("add-card-button"));
    await user.click(screen.getByTestId("dialog-save-btn"));

    expect(screen.queryByTestId("chart-config-dialog")).not.toBeInTheDocument();
  });

  it("closes dialog when close button is clicked", async () => {
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("edit-mode-toggle"));
    await user.click(screen.getByTestId("add-card-button"));
    expect(screen.getByTestId("chart-config-dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("dialog-close-btn"));
    expect(screen.queryByTestId("chart-config-dialog")).not.toBeInTheDocument();
  });

  // --- Edit card flow ---

  it("opens dialog in edit mode when card settings is clicked", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("card-settings-btn-card-1"));

    expect(screen.getByTestId("chart-config-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-has-initial")).toHaveTextContent(
      "editing",
    );
  });

  it("passes card config as initialConfig when editing", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("card-settings-btn-card-1"));

    expect(mocks.dialogInitialConfig).toEqual(SAMPLE_CARDS[0]);
  });

  it("calls updateCard when saving in edit mode", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("card-settings-btn-card-1"));
    await user.click(screen.getByTestId("dialog-save-btn"));

    expect(mocks.updateCard).toHaveBeenCalledWith("card-1", {
      type: "bar",
      title: "Test Card",
      query: "SELECT * FROM t",
      columnMappings: { xField: "a", yField: "b" },
    });
    expect(mocks.addCard).not.toHaveBeenCalled();
  });

  it("closes dialog after updating a card", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("card-settings-btn-card-1"));
    await user.click(screen.getByTestId("dialog-save-btn"));

    expect(screen.queryByTestId("chart-config-dialog")).not.toBeInTheDocument();
  });

  // --- Remove card flow ---

  it("calls removeCard when card remove button is clicked", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("card-remove-btn-card-1"));

    expect(mocks.removeCard).toHaveBeenCalledWith("card-1");
  });

  it("calls removeCard for correct card ID", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("card-remove-btn-card-2"));

    expect(mocks.removeCard).toHaveBeenCalledWith("card-2");
  });

  // --- Dialog does not show when not opened ---

  it("does not show dialog initially", () => {
    renderDashboard();
    expect(
      screen.queryByTestId("chart-config-dialog"),
    ).not.toBeInTheDocument();
  });

  // --- URL parameter handling ---

  it("renders correctly with UUID-style dashboard ID", () => {
    renderDashboard("/dashboards/550e8400-e29b-41d4-a716-446655440000");
    expect(screen.getByTestId("dashboard-id")).toHaveTextContent(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  // --- Single card ---

  it("renders a single card correctly", () => {
    mocks.cards = [SAMPLE_CARDS[0]];
    mocks.layout = [SAMPLE_LAYOUT[0]];
    renderDashboard();
    expect(screen.getByTestId("dashboard-grid")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-card-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-renderer-card-1")).toHaveTextContent(
      "Rendered: bar",
    );
  });

  // --- Card type rendering ---

  it("passes card config type to CardRenderer", () => {
    mocks.cards = [
      {
        id: "card-text",
        type: "text",
        title: "Note",
        query: "",
        columnMappings: { content: "Hello world" },
      },
    ];
    mocks.layout = [{ i: "card-text", x: 0, y: 0, w: 4, h: 3 }];
    renderDashboard();
    expect(screen.getByTestId("card-renderer-card-text")).toHaveTextContent(
      "Rendered: text",
    );
  });

  // --- Edit then add flow (switching between edit and create) ---

  it("switches from edit to create mode correctly", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    // First open edit dialog
    await user.click(screen.getByTestId("card-settings-btn-card-1"));
    expect(screen.getByTestId("dialog-has-initial")).toHaveTextContent(
      "editing",
    );
    await user.click(screen.getByTestId("dialog-close-btn"));

    // Then open add dialog
    await user.click(screen.getByTestId("edit-mode-toggle"));
    await user.click(screen.getByTestId("add-card-button"));
    expect(screen.getByTestId("dialog-has-initial")).toHaveTextContent(
      "creating",
    );
  });

  // --- Multiple operations ---

  it("can add card and then edit another", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    // Enter edit mode and add a card
    await user.click(screen.getByTestId("edit-mode-toggle"));
    await user.click(screen.getByTestId("add-card-button"));
    await user.click(screen.getByTestId("dialog-save-btn"));
    expect(mocks.addCard).toHaveBeenCalledTimes(1);

    // Now edit an existing card
    await user.click(screen.getByTestId("card-settings-btn-card-2"));
    await user.click(screen.getByTestId("dialog-save-btn"));
    expect(mocks.updateCard).toHaveBeenCalledWith("card-2", expect.any(Object));
  });

  it("can remove multiple cards sequentially", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("card-remove-btn-card-1"));
    await user.click(screen.getByTestId("card-remove-btn-card-2"));

    expect(mocks.removeCard).toHaveBeenCalledTimes(2);
    expect(mocks.removeCard).toHaveBeenNthCalledWith(1, "card-1");
    expect(mocks.removeCard).toHaveBeenNthCalledWith(2, "card-2");
  });

  // --- Grid props ---

  it("passes editMode=false to grid in view mode", () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    expect(capturedGridProps.editMode).toBe(false);
  });

  it("passes editMode=true to grid in edit mode", async () => {
    mocks.cards = SAMPLE_CARDS;
    mocks.layout = SAMPLE_LAYOUT;
    renderDashboard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("edit-mode-toggle"));
    expect(capturedGridProps.editMode).toBe(true);
  });
});
