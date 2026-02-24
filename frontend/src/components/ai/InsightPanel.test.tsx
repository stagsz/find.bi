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
});

afterEach(() => {
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
      const user = userEvent.setup();
      mocks.post.mockResolvedValue(MOCK_INSIGHTS);

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      expect(mocks.post).toHaveBeenCalledWith("/api/ai/insights", {
        workspace_id: WORKSPACE_ID,
      });
    });

    it("does not call API when workspaceId is null", async () => {
      const user = userEvent.setup();

      render(<InsightPanel workspaceId={null} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      expect(mocks.post).not.toHaveBeenCalled();
    });
  });

  // ─── Loading state ────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows loading indicator while fetching", async () => {
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      expect(screen.getByTestId("insight-loading")).toBeInTheDocument();
    });

    it("shows Analyzing... text on button while loading", async () => {
      const user = userEvent.setup();
      mocks.post.mockReturnValue(new Promise(() => {}));

      render(<InsightPanel workspaceId={WORKSPACE_ID} />);
      await user.click(screen.getByTestId("insight-analyze-button"));

      expect(screen.getByTestId("insight-analyze-button")).toHaveTextContent(
        "Analyzing...",
      );
    });

    it("disables button while loading", async () => {
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
});
