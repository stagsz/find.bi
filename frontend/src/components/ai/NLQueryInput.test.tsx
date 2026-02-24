import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  default: { post: mocks.post },
}));

vi.mock("@/hooks/useDuckDB", () => ({
  useDuckDB: () => ({
    query: mocks.query,
    loadTable: vi.fn(),
    loading: false,
    error: null,
    isReady: true,
    initError: null,
  }),
}));

// Mock QueryResult to keep tests focused on NLQueryInput behavior
vi.mock("@/components/editor/QueryResult", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="query-result-mock" data-loading={String(props.loading)} data-error={String(props.error ?? "")}>
      {props.result ? "has-result" : "no-result"}
    </div>
  ),
}));

import NLQueryInput from "./NLQueryInput";

// ─── Setup / Teardown ───────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

const WORKSPACE_ID = "ws-abc-123";

// ─── Rendering ──────────────────────────────────────────────────────

describe("NLQueryInput", () => {
  describe("rendering", () => {
    it("renders the container", () => {
      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      expect(screen.getByTestId("nl-query-input")).toBeInTheDocument();
    });

    it("renders the question input with placeholder", () => {
      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      const input = screen.getByTestId("nl-question-input");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute(
        "placeholder",
        "Ask a question about your data...",
      );
    });

    it("renders the Ask button", () => {
      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      const btn = screen.getByTestId("nl-ask-button");
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent("Ask");
    });

    it("applies className to container", () => {
      render(
        <NLQueryInput workspaceId={WORKSPACE_ID} className="my-custom" />,
      );
      expect(screen.getByTestId("nl-query-input")).toHaveClass("my-custom");
    });

    it("does not show SQL section initially", () => {
      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      expect(screen.queryByTestId("nl-sql-section")).not.toBeInTheDocument();
    });

    it("does not show error initially", () => {
      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      expect(screen.queryByTestId("nl-ai-error")).not.toBeInTheDocument();
    });

    it("does not show query result initially", () => {
      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      expect(screen.queryByTestId("query-result-mock")).not.toBeInTheDocument();
    });
  });

  // ─── Ask button state ───────────────────────────────────────────────

  describe("Ask button state", () => {
    it("disables Ask button when input is empty", () => {
      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      expect(screen.getByTestId("nl-ask-button")).toBeDisabled();
    });

    it("disables Ask button when input is only whitespace", async () => {
      const user = userEvent.setup();
      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "   ");
      expect(screen.getByTestId("nl-ask-button")).toBeDisabled();
    });

    it("disables Ask button when workspaceId is null", async () => {
      const user = userEvent.setup();
      render(<NLQueryInput workspaceId={null} />);
      await user.type(
        screen.getByTestId("nl-question-input"),
        "show me sales",
      );
      expect(screen.getByTestId("nl-ask-button")).toBeDisabled();
    });

    it("enables Ask button when input has text and workspace exists", async () => {
      const user = userEvent.setup();
      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(
        screen.getByTestId("nl-question-input"),
        "show me sales",
      );
      expect(screen.getByTestId("nl-ask-button")).not.toBeDisabled();
    });
  });

  // ─── API call on Ask ────────────────────────────────────────────────

  describe("API call", () => {
    it("calls text-to-sql API with question and workspace_id", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 1", explanation: "Returns one" },
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(
        screen.getByTestId("nl-question-input"),
        "show me sales",
      );
      await user.click(screen.getByTestId("nl-ask-button"));

      expect(mocks.post).toHaveBeenCalledWith("/api/ai/text-to-sql", {
        question: "show me sales",
        workspace_id: WORKSPACE_ID,
      });
    });

    it("trims whitespace from question before sending", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 1", explanation: "test" },
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(
        screen.getByTestId("nl-question-input"),
        "  show me sales  ",
      );
      await user.click(screen.getByTestId("nl-ask-button"));

      expect(mocks.post).toHaveBeenCalledWith("/api/ai/text-to-sql", {
        question: "show me sales",
        workspace_id: WORKSPACE_ID,
      });
    });

    it("submits on Enter key press", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 1", explanation: "test" },
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(
        screen.getByTestId("nl-question-input"),
        "show me sales{enter}",
      );

      expect(mocks.post).toHaveBeenCalledTimes(1);
    });

    it("does not submit on empty input", async () => {
      const user = userEvent.setup();
      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      const input = screen.getByTestId("nl-question-input");
      await user.click(input);
      await user.keyboard("{enter}");

      expect(mocks.post).not.toHaveBeenCalled();
    });
  });

  // ─── Loading state ──────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows Thinking... text while loading", async () => {
      const user = userEvent.setup();
      // Never-resolving promise to keep loading state
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(
        screen.getByTestId("nl-question-input"),
        "show me sales",
      );
      await user.click(screen.getByTestId("nl-ask-button"));

      expect(screen.getByTestId("nl-ask-button")).toHaveTextContent(
        "Thinking...",
      );
    });

    it("disables Ask button while loading", async () => {
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(
        screen.getByTestId("nl-question-input"),
        "show me sales",
      );
      await user.click(screen.getByTestId("nl-ask-button"));

      expect(screen.getByTestId("nl-ask-button")).toBeDisabled();
    });

    it("disables input while loading", async () => {
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(
        screen.getByTestId("nl-question-input"),
        "show me sales",
      );
      await user.click(screen.getByTestId("nl-ask-button"));

      expect(screen.getByTestId("nl-question-input")).toBeDisabled();
    });
  });

  // ─── Successful response ────────────────────────────────────────────

  describe("successful response", () => {
    it("displays generated SQL", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: {
          sql: "SELECT region, SUM(revenue) FROM sales GROUP BY region",
          explanation: "Sums revenue by region",
        },
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(
        screen.getByTestId("nl-question-input"),
        "revenue by region",
      );
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-sql-section")).toBeInTheDocument();
      });

      const textarea = screen.getByTestId("nl-sql-editor");
      expect(textarea).toHaveValue(
        "SELECT region, SUM(revenue) FROM sales GROUP BY region",
      );
    });

    it("displays explanation", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: {
          sql: "SELECT 1",
          explanation: "Sums revenue by region",
        },
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-explanation")).toBeInTheDocument();
      });
      expect(screen.getByTestId("nl-explanation")).toHaveTextContent(
        "Sums revenue by region",
      );
    });

    it("shows Run Query button after SQL generation", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 1", explanation: "test" },
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-run-button")).toBeInTheDocument();
      });
      expect(screen.getByTestId("nl-run-button")).toHaveTextContent(
        "Run Query",
      );
    });

    it("restores Ask button text after response", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 1", explanation: "test" },
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-ask-button")).toHaveTextContent("Ask");
      });
    });
  });

  // ─── SQL editing ────────────────────────────────────────────────────

  describe("SQL editing", () => {
    it("allows editing generated SQL", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 1", explanation: "test" },
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-sql-editor")).toBeInTheDocument();
      });

      const textarea = screen.getByTestId("nl-sql-editor");
      await user.clear(textarea);
      await user.type(textarea, "SELECT 2");
      expect(textarea).toHaveValue("SELECT 2");
    });
  });

  // ─── Query execution ───────────────────────────────────────────────

  describe("query execution", () => {
    it("executes SQL via DuckDB when Run Query clicked", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 1 AS val", explanation: "test" },
      });
      mocks.query.mockResolvedValue({
        columns: ["val"],
        rows: [[1]],
        duration: 5,
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-run-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("nl-run-button"));

      expect(mocks.query).toHaveBeenCalledWith("SELECT 1 AS val");
    });

    it("passes query result to QueryResult component", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 1", explanation: "test" },
      });
      mocks.query.mockResolvedValue({
        columns: ["val"],
        rows: [[1]],
        duration: 5,
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-run-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("nl-run-button"));

      await waitFor(() => {
        const resultEl = screen.getByTestId("query-result-mock");
        expect(resultEl).toHaveTextContent("has-result");
      });
    });

    it("executes edited SQL, not original", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 1", explanation: "test" },
      });
      mocks.query.mockResolvedValue({
        columns: ["val"],
        rows: [[2]],
        duration: 3,
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-sql-editor")).toBeInTheDocument();
      });

      const textarea = screen.getByTestId("nl-sql-editor");
      await user.clear(textarea);
      await user.type(textarea, "SELECT 2 AS val");
      await user.click(screen.getByTestId("nl-run-button"));

      expect(mocks.query).toHaveBeenCalledWith("SELECT 2 AS val");
    });
  });

  // ─── Error handling ─────────────────────────────────────────────────

  describe("error handling", () => {
    it("shows AI error on API failure with detail", async () => {
      const user = userEvent.setup();
      mocks.post.mockRejectedValue({
        response: { data: { detail: "No data tables found" } },
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-ai-error")).toBeInTheDocument();
      });
      expect(screen.getByTestId("nl-ai-error")).toHaveTextContent(
        "No data tables found",
      );
    });

    it("shows generic error on network failure", async () => {
      const user = userEvent.setup();
      mocks.post.mockRejectedValue(new Error("Network Error"));

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-ai-error")).toBeInTheDocument();
      });
      expect(screen.getByTestId("nl-ai-error")).toHaveTextContent(
        "Network Error",
      );
    });

    it("shows query error on DuckDB failure", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT bad_column", explanation: "test" },
      });
      mocks.query.mockRejectedValue(
        new Error("Column bad_column not found"),
      );

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-run-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("nl-run-button"));

      await waitFor(() => {
        const resultEl = screen.getByTestId("query-result-mock");
        expect(resultEl.getAttribute("data-error")).toBe(
          "Column bad_column not found",
        );
      });
    });

    it("clears AI error on next successful ask", async () => {
      const user = userEvent.setup();
      mocks.post.mockRejectedValueOnce(new Error("fail"));
      mocks.post.mockResolvedValueOnce({
        data: { sql: "SELECT 1", explanation: "ok" },
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.getByTestId("nl-ai-error")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("nl-ask-button"));

      await waitFor(() => {
        expect(screen.queryByTestId("nl-ai-error")).not.toBeInTheDocument();
      });
    });
  });

  // ─── New ask resets state ───────────────────────────────────────────

  describe("state reset on new ask", () => {
    it("clears previous query result on new ask", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 1", explanation: "test" },
      });
      mocks.query.mockResolvedValue({
        columns: ["val"],
        rows: [[1]],
        duration: 5,
      });

      render(<NLQueryInput workspaceId={WORKSPACE_ID} />);

      // First ask + run
      await user.type(screen.getByTestId("nl-question-input"), "test");
      await user.click(screen.getByTestId("nl-ask-button"));
      await waitFor(() => {
        expect(screen.getByTestId("nl-run-button")).toBeInTheDocument();
      });
      await user.click(screen.getByTestId("nl-run-button"));
      await waitFor(() => {
        expect(screen.getByTestId("query-result-mock")).toHaveTextContent(
          "has-result",
        );
      });

      // Second ask — result should be cleared
      mocks.post.mockResolvedValue({
        data: { sql: "SELECT 2", explanation: "test2" },
      });
      await user.click(screen.getByTestId("nl-ask-button"));
      await waitFor(() => {
        expect(screen.queryByTestId("query-result-mock")).not.toBeInTheDocument();
      });
    });
  });
});
