import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import PushToTalk from "./PushToTalk";

// ─── Mock useVoice ──────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
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
    status: mocks.status,
    isConnected: mocks.isConnected,
    isRecording: mocks.isRecording,
    isPlaying: mocks.isPlaying,
    transcript: mocks.transcript,
    responseText: mocks.responseText,
    error: mocks.error,
    connect: mocks.connect,
    disconnect: mocks.disconnect,
    startRecording: mocks.startRecording,
    stopRecording: mocks.stopRecording,
  }),
}));

// ─── Setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status = "idle";
  mocks.isConnected = false;
  mocks.isRecording = false;
  mocks.isPlaying = false;
  mocks.transcript = "";
  mocks.responseText = "";
  mocks.error = null;
  mocks.startRecording.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("PushToTalk", () => {
  it("renders the push-to-talk container", () => {
    render(<PushToTalk />);
    expect(screen.getByTestId("push-to-talk")).toBeInTheDocument();
  });

  it("renders the main button", () => {
    render(<PushToTalk />);
    expect(screen.getByTestId("ptt-button")).toBeInTheDocument();
  });

  it("calls connect on mount", () => {
    render(<PushToTalk />);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  it("calls disconnect on unmount", () => {
    const { unmount } = render(<PushToTalk />);
    unmount();
    expect(mocks.disconnect).toHaveBeenCalled();
  });

  // ─── Idle state ─────────────────────────────────────────────────

  it("shows 'Hold to talk' label when idle", () => {
    render(<PushToTalk />);
    expect(screen.getByTestId("ptt-status")).toHaveTextContent("Hold to talk");
  });

  it("has aria-label matching status", () => {
    render(<PushToTalk />);
    expect(screen.getByTestId("ptt-button")).toHaveAttribute(
      "aria-label",
      "Hold to talk",
    );
  });

  // ─── Connected state ───────────────────────────────────────────

  it("calls startRecording on pointerdown when connected", () => {
    mocks.status = "connected";
    mocks.isConnected = true;
    render(<PushToTalk />);

    fireEvent.pointerDown(screen.getByTestId("ptt-button"));
    expect(mocks.startRecording).toHaveBeenCalledTimes(1);
  });

  it("calls connect on pointerdown when not connected", () => {
    mocks.status = "idle";
    mocks.isConnected = false;
    // connect is called on mount, clear it
    render(<PushToTalk />);
    mocks.connect.mockClear();

    fireEvent.pointerDown(screen.getByTestId("ptt-button"));
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.startRecording).not.toHaveBeenCalled();
  });

  // ─── Recording state ──────────────────────────────────────────

  it("calls stopRecording on pointerup while recording", () => {
    mocks.status = "recording";
    mocks.isConnected = true;
    mocks.isRecording = true;
    render(<PushToTalk />);

    const btn = screen.getByTestId("ptt-button");
    fireEvent.pointerDown(btn);
    fireEvent.pointerUp(btn);

    expect(mocks.stopRecording).toHaveBeenCalledTimes(1);
  });

  it("calls stopRecording on pointerleave while recording", () => {
    mocks.status = "recording";
    mocks.isConnected = true;
    mocks.isRecording = true;
    render(<PushToTalk />);

    const btn = screen.getByTestId("ptt-button");
    fireEvent.pointerDown(btn);
    fireEvent.pointerLeave(btn);

    expect(mocks.stopRecording).toHaveBeenCalledTimes(1);
  });

  it("shows 'Listening...' label when recording", () => {
    mocks.status = "recording";
    mocks.isConnected = true;
    mocks.isRecording = true;
    render(<PushToTalk />);

    expect(screen.getByTestId("ptt-status")).toHaveTextContent("Listening...");
  });

  // ─── Processing state ─────────────────────────────────────────

  it("shows 'Ralph is thinking...' when processing", () => {
    mocks.status = "processing";
    mocks.isConnected = true;
    render(<PushToTalk />);

    expect(screen.getByTestId("ptt-status")).toHaveTextContent(
      "Ralph is thinking...",
    );
  });

  it("disables button when processing", () => {
    mocks.status = "processing";
    mocks.isConnected = true;
    render(<PushToTalk />);

    expect(screen.getByTestId("ptt-button")).toBeDisabled();
  });

  // ─── Playing state ────────────────────────────────────────────

  it("shows waveform bars when playing", () => {
    mocks.status = "playing";
    mocks.isConnected = true;
    mocks.isPlaying = true;
    render(<PushToTalk />);

    expect(screen.getByTestId("waveform-bars")).toBeInTheDocument();
  });

  it("shows 'Ralph is speaking...' when playing", () => {
    mocks.status = "playing";
    mocks.isConnected = true;
    mocks.isPlaying = true;
    render(<PushToTalk />);

    expect(screen.getByTestId("ptt-status")).toHaveTextContent(
      "Ralph is speaking...",
    );
  });

  it("disables button when playing", () => {
    mocks.status = "playing";
    mocks.isConnected = true;
    mocks.isPlaying = true;
    render(<PushToTalk />);

    expect(screen.getByTestId("ptt-button")).toBeDisabled();
  });

  // ─── Error state ──────────────────────────────────────────────

  it("shows error message when in error state", () => {
    mocks.status = "error";
    mocks.error = "Microphone permission denied";
    render(<PushToTalk />);

    expect(screen.getByTestId("ptt-error")).toHaveTextContent(
      "Microphone permission denied",
    );
  });

  it("shows 'Something went wrong' label on error", () => {
    mocks.status = "error";
    mocks.error = "Connection failed";
    render(<PushToTalk />);

    expect(screen.getByTestId("ptt-status")).toHaveTextContent(
      "Something went wrong",
    );
  });

  // ─── Transcript & Response ────────────────────────────────────

  it("displays transcript when available", () => {
    mocks.status = "connected";
    mocks.isConnected = true;
    mocks.transcript = "What are the top 10 customers?";
    render(<PushToTalk />);

    const transcriptEl = screen.getByTestId("ptt-transcript");
    expect(transcriptEl).toHaveTextContent("What are the top 10 customers?");
    expect(transcriptEl).toHaveTextContent("You said");
  });

  it("does not show transcript when empty", () => {
    mocks.transcript = "";
    render(<PushToTalk />);

    expect(screen.queryByTestId("ptt-transcript")).not.toBeInTheDocument();
  });

  it("displays response text when available", () => {
    mocks.status = "connected";
    mocks.isConnected = true;
    mocks.responseText = "Here are the top 10 customers by revenue.";
    render(<PushToTalk />);

    const responseEl = screen.getByTestId("ptt-response");
    expect(responseEl).toHaveTextContent(
      "Here are the top 10 customers by revenue.",
    );
    expect(responseEl).toHaveTextContent("Ralph");
  });

  it("does not show response when empty", () => {
    mocks.responseText = "";
    render(<PushToTalk />);

    expect(screen.queryByTestId("ptt-response")).not.toBeInTheDocument();
  });

  // ─── CSS class prop ───────────────────────────────────────────

  it("applies custom className", () => {
    render(<PushToTalk className="mt-8" />);
    expect(screen.getByTestId("push-to-talk")).toHaveClass("mt-8");
  });

  // ─── Connecting state ─────────────────────────────────────────

  it("shows 'Connecting...' label when connecting", () => {
    mocks.status = "connecting";
    render(<PushToTalk />);

    expect(screen.getByTestId("ptt-status")).toHaveTextContent("Connecting...");
  });
});
