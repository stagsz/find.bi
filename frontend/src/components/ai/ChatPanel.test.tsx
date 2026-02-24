import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  default: { post: mocks.post },
}));

import ChatPanel from "./ChatPanel";

// ─── Setup / Teardown ───────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

const WORKSPACE_ID = "ws-chat-123";
const onToggle = vi.fn();

const MOCK_RESPONSE = {
  data: {
    text: "Here are the sales by region.",
    sql: "SELECT region, SUM(revenue) FROM sales GROUP BY region",
    plot_spec: null,
  },
};

const MOCK_RESPONSE_WITH_CHART = {
  data: {
    text: "I made a chart with my brain!",
    sql: null,
    plot_spec: {
      marks: [{ type: "barY", data: [{ x: "A", y: 1 }], options: { x: "x", y: "y" } }],
    },
  },
};

const MOCK_RESPONSE_TEXT_ONLY = {
  data: {
    text: "I'm Ralph!",
    sql: null,
    plot_spec: null,
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
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

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
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(screen.getByTestId("chat-input")).toHaveValue("");
    });

    it("calls chat API with message and workspace_id", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "show me sales");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(mocks.post).toHaveBeenCalledWith("/api/ai/chat", {
        message: "show me sales",
        workspace_id: WORKSPACE_ID,
        history: [],
      });
    });

    it("sends conversation history with subsequent messages", async () => {
      const user = userEvent.setup();
      mocks.post
        .mockResolvedValueOnce(MOCK_RESPONSE_TEXT_ONLY)
        .mockResolvedValueOnce(MOCK_RESPONSE_TEXT_ONLY);

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

      expect(mocks.post).toHaveBeenCalledTimes(2);
      const secondCall = mocks.post.mock.calls[1];
      expect(secondCall[1].history).toEqual([
        { role: "user", content: "hello" },
        { role: "assistant", content: "I'm Ralph!" },
      ]);
    });

    it("trims whitespace from message before sending", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "  hello  ");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(mocks.post).toHaveBeenCalledWith("/api/ai/chat", {
        message: "hello",
        workspace_id: WORKSPACE_ID,
        history: [],
      });
    });

    it("submits on Enter key press", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello{enter}");

      expect(mocks.post).toHaveBeenCalledTimes(1);
    });

    it("does not submit on empty input via Enter", async () => {
      const user = userEvent.setup();
      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      const input = screen.getByTestId("chat-input");
      await user.click(input);
      await user.keyboard("{enter}");

      expect(mocks.post).not.toHaveBeenCalled();
    });
  });

  // ─── Loading state ─────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows loading indicator while waiting for response", async () => {
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(screen.getByTestId("chat-loading")).toBeInTheDocument();
    });

    it("disables send button while loading", async () => {
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(screen.getByTestId("chat-send-button")).toBeDisabled();
    });

    it("disables input while loading", async () => {
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "hello");
      await user.click(screen.getByTestId("chat-send-button"));

      expect(screen.getByTestId("chat-input")).toBeDisabled();
    });

    it("hides empty state when user sends message", async () => {
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

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
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

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
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

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
      mocks.post.mockResolvedValue(MOCK_RESPONSE);

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
      mocks.post.mockResolvedValue(MOCK_RESPONSE_WITH_CHART);

      render(
        <ChatPanel workspaceId={WORKSPACE_ID} open={true} onToggle={onToggle} />,
      );
      await user.type(screen.getByTestId("chat-input"), "chart it");
      await user.click(screen.getByTestId("chat-send-button"));

      await waitFor(() => {
        expect(screen.getByTestId("chat-message-chart")).toBeInTheDocument();
      });
      expect(screen.getByTestId("chat-message-chart")).toHaveTextContent("Chart attached");
    });

    it("does not show SQL block when sql is null", async () => {
      const user = userEvent.setup();
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

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
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

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
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

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
      mocks.post
        .mockResolvedValueOnce(MOCK_RESPONSE_TEXT_ONLY)
        .mockResolvedValueOnce({
          data: { text: "Sure thing!", sql: null, plot_spec: null },
        });

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
      mocks.post.mockRejectedValue({
        response: { data: { detail: "AI service unavailable" } },
      });

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
      mocks.post.mockRejectedValue(new Error("Network Error"));

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
      mocks.post.mockRejectedValueOnce(new Error("fail"));
      mocks.post.mockResolvedValueOnce(MOCK_RESPONSE_TEXT_ONLY);

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
      mocks.post.mockRejectedValue(new Error("fail"));

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
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

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
      mocks.post.mockRejectedValue(new Error("fail"));

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
      mocks.post.mockResolvedValue(MOCK_RESPONSE_TEXT_ONLY);

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
});
