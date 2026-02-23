import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import UploadPage from "./UploadPage";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  loadTable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/api", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    defaults: { baseURL: "http://localhost:8000" },
  },
}));

vi.mock("@/hooks/useDuckDB", () => ({
  useDuckDB: () => ({
    loadTable: mocks.loadTable,
    query: vi.fn(),
    loading: false,
    error: null,
    isReady: true,
    initError: null,
  }),
}));

const WORKSPACE_ID = "ws-001";

function renderUpload() {
  return render(
    <MemoryRouter>
      <UploadPage />
    </MemoryRouter>,
  );
}

function mockWorkspace() {
  mocks.get.mockResolvedValue({
    data: [{ id: WORKSPACE_ID, name: "Default Workspace" }],
  });
}

function createCsvFile(name = "sales.csv", content = "a,b\n1,2") {
  return new File([content], name, { type: "text/csv" });
}

function mockUploadAndSchema() {
  mocks.post.mockResolvedValueOnce({
    data: {
      file_id: "f-001",
      filename: "sales.csv",
      size: 123,
      content_type: "text/csv",
      path: "/data/uploads/sales.csv",
    },
  });
  mocks.post.mockResolvedValueOnce({
    data: {
      columns: [
        { name: "region", type: "string", duckdb_type: "VARCHAR" },
        { name: "revenue", type: "integer", duckdb_type: "INTEGER" },
      ],
      row_count: 42,
    },
  });
}

/**
 * Helper: simulate a file upload via fireEvent.change.
 * Needed because userEvent.upload filters files against the
 * accept attribute — files with unsupported extensions are silently
 * dropped, so validation tests must bypass that check.
 */
function uploadViaFireEvent(
  input: HTMLElement,
  file: File,
) {
  fireEvent.change(input, { target: { files: [file] } });
}

describe("UploadPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspace();
  });

  it("renders heading and drop zone", async () => {
    renderUpload();
    expect(screen.getByText("Upload Data")).toBeInTheDocument();
    expect(
      screen.getByText(/drag and drop a file here/i),
    ).toBeInTheDocument();
  });

  it("shows the drop zone with file type hint", () => {
    renderUpload();
    expect(
      screen.getByText(/csv, json, parquet, excel/i),
    ).toBeInTheDocument();
  });

  it("rejects unsupported file type", async () => {
    renderUpload();
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalled();
    });

    const input = screen.getByTestId("file-input");
    const badFile = new File(["hello"], "script.py", {
      type: "text/plain",
    });

    uploadViaFireEvent(input, badFile);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /unsupported file type/i,
      );
    });
  });

  it("rejects empty file", async () => {
    renderUpload();
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalled();
    });

    const input = screen.getByTestId("file-input");
    const emptyFile = new File([""], "empty.csv", { type: "text/csv" });
    Object.defineProperty(emptyFile, "size", { value: 0 });

    uploadViaFireEvent(input, emptyFile);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/empty/i);
    });
  });

  it("uploads file and shows schema preview", async () => {
    mockUploadAndSchema();
    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());

    await waitFor(() => {
      expect(screen.getByText("sales.csv")).toBeInTheDocument();
    });
    expect(screen.getByText(/42 rows/)).toBeInTheDocument();
    expect(screen.getByText("region")).toBeInTheDocument();
    expect(screen.getByText("revenue")).toBeInTheDocument();
    expect(screen.getByText("VARCHAR")).toBeInTheDocument();
    expect(screen.getByText("INTEGER")).toBeInTheDocument();
  });

  it("derives table name from filename", async () => {
    mockUploadAndSchema();
    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());

    await waitFor(() => {
      const tableInput = screen.getByLabelText("Table name");
      expect(tableInput).toHaveValue("sales");
    });
  });

  it("allows renaming the table before import", async () => {
    mockUploadAndSchema();
    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());

    await waitFor(() => {
      expect(screen.getByLabelText("Table name")).toBeInTheDocument();
    });

    const tableInput = screen.getByLabelText("Table name");
    await user.clear(tableInput);
    await user.type(tableInput, "my_custom_table");
    expect(tableInput).toHaveValue("my_custom_table");
  });

  it("disables confirm button when table name is empty", async () => {
    mockUploadAndSchema();
    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());

    await waitFor(() => {
      expect(screen.getByLabelText("Table name")).toBeInTheDocument();
    });

    const tableInput = screen.getByLabelText("Table name");
    await user.clear(tableInput);

    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeDisabled();
  });

  it("ingests data on confirm and shows success", async () => {
    mockUploadAndSchema();
    mocks.post.mockResolvedValueOnce({
      data: {
        table_name: "sales",
        columns: [
          { name: "region", type: "string", duckdb_type: "VARCHAR" },
          { name: "revenue", type: "integer", duckdb_type: "INTEGER" },
        ],
        row_count: 42,
      },
    });

    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/import successful/i)).toBeInTheDocument();
    });
    expect(screen.getByText("sales")).toBeInTheDocument();
    expect(screen.getByText(/42 rows/)).toBeInTheDocument();
  });

  it("shows upload another file button after success", async () => {
    mockUploadAndSchema();
    mocks.post.mockResolvedValueOnce({
      data: {
        table_name: "sales",
        columns: [],
        row_count: 0,
      },
    });

    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm/i }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /upload another/i }),
      ).toBeInTheDocument();
    });
  });

  it("resets to drop zone when upload another is clicked", async () => {
    mockUploadAndSchema();
    mocks.post.mockResolvedValueOnce({
      data: { table_name: "t", columns: [], row_count: 0 },
    });

    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm/i }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /upload another/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /upload another/i }),
    );

    expect(
      screen.getByText(/drag and drop a file here/i),
    ).toBeInTheDocument();
  });

  it("cancel button returns to drop zone from preview", async () => {
    mockUploadAndSchema();
    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(
      screen.getByText(/drag and drop a file here/i),
    ).toBeInTheDocument();
  });

  it("shows error when upload API fails", async () => {
    mocks.post.mockRejectedValueOnce({
      response: { data: { detail: "File too large" } },
    });

    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("File too large");
    });
  });

  it("calls API with correct upload payload", async () => {
    mockUploadAndSchema();
    renderUpload();

    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledWith("/api/workspaces/");
    });

    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");
    await user.upload(input, createCsvFile());

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/data/upload",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        }),
      );
    });
  });

  it("calls detect-schema after upload", async () => {
    mockUploadAndSchema();
    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/data/detect-schema",
        {
          file_path: "/data/uploads/sales.csv",
          workspace_id: WORKSPACE_ID,
        },
      );
    });
  });

  it("calls ingest API with correct payload on confirm", async () => {
    mockUploadAndSchema();
    mocks.post.mockResolvedValueOnce({
      data: { table_name: "sales", columns: [], row_count: 0 },
    });

    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith("/api/data/ingest", {
        file_path: "/data/uploads/sales.csv",
        workspace_id: WORKSPACE_ID,
        table_name: "sales",
      });
    });
  });

  it("calls loadTable after successful ingestion", async () => {
    mockUploadAndSchema();
    mocks.post.mockResolvedValueOnce({
      data: {
        table_name: "sales",
        columns: [
          { name: "region", type: "string", duckdb_type: "VARCHAR" },
        ],
        row_count: 42,
      },
    });

    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/import successful/i)).toBeInTheDocument();
    });

    expect(mocks.loadTable).toHaveBeenCalledWith(
      "sales",
      expect.stringContaining("/api/data/export/sales"),
    );
    expect(mocks.loadTable).toHaveBeenCalledWith(
      "sales",
      expect.stringContaining(`workspace_id=${WORKSPACE_ID}`),
    );
  });

  it("still shows success if loadTable fails", async () => {
    mockUploadAndSchema();
    mocks.post.mockResolvedValueOnce({
      data: { table_name: "sales", columns: [], row_count: 10 },
    });
    mocks.loadTable.mockRejectedValueOnce(new Error("WASM load failed"));

    renderUpload();
    const user = userEvent.setup();
    const input = screen.getByTestId("file-input");

    await user.upload(input, createCsvFile());
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/import successful/i)).toBeInTheDocument();
    });
  });
});
