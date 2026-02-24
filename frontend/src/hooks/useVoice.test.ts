import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";
import { useVoice, floatTo16BitPCM, arrayBufferToBase64, base64ToInt16Array } from "./useVoice";

// --- Mocks ---

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn() as Mock<() => string | null>,
}));

vi.mock("@/services/api", () => ({
  getAccessToken: mocks.getAccessToken,
}));

// --- WebSocket mock ---

type WSListener = (event: Record<string, unknown>) => void;

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: WSListener | null = null;
  onclose: WSListener | null = null;
  onerror: WSListener | null = null;
  onmessage: WSListener | null = null;

  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: code ?? 1000, reason: "" });
    }
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen({});
  }

  simulateMessage(data: string) {
    if (this.onmessage) this.onmessage({ data });
  }

  simulateError() {
    if (this.onerror) this.onerror({});
  }

  simulateClose(code = 1000) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code, reason: "" });
  }

  addEventListener() {
    /* stub */
  }
  removeEventListener() {
    /* stub */
  }
  dispatchEvent(): boolean {
    return true;
  }
}

// --- AudioContext mock ---

class MockAudioContext {
  sampleRate = 24000;
  currentTime = 0;
  destination = {};

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createScriptProcessor() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null as ((e: Record<string, unknown>) => void) | null,
    };
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      copyToChannel: vi.fn(),
      getChannelData: () => new Float32Array(length),
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  close() {
    return Promise.resolve();
  }
}

// --- MediaDevices mock ---

const mockTrack = {
  stop: vi.fn(),
  kind: "audio" as const,
  id: "mock-track",
  enabled: true,
  label: "Mock Microphone",
  muted: false,
  readyState: "live" as const,
};

const mockMediaStream = {
  getTracks: () => [mockTrack],
  getAudioTracks: () => [mockTrack],
  getVideoTracks: () => [],
  id: "mock-stream",
  active: true,
};

// --- Setup ---

let originalWebSocket: typeof globalThis.WebSocket;
let originalAudioContext: typeof globalThis.AudioContext;

beforeEach(() => {
  vi.clearAllMocks();
  MockWebSocket.instances = [];
  mockTrack.stop.mockClear();

  originalWebSocket = globalThis.WebSocket;
  originalAudioContext = globalThis.AudioContext;

  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
    },
    writable: true,
    configurable: true,
  });

  mocks.getAccessToken.mockReturnValue("test-jwt-token");
});

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
  globalThis.AudioContext = originalAudioContext;
});

// --- Utility tests ---

describe("floatTo16BitPCM", () => {
  it("converts silence (zeros) to zero PCM", () => {
    const input = new Float32Array([0, 0, 0]);
    const output = floatTo16BitPCM(input);
    expect(output).toEqual(new Int16Array([0, 0, 0]));
  });

  it("converts +1.0 to max positive PCM", () => {
    const output = floatTo16BitPCM(new Float32Array([1.0]));
    expect(output[0]).toBe(0x7fff);
  });

  it("converts -1.0 to max negative PCM", () => {
    const output = floatTo16BitPCM(new Float32Array([-1.0]));
    expect(output[0]).toBe(-0x8000);
  });

  it("clamps values beyond +/- 1.0", () => {
    const output = floatTo16BitPCM(new Float32Array([2.0, -2.0]));
    expect(output[0]).toBe(0x7fff);
    expect(output[1]).toBe(-0x8000);
  });
});

describe("arrayBufferToBase64", () => {
  it("encodes an empty buffer", () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe("");
  });

  it("round-trips with base64ToInt16Array", () => {
    const original = new Int16Array([100, -200, 300]);
    const b64 = arrayBufferToBase64(original.buffer);
    const decoded = base64ToInt16Array(b64);
    expect(decoded).toEqual(original);
  });
});

describe("base64ToInt16Array", () => {
  it("decodes base64 to Int16Array", () => {
    const original = new Int16Array([1000, -500]);
    const b64 = arrayBufferToBase64(original.buffer);
    const result = base64ToInt16Array(b64);
    expect(result[0]).toBe(1000);
    expect(result[1]).toBe(-500);
  });
});

// --- Hook tests ---

describe("useVoice", () => {
  // --- Initial state ---

  it("starts with idle status and no errors", () => {
    const { result } = renderHook(() => useVoice());
    expect(result.current.status).toBe("idle");
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.transcript).toBe("");
    expect(result.current.responseText).toBe("");
    expect(result.current.error).toBeNull();
  });

  // --- connect ---

  it("sets error when not authenticated", () => {
    mocks.getAccessToken.mockReturnValue(null);
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Not authenticated");
  });

  it("transitions to connecting then connected on WebSocket open", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    expect(result.current.status).toBe("connecting");
    expect(MockWebSocket.instances).toHaveLength(1);

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain("/ws/voice?token=test-jwt-token");

    act(() => {
      ws.simulateOpen();
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.isConnected).toBe(true);
  });

  it("does not create a second WebSocket if already connected", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.connect();
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("sets error on WebSocket error event", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateError();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("WebSocket connection failed");
  });

  it("handles close code 1008 as auth failure", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateClose(1008);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Authentication failed");
  });

  it("handles close code 1011 as server error", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateClose(1011);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Server error");
  });

  it("returns to idle on normal close", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateClose(1000);
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  // --- disconnect ---

  it("disconnect closes WebSocket and returns to idle", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  // --- Message handling ---

  it("updates transcript on transcription completed event", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({
          type: "conversation.item.input_audio_transcription.completed",
          transcript: "Hello Ralph",
        }),
      );
    });

    expect(result.current.transcript).toBe("Hello Ralph");
  });

  it("accumulates responseText on text delta events", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({ type: "response.text.delta", delta: "Hello " }),
      );
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({ type: "response.text.delta", delta: "world" }),
      );
    });

    expect(result.current.responseText).toBe("Hello world");
  });

  it("transitions to playing on audio delta", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    // Send a minimal valid base64 PCM chunk (2 bytes = 1 PCM16 sample)
    const pcm = new Int16Array([100]);
    const b64 = arrayBufferToBase64(pcm.buffer);

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({ type: "response.audio.delta", delta: b64 }),
      );
    });

    expect(result.current.status).toBe("playing");
  });

  it("transitions back to connected on response.done after playing", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    const pcm = new Int16Array([100]);
    const b64 = arrayBufferToBase64(pcm.buffer);

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({ type: "response.audio.delta", delta: b64 }),
      );
    });

    expect(result.current.status).toBe("playing");

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({ type: "response.done" }),
      );
    });

    expect(result.current.status).toBe("connected");
  });

  it("handles error events from the server", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({ type: "error", message: "API key missing" }),
      );
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("API key missing");
  });

  it("handles error events with nested error object", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({
          type: "error",
          error: { message: "Rate limited" },
        }),
      );
    });

    expect(result.current.error).toBe("Rate limited");
  });

  it("ignores non-JSON messages without error", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage("not json{{{");
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.error).toBeNull();
  });

  it("handles speech_started and speech_stopped events", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({ type: "input_audio_buffer.speech_started" }),
      );
    });

    expect(result.current.status).toBe("recording");

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({ type: "input_audio_buffer.speech_stopped" }),
      );
    });

    expect(result.current.status).toBe("processing");
  });

  // --- startRecording ---

  it("sets error if not connected when starting recording", async () => {
    const { result } = renderHook(() => useVoice());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.error).toBe("Not connected");
  });

  it("requests microphone and sets status to recording", async () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe("recording");
    expect(result.current.isRecording).toBe(true);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  });

  it("handles getUserMedia rejection", async () => {
    (navigator.mediaDevices.getUserMedia as Mock).mockRejectedValueOnce(
      new Error("Permission denied"),
    );

    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Permission denied");
  });

  // --- stopRecording ---

  it("sends commit message and transitions to processing", async () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
    });

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.status).toBe("processing");

    const commitMsg = ws.sent.find((m) => {
      const parsed = JSON.parse(m) as Record<string, unknown>;
      return parsed.type === "input_audio_buffer.commit";
    });
    expect(commitMsg).toBeDefined();
  });

  it("stops media tracks on stopRecording", async () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(mockTrack.stop).toHaveBeenCalled();
  });

  // --- connect resets transcript/responseText ---

  it("resets transcript and responseText on connect", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({
          type: "conversation.item.input_audio_transcription.completed",
          transcript: "old transcript",
        }),
      );
    });

    expect(result.current.transcript).toBe("old transcript");

    // Disconnect then reconnect
    act(() => {
      result.current.disconnect();
    });

    act(() => {
      result.current.connect();
    });

    expect(result.current.transcript).toBe("");
    expect(result.current.responseText).toBe("");
  });

  // --- URL construction ---

  it("constructs WS URL from VITE_API_URL with token", () => {
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.connect();
    });

    const ws = MockWebSocket.instances[0];
    // Default VITE_API_URL is undefined in test, fallback is http://localhost:8000
    expect(ws.url).toBe(
      "ws://localhost:8000/ws/voice?token=test-jwt-token",
    );
  });
});
