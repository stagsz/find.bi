import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useNarration } from "./useNarration";

// ─── Mock NarrationContext ──────────────────────────────────────────

const mockActions = {
  startNarration: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
};

const mockState = {
  status: "playing" as const,
  segments: [
    { card_id: "c1", title: "Chart A", narration: "Description of Chart A" },
    { card_id: "c2", title: "Chart B", narration: "Description of Chart B" },
  ],
  currentIndex: 0,
  activeCardId: "c1",
  error: null,
  progress: { current: 1, total: 2 },
};

vi.mock("@/contexts/NarrationContext", () => ({
  useNarrationContext: () => ({
    state: mockState,
    actions: mockActions,
  }),
}));

// ─── Tests ──────────────────────────────────────────────────────────

describe("useNarration", () => {
  it("returns status flags", () => {
    const { result } = renderHook(() => useNarration());

    expect(result.current.status).toBe("playing");
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns the current segment based on currentIndex", () => {
    const { result } = renderHook(() => useNarration());

    expect(result.current.currentSegment).toEqual(mockState.segments[0]);
    expect(result.current.activeCardId).toBe("c1");
  });

  it("returns progress", () => {
    const { result } = renderHook(() => useNarration());

    expect(result.current.progress).toEqual({ current: 1, total: 2 });
  });

  it("passes through action methods", () => {
    const { result } = renderHook(() => useNarration());

    expect(result.current.startNarration).toBe(mockActions.startNarration);
    expect(result.current.pause).toBe(mockActions.pause);
    expect(result.current.resume).toBe(mockActions.resume);
    expect(result.current.stop).toBe(mockActions.stop);
    expect(result.current.next).toBe(mockActions.next);
    expect(result.current.previous).toBe(mockActions.previous);
  });

  it("returns all segments", () => {
    const { result } = renderHook(() => useNarration());

    expect(result.current.segments).toHaveLength(2);
  });
});
