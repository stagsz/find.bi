import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useVoiceHistory } from "./useVoiceHistory";
import type { TranscriptEntry } from "./useVoiceHistory";

// ─── Mock VoiceContext ───────────────────────────────────────────────

const mockVoice = {
  status: "idle" as string,
  transcript: "",
  responseText: "",
  isConnected: false,
  isRecording: false,
  isPlaying: false,
  error: null as string | null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
};

vi.mock("@/contexts/VoiceContext", () => ({
  useVoiceContext: () => ({
    voice: mockVoice,
    wakeWord: { isListening: false, enable: vi.fn(), disable: vi.fn() },
    wakeWordEnabled: false,
    setWakeWordEnabled: vi.fn(),
  }),
}));

// ─── Mock localStorage ───────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// ─── Setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  mockVoice.status = "idle";
  mockVoice.transcript = "";
  mockVoice.responseText = "";
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("useVoiceHistory", () => {
  it("initialises with empty entries when localStorage is empty", () => {
    const { result } = renderHook(() => useVoiceHistory());
    expect(result.current.entries).toHaveLength(0);
  });

  it("loads existing entries from localStorage on mount", () => {
    const stored: TranscriptEntry[] = [
      { id: "abc", timestamp: 1000, userSpeech: "hello", ralphResponse: "hi" },
    ];
    localStorageMock.setItem("findbi-voice-history", JSON.stringify(stored));

    const { result } = renderHook(() => useVoiceHistory());
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].userSpeech).toBe("hello");
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorageMock.setItem("findbi-voice-history", "not-json{{{");
    const { result } = renderHook(() => useVoiceHistory());
    expect(result.current.entries).toHaveLength(0);
  });

  it("appends an entry when status transitions playing → connected", () => {
    mockVoice.status = "playing";
    mockVoice.transcript = "Show me sales data";
    mockVoice.responseText = "Here is the sales data.";

    const { result, rerender } = renderHook(() => useVoiceHistory());
    expect(result.current.entries).toHaveLength(0);

    // Simulate transition: playing → connected
    act(() => {
      mockVoice.status = "connected";
    });
    rerender();

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].userSpeech).toBe("Show me sales data");
    expect(result.current.entries[0].ralphResponse).toBe("Here is the sales data.");
    expect(result.current.entries[0].timestamp).toBeGreaterThan(0);
    expect(result.current.entries[0].id).toBeTruthy();
  });

  it("persists new entry to localStorage", () => {
    mockVoice.status = "playing";
    mockVoice.transcript = "revenue by region";
    mockVoice.responseText = "Revenue breakdown follows.";

    const { rerender } = renderHook(() => useVoiceHistory());

    act(() => { mockVoice.status = "connected"; });
    rerender();

    const stored = JSON.parse(
      localStorageMock.getItem("findbi-voice-history") ?? "[]",
    ) as TranscriptEntry[];
    expect(stored).toHaveLength(1);
    expect(stored[0].userSpeech).toBe("revenue by region");
  });

  it("does not append entry when transcript is empty", () => {
    mockVoice.status = "playing";
    mockVoice.transcript = "";
    mockVoice.responseText = "Some response.";

    const { result, rerender } = renderHook(() => useVoiceHistory());
    act(() => { mockVoice.status = "connected"; });
    rerender();

    expect(result.current.entries).toHaveLength(0);
  });

  it("does not append entry when responseText is empty", () => {
    mockVoice.status = "playing";
    mockVoice.transcript = "Hello Ralph";
    mockVoice.responseText = "";

    const { result, rerender } = renderHook(() => useVoiceHistory());
    act(() => { mockVoice.status = "connected"; });
    rerender();

    expect(result.current.entries).toHaveLength(0);
  });

  it("does not append duplicate when responseText is unchanged", () => {
    mockVoice.status = "playing";
    mockVoice.transcript = "Query A";
    mockVoice.responseText = "Response A";

    const { result, rerender } = renderHook(() => useVoiceHistory());

    // First completion
    act(() => { mockVoice.status = "connected"; });
    rerender();
    expect(result.current.entries).toHaveLength(1);

    // Status cycles back to playing and connected again with same response
    act(() => { mockVoice.status = "playing"; });
    rerender();
    act(() => { mockVoice.status = "connected"; });
    rerender();

    // Should not add a duplicate
    expect(result.current.entries).toHaveLength(1);
  });

  it("prepends new entries (newest first)", () => {
    // Start with playing so initial render captures prevStatus="playing"
    mockVoice.status = "playing";
    mockVoice.transcript = "First query";
    mockVoice.responseText = "First response";

    const { result, rerender } = renderHook(() => useVoiceHistory());

    // Complete first interaction
    act(() => { mockVoice.status = "connected"; });
    rerender();
    expect(result.current.entries).toHaveLength(1);

    // Begin second interaction — render with "playing" so prevStatus is captured
    act(() => { mockVoice.status = "playing"; });
    mockVoice.transcript = "Second query";
    mockVoice.responseText = "Second response";
    rerender();

    act(() => { mockVoice.status = "connected"; });
    rerender();

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].userSpeech).toBe("Second query");
    expect(result.current.entries[1].userSpeech).toBe("First query");
  });

  it("trims entries to MAX_ENTRIES (100)", () => {
    // Pre-fill localStorage with 100 entries
    const existing: TranscriptEntry[] = Array.from({ length: 100 }, (_, i) => ({
      id: `e${i}`,
      timestamp: i,
      userSpeech: `query ${i}`,
      ralphResponse: `response ${i}`,
    }));
    localStorageMock.setItem(
      "findbi-voice-history",
      JSON.stringify(existing),
    );

    mockVoice.status = "playing";
    mockVoice.transcript = "overflow query";
    mockVoice.responseText = "overflow response";

    const { result, rerender } = renderHook(() => useVoiceHistory());
    act(() => { mockVoice.status = "connected"; });
    rerender();

    expect(result.current.entries).toHaveLength(100);
    expect(result.current.entries[0].userSpeech).toBe("overflow query");
  });

  it("clearHistory empties entries and localStorage", () => {
    const stored: TranscriptEntry[] = [
      { id: "x1", timestamp: 1000, userSpeech: "q1", ralphResponse: "r1" },
      { id: "x2", timestamp: 2000, userSpeech: "q2", ralphResponse: "r2" },
    ];
    localStorageMock.setItem("findbi-voice-history", JSON.stringify(stored));

    const { result } = renderHook(() => useVoiceHistory());
    expect(result.current.entries).toHaveLength(2);

    act(() => { result.current.clearHistory(); });

    expect(result.current.entries).toHaveLength(0);
    const inStorage = localStorageMock.getItem("findbi-voice-history");
    expect(JSON.parse(inStorage ?? "null")).toEqual([]);
  });

  it("trims whitespace from transcript and response before saving", () => {
    mockVoice.status = "playing";
    mockVoice.transcript = "  padded query  ";
    mockVoice.responseText = "  padded response  ";

    const { result, rerender } = renderHook(() => useVoiceHistory());
    act(() => { mockVoice.status = "connected"; });
    rerender();

    expect(result.current.entries[0].userSpeech).toBe("padded query");
    expect(result.current.entries[0].ralphResponse).toBe("padded response");
  });
});
