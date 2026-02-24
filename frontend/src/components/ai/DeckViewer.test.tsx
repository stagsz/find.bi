import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";

import DeckViewer from "./DeckViewer";
import type { Deck } from "./DeckViewer";

// ─── Mock PlotRenderer ──────────────────────────────────────────────

vi.mock("@/components/explore/PlotRenderer", () => ({
  default: ({ spec }: { spec: unknown }) => (
    <div data-testid="plot-renderer" data-spec={JSON.stringify(spec)} />
  ),
}));

// ─── Test data ──────────────────────────────────────────────────────

const MOCK_DECK: Deck = {
  deck_title: "Sales Analysis Q4",
  summary: "An overview of Q4 performance.",
  slides: [
    {
      title: "Executive Summary",
      narrative: "Revenue grew **15%** in Q4.\n\nThis exceeded targets.",
      plot_spec: null,
    },
    {
      title: "Regional Breakdown",
      narrative: "The `EMEA` region led growth with *strong* performance.",
      plot_spec: {
        marks: [
          {
            type: "barY",
            data: [{ x: "EMEA", y: 100 }],
            options: { x: "x", y: "y" },
          },
        ],
      },
    },
    {
      title: "Recommendations",
      narrative: "Invest more in EMEA and APAC markets.",
      plot_spec: null,
    },
  ],
};

const EMPTY_DECK: Deck = {
  deck_title: "Empty Deck",
  summary: "",
  slides: [],
};

const SINGLE_SLIDE_DECK: Deck = {
  deck_title: "One Slide",
  summary: "Just one.",
  slides: [
    {
      title: "Only Slide",
      narrative: "This is the only slide.",
      plot_spec: null,
    },
  ],
};

// ─── Teardown ───────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("DeckViewer", () => {
  describe("rendering", () => {
    it("renders the deck viewer container", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(screen.getByTestId("deck-viewer")).toBeInTheDocument();
    });

    it("displays the deck title", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(screen.getByTestId("deck-title")).toHaveTextContent(
        "Sales Analysis Q4",
      );
    });

    it("displays the first slide title by default", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(screen.getByTestId("deck-slide-title")).toHaveTextContent(
        "Executive Summary",
      );
    });

    it("displays the slide narrative", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(screen.getByTestId("deck-slide-narrative")).toBeInTheDocument();
      expect(screen.getByTestId("deck-slide-narrative")).toHaveTextContent(
        /Revenue grew/,
      );
    });

    it("renders bold text in narrative", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      const strong = screen
        .getByTestId("deck-slide-narrative")
        .querySelector("strong");
      expect(strong).toBeInTheDocument();
      expect(strong).toHaveTextContent("15%");
    });

    it("splits narrative into paragraphs", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      const paragraphs = screen
        .getByTestId("deck-slide-narrative")
        .querySelectorAll("p");
      expect(paragraphs.length).toBe(2);
    });

    it("shows slide counter as 1 / N", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(screen.getByTestId("deck-slide-counter")).toHaveTextContent(
        "1 / 3",
      );
    });

    it("does not render chart when plot_spec is null", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(screen.queryByTestId("deck-slide-chart")).not.toBeInTheDocument();
    });

    it("applies className prop", () => {
      render(<DeckViewer deck={MOCK_DECK} className="my-custom" />);
      expect(screen.getByTestId("deck-viewer")).toHaveClass("my-custom");
    });
  });

  describe("empty deck", () => {
    it("shows empty message when deck has no slides", () => {
      render(<DeckViewer deck={EMPTY_DECK} />);
      expect(screen.getByTestId("deck-viewer")).toHaveTextContent(
        "No slides in this deck.",
      );
    });

    it("does not render navigation for empty deck", () => {
      render(<DeckViewer deck={EMPTY_DECK} />);
      expect(
        screen.queryByTestId("deck-prev-button"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("deck-next-button"),
      ).not.toBeInTheDocument();
    });
  });

  describe("navigation with buttons", () => {
    it("disables prev button on first slide", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(screen.getByTestId("deck-prev-button")).toBeDisabled();
    });

    it("enables next button on first slide", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(screen.getByTestId("deck-next-button")).not.toBeDisabled();
    });

    it("navigates to next slide on next button click", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.click(screen.getByTestId("deck-next-button"));

      expect(screen.getByTestId("deck-slide-title")).toHaveTextContent(
        "Regional Breakdown",
      );
      expect(screen.getByTestId("deck-slide-counter")).toHaveTextContent(
        "2 / 3",
      );
    });

    it("navigates back on prev button click", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.click(screen.getByTestId("deck-next-button"));
      await user.click(screen.getByTestId("deck-prev-button"));

      expect(screen.getByTestId("deck-slide-title")).toHaveTextContent(
        "Executive Summary",
      );
      expect(screen.getByTestId("deck-slide-counter")).toHaveTextContent(
        "1 / 3",
      );
    });

    it("disables next button on last slide", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.click(screen.getByTestId("deck-next-button"));
      await user.click(screen.getByTestId("deck-next-button"));

      expect(screen.getByTestId("deck-next-button")).toBeDisabled();
      expect(screen.getByTestId("deck-slide-counter")).toHaveTextContent(
        "3 / 3",
      );
    });

    it("enables prev button after navigating away from first slide", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.click(screen.getByTestId("deck-next-button"));

      expect(screen.getByTestId("deck-prev-button")).not.toBeDisabled();
    });

    it("disables both buttons for single-slide deck", () => {
      render(<DeckViewer deck={SINGLE_SLIDE_DECK} />);
      expect(screen.getByTestId("deck-prev-button")).toBeDisabled();
      expect(screen.getByTestId("deck-next-button")).toBeDisabled();
    });
  });

  describe("keyboard navigation", () => {
    it("navigates to next slide with ArrowRight", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.keyboard("{ArrowRight}");

      expect(screen.getByTestId("deck-slide-title")).toHaveTextContent(
        "Regional Breakdown",
      );
    });

    it("navigates to previous slide with ArrowLeft", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.keyboard("{ArrowRight}");
      await user.keyboard("{ArrowLeft}");

      expect(screen.getByTestId("deck-slide-title")).toHaveTextContent(
        "Executive Summary",
      );
    });

    it("navigates with ArrowDown and ArrowUp", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.keyboard("{ArrowDown}");
      expect(screen.getByTestId("deck-slide-title")).toHaveTextContent(
        "Regional Breakdown",
      );

      await user.keyboard("{ArrowUp}");
      expect(screen.getByTestId("deck-slide-title")).toHaveTextContent(
        "Executive Summary",
      );
    });

    it("does not go below first slide with ArrowLeft", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.keyboard("{ArrowLeft}");

      expect(screen.getByTestId("deck-slide-counter")).toHaveTextContent(
        "1 / 3",
      );
    });

    it("does not go past last slide with ArrowRight", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.keyboard("{ArrowRight}");
      await user.keyboard("{ArrowRight}");
      await user.keyboard("{ArrowRight}"); // extra — should stay at 3

      expect(screen.getByTestId("deck-slide-counter")).toHaveTextContent(
        "3 / 3",
      );
    });

    it("calls onClose on Escape key", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<DeckViewer deck={MOCK_DECK} onClose={onClose} />);

      await user.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("chart rendering", () => {
    it("renders chart when slide has plot_spec", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      // Navigate to slide 2 which has a chart
      await user.click(screen.getByTestId("deck-next-button"));

      expect(screen.getByTestId("deck-slide-chart")).toBeInTheDocument();
      expect(screen.getByTestId("plot-renderer")).toBeInTheDocument();
    });

    it("does not render chart on slide without plot_spec", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(screen.queryByTestId("deck-slide-chart")).not.toBeInTheDocument();
    });

    it("renders inline code in narrative", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.click(screen.getByTestId("deck-next-button"));

      const code = screen
        .getByTestId("deck-slide-narrative")
        .querySelector("code");
      expect(code).toBeInTheDocument();
      expect(code).toHaveTextContent("EMEA");
    });

    it("renders italic text in narrative", async () => {
      const user = userEvent.setup();
      render(<DeckViewer deck={MOCK_DECK} />);

      await user.click(screen.getByTestId("deck-next-button"));

      const em = screen
        .getByTestId("deck-slide-narrative")
        .querySelector("em");
      expect(em).toBeInTheDocument();
      expect(em).toHaveTextContent("strong");
    });
  });

  describe("close button", () => {
    it("renders close button when onClose provided", () => {
      const onClose = vi.fn();
      render(<DeckViewer deck={MOCK_DECK} onClose={onClose} />);
      expect(screen.getByTestId("deck-close-button")).toBeInTheDocument();
    });

    it("does not render close button when onClose not provided", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(
        screen.queryByTestId("deck-close-button"),
      ).not.toBeInTheDocument();
    });

    it("calls onClose when close button clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<DeckViewer deck={MOCK_DECK} onClose={onClose} />);

      await user.click(screen.getByTestId("deck-close-button"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("fullscreen", () => {
    it("renders fullscreen button", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(
        screen.getByTestId("deck-fullscreen-button"),
      ).toBeInTheDocument();
    });

    it("fullscreen button has correct aria-label", () => {
      render(<DeckViewer deck={MOCK_DECK} />);
      expect(screen.getByTestId("deck-fullscreen-button")).toHaveAttribute(
        "aria-label",
        "Enter fullscreen",
      );
    });
  });
});
