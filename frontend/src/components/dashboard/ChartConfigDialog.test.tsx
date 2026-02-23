import { render, screen, cleanup, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  isReady: true,
}));

vi.mock("@/hooks/useDuckDB", () => ({
  useDuckDB: () => ({
    query: mocks.query,
    loadTable: vi.fn(),
    loading: false,
    error: null,
    isReady: mocks.isReady,
    initError: null,
  }),
}));

// Mock chart components to simple divs for testing
vi.mock("@/components/charts/BarChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="preview-bar" data-x={props.xField} data-y={props.yField} />
  ),
}));

vi.mock("@/components/charts/LineChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="preview-line" data-x={props.xField} data-y={props.yField} />
  ),
}));

vi.mock("@/components/charts/AreaChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="preview-area" data-x={props.xField} data-y={props.yField} />
  ),
}));

vi.mock("@/components/charts/ScatterChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="preview-scatter" data-x={props.xField} data-y={props.yField} />
  ),
}));

vi.mock("@/components/charts/PieChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="preview-pie" data-name={props.nameField} data-value={props.valueField} />
  ),
}));

vi.mock("@/components/charts/RadarChart", () => ({
  default: () => <div data-testid="preview-radar" />,
}));

vi.mock("@/components/charts/KPICard", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="preview-kpi" data-value={props.value} data-unit={props.unit} />
  ),
}));

vi.mock("@/components/charts/DataTable", () => ({
  default: () => <div data-testid="preview-table" />,
}));

import ChartConfigDialog, {
  CHART_TYPES,
  MAPPING_FIELDS,
  needsQuery,
  needsMappings,
} from "./ChartConfigDialog";
import type { ChartConfigDialogProps } from "./ChartConfigDialog";
import type { DashboardCardConfig } from "./DashboardGrid";

// --- Helpers ---

const defaultProps: ChartConfigDialogProps = {
  open: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
};

function renderDialog(overrides?: Partial<ChartConfigDialogProps>) {
  return render(<ChartConfigDialog {...defaultProps} {...overrides} />);
}

const mockQueryResult = {
  columns: ["region", "revenue", "count"],
  rows: [
    ["North", 100, 5],
    ["South", 200, 8],
    ["East", 150, 3],
  ],
  duration: 12,
};

async function runQueryAndGetColumns(user: ReturnType<typeof userEvent.setup>) {
  mocks.query.mockResolvedValueOnce(mockQueryResult);
  const textarea = screen.getByTestId("config-query");
  await user.clear(textarea);
  await user.type(textarea, "SELECT * FROM sales");
  await user.click(screen.getByTestId("config-run-query"));
  // Wait for async query to complete
  await screen.findByTestId("config-query-info");
}

// --- Tests ---

describe("ChartConfigDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isReady = true;
  });

  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders nothing when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId("chart-config-dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog when open", () => {
    renderDialog();
    expect(screen.getByTestId("chart-config-dialog")).toBeInTheDocument();
  });

  it("renders the overlay backdrop", () => {
    renderDialog();
    expect(screen.getByTestId("chart-config-overlay")).toBeInTheDocument();
  });

  it("shows 'Configure Card' title for new card", () => {
    renderDialog();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Configure Card");
  });

  it("shows 'Edit Card' title for existing card", () => {
    const config: DashboardCardConfig = {
      id: "c1",
      type: "bar",
      title: "Test",
      query: "SELECT 1",
      columnMappings: {},
    };
    renderDialog({ initialConfig: config });
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Edit Card");
  });

  it("has role=dialog and aria-modal", () => {
    renderDialog();
    const dialog = screen.getByTestId("chart-config-dialog");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("shows title input", () => {
    renderDialog();
    expect(screen.getByTestId("config-title")).toBeInTheDocument();
  });

  it("shows SQL query textarea for non-text types", () => {
    renderDialog();
    expect(screen.getByTestId("config-query")).toBeInTheDocument();
  });

  it("shows Run Query button", () => {
    renderDialog();
    expect(screen.getByTestId("config-run-query")).toBeInTheDocument();
  });

  it("shows Cancel and Save buttons", () => {
    renderDialog();
    expect(screen.getByTestId("config-cancel")).toBeInTheDocument();
    expect(screen.getByTestId("config-save")).toBeInTheDocument();
  });

  it("shows 'Add Card' text on save for new card", () => {
    renderDialog();
    expect(screen.getByTestId("config-save")).toHaveTextContent("Add Card");
  });

  it("shows 'Update' text on save for existing card", () => {
    const config: DashboardCardConfig = {
      id: "c1",
      type: "bar",
      title: "Test",
      query: "",
      columnMappings: {},
    };
    renderDialog({ initialConfig: config });
    expect(screen.getByTestId("config-save")).toHaveTextContent("Update");
  });

  // --- Chart type selection ---

  it("renders all 9 chart type buttons", () => {
    renderDialog();
    for (const ct of CHART_TYPES) {
      expect(screen.getByTestId(`chart-type-${ct.value}`)).toBeInTheDocument();
    }
  });

  it("defaults to bar chart type", () => {
    renderDialog();
    const barBtn = screen.getByTestId("chart-type-bar");
    expect(barBtn).toHaveClass("border-blue-500");
  });

  it("highlights selected chart type", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("chart-type-line"));
    expect(screen.getByTestId("chart-type-line")).toHaveClass("border-blue-500");
    expect(screen.getByTestId("chart-type-bar")).not.toHaveClass("border-blue-500");
  });

  it("resets column mappings when chart type changes", async () => {
    const user = userEvent.setup();
    renderDialog();

    // Run a query first so we get columns
    await runQueryAndGetColumns(user);

    // Set a mapping for bar chart
    const select = screen.getByTestId("mapping-select-xField");
    await user.selectOptions(select, "region");
    expect(select).toHaveValue("region");

    // Switch to pie chart — mappings should reset
    await user.click(screen.getByTestId("chart-type-pie"));

    // nameField should be empty (reset)
    const nameSelect = screen.getByTestId("mapping-select-nameField");
    expect(nameSelect).toHaveValue("");
  });

  // --- SQL Query ---

  it("runs query on button click", async () => {
    const user = userEvent.setup();
    mocks.query.mockResolvedValueOnce(mockQueryResult);
    renderDialog();

    const textarea = screen.getByTestId("config-query");
    await user.type(textarea, "SELECT * FROM sales");
    await user.click(screen.getByTestId("config-run-query"));

    await screen.findByTestId("config-query-info");
    expect(mocks.query).toHaveBeenCalledWith("SELECT * FROM sales");
  });

  it("shows row and column count after query runs", async () => {
    const user = userEvent.setup();
    renderDialog();
    await runQueryAndGetColumns(user);

    const info = screen.getByTestId("config-query-info");
    expect(info).toHaveTextContent("3 rows");
    expect(info).toHaveTextContent("3 columns");
  });

  it("shows query error when query fails", async () => {
    const user = userEvent.setup();
    mocks.query.mockRejectedValueOnce(new Error("Table not found"));
    renderDialog();

    const textarea = screen.getByTestId("config-query");
    await user.type(textarea, "SELECT * FROM nonexistent");
    await user.click(screen.getByTestId("config-run-query"));

    await screen.findByTestId("config-query-error");
    expect(screen.getByTestId("config-query-error")).toHaveTextContent("Table not found");
  });

  it("disables run button when query is empty", () => {
    renderDialog();
    expect(screen.getByTestId("config-run-query")).toBeDisabled();
  });

  it("disables run button when DuckDB is not ready", async () => {
    const user = userEvent.setup();
    mocks.isReady = false;
    renderDialog();

    const textarea = screen.getByTestId("config-query");
    await user.type(textarea, "SELECT 1");
    expect(screen.getByTestId("config-run-query")).toBeDisabled();
  });

  it("shows 'Running...' text during query execution", async () => {
    const user = userEvent.setup();
    let resolveQuery!: (value: unknown) => void;
    mocks.query.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveQuery = resolve;
      }),
    );
    renderDialog();

    const textarea = screen.getByTestId("config-query");
    await user.type(textarea, "SELECT 1");
    await user.click(screen.getByTestId("config-run-query"));

    expect(screen.getByTestId("config-run-query")).toHaveTextContent("Running...");

    await act(async () => {
      resolveQuery(mockQueryResult);
    });

    expect(screen.getByTestId("config-run-query")).toHaveTextContent("Run Query");
  });

  // --- Text type ---

  it("hides SQL query section for text type", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("chart-type-text"));
    expect(screen.queryByTestId("config-query")).not.toBeInTheDocument();
  });

  it("shows content textarea for text type", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("chart-type-text"));
    expect(screen.getByTestId("config-text-content")).toBeInTheDocument();
  });

  it("saves text content in columnMappings", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDialog({ onSave });

    await user.click(screen.getByTestId("chart-type-text"));

    const textarea = screen.getByTestId("config-text-content");
    await user.type(textarea, "Hello World");

    await user.click(screen.getByTestId("config-save"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "text",
        columnMappings: { content: "Hello World" },
      }),
    );
  });

  // --- Column Mappings ---

  it("does not show mappings before query runs", () => {
    renderDialog();
    expect(screen.queryByTestId("config-mappings")).not.toBeInTheDocument();
  });

  it("shows column mapping dropdowns after query runs (bar type)", async () => {
    const user = userEvent.setup();
    renderDialog();
    await runQueryAndGetColumns(user);

    expect(screen.getByTestId("config-mappings")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-select-xField")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-select-yField")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-toggle-horizontal")).toBeInTheDocument();
  });

  it("populates column dropdowns with query result columns", async () => {
    const user = userEvent.setup();
    renderDialog();
    await runQueryAndGetColumns(user);

    const select = screen.getByTestId("mapping-select-xField");
    const options = within(select).getAllByRole("option");
    // First option is placeholder, then 3 columns
    expect(options).toHaveLength(4);
    expect(options[1]).toHaveTextContent("region");
    expect(options[2]).toHaveTextContent("revenue");
    expect(options[3]).toHaveTextContent("count");
  });

  it("shows required indicator on required fields", async () => {
    const user = userEvent.setup();
    renderDialog();
    await runQueryAndGetColumns(user);

    const xFieldContainer = screen.getByTestId("mapping-column-xField");
    expect(xFieldContainer).toHaveTextContent("*");
  });

  it("shows different mapping fields for pie chart", async () => {
    const user = userEvent.setup();
    renderDialog();

    // Switch to pie
    await user.click(screen.getByTestId("chart-type-pie"));
    await runQueryAndGetColumns(user);

    expect(screen.getByTestId("mapping-select-nameField")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-select-valueField")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-toggle-donut")).toBeInTheDocument();
    expect(screen.queryByTestId("mapping-select-xField")).not.toBeInTheDocument();
  });

  it("shows scatter-specific fields", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("chart-type-scatter"));
    await runQueryAndGetColumns(user);

    expect(screen.getByTestId("mapping-select-xField")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-select-yField")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-select-sizeField")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-select-colorField")).toBeInTheDocument();
  });

  it("shows KPI-specific fields with text input", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("chart-type-kpi"));
    await runQueryAndGetColumns(user);

    expect(screen.getByTestId("mapping-select-valueField")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-text-unit")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-input-unit")).toBeInTheDocument();
  });

  it("does not show mappings for table type (auto-uses all columns)", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("chart-type-table"));
    await runQueryAndGetColumns(user);

    expect(screen.queryByTestId("config-mappings")).not.toBeInTheDocument();
  });

  it("does not show mappings for radar type (auto-detect)", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("chart-type-radar"));
    await runQueryAndGetColumns(user);

    expect(screen.queryByTestId("config-mappings")).not.toBeInTheDocument();
  });

  it("updates column mapping on selection", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDialog({ onSave });
    await runQueryAndGetColumns(user);

    await user.selectOptions(screen.getByTestId("mapping-select-xField"), "region");
    await user.selectOptions(screen.getByTestId("mapping-select-yField"), "revenue");
    await user.click(screen.getByTestId("config-save"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        columnMappings: expect.objectContaining({
          xField: "region",
          yField: "revenue",
        }),
      }),
    );
  });

  it("toggles checkbox mapping", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDialog({ onSave });
    await runQueryAndGetColumns(user);

    const toggleLabel = screen.getByTestId("mapping-toggle-horizontal");
    const checkbox = within(toggleLabel).getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.selectOptions(screen.getByTestId("mapping-select-xField"), "region");
    await user.selectOptions(screen.getByTestId("mapping-select-yField"), "revenue");
    await user.click(screen.getByTestId("config-save"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        columnMappings: expect.objectContaining({
          horizontal: "true",
        }),
      }),
    );
  });

  // --- Preview ---

  it("shows preview button after query runs", async () => {
    const user = userEvent.setup();
    renderDialog();
    await runQueryAndGetColumns(user);

    expect(screen.getByTestId("config-preview-btn")).toBeInTheDocument();
  });

  it("does not show preview button before query runs", () => {
    renderDialog();
    expect(screen.queryByTestId("config-preview-btn")).not.toBeInTheDocument();
  });

  it("toggles preview section on button click", async () => {
    const user = userEvent.setup();
    renderDialog();
    await runQueryAndGetColumns(user);

    expect(screen.queryByTestId("config-preview")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("config-preview-btn"));
    expect(screen.getByTestId("config-preview")).toBeInTheDocument();

    await user.click(screen.getByTestId("config-preview-btn"));
    expect(screen.queryByTestId("config-preview")).not.toBeInTheDocument();
  });

  it("shows preview-empty when mappings are not set", async () => {
    const user = userEvent.setup();
    renderDialog();
    await runQueryAndGetColumns(user);

    await user.click(screen.getByTestId("config-preview-btn"));
    expect(screen.getByTestId("preview-empty")).toBeInTheDocument();
  });

  it("renders bar chart preview with correct props", async () => {
    const user = userEvent.setup();
    renderDialog();
    await runQueryAndGetColumns(user);

    await user.selectOptions(screen.getByTestId("mapping-select-xField"), "region");
    await user.selectOptions(screen.getByTestId("mapping-select-yField"), "revenue");

    await user.click(screen.getByTestId("config-preview-btn"));
    const preview = screen.getByTestId("preview-bar");
    expect(preview).toHaveAttribute("data-x", "region");
    expect(preview).toHaveAttribute("data-y", "revenue");
  });

  it("renders line chart preview", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("chart-type-line"));
    await runQueryAndGetColumns(user);

    await user.selectOptions(screen.getByTestId("mapping-select-xField"), "region");
    await user.selectOptions(screen.getByTestId("mapping-select-yField"), "revenue");

    await user.click(screen.getByTestId("config-preview-btn"));
    expect(screen.getByTestId("preview-line")).toBeInTheDocument();
  });

  it("renders pie chart preview", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("chart-type-pie"));
    await runQueryAndGetColumns(user);

    await user.selectOptions(screen.getByTestId("mapping-select-nameField"), "region");
    await user.selectOptions(screen.getByTestId("mapping-select-valueField"), "revenue");

    await user.click(screen.getByTestId("config-preview-btn"));
    const preview = screen.getByTestId("preview-pie");
    expect(preview).toHaveAttribute("data-name", "region");
    expect(preview).toHaveAttribute("data-value", "revenue");
  });

  it("renders table preview (no mappings needed)", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("chart-type-table"));
    await runQueryAndGetColumns(user);

    await user.click(screen.getByTestId("config-preview-btn"));
    expect(screen.getByTestId("preview-table")).toBeInTheDocument();
  });

  it("renders radar preview (auto-detect columns)", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("chart-type-radar"));
    await runQueryAndGetColumns(user);

    await user.click(screen.getByTestId("config-preview-btn"));
    expect(screen.getByTestId("preview-radar")).toBeInTheDocument();
  });

  it("renders KPI preview with value from first row", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("chart-type-kpi"));
    await runQueryAndGetColumns(user);

    await user.selectOptions(screen.getByTestId("mapping-select-valueField"), "revenue");

    await user.click(screen.getByTestId("config-preview-btn"));
    const preview = screen.getByTestId("preview-kpi");
    expect(preview).toHaveAttribute("data-value", "100");
  });

  // --- Save / Validation ---

  it("disables save when SQL query is empty (non-text type)", () => {
    renderDialog();
    expect(screen.getByTestId("config-save")).toBeDisabled();
  });

  it("disables save when required column mappings are missing", async () => {
    const user = userEvent.setup();
    renderDialog();

    const textarea = screen.getByTestId("config-query");
    await user.type(textarea, "SELECT 1");

    // Has query but no column mappings → disabled
    expect(screen.getByTestId("config-save")).toBeDisabled();
  });

  it("enables save when query exists and no required mappings for table type", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("chart-type-table"));
    const textarea = screen.getByTestId("config-query");
    await user.type(textarea, "SELECT * FROM sales");

    expect(screen.getByTestId("config-save")).not.toBeDisabled();
  });

  it("enables save for text type without query", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("chart-type-text"));
    expect(screen.getByTestId("config-save")).not.toBeDisabled();
  });

  it("enables save for radar type when query exists", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByTestId("chart-type-radar"));
    const textarea = screen.getByTestId("config-query");
    await user.type(textarea, "SELECT * FROM sales");
    expect(screen.getByTestId("config-save")).not.toBeDisabled();
  });

  it("calls onSave with correct config on save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDialog({ onSave });

    // Set title
    await user.type(screen.getByTestId("config-title"), "Revenue Chart");

    // Set query (enough for save with table type)
    await user.click(screen.getByTestId("chart-type-table"));
    const textarea = screen.getByTestId("config-query");
    await user.type(textarea, "SELECT * FROM sales");

    await user.click(screen.getByTestId("config-save"));

    expect(onSave).toHaveBeenCalledWith({
      type: "table",
      title: "Revenue Chart",
      query: "SELECT * FROM sales",
      columnMappings: {},
    });
  });

  it("uses 'Untitled Card' when title is empty", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderDialog({ onSave });

    await user.click(screen.getByTestId("chart-type-text"));
    await user.click(screen.getByTestId("config-save"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Untitled Card",
      }),
    );
  });

  // --- Close behavior ---

  it("calls onClose on X button click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ onClose });
    await user.click(screen.getByTestId("dialog-close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Cancel button click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ onClose });
    await user.click(screen.getByTestId("config-cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on overlay click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ onClose });
    await user.click(screen.getByTestId("chart-config-overlay"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close on dialog panel click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ onClose });
    await user.click(screen.getByTestId("chart-config-dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ onClose });
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  // --- Initial config ---

  it("populates form fields from initialConfig", () => {
    const config: DashboardCardConfig = {
      id: "c1",
      type: "pie",
      title: "Sales Breakdown",
      query: "SELECT region, SUM(rev) FROM sales GROUP BY 1",
      columnMappings: { nameField: "region", valueField: "rev" },
    };
    renderDialog({ initialConfig: config });

    expect(screen.getByTestId("config-title")).toHaveValue("Sales Breakdown");
    expect(screen.getByTestId("chart-type-pie")).toHaveClass("border-blue-500");
    expect(screen.getByTestId("config-query")).toHaveValue(
      "SELECT region, SUM(rev) FROM sales GROUP BY 1",
    );
  });

  it("populates text content from initialConfig", () => {
    const config: DashboardCardConfig = {
      id: "c1",
      type: "text",
      title: "Notes",
      query: "",
      columnMappings: { content: "Some notes here" },
    };
    renderDialog({ initialConfig: config });

    expect(screen.getByTestId("config-text-content")).toHaveValue("Some notes here");
  });

  it("resets state when dialog reopens", () => {
    const { rerender } = render(
      <ChartConfigDialog {...defaultProps} open={false} />,
    );

    rerender(<ChartConfigDialog {...defaultProps} open={true} />);

    expect(screen.getByTestId("config-title")).toHaveValue("");
    expect(screen.getByTestId("chart-type-bar")).toHaveClass("border-blue-500");
    expect(screen.queryByTestId("config-query-info")).not.toBeInTheDocument();
    expect(screen.queryByTestId("config-query-error")).not.toBeInTheDocument();
  });

  // --- Utility functions ---

  it("needsQuery returns false only for text", () => {
    expect(needsQuery("bar")).toBe(true);
    expect(needsQuery("line")).toBe(true);
    expect(needsQuery("table")).toBe(true);
    expect(needsQuery("kpi")).toBe(true);
    expect(needsQuery("text")).toBe(false);
  });

  it("needsMappings returns false for radar, table, text", () => {
    expect(needsMappings("bar")).toBe(true);
    expect(needsMappings("line")).toBe(true);
    expect(needsMappings("pie")).toBe(true);
    expect(needsMappings("scatter")).toBe(true);
    expect(needsMappings("kpi")).toBe(true);
    expect(needsMappings("radar")).toBe(false);
    expect(needsMappings("table")).toBe(false);
    expect(needsMappings("text")).toBe(false);
  });

  it("CHART_TYPES contains all 9 types", () => {
    expect(CHART_TYPES).toHaveLength(9);
    const values = CHART_TYPES.map((ct) => ct.value);
    expect(values).toContain("bar");
    expect(values).toContain("line");
    expect(values).toContain("area");
    expect(values).toContain("scatter");
    expect(values).toContain("pie");
    expect(values).toContain("radar");
    expect(values).toContain("kpi");
    expect(values).toContain("table");
    expect(values).toContain("text");
  });

  it("MAPPING_FIELDS has entries for all chart types", () => {
    for (const ct of CHART_TYPES) {
      expect(MAPPING_FIELDS[ct.value]).toBeDefined();
    }
  });

  // --- Singular/plural text ---

  it("shows singular 'row' and 'column' for single-item result", async () => {
    const user = userEvent.setup();
    mocks.query.mockResolvedValueOnce({
      columns: ["val"],
      rows: [[42]],
      duration: 1,
    });
    renderDialog();

    const textarea = screen.getByTestId("config-query");
    await user.type(textarea, "SELECT 42 AS val");
    await user.click(screen.getByTestId("config-run-query"));

    await screen.findByTestId("config-query-info");
    const info = screen.getByTestId("config-query-info");
    expect(info).toHaveTextContent("1 row,");
    expect(info).toHaveTextContent("1 column");
  });
});
