import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import NarrationPlayback from "./NarrationPlayback";

// ─── Mock useNarration ──────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  status: "idle" as string,
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  activeCardId: null as string | null,
  currentSegment: null as { card_id: string; title: string; narration: string } | null,
  segments: [] as { card_id: string; title: string; narration: string }[],
  progress: { current: 0, total: 0 },
  error: null as string | null,
  startNarration: vi.fn() as Mock<() => Promise<void>>,
  pause: vi.fn() as Mock,
  resume: vi.fn() as Mock,
  stop: vi.fn() as Mock,
  next: vi.fn() as Mock,
  previous: vi.fn() as Mock,
}));

vi.mock("@/hooks/useNarration", () => ({
  useNarration: () => ({
    status: mocks.status,
    isPlaying: mocks.isPlaying,
    isPaused: mocks.isPaused,
    isLoading: mocks.isLoading,
    activeCardId: mocks.activeCardId,
    currentSegment: mocks.currentSegment,
    segments: mocks.segments,
    progress: mocks.progress,
    error: mocks.error,
    startNarration: mocks.startNarration,
    pause: mocks.pause,
    resume: mocks.resume,
    stop: mocks.stop,
    next: mocks.next,
    previous: mocks.previous,
  }),
}));

// ─── Setup ──────────────────────────────────────────────────────────

const SAMPLE_SEGMENTS = [
  { card_id: "c1", title: "Revenue by Region", narration: "This chart shows revenue across different regions." },
  { card_id: "c2", title: "Monthly Growth", narration: "Growth has been steady at 12% month over month." },
  { card_id: "c3", title: "Top Products", narration: "The top 5 products account for 80% of sales." },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status = "idle";
  mocks.isPlaying = false;
  mocks.isPaused = false;
  mocks.isLoading = false;
  mocks.activeCardId = null;
  mocks.currentSegment = null;
  mocks.segments = [];
  mocks.progress = { current: 0, total: 0 };
  mocks.error = null;
  mocks.startNarration.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("NarrationPlayback", () => {
  it("does not render when idle with no segments", () => {
    render(<NarrationPlayback />);
    expect(screen.queryByTestId("narration-playback")).not.toBeInTheDocument();
  });

  it("renders when playing with segments", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[0];
    mocks.progress = { current: 1, total: 3 };
    render(<NarrationPlayback />);

    expect(screen.getByTestId("narration-playback")).toBeInTheDocument();
  });

  it("shows loading spinner when loading", () => {
    mocks.status = "loading";
    mocks.isLoading = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.progress = { current: 0, total: 3 };
    render(<NarrationPlayback />);

    expect(screen.getByTestId("narration-loading")).toBeInTheDocument();
  });

  it("displays current segment title and narration text", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[1];
    mocks.progress = { current: 2, total: 3 };
    render(<NarrationPlayback />);

    expect(screen.getByTestId("narration-segment-title")).toHaveTextContent(
      "Monthly Growth",
    );
    expect(screen.getByTestId("narration-segment-text")).toHaveTextContent(
      "Growth has been steady",
    );
  });

  it("shows progress counter", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[0];
    mocks.progress = { current: 1, total: 3 };
    render(<NarrationPlayback />);

    expect(screen.getByTestId("narration-counter")).toHaveTextContent("1/3");
  });

  it("shows progress dots for segments", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[0];
    mocks.progress = { current: 1, total: 3 };
    render(<NarrationPlayback />);

    const dots = screen.getByTestId("narration-dots");
    expect(dots.children).toHaveLength(3);
  });

  // ─── Controls ─────────────────────────────────────────────────────

  it("calls pause when play/pause button is clicked while playing", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[0];
    mocks.progress = { current: 1, total: 3 };
    render(<NarrationPlayback />);

    fireEvent.click(screen.getByTestId("narration-play-pause"));
    expect(mocks.pause).toHaveBeenCalledTimes(1);
  });

  it("calls resume when play/pause button is clicked while paused", () => {
    mocks.status = "paused";
    mocks.isPaused = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[0];
    mocks.progress = { current: 1, total: 3 };
    render(<NarrationPlayback />);

    fireEvent.click(screen.getByTestId("narration-play-pause"));
    expect(mocks.resume).toHaveBeenCalledTimes(1);
  });

  it("calls stop when stop button is clicked", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[0];
    mocks.progress = { current: 1, total: 3 };
    render(<NarrationPlayback />);

    fireEvent.click(screen.getByTestId("narration-stop"));
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it("calls next when next button is clicked", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[0];
    mocks.progress = { current: 1, total: 3 };
    render(<NarrationPlayback />);

    fireEvent.click(screen.getByTestId("narration-next"));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });

  it("disables previous button on first segment", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[0];
    mocks.progress = { current: 1, total: 3 };
    render(<NarrationPlayback />);

    expect(screen.getByTestId("narration-prev")).toBeDisabled();
  });

  it("enables previous button on second segment", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[1];
    mocks.progress = { current: 2, total: 3 };
    render(<NarrationPlayback />);

    const prevBtn = screen.getByTestId("narration-prev");
    expect(prevBtn).not.toBeDisabled();
    fireEvent.click(prevBtn);
    expect(mocks.previous).toHaveBeenCalledTimes(1);
  });

  it("disables next button on last segment", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[2];
    mocks.progress = { current: 3, total: 3 };
    render(<NarrationPlayback />);

    expect(screen.getByTestId("narration-next")).toBeDisabled();
  });

  // ─── Error state ──────────────────────────────────────────────────

  it("displays error message", () => {
    mocks.status = "error";
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.error = "TTS API failed";
    mocks.progress = { current: 1, total: 3 };
    render(<NarrationPlayback />);

    expect(screen.getByTestId("narration-error")).toHaveTextContent(
      "TTS API failed",
    );
  });

  // ─── Progress bar ────────────────────────────────────────────────

  it("renders progress bar", () => {
    mocks.status = "playing";
    mocks.isPlaying = true;
    mocks.segments = SAMPLE_SEGMENTS;
    mocks.currentSegment = SAMPLE_SEGMENTS[1];
    mocks.progress = { current: 2, total: 3 };
    render(<NarrationPlayback />);

    expect(screen.getByTestId("narration-progress-bar")).toBeInTheDocument();
  });
});
