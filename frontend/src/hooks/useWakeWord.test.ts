import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useWakeWord, getSpeechRecognitionConstructor } from "./useWakeWord";

// ─── Mock SpeechRecognition ─────────────────────────────────────────

type ResultHandler = (event: unknown) => void;
type ErrorHandler = (event: unknown) => void;
type VoidHandler = () => void;

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";

  onstart: VoidHandler | null = null;
  onresult: ResultHandler | null = null;
  onerror: ErrorHandler | null = null;
  onend: VoidHandler | null = null;

  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn(() => true);

  static instance: MockSpeechRecognition | null = null;

  constructor() {
    MockSpeechRecognition.instance = this;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function createResultEvent(
  transcript: string,
  resultIndex = 0,
  isFinal = false,
): unknown {
  return {
    resultIndex,
    results: {
      length: resultIndex + 1,
      [resultIndex]: {
        0: { transcript, confidence: 1 },
        length: 1,
        isFinal,
      },
    },
  };
}

function getRecognition(): MockSpeechRecognition {
  const r = MockSpeechRecognition.instance;
  if (!r) throw new Error("No MockSpeechRecognition instance");
  return r;
}

// ─── Setup ──────────────────────────────────────────────────────────

let originalSpeechRecognition: unknown;
let originalWebkitSpeechRecognition: unknown;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  MockSpeechRecognition.instance = null;

  originalSpeechRecognition = (
    globalThis as unknown as Record<string, unknown>
  ).SpeechRecognition;
  originalWebkitSpeechRecognition = (
    globalThis.window as unknown as Record<string, unknown>
  )?.webkitSpeechRecognition;

  (globalThis as unknown as Record<string, unknown>).SpeechRecognition =
    MockSpeechRecognition;
});

afterEach(() => {
  vi.useRealTimers();
  (globalThis as unknown as Record<string, unknown>).SpeechRecognition =
    originalSpeechRecognition;
  if (globalThis.window) {
    (globalThis.window as unknown as Record<string, unknown>).webkitSpeechRecognition =
      originalWebkitSpeechRecognition;
  }
});

// ─── getSpeechRecognitionConstructor ────────────────────────────────

describe("getSpeechRecognitionConstructor", () => {
  it("returns SpeechRecognition when available", () => {
    expect(getSpeechRecognitionConstructor()).toBe(MockSpeechRecognition);
  });

  it("falls back to webkitSpeechRecognition", () => {
    (globalThis as unknown as Record<string, unknown>).SpeechRecognition =
      undefined;
    (globalThis.window as unknown as Record<string, unknown>).webkitSpeechRecognition =
      MockSpeechRecognition;

    expect(getSpeechRecognitionConstructor()).toBe(MockSpeechRecognition);
  });

  it("returns null when unsupported", () => {
    (globalThis as unknown as Record<string, unknown>).SpeechRecognition =
      undefined;
    if (globalThis.window) {
      (globalThis.window as unknown as Record<string, unknown>).webkitSpeechRecognition =
        undefined;
    }

    expect(getSpeechRecognitionConstructor()).toBeNull();
  });
});

// ─── useWakeWord ────────────────────────────────────────────────────

describe("useWakeWord", () => {
  // ─── Initial state ──────────────────────────────────────────────

  it("starts with isListening false", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    expect(result.current.isListening).toBe(false);
    expect(result.current.isSupported).toBe(true);
  });

  it("reports isSupported false when API unavailable", () => {
    (globalThis as unknown as Record<string, unknown>).SpeechRecognition =
      undefined;
    if (globalThis.window) {
      (globalThis.window as unknown as Record<string, unknown>).webkitSpeechRecognition =
        undefined;
    }

    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    expect(result.current.isSupported).toBe(false);
  });

  // ─── enable / disable ──────────────────────────────────────────

  it("starts recognition on enable()", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    const r = getRecognition();
    expect(r.continuous).toBe(true);
    expect(r.interimResults).toBe(true);
    expect(r.lang).toBe("en-US");
    expect(r.start).toHaveBeenCalledTimes(1);
  });

  it("sets isListening to true on recognition start", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    act(() => {
      getRecognition().onstart?.();
    });

    expect(result.current.isListening).toBe(true);
  });

  it("stops recognition on disable()", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    const r = getRecognition();

    act(() => {
      r.onstart?.();
    });

    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.disable();
    });

    expect(r.abort).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
  });

  it("does nothing on enable() when unsupported", () => {
    (globalThis as unknown as Record<string, unknown>).SpeechRecognition =
      undefined;
    if (globalThis.window) {
      (globalThis.window as unknown as Record<string, unknown>).webkitSpeechRecognition =
        undefined;
    }

    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    expect(MockSpeechRecognition.instance).toBeNull();
  });

  // ─── toggle ─────────────────────────────────────────────────────

  it("toggle() enables then disables", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    // First toggle → enable
    act(() => {
      result.current.toggle();
    });

    const r = getRecognition();
    expect(r.start).toHaveBeenCalledTimes(1);

    act(() => {
      r.onstart?.();
    });

    // Second toggle → disable
    act(() => {
      result.current.toggle();
    });

    expect(r.abort).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
  });

  // ─── Wake word detection ────────────────────────────────────────

  it("fires onWakeWord when phrase detected", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    const r = getRecognition();

    act(() => {
      r.onstart?.();
    });

    act(() => {
      r.onresult?.(createResultEvent("hey ralph what is sales"));
    });

    expect(onWakeWord).toHaveBeenCalledTimes(1);
    expect(r.abort).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
  });

  it("detects phrase case-insensitively", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    act(() => {
      getRecognition().onstart?.();
    });

    act(() => {
      getRecognition().onresult?.(createResultEvent("HEY RALPH"));
    });

    expect(onWakeWord).toHaveBeenCalledTimes(1);
  });

  it("ignores speech without the wake phrase", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    act(() => {
      getRecognition().onstart?.();
    });

    act(() => {
      getRecognition().onresult?.(
        createResultEvent("show me the top customers"),
      );
    });

    expect(onWakeWord).not.toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);
  });

  it("supports custom phrase", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() =>
      useWakeWord({ onWakeWord, phrase: "ok computer" }),
    );

    act(() => {
      result.current.enable();
    });

    act(() => {
      getRecognition().onstart?.();
    });

    // Default phrase should NOT trigger
    act(() => {
      getRecognition().onresult?.(createResultEvent("hey ralph"));
    });
    expect(onWakeWord).not.toHaveBeenCalled();

    // Custom phrase should trigger
    act(() => {
      getRecognition().onresult?.(createResultEvent("ok computer show sales"));
    });
    expect(onWakeWord).toHaveBeenCalledTimes(1);
  });

  // ─── Auto-restart ───────────────────────────────────────────────

  it("auto-restarts recognition on end when enabled", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    const firstInstance = getRecognition();

    act(() => {
      firstInstance.onstart?.();
    });

    // Simulate recognition ending (e.g. silence timeout)
    act(() => {
      firstInstance.onend?.();
    });

    // Advance past the restart delay
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // A new instance should have been created and started
    const secondInstance = getRecognition();
    expect(secondInstance).not.toBe(firstInstance);
    expect(secondInstance.start).toHaveBeenCalled();
  });

  it("does NOT auto-restart after wake word detection", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    const r = getRecognition();

    act(() => {
      r.onstart?.();
    });

    // Detect wake word → triggers abort → triggers onend
    act(() => {
      r.onresult?.(createResultEvent("hey ralph"));
    });

    // Simulate onend after abort
    act(() => {
      r.onend?.();
    });

    // Advance timers — should NOT restart
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Only the original start call, no restart
    expect(r.start).toHaveBeenCalledTimes(1);
  });

  // ─── Error handling ─────────────────────────────────────────────

  it("ignores 'aborted' errors", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    act(() => {
      getRecognition().onstart?.();
    });

    act(() => {
      getRecognition().onerror?.({ error: "aborted", message: "" });
    });

    // Still listening — aborted is normal when we call abort()
    expect(result.current.isListening).toBe(true);
  });

  it("ignores 'no-speech' errors", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    act(() => {
      getRecognition().onstart?.();
    });

    act(() => {
      getRecognition().onerror?.({ error: "no-speech", message: "" });
    });

    expect(result.current.isListening).toBe(true);
  });

  it("disables on 'not-allowed' error", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    act(() => {
      getRecognition().onstart?.();
    });

    act(() => {
      getRecognition().onerror?.({
        error: "not-allowed",
        message: "Permission denied",
      });
    });

    expect(result.current.isListening).toBe(false);
  });

  // ─── Cleanup ────────────────────────────────────────────────────

  it("cleans up recognition on unmount", () => {
    const onWakeWord = vi.fn();
    const { result, unmount } = renderHook(() => useWakeWord({ onWakeWord }));

    act(() => {
      result.current.enable();
    });

    const r = getRecognition();

    act(() => {
      r.onstart?.();
    });

    unmount();

    expect(r.abort).toHaveBeenCalled();
  });

  it("handles start() throwing gracefully", () => {
    const onWakeWord = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onWakeWord }));

    // Make start() throw
    MockSpeechRecognition.prototype.start = vi.fn(() => {
      throw new Error("already started");
    });

    act(() => {
      result.current.enable();
    });

    expect(result.current.isListening).toBe(false);

    // Restore
    MockSpeechRecognition.prototype.start = vi.fn();
  });

  // ─── Uses latest callback ref ───────────────────────────────────

  it("uses the latest onWakeWord callback", () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    const { result, rerender } = renderHook(
      ({ cb }) => useWakeWord({ onWakeWord: cb }),
      { initialProps: { cb: firstCallback } },
    );

    act(() => {
      result.current.enable();
    });

    act(() => {
      getRecognition().onstart?.();
    });

    // Re-render with different callback
    rerender({ cb: secondCallback });

    act(() => {
      getRecognition().onresult?.(createResultEvent("hey ralph"));
    });

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
  });
});
