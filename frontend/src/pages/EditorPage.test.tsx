import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import EditorPage from "./EditorPage";

// --- Mocks ---

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  query: vi.fn(),
  loadTable: vi.fn().mockResolvedValue(undefined),
  editorOnRun: null as (() => void) | null,
  editorOnChange: null as ((value: string) => void) | null,
  editorValue: "",
}));

vi.mock("@/services/api", () => ({
  default: {
    get: mocks.get,
    post: vi.fn(),
    defaults: { baseURL: "http://localhost:8000" },
  },
  getAccessToken: vi.fn(() => "test-token"),
}));

vi.mock("@/hooks/useDuckDB", () => ({
  useDuckDB: () => ({
    query: mocks.query,
    loadTable: mocks.loadTable,
    loading: false,
    error: null,
    isReady: true,
    initError: null,
  }),
}));

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => {
  const MockEditor = (props: Record<string, unknown>) => {
    mocks.editorValue = props.value as string;
    mocks.editorOnChange = props.onChange as typeof mocks.editorOnChange;
    return <div data-testid="monaco-editor-mock">{props.value as string}</div>;
  };
  return { default: MockEditor };
});

// Mock SchemaExplorer to capture props
let capturedSchemaProps: Record<string, unknown> = {};
vi.mock("@/components/editor/SchemaExplorer", () => ({
  default: (props: Record<string, unknown>) => {
    capturedSchemaProps = props;
    return (
      <div data-testid="schema-explorer" className={props.className as string}>
        <button
          data-testid="mock-column-click"
          onClick={() =>
            (props.onColumnClick as (t: string, c: string) => void)?.(
              "sales",
              "revenue",
            )
          }
        >
          Insert Column
        </button>
      </div>
    );
  },
}));

// Mock QueryResult to capture props
let capturedResultProps: Record<string, unknown> = {};
vi.mock("@/components/editor/QueryResult", () => ({
  default: (props: Record<string, unknown>) => {
    capturedResultProps = props;
    const result = props.result as { rows: unknown[][] } | null;
    const isLoading = Boolean(props.loading);
    const errorMsg = props.error as string | null;
    return (
      <div data-testid="query-result" className={props.className as string}>
        {isLoading && <span data-testid="result-loading">Loading...</span>}
        {errorMsg && (
          <span data-testid="result-error">{errorMsg}</span>
        )}
        {result && (
          <span data-testid="result-data">
            {result.rows.length} rows
          </span>
        )}
        {!result && !isLoading && !errorMsg && (
          <span data-testid="result-empty">No results</span>
        )}
      </div>
    );
  },
}));

const WORKSPACE_ID = "ws-001";

async function renderEditor() {
  const result = render(
    <MemoryRouter>
      <EditorPage />
    </MemoryRouter>,
  );
  // Wait for workspace fetch to settle to avoid act warnings
  await waitFor(() => {
    expect(mocks.get).toHaveBeenCalled();
  });
  return result;
}

function mockWorkspace() {
  mocks.get.mockResolvedValue({
    data: [{ id: WORKSPACE_ID, name: "Default Workspace" }],
  });
}

describe("EditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspace();
    mocks.editorOnRun = null;
    mocks.editorOnChange = null;
    mocks.editorValue = "";
    capturedSchemaProps = {};
    capturedResultProps = {};
  });

  // --- Layout ---

  it("renders the editor page container", async () => {
    await renderEditor();
    expect(screen.getByTestId("editor-page")).toBeInTheDocument();
  });

  it("renders the schema explorer sidebar", async () => {
    await renderEditor();
    expect(screen.getByTestId("schema-explorer")).toBeInTheDocument();
  });

  it("renders the SQL editor", async () => {
    await renderEditor();
    expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument();
  });

  it("renders the query result panel", async () => {
    await renderEditor();
    expect(screen.getByTestId("query-result")).toBeInTheDocument();
  });

  it("renders the sidebar resize handle", async () => {
    await renderEditor();
    expect(screen.getByTestId("sidebar-resize-handle")).toBeInTheDocument();
  });

  it("renders the editor resize handle", async () => {
    await renderEditor();
    expect(screen.getByTestId("editor-resize-handle")).toBeInTheDocument();
  });

  it("has three-pane layout structure", async () => {
    await renderEditor();
    expect(screen.getByTestId("editor-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("editor-main")).toBeInTheDocument();
    expect(screen.getByTestId("editor-pane")).toBeInTheDocument();
    expect(screen.getByTestId("result-pane")).toBeInTheDocument();
  });

  it("sidebar resize handle has correct ARIA role", async () => {
    await renderEditor();
    const handle = screen.getByTestId("sidebar-resize-handle");
    expect(handle).toHaveAttribute("role", "separator");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
  });

  it("editor resize handle has correct ARIA role", async () => {
    await renderEditor();
    const handle = screen.getByTestId("editor-resize-handle");
    expect(handle).toHaveAttribute("role", "separator");
    expect(handle).toHaveAttribute("aria-orientation", "horizontal");
  });

  // --- Workspace loading ---

  it("fetches workspaces on mount", async () => {
    await renderEditor();
    expect(mocks.get).toHaveBeenCalledWith("/api/workspaces/");
  });

  it("passes workspace ID to SchemaExplorer", async () => {
    await renderEditor();
    await waitFor(() => {
      expect(capturedSchemaProps.workspaceId).toBe(WORKSPACE_ID);
    });
  });

  it("passes null workspaceId when fetch fails", async () => {
    mocks.get.mockRejectedValue(new Error("Network error"));
    const result = render(
      <MemoryRouter>
        <EditorPage />
      </MemoryRouter>,
    );
    // Initially null
    expect(capturedSchemaProps.workspaceId).toBeNull();
    // After failed fetch, still null
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalled();
    });
    expect(capturedSchemaProps.workspaceId).toBeNull();
    result.unmount();
  });

  // --- SQL Editor integration ---

  it("initializes with default SQL", async () => {
    await renderEditor();
    expect(mocks.editorValue).toBe("SELECT 1;");
  });

  it("renders Run button", async () => {
    await renderEditor();
    expect(screen.getByTestId("run-button")).toBeInTheDocument();
  });

  // --- Query execution ---

  it("executes query when Run button is clicked", async () => {
    const mockResult = {
      columns: ["count"],
      rows: [[42]],
      duration: 5.2,
    };
    mocks.query.mockResolvedValue(mockResult);

    await renderEditor();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => {
      expect(mocks.query).toHaveBeenCalledWith("SELECT 1;");
    });

    await waitFor(() => {
      expect(screen.getByTestId("result-data")).toHaveTextContent("1 rows");
    });
  });

  it("shows loading state during query", async () => {
    let resolveQuery: (v: unknown) => void = () => {};
    mocks.query.mockImplementation(
      () => new Promise((res) => { resolveQuery = res; }),
    );

    await renderEditor();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => {
      expect(capturedResultProps.loading).toBe(true);
    });

    await act(async () => {
      resolveQuery({ columns: ["x"], rows: [[1]], duration: 1 });
    });

    await waitFor(() => {
      expect(capturedResultProps.loading).toBe(false);
    });
  });

  it("shows error when query fails", async () => {
    mocks.query.mockRejectedValue(new Error("Syntax error near SELECT"));

    await renderEditor();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => {
      expect(screen.getByTestId("result-error")).toHaveTextContent(
        "Syntax error near SELECT",
      );
    });
  });

  it("clears previous error on successful query", async () => {
    mocks.query.mockRejectedValueOnce(new Error("Bad query"));
    mocks.query.mockResolvedValueOnce({
      columns: ["x"],
      rows: [[1]],
      duration: 1,
    });

    await renderEditor();
    const user = userEvent.setup();

    // First query — fails
    await user.click(screen.getByTestId("run-button"));
    await waitFor(() => {
      expect(screen.getByTestId("result-error")).toBeInTheDocument();
    });

    // Second query — succeeds
    await user.click(screen.getByTestId("run-button"));
    await waitFor(() => {
      expect(screen.getByTestId("result-data")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("result-error")).not.toBeInTheDocument();
  });

  it("clears previous result on query error", async () => {
    mocks.query.mockResolvedValueOnce({
      columns: ["x"],
      rows: [[1]],
      duration: 1,
    });
    mocks.query.mockRejectedValueOnce(new Error("Error"));

    await renderEditor();
    const user = userEvent.setup();

    // First: success
    await user.click(screen.getByTestId("run-button"));
    await waitFor(() => {
      expect(screen.getByTestId("result-data")).toBeInTheDocument();
    });

    // Second: error
    await user.click(screen.getByTestId("run-button"));
    await waitFor(() => {
      expect(screen.getByTestId("result-error")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("result-data")).not.toBeInTheDocument();
  });

  it("does not execute query when SQL is empty", async () => {
    await renderEditor();
    // Clear the editor via onChange
    await act(() => {
      mocks.editorOnChange?.("");
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("run-button"));

    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("does not execute query when SQL is whitespace only", async () => {
    await renderEditor();
    await act(() => {
      mocks.editorOnChange?.("   \n  ");
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("run-button"));

    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("handles non-Error thrown from query", async () => {
    mocks.query.mockRejectedValue("string error");

    await renderEditor();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => {
      expect(screen.getByTestId("result-error")).toHaveTextContent(
        "string error",
      );
    });
  });

  // --- Column click (schema → editor insertion) ---

  it("inserts column name into SQL on column click", async () => {
    await renderEditor();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("mock-column-click"));

    // The editorValue should now include "revenue" appended
    expect(mocks.editorValue).toContain("revenue");
  });

  it("adds space before column name if needed", async () => {
    await renderEditor();
    const user = userEvent.setup();

    // Click to insert column — initial SQL is "SELECT 1;"
    await user.click(screen.getByTestId("mock-column-click"));

    // Should have a space between "SELECT 1;" and "revenue"
    expect(mocks.editorValue).toBe("SELECT 1; revenue");
  });

  // --- SchemaExplorer wiring ---

  it("passes onColumnClick to SchemaExplorer", async () => {
    await renderEditor();
    expect(capturedSchemaProps.onColumnClick).toBeDefined();
    expect(typeof capturedSchemaProps.onColumnClick).toBe("function");
  });

  // --- QueryResult wiring ---

  it("passes null result initially", async () => {
    await renderEditor();
    expect(capturedResultProps.result).toBeNull();
  });

  it("passes loading=false initially", async () => {
    await renderEditor();
    expect(capturedResultProps.loading).toBe(false);
  });

  it("passes error=null initially", async () => {
    await renderEditor();
    expect(capturedResultProps.error).toBeNull();
  });

  // --- Resizable sidebar ---

  it("sidebar starts at default width", async () => {
    await renderEditor();
    const sidebar = screen.getByTestId("editor-sidebar");
    expect(sidebar.style.width).toBe("224px");
  });

  it("sidebar resize via mouse drag changes width", async () => {
    await renderEditor();
    const handle = screen.getByTestId("sidebar-resize-handle");
    const sidebar = screen.getByTestId("editor-sidebar");

    fireEvent.mouseDown(handle, { clientX: 224, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 324, clientY: 100 });
    fireEvent.mouseUp(document);

    expect(sidebar.style.width).toBe("324px");
  });

  it("sidebar width clamps to minimum", async () => {
    await renderEditor();
    const handle = screen.getByTestId("sidebar-resize-handle");
    const sidebar = screen.getByTestId("editor-sidebar");

    fireEvent.mouseDown(handle, { clientX: 224, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 10, clientY: 100 });
    fireEvent.mouseUp(document);

    expect(sidebar.style.width).toBe("140px");
  });

  it("sidebar width clamps to maximum", async () => {
    await renderEditor();
    const handle = screen.getByTestId("sidebar-resize-handle");
    const sidebar = screen.getByTestId("editor-sidebar");

    fireEvent.mouseDown(handle, { clientX: 224, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 1000, clientY: 100 });
    fireEvent.mouseUp(document);

    expect(sidebar.style.width).toBe("480px");
  });

  // --- Resizable editor/result split ---

  it("editor pane starts at 40% height", async () => {
    await renderEditor();
    const editorPane = screen.getByTestId("editor-pane");
    expect(editorPane.style.height).toBe("40%");
  });

  // --- Initial empty state ---

  it("shows empty result state before any query", async () => {
    await renderEditor();
    expect(screen.getByTestId("result-empty")).toBeInTheDocument();
  });

  // --- Multiple queries ---

  it("executes updated SQL after editor change", async () => {
    mocks.query.mockResolvedValue({
      columns: ["x"],
      rows: [[1]],
      duration: 1,
    });

    await renderEditor();
    const user = userEvent.setup();

    // Change the SQL
    await act(() => {
      mocks.editorOnChange?.("SELECT * FROM sales");
    });

    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => {
      expect(mocks.query).toHaveBeenCalledWith("SELECT * FROM sales");
    });
  });

  it("can run multiple queries sequentially", async () => {
    mocks.query
      .mockResolvedValueOnce({ columns: ["a"], rows: [[1]], duration: 1 })
      .mockResolvedValueOnce({ columns: ["b"], rows: [[2], [3]], duration: 2 });

    await renderEditor();
    const user = userEvent.setup();

    // First query
    await user.click(screen.getByTestId("run-button"));
    await waitFor(() => {
      expect(screen.getByTestId("result-data")).toHaveTextContent("1 rows");
    });

    // Change SQL and run again
    await act(() => {
      mocks.editorOnChange?.("SELECT b FROM t");
    });
    await user.click(screen.getByTestId("run-button"));

    await waitFor(() => {
      expect(screen.getByTestId("result-data")).toHaveTextContent("2 rows");
    });

    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});
