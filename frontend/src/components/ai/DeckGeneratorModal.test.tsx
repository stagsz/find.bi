import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import DeckGeneratorModal from "./DeckGeneratorModal";
import api from "@/services/api";
import type { Deck } from "./DeckViewer";

// ─── Mocks ──────────────────────────────────────────────────────────

vi.mock("@/services/api", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { baseURL: "" },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock("@/components/explore/PlotRenderer", () => ({
  default: ({ spec }: { spec: unknown }) => (
    <div data-testid="plot-renderer" data-spec={JSON.stringify(spec)} />
  ),
}));

// ─── Test data ──────────────────────────────────────────────────────

const MOCK_DECK: Deck = {
  deck_title: "Sales Analysis",
  summary: "Overview of sales data.",
  slides: [
    {
      title: "Slide 1",
      narrative: "First slide narrative.",
      plot_spec: null,
    },
    {
      title: "Slide 2",
      narrative: "Second slide with chart.",
      plot_spec: { marks: [{ type: "barY", data: [], options: {} }] },
    },
  ],
};

// ─── Teardown ───────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("DeckGeneratorModal", () => {
  describe("closed state", () => {
    it("renders nothing when open is false", () => {
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={false}
          onClose={vi.fn()}
        />,
      );
      expect(
        screen.queryByTestId("deck-generator-modal"),
      ).not.toBeInTheDocument();
    });
  });

  describe("prompt phase", () => {
    it("renders the modal when open", () => {
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("deck-generator-modal")).toBeInTheDocument();
    });

    it("renders the prompt form with input and buttons", () => {
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("deck-generator-prompt")).toBeInTheDocument();
      expect(screen.getByTestId("deck-goal-input")).toBeInTheDocument();
      expect(screen.getByTestId("deck-generate-button")).toBeInTheDocument();
      expect(screen.getByTestId("deck-cancel-button")).toBeInTheDocument();
    });

    it("displays modal title", () => {
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(
        screen.getByText("Generate Analysis Deck"),
      ).toBeInTheDocument();
    });

    it("allows typing in the focus prompt input", async () => {
      const user = userEvent.setup();
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      const input = screen.getByTestId("deck-goal-input");
      await user.type(input, "Focus on revenue");
      expect(input).toHaveValue("Focus on revenue");
    });

    it("calls onClose when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByTestId("deck-cancel-button"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when backdrop is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByTestId("deck-generator-backdrop"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape is pressed in prompt phase", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={onClose}
        />,
      );

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("disables Generate button when workspaceId is null", () => {
      render(
        <DeckGeneratorModal
          workspaceId={null}
          open={true}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("deck-generate-button")).toBeDisabled();
    });
  });

  describe("generating phase", () => {
    beforeEach(() => {
      // Make the API call hang (never resolve) so we stay in generating phase
      vi.mocked(api.post).mockReturnValue(new Promise(() => {}));
    });

    it("shows loading state after clicking Generate", async () => {
      const user = userEvent.setup();
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("deck-generate-button"));

      expect(
        screen.getByTestId("deck-generator-loading"),
      ).toBeInTheDocument();
      expect(screen.getByText("Generating Deck...")).toBeInTheDocument();
    });

    it("sends correct API request with user goal", async () => {
      const user = userEvent.setup();
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      await user.type(screen.getByTestId("deck-goal-input"), "Revenue trends");
      await user.click(screen.getByTestId("deck-generate-button"));

      expect(api.post).toHaveBeenCalledWith("/api/deck", {
        workspace_id: "ws1",
        user_goal: "Revenue trends",
      });
    });

    it("sends empty user_goal when input is blank", async () => {
      const user = userEvent.setup();
      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("deck-generate-button"));

      expect(api.post).toHaveBeenCalledWith("/api/deck", {
        workspace_id: "ws1",
        user_goal: "",
      });
    });

    it("triggers generate on Enter key in input", async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockReturnValue(new Promise(() => {}));

      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      const input = screen.getByTestId("deck-goal-input");
      await user.type(input, "Test goal{Enter}");

      expect(api.post).toHaveBeenCalledWith("/api/deck", {
        workspace_id: "ws1",
        user_goal: "Test goal",
      });
    });
  });

  describe("viewing phase", () => {
    it("shows DeckViewer after successful generation", async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValueOnce({ data: MOCK_DECK });

      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("deck-generate-button"));

      await waitFor(() => {
        expect(
          screen.getByTestId("deck-generator-viewer"),
        ).toBeInTheDocument();
      });

      expect(screen.getByTestId("deck-viewer")).toBeInTheDocument();
      expect(screen.getByTestId("deck-title")).toHaveTextContent(
        "Sales Analysis",
      );
    });
  });

  describe("error phase", () => {
    it("shows error message on API failure", async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce({
        response: {
          data: { detail: "No data tables found" },
        },
      });

      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("deck-generate-button"));

      await waitFor(() => {
        expect(
          screen.getByTestId("deck-generator-error"),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("No data tables found")).toBeInTheDocument();
      expect(screen.getByText("Generation Failed")).toBeInTheDocument();
    });

    it("shows generic error message for non-API errors", async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce(new Error("Network error"));

      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("deck-generate-button"));

      await waitFor(() => {
        expect(
          screen.getByTestId("deck-generator-error"),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    it("returns to prompt phase on Try Again", async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce(new Error("Fail"));

      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("deck-generate-button"));

      await waitFor(() => {
        expect(screen.getByTestId("deck-retry-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("deck-retry-button"));

      expect(screen.getByTestId("deck-generator-prompt")).toBeInTheDocument();
    });

    it("calls onClose when Close button clicked in error phase", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      vi.mocked(api.post).mockRejectedValueOnce(new Error("Fail"));

      render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={onClose}
        />,
      );

      await user.click(screen.getByTestId("deck-generate-button"));

      await waitFor(() => {
        expect(
          screen.getByTestId("deck-error-close-button"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("deck-error-close-button"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("state reset", () => {
    it("resets to prompt phase when modal is reopened", async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValueOnce({ data: MOCK_DECK });

      const { rerender } = render(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      // Generate a deck
      await user.click(screen.getByTestId("deck-generate-button"));
      await waitFor(() => {
        expect(
          screen.getByTestId("deck-generator-viewer"),
        ).toBeInTheDocument();
      });

      // Close modal
      rerender(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={false}
          onClose={vi.fn()}
        />,
      );

      // Reopen modal
      rerender(
        <DeckGeneratorModal
          workspaceId="ws1"
          open={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByTestId("deck-generator-prompt")).toBeInTheDocument();
      expect(screen.getByTestId("deck-goal-input")).toHaveValue("");
    });
  });
});
