import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  default: { post: mocks.post, get: mocks.get },
}));

// Mock InsightCard to keep tests focused on panel behavior
vi.mock("./InsightCard", () => ({
  default: (props: { insight: { title: string; type: string } }) => (
    <div data-testid="insight-card-mock" data-title={props.insight.title}>
      {props.insight.type}: {props.insight.title}
    </div>
  ),
}));

import InsightPanel from "./InsightPanel";

// ─── Setup / Teardown ───────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const WORKSPACE_ID = "ws-insight-123";

const MOCK_INSIGHTS = {
  data: {
    insights: [
      {
        type: "trend",
        title: "Revenue is increasing",
        description: "Revenue shows an upward trend.",
        severity: "info",
        table: "sales",
        columns: ["revenue"],
      },
      {
        type: "anomaly",
        title: "North region outlier",
        description: "North has significantly lower revenue.",
        severity: "warning",
        table: "sales",
        columns: ["region", "revenue"],
      },
      {
        type: "correlation",
        title: "Revenue-quantity correlation",
        description: "Revenue and quantity are strongly correlated.",
        severity: "info",
        table: "sales",
        columns: ["revenue", "quantity"],
        metrics: { correlation: 0.95 },
      },
    ],
  },
};

const MOCK_CACHED_READY = {
  data: {
    entries: [
      {
        table_name: "sales",
        status: "ready",
        insights: [
          {
            type: "trend",
            title: "Cached insight",
            description: "From cache.",
            severity: "info",
          },
        ],
      },
    ],
  },
};

const MOCK_CACHED_PENDING = {
  data: {
    entries: [
      {
        table_name: "orders",
        status: "pending",
        insights: [],
      },
    ],
  },
};

// ─── Rendering ──────────────────────────────────────────────────────

describe("InsightPanel", () => {
  describe("rendering", () => {
    it("renders the panel container", () => {
      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      expect(screen.getByTestId("insight-panel")).toBeInTheDocument();
    });

    it("renders the Insights heading", () => {
      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      expect(screen.getByText("Insights")).toBeInTheDocument();
    });

    it("renders the Analyze button", () => {
      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      const btn = screen.getByTestId("insight-analyze-button");
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent("Analyze");
    });

    it("applies className to container", () => {
      render(
        <InsightPanel workspaceId={WORKSPACE_ID} className="my-custom" />,
      );
      expect(screen.getByTestId("insight-panel")).toHaveClass("my-custom");
    });

    it("does not show insight list initially", () => {
      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      expect(screen.queryByTestId("insight-list")).not.toBeInTheDocument();
    });

    it("does not show error initially", () => {
      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      expect(screen.queryByTestId("insight-error")).not.toBeInTheDocument();
    });

    it("does not show empty state initially", () => {
      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      expect(screen.queryByTestId("insight-empty")).not.toBeInTheDocument();
    });
  });

  // ─── Button state ───────────────────────────────────────────────────

  describe("button state", () => {
    it("disables Analyze button when workspaceId is null", () => {
      render(<InsightPanel workspaceId={null} />);
      expect(screen.getByTestId("insight-analyze-button")).toBeDisabled();
    });

    it("enables Analyze button when workspaceId is provided", () => {
      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      expect(
        screen.getByTestId("insight-analyze-button"),
      ).not.toBeDisabled();
    });
  });

  // ─── API call ─────────────────────────────────────────────────────

  describe("API call", () => {
    it("calls insights API with workspace_id on Analyze click", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockResolvedValue(MOCK_INSIGHTS);

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      expect(mocks.post).toHaveBeenCalledWith("/api/ai/insights", {
        workspace_id: WORKSPACE_ID,
      });
    });

    it("does not call API when workspaceId is null", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();

      render(<InsightPanel workspaceId={null} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      expect(mocks.post).not.toHaveBeenCalled();
    });
  });

  // ─── Loading state ────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows loading indicator while fetching", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      expect(screen.getByTestId("insight-loading")).toBeInTheDocument();
    });

    it("shows Analyzing... text on button while loading", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      expect(screen.getByTestId("insight-analyze-button")).toHaveTextContent(
        "Analyzing...",
      );
    });

    it("disables button while loading", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      expect(screen.getByTestId("insight-analyze-button")).toBeDisabled();
    });
  });

  // ─── Successful response ──────────────────────────────────────────

  describe("successful response", () => {
    it("renders insight cards", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockResolvedValue(MOCK_INSIGHTS);

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      await waitFor(() => {
        expect(screen.getByTestId("insight-list")).toBeInTheDocument();
      });

      const cards = screen.getAllByTestId("insight-card-mock");
      expect(cards).toHaveLength(3);
    });

    it("passes insight data to InsightCard", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockResolvedValue(MOCK_INSIGHTS);

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      await waitFor(() => {
        expect(screen.getByTestId("insight-list")).toBeInTheDocument();
      });

      const cards = screen.getAllByTestId("insight-card-mock");
      expect(cards[0]).toHaveAttribute("data-title", "Revenue is increasing");
      expect(cards[1]).toHaveAttribute("data-title", "North region outlier");
    });

    it("shows Refresh button after successful load", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockResolvedValue(MOCK_INSIGHTS);

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      await waitFor(() => {
        expect(screen.getByTestId("insight-analyze-button")).toHaveTextContent(
          "Refresh",
        );
      });
    });

    it("hides loading indicator after response", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockResolvedValue(MOCK_INSIGHTS);

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      await waitFor(() => {
        expect(
          screen.queryByTestId("insight-loading"),
        ).not.toBeInTheDocument();
      });
    });
  });

  // ─── Empty response ───────────────────────────────────────────────

  describe("empty response", () => {
    it("shows empty state when no insights returned", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockResolvedValue({ data: { insights: [] } });

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      await waitFor(() => {
        expect(screen.getByTestId("insight-empty")).toBeInTheDocument();
      });
      expect(screen.getByTestId("insight-empty")).toHaveTextContent(
        "No insights found",
      );
    });
  });

  // ─── Error handling ───────────────────────────────────────────────

  describe("error handling", () => {
    it("shows error on API failure with detail", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockRejectedValue({
        response: { data: { detail: "No data tables found" } },
      });

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      await waitFor(() => {
        expect(screen.getByTestId("insight-error")).toBeInTheDocument();
      });
      expect(screen.getByTestId("insight-error")).toHaveTextContent(
        "No data tables found",
      );
    });

    it("shows generic error on network failure", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockRejectedValue(new Error("Network Error"));

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      await waitFor(() => {
        expect(screen.getByTestId("insight-error")).toBeInTheDocument();
      });
      expect(screen.getByTestId("insight-error")).toHaveTextContent(
        "Network Error",
      );
    });

    it("clears error on successful retry", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockRejectedValueOnce(new Error("fail"));
      mocks.post.mockResolvedValueOnce(MOCK_INSIGHTS);

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      await waitFor(() => {
        expect(screen.getByTestId("insight-error")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("insight-analyze-button"));

      await waitFor(() => {
        expect(
          screen.queryByTestId("insight-error"),
        ).not.toBeInTheDocument();
      });
    });
  });

  // ─── State reset on re-analyze ────────────────────────────────────

  describe("state reset on re-analyze", () => {
    it("clears previous insights on new analyze", async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      mocks.post.mockResolvedValueOnce(MOCK_INSIGHTS);
      // Second call returns different data
      mocks.post.mockResolvedValueOnce({
        data: {
          insights: [
            {
              type: "outlier",
              title: "New insight",
              description: "New description.",
              severity: "important",
            },
          ],
        },
      });

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);

      // First analyze
      await user.click(screen.getByTestId("insight-analyze-button"));
      await waitFor(() => {
        expect(screen.getAllByTestId("insight-card-mock")).toHaveLength(3);
      });

      // Second analyze
      await user.click(screen.getByTestId("insight-analyze-button"));
      await waitFor(() => {
        expect(screen.getAllByTestId("insight-card-mock")).toHaveLength(1);
      });

      expect(screen.getByTestId("insight-card-mock")).toHaveAttribute(
        "data-title",
        "New insight",
      );
    });
  });

  // ─── Auto-fetch (cached insights polling) ──────────────────────────

  describe("auto-fetch", () => {
    it("fetches cached insights immediately when autoFetch is true", async () => {
      mocks.get.mockResolvedValue(MOCK_CACHED_READY);

      await act(async () => {
        render(
          <InsightPanel workspaceId={WORKSPACE_ID} autoFetch />,
        );
      });

      await waitFor(() => {
        expect(mocks.get).toHaveBeenCalledWith(
          expect.stringContaining("/api/ai/insights/cached"),
        );
      });
    });

    it("displays cached insights when ready", async () => {
      mocks.get.mockResolvedValue(MOCK_CACHED_READY);

      await act(async () => {
        render(
          <InsightPanel workspaceId={WORKSPACE_ID} autoFetch />,
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("insight-list")).toBeInTheDocument();
      });

      const cards = screen.getAllByTestId("insight-card-mock");
      expect(cards).toHaveLength(1);
      expect(cards[0]).toHaveAttribute("data-title", "Cached insight");
    });

    it("shows loading spinner when cache is pending", async () => {
      mocks.get.mockResolvedValue(MOCK_CACHED_PENDING);

      await act(async () => {
        render(
          <InsightPanel workspaceId={WORKSPACE_ID} autoFetch />,
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("insight-loading")).toBeInTheDocument();
      });
    });

    it("does not auto-fetch when autoFetch is false", async () => {
      await act(async () => {
        render(
          <InsightPanel workspaceId={WORKSPACE_ID} autoFetch={false} />,
        );
      });

      expect(mocks.get).not.toHaveBeenCalled();
    });

    it("does not auto-fetch when workspaceId is null", async () => {
      await act(async () => {
        render(<InsightPanel workspaceId={null} autoFetch />);
      });

      expect(mocks.get).not.toHaveBeenCalled();
    });

    it("polls and displays insights once ready", async () => {
      // First poll: pending, second poll: ready
      mocks.get
        .mockResolvedValueOnce(MOCK_CACHED_PENDING)
        .mockResolvedValueOnce(MOCK_CACHED_READY);

      await act(async () => {
        render(
          <InsightPanel workspaceId={WORKSPACE_ID} autoFetch />,
        );
      });

      // First call returns pending — should show loading
      await waitFor(() => {
        expect(mocks.get).toHaveBeenCalledTimes(1);
      });

      // Advance timers to trigger next poll
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mocks.get).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(screen.getByTestId("insight-list")).toBeInTheDocument();
      });

      expect(screen.getByTestId("insight-card-mock")).toHaveAttribute(
        "data-title",
        "Cached insight",
      );
    });
  });
});
