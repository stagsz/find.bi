import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock api module
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  default: { get: mocks.get },
}));

import SchemaExplorer from "./SchemaExplorer";

const WORKSPACE_ID = "ws-123";

const mockTables = [
  {
    table_name: "sales",
    columns: [
      { name: "id", type: "integer", duckdb_type: "INTEGER" },
      { name: "region", type: "string", duckdb_type: "VARCHAR" },
      { name: "revenue", type: "float", duckdb_type: "DOUBLE" },
    ],
    row_count: 1500,
  },
  {
    table_name: "users",
    columns: [
      { name: "user_id", type: "integer", duckdb_type: "INTEGER" },
      { name: "email", type: "string", duckdb_type: "VARCHAR" },
    ],
    row_count: 42,
  },
];

describe("SchemaExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ data: mockTables });
  });

  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders the schema explorer container", async () => {
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    expect(screen.getByTestId("schema-explorer")).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalled();
    });
  });

  it("renders Schema label in header", async () => {
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    expect(screen.getByText("Schema")).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalled();
    });
  });

  it("renders refresh button", async () => {
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    expect(screen.getByTestId("schema-refresh")).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalled();
    });
  });

  it("applies className to container", async () => {
    render(
      <SchemaExplorer workspaceId={WORKSPACE_ID} className="w-64 border-r" />,
    );
    expect(screen.getByTestId("schema-explorer")).toHaveClass("w-64");
    expect(screen.getByTestId("schema-explorer")).toHaveClass("border-r");
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalled();
    });
  });

  // --- API integration ---

  it("fetches schema from API on mount", async () => {
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledWith("/api/data/sources", {
        params: { workspace_id: WORKSPACE_ID },
      });
    });
  });

  it("does not fetch schema when workspaceId is null", () => {
    render(<SchemaExplorer workspaceId={null} />);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("refetches when workspaceId changes", async () => {
    const { rerender } = render(
      <SchemaExplorer workspaceId={WORKSPACE_ID} />,
    );
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(1);
    });

    rerender(<SchemaExplorer workspaceId="ws-456" />);
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(2);
      expect(mocks.get).toHaveBeenLastCalledWith("/api/data/sources", {
        params: { workspace_id: "ws-456" },
      });
    });
  });

  // --- Loading state ---

  it("shows loading indicator while fetching", () => {
    mocks.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    expect(screen.getByTestId("schema-loading")).toBeInTheDocument();
    expect(screen.getByTestId("schema-loading")).toHaveTextContent("Loading...");
  });

  it("hides loading indicator after fetch completes", async () => {
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(screen.queryByTestId("schema-loading")).not.toBeInTheDocument();
    });
  });

  // --- Error state ---

  it("shows error message when fetch fails", async () => {
    mocks.get.mockRejectedValue(new Error("Network error"));
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId("schema-error")).toBeInTheDocument();
      expect(screen.getByTestId("schema-error")).toHaveTextContent(
        "Failed to load schema",
      );
    });
  });

  // --- Empty state ---

  it("shows empty message when no tables found", async () => {
    mocks.get.mockResolvedValue({ data: [] });
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId("schema-empty")).toBeInTheDocument();
      expect(screen.getByTestId("schema-empty")).toHaveTextContent(
        "No tables found",
      );
    });
  });

  // --- Table list ---

  it("renders all table names", async () => {
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      const tables = screen.getAllByTestId("schema-table");
      expect(tables).toHaveLength(2);
    });
    expect(screen.getByText("sales")).toBeInTheDocument();
    expect(screen.getByText("users")).toBeInTheDocument();
  });

  it("shows row count for each table", async () => {
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      // Use regex to handle locale-specific number formatting (e.g. "1,500" or "1 500")
      expect(screen.getByText(/1.?500/)).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  it("renders table toggle buttons", async () => {
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-toggle-sales"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("schema-table-toggle-users"),
      ).toBeInTheDocument();
    });
  });

  // --- Expand / Collapse ---

  it("tables are collapsed by default", async () => {
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(screen.getAllByTestId("schema-table")).toHaveLength(2);
    });
    expect(
      screen.queryByTestId("schema-columns-sales"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("schema-columns-users"),
    ).not.toBeInTheDocument();
  });

  it("expands table on click to show columns", async () => {
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-toggle-sales"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-sales"));
    expect(screen.getByTestId("schema-columns-sales")).toBeInTheDocument();
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("region")).toBeInTheDocument();
    expect(screen.getByText("revenue")).toBeInTheDocument();
  });

  it("collapses expanded table on second click", async () => {
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-toggle-sales"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-sales"));
    expect(screen.getByTestId("schema-columns-sales")).toBeInTheDocument();

    await user.click(screen.getByTestId("schema-table-toggle-sales"));
    expect(
      screen.queryByTestId("schema-columns-sales"),
    ).not.toBeInTheDocument();
  });

  it("can expand multiple tables independently", async () => {
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-toggle-sales"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-sales"));
    await user.click(screen.getByTestId("schema-table-toggle-users"));
    expect(screen.getByTestId("schema-columns-sales")).toBeInTheDocument();
    expect(screen.getByTestId("schema-columns-users")).toBeInTheDocument();
  });

  it("rotates arrow icon when table is expanded", async () => {
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-arrow-sales"),
      ).toBeInTheDocument();
    });

    const arrow = screen.getByTestId("schema-table-arrow-sales");
    expect(arrow).not.toHaveClass("rotate-90");

    await user.click(screen.getByTestId("schema-table-toggle-sales"));
    expect(arrow).toHaveClass("rotate-90");
  });

  // --- Column display ---

  it("shows column types next to column names", async () => {
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-toggle-sales"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-sales"));
    expect(
      screen.getByTestId("schema-column-sales-id"),
    ).toHaveTextContent("integer");
    expect(
      screen.getByTestId("schema-column-sales-region"),
    ).toHaveTextContent("string");
    expect(
      screen.getByTestId("schema-column-sales-revenue"),
    ).toHaveTextContent("float");
  });

  it("renders column buttons with correct test IDs", async () => {
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-toggle-sales"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-sales"));
    expect(screen.getByTestId("schema-column-sales-id")).toBeInTheDocument();
    expect(
      screen.getByTestId("schema-column-sales-region"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("schema-column-sales-revenue"),
    ).toBeInTheDocument();
  });

  it("shows DuckDB type in column title attribute", async () => {
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-toggle-sales"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-sales"));
    const colBtn = screen.getByTestId("schema-column-sales-id");
    expect(colBtn).toHaveAttribute(
      "title",
      "id (INTEGER) — click to insert",
    );
  });

  // --- Column click handler ---

  it("calls onColumnClick with table and column name when column is clicked", async () => {
    const onColumnClick = vi.fn();
    const user = userEvent.setup();
    render(
      <SchemaExplorer
        workspaceId={WORKSPACE_ID}
        onColumnClick={onColumnClick}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-toggle-sales"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-sales"));
    await user.click(screen.getByTestId("schema-column-sales-region"));

    expect(onColumnClick).toHaveBeenCalledTimes(1);
    expect(onColumnClick).toHaveBeenCalledWith("sales", "region");
  });

  it("does not throw when onColumnClick is not provided", async () => {
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-toggle-sales"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-sales"));
    await user.click(screen.getByTestId("schema-column-sales-id"));
    // No error thrown
  });

  it("calls onColumnClick for different tables", async () => {
    const onColumnClick = vi.fn();
    const user = userEvent.setup();
    render(
      <SchemaExplorer
        workspaceId={WORKSPACE_ID}
        onColumnClick={onColumnClick}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("schema-table-toggle-users"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-users"));
    await user.click(screen.getByTestId("schema-column-users-email"));

    expect(onColumnClick).toHaveBeenCalledWith("users", "email");
  });

  // --- Refresh ---

  it("refetches schema when refresh button is clicked", async () => {
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByTestId("schema-refresh"));
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledTimes(2);
    });
  });

  // --- Edge cases ---

  it("handles table with no columns", async () => {
    mocks.get.mockResolvedValue({
      data: [{ table_name: "empty_table", columns: [], row_count: 0 }],
    });
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(screen.getByText("empty_table")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-empty_table"));
    expect(
      screen.getByTestId("schema-columns-empty_table"),
    ).toBeInTheDocument();
    // Container is present but has no column buttons
    expect(
      screen.getByTestId("schema-columns-empty_table").children,
    ).toHaveLength(0);
  });

  it("handles single table with single column", async () => {
    mocks.get.mockResolvedValue({
      data: [
        {
          table_name: "tiny",
          columns: [{ name: "val", type: "integer", duckdb_type: "INTEGER" }],
          row_count: 1,
        },
      ],
    });
    const user = userEvent.setup();
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(screen.getByText("tiny")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("schema-table-toggle-tiny"));
    expect(screen.getByTestId("schema-column-tiny-val")).toBeInTheDocument();
  });

  it("handles large number of tables", async () => {
    const manyTables = Array.from({ length: 20 }, (_, i) => ({
      table_name: `table_${i}`,
      columns: [{ name: "id", type: "integer", duckdb_type: "INTEGER" }],
      row_count: i * 100,
    }));
    mocks.get.mockResolvedValue({ data: manyTables });
    render(<SchemaExplorer workspaceId={WORKSPACE_ID} />);
    await waitFor(() => {
      expect(screen.getAllByTestId("schema-table")).toHaveLength(20);
    });
  });
});
