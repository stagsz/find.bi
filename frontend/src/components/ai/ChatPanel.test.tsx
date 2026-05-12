import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ columns: [], rows: [], duration: 0 }),
  fetchImpl: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  default: { defaults: { baseURL: "http://localhost:8000" } },
  getAccessToken: () => "test-token",
}));

vi.mock("@/hooks/useDuckDB", () => ({
  useDuckDB: () => ({
    query: mocks.query,
    isReady: true,
    loading: false,
    error: null,
    initError: null,
  }),
}));

import ChatPanel from "./ChatPanel";

// ─── SSE stream helpers ─────────────────────────────────────────────

/**
 * Build a Response whose body streams SSE events from the given data payloads.
 * Each payload becomes a `data: <json>\n\n` chunk.
 */
function makeSseResponse(events: object[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const evt of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

/** Convenience: a simple done-only SSE response (no tokens). */
function makeDoneResponse(
  text: string,
  sql: string | null = null,
  plotSpec: object | null = null,
  dataTable: object | null = null,
): Response {
  return makeSseResponse([
    { type: "done", text, sql, plot_spec: plotSpec, data_table: dataTable },
  ]);
}

/** Convenience: token + done pair. */
function makeStreamingResponse(text: string, sql: string | null = null): Response {
  return makeSseResponse([
    { type: "token", text: text.slice(0, 5) },
    { type: "token", text: text.slice(5) },
    { type: "done", text, sql, plot_spec: null, data_table: null },
  ]);
}

// ─── Setup / Teardown ───────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: success with plain text response
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    makeDoneResponse("Here are the sales by region.", "SELECT region, SUM(revenue) FROM sales GROUP BY region"),
  ));
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

const WORKSPACE_ID = "ws-chat-123";
const onToggle = vi.fn();

const MOCK_RESPONSE_WITH_ALL = {
  data: {
    text: "Here's a **full analysis** with `revenue` data:",
    sql: null,
    plot_spec: {
      marks: [{ type: "barY", data: [{ x: "A", y: 1 }], options: { x: "x", y: "y" } }],
    },
    data_table: {
      columns: ["name", "price"],
      rows: [["Widget", 9.99]],
    },
  },
};

// ─── Closed state (toggle button) ───────────────────────────────────

describe("ChatPanel", () => {
  describe("closed state", () => {
    it("renders toggle button when closed", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={false} onToggle={onToggle} />,
      );
      expect(screen.getByTestId("chat-toggle-button")).toBeInTheDocument();
    });

    it("does not render panel when closed", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={false} onToggle={onToggle} />,
      );
      expect(screen.queryByTestId("chat-panel")).not.toBeInTheDocument();
    });

    it("calls onToggle when toggle button clicked", async () => {
      const user = userEvent.setup();
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={false} onToggle={onToggle} />,
      );
      await user.click(screen.getByTestId("chat-toggle-button"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("applies className to toggle button", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={false} onToggle={onToggle} className="my-custom" />,
      );
      expect(screen.getByTestId("chat-toggle-button")).toHaveClass("my-custom");
    });
  });

  // ─── Open state rendering ──────────────────────────────────────────

  describe("open state rendering", () => {
    it("renders the panel when open", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    });

    it("renders Ralph avatar in header", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      expect(screen.getByTestId("ralph-avatar")).toBeInTheDocument();
      expect(screen.getByTestId("ralph-avatar")).toHaveTextContent("R");
    });

    it("renders Ask Ralph heading", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      expect(screen.getByText("Ask Ralph")).toBeInTheDocument();
    });

    it("renders close button", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      expect(screen.getByTestId("chat-close-button")).toBeInTheDocument();
    });

    it("renders input field with placeholder", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      const input = screen.getByTestId("chat-input");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("placeholder", "Ask Ralph...");
    });

    it("renders send button", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      expect(screen.getByTestId("chat-send-button")).toBeInTheDocument();
    });

    it("renders messages area", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      expect(screen.getByTestId("chat-messages")).toBeInTheDocument();
    });

    it("renders empty state initially", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      expect(screen.getByTestId("chat-empty")).toBeInTheDocument();
      expect(screen.getByText("Hi! I'm Ralph.")).toBeInTheDocument();
    });

    it("does not show clear button when no messages", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      expect(screen.queryByTestId("chat-clear-button")).not.toBeInTheDocument();
    });

    it("applies className to panel", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} className="my-custom" />,
      );
      expect(screen.getByTestId("chat-panel")).toHaveClass("my-custom");
    });

    it("calls onToggle when close button clicked", async () => {
      const user = userEvent.setup();
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.click(screen.getByTestId("chat-close-button"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Send button state ─────────────────────────────────────────────

  describe("send button state", () => {
    it("disables send button when input is empty", () => {
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      expect(screen.getByTestId("chat-send-button")).toBeDisabled();
    });

    it("disables send button when input is whitespace only", async () => {
      const user = userEvent.setup();
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "   ");
      expect(screen.getByTestId("chat-send-button")).toBeDisabled();
    });

    it("disables send button when workspaceId is null", async () => {
      const user = userEvent.setup();
      render(
        <ChatPanel workspaceId={null} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      expect(screen.getByTestId("chat-send-button")).toBeDisabled();
    });

    it("enables send button with text and workspace", async () => {
      const user = userEvent.setup();
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "show me sales");
      expect(screen.getByTestId("chat-send-button")).not.toBeDisabled();
    });

    it("disables input when workspaceId is null", () => {
      render(
        <ChatPanel workspaceId={null} open={true} onToggle={onToggle} />,
      );
      expect(screen.getByTestId("chat-input")).toBeDisabled();
    });
  });

  // ─── Sending messages ──────────────────────────────────────────────

  describe("sending messages", () => {
    it("adds user message bubble on send", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello Ralph");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(screen.getByTestId("chat-message-user")).toBeInTheDocument();
      expect(screen.getByTestId("chat-message-user")).toHaveTextContent("hello Ralph");
    });

    it("clears input after sending", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(screen.getByTestId("chat-input")).toHaveValue("");
    });

    it("calls chat API with message and workspace_id", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "show me sales");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/ai/chat/stream"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"show me sales"'),
          }),
        );
      });
    });

    it("sends conversation history with subsequent messages", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn()
        .mockResolvedValueOnce(makeDoneResponse("I'm Ralph!"))
        .mockResolvedValueOnce(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );

      // First message
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
      });

      // Second message — should include history
      await user.type(screen.getByTestId("chat-input"), "more");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
      const secondFetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
      const secondBody = JSON.parse((secondFetchCall[1] as RequestInit).body as string) as { history: Array<{role: string; content: string}> };
      expect(secondBody.history).toEqual([
        { role: "user", content: "hello" },
        { role: "assistant", content: "I'm Ralph!" },
      ]);
    });

    it("trims whitespace from message before sending", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "  hello  ");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/ai/chat/stream"),
          expect.objectContaining({ body: expect.stringContaining('"hello"') }),
        );
      });
    });

    it("submits on Enter key press", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello{enter}");

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    });

    it("does not submit on empty input via Enter", async () => {
      const user = userEvent.setup();
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      const input = screen.getByTestId("chat-input");
      await user.click(input);
      await user.keyboard("{enter}");

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ─── Loading state ─────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows loading indicator while waiting for response", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(screen.getByTestId("chat-loading")).toBeInTheDocument();
    });

    it("disables send button while loading", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(screen.getByTestId("chat-send-button")).toBeDisabled();
    });

    it("disables input while loading", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(screen.getByTestId("chat-input")).toBeDisabled();
    });

    it("hides empty state when user sends message", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );

      expect(screen.getByTestId("chat-empty")).toBeInTheDocument();

      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(screen.queryByTestId("chat-empty")).not.toBeInTheDocument();
    });
  });

  // ─── Successful response ───────────────────────────────────────────

  describe("successful response", () => {
    it("displays assistant message bubble", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
      });
      expect(screen.getByTestId("chat-message-assistant")).toHaveTextContent("I'm Ralph!");
    });

    it("hides loading indicator after response", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.queryByTestId("chat-loading")).not.toBeInTheDocument();
      });
    });

    it("shows SQL code block when response contains SQL", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("Here are the sales by region.", "SELECT region, SUM(revenue) FROM sales GROUP BY region")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "show me sales");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-sql")).toBeInTheDocument();
      });
      expect(screen.getByTestId("chat-message-sql")).toHaveTextContent(
        "SELECT region, SUM(revenue) FROM sales GROUP BY region",
      );
    });

    it("shows chart indicator when response contains plot_spec", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I made a chart with my brain!", null, {marks: [{type: "barY", data: [{x: "A", y: 1}], options: {x: "x", y: "y"}}]})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "chart it");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-chart")).toBeInTheDocument();
      });
    });

    it("does not show SQL block when sql is null", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("chat-message-sql")).not.toBeInTheDocument();
    });

    it("does not show chart indicator when plot_spec is null", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("chat-message-chart")).not.toBeInTheDocument();
    });

    it("shows clear button after first message", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-clear-button")).toBeInTheDocument();
      });
    });
  });

  // ─── Multiple messages ─────────────────────────────────────────────

  describe("multiple messages", () => {
    it("accumulates messages in conversation", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn()
        .mockResolvedValueOnce(makeDoneResponse("I'm Ralph!"))
        .mockResolvedValueOnce(makeDoneResponse("Sure thing!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );

      // First exchange
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
      });

      // Second exchange
      await user.type(screen.getByTestId("chat-input"), "tell me more");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        const userMsgs = screen.getAllByTestId("chat-message-user");
        const assistantMsgs = screen.getAllByTestId("chat-message-assistant");
        expect(userMsgs).toHaveLength(2);
        expect(assistantMsgs).toHaveLength(2);
      });
    });
  });

  // ─── Error handling ────────────────────────────────────────────────

  describe("error handling", () => {
    it("shows error on API failure with detail", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "AI service unavailable" }), { status: 502 }),
      ));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-error")).toBeInTheDocument();
      });
      expect(screen.getByTestId("chat-error")).toHaveTextContent("AI service unavailable");
    });

    it("shows generic error on network failure", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network Error")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-error")).toBeInTheDocument();
      });
      expect(screen.getByTestId("chat-error")).toHaveTextContent("Network Error");
    });

    it("clears error on next successful send", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );

      // First message — fails
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-error")).toBeInTheDocument();
      });

      // Second message — succeeds
      await user.type(screen.getByTestId("chat-input"), "try again");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.queryByTestId("chat-error")).not.toBeInTheDocument();
      });
    });

    it("preserves user message even when API fails", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fail")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-error")).toBeInTheDocument();
      });

      // User message should still be visible
      expect(screen.getByTestId("chat-message-user")).toBeInTheDocument();
      expect(screen.getByTestId("chat-message-user")).toHaveTextContent("hello");
    });
  });

  // ─── Clear history ─────────────────────────────────────────────────

  describe("clear history", () => {
    it("clears all messages when clear button clicked", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );

      // Send a message
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-clear-button")).toBeInTheDocument();
      });

      // Clear
      await user.click(screen.getByTestId("chat-clear-button"));

      expect(screen.queryByTestId("chat-message-user")).not.toBeInTheDocument();
      expect(screen.queryByTestId("chat-message-assistant")).not.toBeInTheDocument();
      expect(screen.getByTestId("chat-empty")).toBeInTheDocument();
    });

    it("clears error on clear", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fail")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );

      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-error")).toBeInTheDocument();
        expect(screen.getByTestId("chat-clear-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("chat-clear-button"));

      expect(screen.queryByTestId("chat-error")).not.toBeInTheDocument();
    });

    it("hides clear button after clearing", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );

      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-clear-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("chat-clear-button"));

      expect(screen.queryByTestId("chat-clear-button")).not.toBeInTheDocument();
    });
  });

  // ─── Data table rendering ───────────────────────────────────────────

  describe("data table rendering", () => {
    it("shows inline data table when response contains data_table", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("Here are the top products:", null, null, {columns: ["name", "price"], rows: [["Widget", 9.99], ["Gadget", 19.99], ["Doohickey", 14.50]]})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "show products");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-table")).toBeInTheDocument();
      });
    });

    it("renders column headers in data table", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("Here are the top products:", null, null, {columns: ["name", "price"], rows: [["Widget", 9.99], ["Gadget", 19.99], ["Doohickey", 14.50]]})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "show products");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-table")).toBeInTheDocument();
      });
      expect(screen.getByTestId("chat-message-table")).toHaveTextContent("name");
      expect(screen.getByTestId("chat-message-table")).toHaveTextContent("price");
    });

    it("renders row data in data table", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("Here are the top products:", null, null, {columns: ["name", "price"], rows: [["Widget", 9.99], ["Gadget", 19.99], ["Doohickey", 14.50]]})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "show products");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-table")).toBeInTheDocument();
      });
      expect(screen.getByTestId("chat-message-table")).toHaveTextContent("Widget");
      expect(screen.getByTestId("chat-message-table")).toHaveTextContent("9.99");
      expect(screen.getByTestId("chat-message-table")).toHaveTextContent("Gadget");
    });

    it("shows row count in data table", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("Here are the top products:", null, null, {columns: ["name", "price"], rows: [["Widget", 9.99], ["Gadget", 19.99], ["Doohickey", 14.50]]})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "show products");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-table")).toBeInTheDocument();
      });
      expect(screen.getByTestId("chat-message-table")).toHaveTextContent("3 rows");
    });

    it("does not show data table when data_table is null", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("chat-message-table")).not.toBeInTheDocument();
    });
  });

  // ─── Rich response with all components ──────────────────────────────

  describe("rich response with all components", () => {
    it("renders chart and data table together", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("Here's a **full analysis** with `revenue` data:", null, {marks: [{type: "barY", data: [{x: "A", y: 1}], options: {x: "x", y: "y"}}]}, {columns: ["name", "price"], rows: [["Widget", 9.99]]})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "full analysis");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
      });
      expect(screen.getByTestId("chat-message-chart")).toBeInTheDocument();
      expect(screen.getByTestId("chat-message-table")).toBeInTheDocument();
    });

    it("renders rich text with inline code formatting", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("Here's a **full analysis** with `revenue` data:", null, {marks: [{type: "barY", data: [{x: "A", y: 1}], options: {x: "x", y: "y"}}]}, {columns: ["name", "price"], rows: [["Widget", 9.99]]})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "analyze");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
      });
      // The text contains `revenue` which should be rendered as a <code> element
      const codeEl = screen.getByTestId("chat-message-assistant").querySelector("code");
      expect(codeEl).toBeInTheDocument();
      expect(codeEl).toHaveTextContent("revenue");
    });

    it("renders rich text with bold formatting", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("Here's a **full analysis** with `revenue` data:", null, {marks: [{type: "barY", data: [{x: "A", y: 1}], options: {x: "x", y: "y"}}]}, {columns: ["name", "price"], rows: [["Widget", 9.99]]})));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "analyze");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument();
      });
      // The text contains **full analysis** which should be rendered as <strong>
      const strongEl = screen.getByTestId("chat-message-assistant").querySelector("strong");
      expect(strongEl).toBeInTheDocument();
      expect(strongEl).toHaveTextContent("full analysis");
    });

    it("does not apply rich text formatting to user messages", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeDoneResponse("I'm Ralph!")));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      // Type a message with markdown-like syntax
      await user.type(screen.getByTestId("chat-input"), "show **bold** and `code`");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-user")).toBeInTheDocument();
      });
      // User message should NOT have <code> or <strong> elements
      const userMsg = screen.getByTestId("chat-message-user");
      expect(userMsg.querySelector("code")).not.toBeInTheDocument();
      expect(userMsg.querySelector("strong")).not.toBeInTheDocument();
      // But text should still be there verbatim
      expect(userMsg).toHaveTextContent("show **bold** and `code`");
    });
  });
});
