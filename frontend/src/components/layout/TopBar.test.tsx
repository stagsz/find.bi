import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TopBar from "./TopBar";

// ─── Mock VoiceContext (used by VoiceStatusIndicator) ───────────────

vi.mock("@/contexts/VoiceContext", () => ({
  useVoiceContext: () => ({
    voice: {
      status: "idle",
      isConnected: false,
      isRecording: false,
      isPlaying: false,
      transcript: "",
      responseText: "",
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    },
    wakeWord: {
      isListening: false,
      isSupported: true,
      enable: vi.fn(),
      disable: vi.fn(),
      toggle: vi.fn(),
    },
    wakeWordEnabled: false,
    setWakeWordEnabled: vi.fn(),
  }),
}));

function renderTopBar(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <TopBar />
    </MemoryRouter>
  );
}

describe("TopBar", () => {
  it("shows Home title on root route", () => {
    renderTopBar("/");
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("shows SQL Editor title on editor route", () => {
    renderTopBar("/editor");
    expect(screen.getByText("SQL Editor")).toBeInTheDocument();
  });

  it("shows Upload Data title on upload route", () => {
    renderTopBar("/upload");
    expect(screen.getByText("Upload Data")).toBeInTheDocument();
  });

  it("shows Dashboard title on dashboard route", () => {
    renderTopBar("/dashboard/abc-123");
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("does not show voice indicator when idle", () => {
    renderTopBar("/");
    expect(screen.queryByTestId("voice-status-indicator")).not.toBeInTheDocument();
  });
});
