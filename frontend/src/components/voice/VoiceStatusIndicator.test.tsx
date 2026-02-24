import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import VoiceStatusIndicator from "./VoiceStatusIndicator";

// ─── Mock VoiceContext ──────────────────────────────────────────────

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

const contextMocks = vi.hoisted(() => ({
  wakeWordEnabled: false,
  setWakeWordEnabled: vi.fn() as Mock,
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
    wakeWordEnabled: contextMocks.wakeWordEnabled,
    setWakeWordEnabled: contextMocks.setWakeWordEnabled,
  }),
}));

// ─── Setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  voiceMocks.status = "idle";
  voiceMocks.isConnected = false;
  voiceMocks.isRecording = false;
  voiceMocks.isPlaying = false;
  voiceMocks.transcript = "";
  voiceMocks.responseText = "";
  voiceMocks.error = null;
  wakeWordMocks.isListening = false;
  wakeWordMocks.isSupported = true;
  contextMocks.wakeWordEnabled = false;
});

afterEach(() => {
  cleanup();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("VoiceStatusIndicator", () => {
  it("renders nothing when idle and wake word off", () => {
    const { container } = render(<VoiceStatusIndicator />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when idle and wake word enabled but not listening", () => {
    contextMocks.wakeWordEnabled = true;
    wakeWordMocks.isListening = false;
    const { container } = render(<VoiceStatusIndicator />);
    expect(container.innerHTML).toBe("");
  });

  // ─── Wake Word Listening ────────────────────────────────────────

  it("shows ear icon and 'Listening' when wake word is active", () => {
    contextMocks.wakeWordEnabled = true;
    wakeWordMocks.isListening = true;
    render(<VoiceStatusIndicator />);

    const indicator = screen.getByTestId("voice-status-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-state", "wake-listening");
    expect(screen.getByTestId("vsi-label")).toHaveTextContent("Listening");
  });

  it("has role=status for accessibility", () => {
    contextMocks.wakeWordEnabled = true;
    wakeWordMocks.isListening = true;
    render(<VoiceStatusIndicator />);

    const indicator = screen.getByTestId("voice-status-indicator");
    expect(indicator).toHaveAttribute("role", "status");
    expect(indicator).toHaveAttribute("aria-live", "polite");
  });

  // ─── Connecting ────────────────────────────────────────────────

  it("shows spinner and 'Connecting' when voice is connecting", () => {
    voiceMocks.status = "connecting";
    render(<VoiceStatusIndicator />);

    const indicator = screen.getByTestId("voice-status-indicator");
    expect(indicator).toHaveAttribute("data-state", "connecting");
    expect(screen.getByTestId("vsi-label")).toHaveTextContent("Connecting");
  });

  // ─── Recording ─────────────────────────────────────────────────

  it("shows mic icon, 'Recording' label, and live dot when recording", () => {
    voiceMocks.status = "recording";
    voiceMocks.isRecording = true;
    render(<VoiceStatusIndicator />);

    const indicator = screen.getByTestId("voice-status-indicator");
    expect(indicator).toHaveAttribute("data-state", "recording");
    expect(screen.getByTestId("vsi-label")).toHaveTextContent("Recording");
    expect(screen.getByTestId("vsi-live-dot")).toBeInTheDocument();
  });

  // ─── Processing ────────────────────────────────────────────────

  it("shows thinking dots and 'Thinking' when processing", () => {
    voiceMocks.status = "processing";
    render(<VoiceStatusIndicator />);

    const indicator = screen.getByTestId("voice-status-indicator");
    expect(indicator).toHaveAttribute("data-state", "processing");
    expect(screen.getByTestId("vsi-label")).toHaveTextContent("Thinking");
    expect(screen.getByTestId("vsi-dots")).toBeInTheDocument();
  });

  // ─── Playing ───────────────────────────────────────────────────

  it("shows waveform and 'Speaking' when playing", () => {
    voiceMocks.status = "playing";
    voiceMocks.isPlaying = true;
    render(<VoiceStatusIndicator />);

    const indicator = screen.getByTestId("voice-status-indicator");
    expect(indicator).toHaveAttribute("data-state", "playing");
    expect(screen.getByTestId("vsi-label")).toHaveTextContent("Speaking");
    expect(screen.getByTestId("vsi-waveform")).toBeInTheDocument();
  });

  // ─── Error ─────────────────────────────────────────────────────

  it("shows warning icon and 'Error' on error state", () => {
    voiceMocks.status = "error";
    voiceMocks.error = "Connection lost";
    render(<VoiceStatusIndicator />);

    const indicator = screen.getByTestId("voice-status-indicator");
    expect(indicator).toHaveAttribute("data-state", "error");
    expect(screen.getByTestId("vsi-label")).toHaveTextContent("Error");
  });

  it("applies error styling on error state", () => {
    voiceMocks.status = "error";
    render(<VoiceStatusIndicator />);

    const label = screen.getByTestId("vsi-label");
    expect(label.className).toContain("text-[#E84393]");
  });

  // ─── Priority: voice status overrides wake word ────────────────

  it("shows recording even when wake word is also listening", () => {
    contextMocks.wakeWordEnabled = true;
    wakeWordMocks.isListening = true;
    voiceMocks.status = "recording";
    voiceMocks.isRecording = true;
    render(<VoiceStatusIndicator />);

    const indicator = screen.getByTestId("voice-status-indicator");
    expect(indicator).toHaveAttribute("data-state", "recording");
  });

  it("shows processing even when wake word is enabled", () => {
    contextMocks.wakeWordEnabled = true;
    wakeWordMocks.isListening = false;
    voiceMocks.status = "processing";
    render(<VoiceStatusIndicator />);

    const indicator = screen.getByTestId("voice-status-indicator");
    expect(indicator).toHaveAttribute("data-state", "processing");
  });

  // ─── className prop ────────────────────────────────────────────

  it("forwards className when visible", () => {
    voiceMocks.status = "recording";
    render(<VoiceStatusIndicator className="ml-2" />);

    const indicator = screen.getByTestId("voice-status-indicator");
    expect(indicator.className).toContain("ml-2");
  });

  // ─── No live dot outside recording ────────────────────────────

  it("does not show live dot when not recording", () => {
    voiceMocks.status = "playing";
    render(<VoiceStatusIndicator />);
    expect(screen.queryByTestId("vsi-live-dot")).not.toBeInTheDocument();
  });
});
