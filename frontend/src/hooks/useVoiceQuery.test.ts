import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────

const voiceMocks = vi.hoisted(() => ({
  status: "idle" as string,
  isConnected: false,
  isRecording: false,
  isPlaying: false,
  transcript: "",
  responseText: "",
  error: null as string | null,
  connect: vi.fn() as Mock,
  disconnect: vi.fn() as Mock,
  startRecording: vi.fn() as Mock<() => Promise<void>>,
  stopRecording: vi.fn() as Mock,
}));

const wakeWordMocks = vi.hoisted(() => ({
  isListening: false,
  isSupported: true,
  enable: vi.fn() as Mock,
  disable: vi.fn() as Mock,
  toggle: vi.fn() as Mock,
}));

const apiMocks = vi.hoisted(() => ({
  classifyIntent: vi.fn() as Mock,
}));

vi.mock("@/contexts/VoiceContext", () => ({
  useVoiceContext: () => ({
    voice: {
      status: voiceMocks.status,
      isConnected: voiceMocks.isConnected,
      isRecording: voiceMocks.isRecording,
      isPlaying: voiceMocks.isPlaying,
      transcript: voiceMocks.transcript,
      responseText: voiceMocks.responseText,
      error: voiceMocks.error,
      connect: voiceMocks.connect,
      disconnect: voiceMocks.disconnect,
      startRecording: voiceMocks.startRecording,
      stopRecording: voiceMocks.stopRecording,
    },
    wakeWord: {
      isListening: wakeWordMocks.isListening,
      isSupported: wakeWordMocks.isSupported,
      enable: wakeWordMocks.enable,
      disable: wakeWordMocks.disable,
      toggle: wakeWordMocks.toggle,
    },
    wakeWordEnabled: false,
    setWakeWordEnabled: vi.fn(),
  }),
}));

vi.mock("@/services/api", () => ({
  default: { post: vi.fn() },
  classifyIntent: apiMocks.classifyIntent,
}));

import { useVoiceQuery } from "./useVoiceQuery";

// ─── SpeechSynthesis mock ────────────────────────────────────────────

const mockSpeak = vi.fn();
const mockCancel = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  voiceMocks.status = "idle";
  voiceMocks.isConnected = false;
  voiceMocks.isRecording = false;
  voiceMocks.isPlaying = false;
  voiceMocks.transcript = "";
  voiceMocks.responseText = "";
  voiceMocks.error = null;
  voiceMocks.startRecording.mockResolvedValue(undefined);

  // Mock SpeechSynthesis API
  Object.defineProperty(window, "speechSynthesis", {
    value: {
      speak: mockSpeak,
      cancel: mockCancel,
    },
    writable: true,
    configurable: true,
  });

  // Mock SpeechSynthesisUtterance
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class MockUtterance {
      text: string;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("useVoiceQuery", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => useVoiceQuery("ws-123"));

    expect(result.current.pendingQuery).toBeNull();
    expect(result.current.isClassifying).toBe(false);
    expect(result.current.lastIntent).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isSpeaking).toBe(false);
  });

  it("does not classify when workspaceId is null", () => {
    voiceMocks.transcript = "show me sales";
    voiceMocks.status = "processing";

    renderHook(() => useVoiceQuery(null));

    expect(apiMocks.classifyIntent).not.toHaveBeenCalled();
  });

  it("does not classify when transcript is empty", () => {
    voiceMocks.transcript = "";
    voiceMocks.status = "processing";

    renderHook(() => useVoiceQuery("ws-123"));

    expect(apiMocks.classifyIntent).not.toHaveBeenCalled();
  });

  it("does not classify when status is recording (not yet final)", () => {
    voiceMocks.transcript = "show me sales";
    voiceMocks.status = "recording";

    renderHook(() => useVoiceQuery("ws-123"));

    expect(apiMocks.classifyIntent).not.toHaveBeenCalled();
  });

  it("classifies intent when transcript appears and status is processing", async () => {
    apiMocks.classifyIntent.mockResolvedValue({
      intent: "query",
      confidence: 0.9,
      entities: {},
    });

    voiceMocks.transcript = "show me top sales";
    voiceMocks.status = "processing";

    const { result } = renderHook(() => useVoiceQuery("ws-123"));

    // Wait for the async classify to resolve
    await vi.waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    expect(apiMocks.classifyIntent).toHaveBeenCalledWith("show me top sales");
    expect(result.current.lastIntent).toEqual({
      intent: "query",
      confidence: 0.9,
      entities: {},
    });
    expect(result.current.pendingQuery).toBe("show me top sales");
  });

  it("sets pendingQuery for query intent with sufficient confidence", async () => {
    apiMocks.classifyIntent.mockResolvedValue({
      intent: "query",
      confidence: 0.8,
      entities: {},
    });

    voiceMocks.transcript = "what are the total revenues";
    voiceMocks.status = "connected";

    const { result } = renderHook(() => useVoiceQuery("ws-123"));

    await vi.waitFor(() => {
      expect(result.current.pendingQuery).toBe("what are the total revenues");
    });
  });

  it("does not set pendingQuery for non-query intent", async () => {
    apiMocks.classifyIntent.mockResolvedValue({
      intent: "navigate",
      confidence: 0.95,
      entities: { page: "dashboards" },
    });

    voiceMocks.transcript = "go to dashboards";
    voiceMocks.status = "processing";

    const { result } = renderHook(() => useVoiceQuery("ws-123"));

    await vi.waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    expect(result.current.pendingQuery).toBeNull();
    expect(result.current.lastIntent?.intent).toBe("navigate");
  });

  it("does not set pendingQuery for low confidence query", async () => {
    apiMocks.classifyIntent.mockResolvedValue({
      intent: "query",
      confidence: 0.3,
      entities: {},
    });

    voiceMocks.transcript = "hmm maybe something";
    voiceMocks.status = "processing";

    const { result } = renderHook(() => useVoiceQuery("ws-123"));

    await vi.waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    expect(result.current.pendingQuery).toBeNull();
  });

  it("handles classification error", async () => {
    apiMocks.classifyIntent.mockRejectedValue(new Error("API unavailable"));

    voiceMocks.transcript = "show me data";
    voiceMocks.status = "processing";

    const { result } = renderHook(() => useVoiceQuery("ws-123"));

    await vi.waitFor(() => {
      expect(result.current.isClassifying).toBe(false);
    });

    expect(result.current.error).toBe("API unavailable");
    expect(result.current.pendingQuery).toBeNull();
  });

  it("does not re-classify the same transcript", async () => {
    apiMocks.classifyIntent.mockResolvedValue({
      intent: "query",
      confidence: 0.9,
      entities: {},
    });

    voiceMocks.transcript = "show me sales";
    voiceMocks.status = "processing";

    const { rerender } = renderHook(() => useVoiceQuery("ws-123"));

    await vi.waitFor(() => {
      expect(apiMocks.classifyIntent).toHaveBeenCalledTimes(1);
    });

    // Re-render with the same transcript — should not classify again
    rerender();

    expect(apiMocks.classifyIntent).toHaveBeenCalledTimes(1);
  });

  it("clearPendingQuery resets pendingQuery to null", async () => {
    apiMocks.classifyIntent.mockResolvedValue({
      intent: "query",
      confidence: 0.9,
      entities: {},
    });

    voiceMocks.transcript = "show me sales";
    voiceMocks.status = "processing";

    const { result } = renderHook(() => useVoiceQuery("ws-123"));

    await vi.waitFor(() => {
      expect(result.current.pendingQuery).toBe("show me sales");
    });

    act(() => {
      result.current.clearPendingQuery();
    });

    expect(result.current.pendingQuery).toBeNull();
  });

  // ─── SpeechSynthesis ────────────────────────────────────────────

  it("speak() calls SpeechSynthesis with the given text", () => {
    const { result } = renderHook(() => useVoiceQuery("ws-123"));

    act(() => {
      result.current.speak("Here are your top customers.");
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance.text).toBe("Here are your top customers.");
  });

  it("stopSpeaking() calls speechSynthesis.cancel", () => {
    const { result } = renderHook(() => useVoiceQuery("ws-123"));

    act(() => {
      result.current.stopSpeaking();
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it("isSpeaking tracks SpeechSynthesisUtterance events", () => {
    const { result } = renderHook(() => useVoiceQuery("ws-123"));

    act(() => {
      result.current.speak("Hello from Ralph!");
    });

    const utterance = mockSpeak.mock.calls[0][0];

    // Simulate onstart
    act(() => {
      utterance.onstart?.();
    });
    expect(result.current.isSpeaking).toBe(true);

    // Simulate onend
    act(() => {
      utterance.onend?.();
    });
    expect(result.current.isSpeaking).toBe(false);
  });

  it("cancels speech synthesis on unmount", () => {
    const { unmount } = renderHook(() => useVoiceQuery("ws-123"));

    unmount();

    expect(mockCancel).toHaveBeenCalled();
  });
});
