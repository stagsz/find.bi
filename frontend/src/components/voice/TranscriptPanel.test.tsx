import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import TranscriptPanel from "./TranscriptPanel";
import type { TranscriptEntry } from "@/hooks/useVoiceHistory";

// ─── Fixtures ────────────────────────────────────────────────────────

const ENTRIES: TranscriptEntry[] = [
  {
    id: "e1",
    timestamp: Date.now() - 60_000,
    userSpeech: "Show me revenue by region",
    ralphResponse: "Here is the revenue breakdown by region for Q4.",
  },
  {
    id: "e2",
    timestamp: Date.now() - 300_000,
    userSpeech: "What are the top products?",
    ralphResponse: "The top 5 products account for 80% of sales.",
  },
  {
    id: "e3",
    timestamp: Date.now() - 3_600_000,
    userSpeech: "Monthly growth trend",
    ralphResponse: "Growth has been steady at 12% month over month.",
  },
];

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  entries: ENTRIES,
  onClearHistory: vi.fn(),
  onRerun: vi.fn(),
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("TranscriptPanel", () => {
  // ── Visibility ────────────────────────────────────────────────────

  it("renders nothing when open=false", () => {
    render(<TranscriptPanel {...defaultProps} open={false} />);
    expect(screen.queryByTestId("transcript-panel")).not.toBeInTheDocument();
  });

  it("renders the panel when open=true", () => {
    render(<TranscriptPanel {...defaultProps} />);
    expect(screen.getByTestId("transcript-panel")).toBeInTheDocument();
  });

  // ── Header ────────────────────────────────────────────────────────

  it("shows the entry count badge", () => {
    render(<TranscriptPanel {...defaultProps} />);
    expect(screen.getByTestId("transcript-count")).toHaveTextContent("3");
  });

  it("does not show count badge when entries are empty", () => {
    render(<TranscriptPanel {...defaultProps} entries={[]} />);
    expect(screen.queryByTestId("transcript-count")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    render(<TranscriptPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("transcript-close"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClearHistory when clear button is clicked", () => {
    render(<TranscriptPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("transcript-clear"));
    expect(defaultProps.onClearHistory).toHaveBeenCalledTimes(1);
  });

  it("does not show clear button when entries are empty", () => {
    render(<TranscriptPanel {...defaultProps} entries={[]} />);
    expect(screen.queryByTestId("transcript-clear")).not.toBeInTheDocument();
  });

  // ── Empty state ───────────────────────────────────────────────────

  it("shows empty state when entries is empty", () => {
    render(<TranscriptPanel {...defaultProps} entries={[]} />);
    expect(screen.getByTestId("transcript-empty")).toBeInTheDocument();
  });

  it("does not show empty state when entries exist", () => {
    render(<TranscriptPanel {...defaultProps} />);
    expect(screen.queryByTestId("transcript-empty")).not.toBeInTheDocument();
  });

  // ── Entry rendering ───────────────────────────────────────────────

  it("renders all entries", () => {
    render(<TranscriptPanel {...defaultProps} />);
    const entries = screen.getAllByTestId("transcript-entry");
    expect(entries).toHaveLength(3);
  });

  it("renders user speech and Ralph response per entry", () => {
    render(<TranscriptPanel {...defaultProps} />);
    expect(
      screen.getByText("Show me revenue by region"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/revenue breakdown by region/),
    ).toBeInTheDocument();
  });

  it("renders timestamps for each entry", () => {
    render(<TranscriptPanel {...defaultProps} />);
    const timestamps = screen.getAllByTestId("transcript-timestamp");
    expect(timestamps).toHaveLength(3);
    timestamps.forEach((t) => expect(t.textContent).toBeTruthy());
  });

  // ── Search ────────────────────────────────────────────────────────

  it("filters entries by user speech", () => {
    render(<TranscriptPanel {...defaultProps} />);
    const searchInput = screen.getByTestId("transcript-search");
    fireEvent.change(searchInput, { target: { value: "revenue" } });

    const entries = screen.getAllByTestId("transcript-entry");
    expect(entries).toHaveLength(1);
    expect(screen.getByText("Show me revenue by region")).toBeInTheDocument();
  });

  it("filters entries by Ralph response text", () => {
    render(<TranscriptPanel {...defaultProps} />);
    const searchInput = screen.getByTestId("transcript-search");
    fireEvent.change(searchInput, { target: { value: "80%" } });

    const entries = screen.getAllByTestId("transcript-entry");
    expect(entries).toHaveLength(1);
    expect(screen.getByText("What are the top products?")).toBeInTheDocument();
  });

  it("search is case-insensitive", () => {
    render(<TranscriptPanel {...defaultProps} />);
    const searchInput = screen.getByTestId("transcript-search");
    fireEvent.change(searchInput, { target: { value: "REVENUE" } });

    const entries = screen.getAllByTestId("transcript-entry");
    expect(entries).toHaveLength(1);
  });

  it("shows no-results state when search has no matches", () => {
    render(<TranscriptPanel {...defaultProps} />);
    const searchInput = screen.getByTestId("transcript-search");
    fireEvent.change(searchInput, { target: { value: "xyznotfound" } });

    expect(screen.getByTestId("transcript-no-results")).toBeInTheDocument();
    expect(screen.queryByTestId("transcript-entry")).not.toBeInTheDocument();
  });

  it("shows all entries when search is cleared", () => {
    render(<TranscriptPanel {...defaultProps} />);
    const searchInput = screen.getByTestId("transcript-search");
    fireEvent.change(searchInput, { target: { value: "revenue" } });
    expect(screen.getAllByTestId("transcript-entry")).toHaveLength(1);

    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getAllByTestId("transcript-entry")).toHaveLength(3);
  });

  // ── Copy ─────────────────────────────────────────────────────────

  it("copy button calls clipboard writeText with formatted exchange", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<TranscriptPanel {...defaultProps} />);
    const copyBtns = screen.getAllByTestId("transcript-copy");
    fireEvent.click(copyBtns[0]);

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Show me revenue by region"),
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("revenue breakdown by region"),
    );
  });

  // ── Re-run ────────────────────────────────────────────────────────

  it("rerun button calls onRerun with userSpeech", () => {
    render(<TranscriptPanel {...defaultProps} />);
    const rerunBtns = screen.getAllByTestId("transcript-rerun");
    fireEvent.click(rerunBtns[0]);
    expect(defaultProps.onRerun).toHaveBeenCalledWith(
      "Show me revenue by region",
    );
  });

  it("does not render rerun buttons when onRerun is not provided", () => {
    render(<TranscriptPanel {...defaultProps} onRerun={undefined} />);
    expect(screen.queryByTestId("transcript-rerun")).not.toBeInTheDocument();
  });

  it("rerun calls correct userSpeech for each entry", () => {
    render(<TranscriptPanel {...defaultProps} />);
    const rerunBtns = screen.getAllByTestId("transcript-rerun");
    fireEvent.click(rerunBtns[1]);
    expect(defaultProps.onRerun).toHaveBeenCalledWith(
      "What are the top products?",
    );
  });

  // ── Entry list structure ──────────────────────────────────────────

  it("each entry has its own copy and rerun buttons", () => {
    render(<TranscriptPanel {...defaultProps} />);
    const entries = screen.getAllByTestId("transcript-entry");
    entries.forEach((entry) => {
      expect(within(entry).getByTestId("transcript-copy")).toBeInTheDocument();
      expect(within(entry).getByTestId("transcript-rerun")).toBeInTheDocument();
    });
  });
});

// ─── relativeTime utility ────────────────────────────────────────────

import { relativeTime } from "./TranscriptPanel";

describe("relativeTime", () => {
  it("returns 'just now' for < 60s", () => {
    expect(relativeTime(Date.now() - 30_000)).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(relativeTime(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    expect(relativeTime(Date.now() - 3 * 3_600_000)).toBe("3h ago");
  });

  it("returns 'yesterday' for 1 day ago", () => {
    expect(relativeTime(Date.now() - 25 * 3_600_000)).toBe("yesterday");
  });

  it("returns days ago", () => {
    expect(relativeTime(Date.now() - 3 * 86_400_000)).toBe("3d ago");
  });

  it("returns date string for > 7 days", () => {
    const old = Date.now() - 10 * 86_400_000;
    expect(relativeTime(old)).toBe(new Date(old).toLocaleDateString());
  });
});
