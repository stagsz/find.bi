import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import WakeWordListener from "./WakeWordListener";

// ─── Mock useVoice ──────────────────────────────────────────────────

const voiceMocks = vi.hoisted(() => ({
  connect: vi.fn() as Mock,
  disconnect: vi.fn() as Mock,
  startRecording: vi.fn() as Mock<() => Promise<void>>,
  stopRecording: vi.fn() as Mock,
  status: "idle" as string,
  isConnected: false,
  isRecording: false,
  isPlaying: false,
  transcript: "",
  responseText: "",
  error: null as string | null,
}));

vi.mock("@/hooks/useVoice", () => ({
  useVoice: () => ({
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
  }),
}));

// ─── Mock useWakeWord ───────────────────────────────────────────────

const wakeWordMocks = vi.hoisted(() => ({
  isListening: false,
  isSupported: true,
  enable: vi.fn() as Mock,
  disable: vi.fn() as Mock,
  toggle: vi.fn() as Mock,
}));

let capturedOnWakeWord: (() => void) | null = null;

vi.mock("@/hooks/useWakeWord", () => ({
  useWakeWord: ({ onWakeWord }: { onWakeWord: () => void }) => {
    capturedOnWakeWord = onWakeWord;
    return {
      isListening: wakeWordMocks.isListening,
      isSupported: wakeWordMocks.isSupported,
      enable: wakeWordMocks.enable,
      disable: wakeWordMocks.disable,
      toggle: wakeWordMocks.toggle,
    };
  },
}));

// ─── Setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnWakeWord = null;

  voiceMocks.status = "idle";
  voiceMocks.isConnected = false;
  voiceMocks.isRecording = false;
  voiceMocks.isPlaying = false;
  voiceMocks.transcript = "";
  voiceMocks.responseText = "";
  voiceMocks.error = null;
  voiceMocks.startRecording.mockResolvedValue(undefined);

  wakeWordMocks.isListening = false;
  wakeWordMocks.isSupported = true;
});

afterEach(() => {
  cleanup();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("WakeWordListener", () => {
  // ─── Rendering ──────────────────────────────────────────────────

  it("renders the container", () => {
    render(<WakeWordListener />);
    expect(screen.getByTestId("wake-word-listener")).toBeInTheDocument();
  });

  it("renders the toggle button", () => {
    render(<WakeWordListener />);
    expect(screen.getByTestId("wake-word-toggle")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<WakeWordListener className="mt-4" />);
    expect(screen.getByTestId("wake-word-listener")).toHaveClass("mt-4");
  });

  // ─── Initial state ─────────────────────────────────────────────

  it("shows 'Off' when not enabled", () => {
    render(<WakeWordListener />);
    expect(screen.getByTestId("wake-word-status")).toHaveTextContent("Off");
  });

  it("has correct aria-label when disabled", () => {
    render(<WakeWordListener />);
    expect(screen.getByTestId("wake-word-toggle")).toHaveAttribute(
      "aria-label",
      "Enable wake word detection",
    );
  });

  it("has aria-pressed=false when disabled", () => {
    render(<WakeWordListener />);
    expect(screen.getByTestId("wake-word-toggle")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  // ─── Toggle on/off ─────────────────────────────────────────────

  it("enables wake word on toggle click", () => {
    render(<WakeWordListener />);

    fireEvent.click(screen.getByTestId("wake-word-toggle"));

    expect(wakeWordMocks.enable).toHaveBeenCalledTimes(1);
  });

  it("disables wake word on second toggle click", () => {
    render(<WakeWordListener />);

    // Toggle on
    fireEvent.click(screen.getByTestId("wake-word-toggle"));
    wakeWordMocks.enable.mockClear();
    wakeWordMocks.disable.mockClear();

    // Toggle off
    fireEvent.click(screen.getByTestId("wake-word-toggle"));

    expect(wakeWordMocks.disable).toHaveBeenCalledTimes(1);
  });

  it("changes aria-label after toggle", () => {
    render(<WakeWordListener />);

    fireEvent.click(screen.getByTestId("wake-word-toggle"));

    expect(screen.getByTestId("wake-word-toggle")).toHaveAttribute(
      "aria-label",
      "Disable wake word detection",
    );
  });

  it("changes aria-pressed after toggle", () => {
    render(<WakeWordListener />);

    fireEvent.click(screen.getByTestId("wake-word-toggle"));

    expect(screen.getByTestId("wake-word-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  // ─── Status labels ─────────────────────────────────────────────

  it("shows 'Say \"Hey Ralph\"' when listening", () => {
    wakeWordMocks.isListening = true;
    render(<WakeWordListener />);

    // Need to toggle on first to show listening status
    fireEvent.click(screen.getByTestId("wake-word-toggle"));

    expect(screen.getByTestId("wake-word-status")).toHaveTextContent(
      'Say "Hey Ralph"',
    );
  });

  it("shows 'Not supported' when API unavailable", () => {
    wakeWordMocks.isSupported = false;
    render(<WakeWordListener />);

    expect(screen.getByTestId("wake-word-status")).toHaveTextContent(
      "Not supported",
    );
  });

  it("disables toggle button when unsupported", () => {
    wakeWordMocks.isSupported = false;
    render(<WakeWordListener />);

    expect(screen.getByTestId("wake-word-toggle")).toBeDisabled();
  });

  // ─── Wake word triggers voice ───────────────────────────────────

  it("connects voice when wake word detected and not connected", () => {
    voiceMocks.status = "idle";
    voiceMocks.isConnected = false;
    render(<WakeWordListener />);

    // Toggle on
    fireEvent.click(screen.getByTestId("wake-word-toggle"));

    // Simulate wake word detection
    act(() => {
      capturedOnWakeWord?.();
    });

    expect(voiceMocks.connect).toHaveBeenCalledTimes(1);
    expect(voiceMocks.startRecording).not.toHaveBeenCalled();
  });

  it("starts recording when wake word detected and already connected", () => {
    voiceMocks.status = "connected";
    voiceMocks.isConnected = true;
    render(<WakeWordListener />);

    // Toggle on
    fireEvent.click(screen.getByTestId("wake-word-toggle"));

    // Simulate wake word detection
    act(() => {
      capturedOnWakeWord?.();
    });

    expect(voiceMocks.startRecording).toHaveBeenCalledTimes(1);
    expect(voiceMocks.connect).not.toHaveBeenCalled();
  });

  // ─── Icon switching ─────────────────────────────────────────────

  it("shows ear icon when not voice active", () => {
    render(<WakeWordListener />);

    const icon = screen.getByTestId("wake-word-icon");
    // Ear icon has the outer ear path
    expect(icon.querySelector("svg")).toBeInTheDocument();
  });

  // ─── Switch visual ─────────────────────────────────────────────

  it("renders the toggle switch element", () => {
    render(<WakeWordListener />);
    expect(screen.getByTestId("wake-word-switch")).toBeInTheDocument();
  });
});
