/**
 * PushToTalk - Hold-to-record voice button with visual status indicators.
 *
 * States:
 *   idle       — static microphone icon, ready to record
 *   connecting — connecting spinner overlay
 *   connected  — mic icon with subtle glow, ready to hold
 *   recording  — pulsing amber ring while capturing audio
 *   processing — spinner while server processes transcript
 *   playing    — animated waveform bars while Ralph speaks
 *   error      — error state with message
 *
 * Integrates with useVoice hook for WebSocket voice streaming.
 */

import { useCallback, useEffect, useRef } from "react";
import { useVoice } from "@/hooks/useVoice";
import type { VoiceStatus } from "@/hooks/useVoice";

interface PushToTalkProps {
  className?: string;
}

// ─── Inline SVG Icons ───────────────────────────────────────────────

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="1" width="6" height="11" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function WaveformBars() {
  return (
    <div
      className="flex items-center justify-center gap-[3px]"
      aria-hidden="true"
      data-testid="waveform-bars"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="inline-block w-[3px] rounded-full bg-[#F5A623]"
          style={{
            height: [14, 20, 10, 18, 12][i],
            animation: `ptt-wave 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Status Helpers ─────────────────────────────────────────────────

function statusLabel(status: VoiceStatus): string {
  switch (status) {
    case "idle":
      return "Hold to talk";
    case "connecting":
      return "Connecting...";
    case "connected":
      return "Hold to talk";
    case "recording":
      return "Listening...";
    case "processing":
      return "Ralph is thinking...";
    case "playing":
      return "Ralph is speaking...";
    case "error":
      return "Something went wrong";
  }
}

// ─── Component ──────────────────────────────────────────────────────

function PushToTalk({ className }: PushToTalkProps) {
  const {
    status,
    isConnected,
    isRecording,
    transcript,
    responseText,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  } = useVoice();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const holdActiveRef = useRef(false);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = useCallback(() => {
    holdActiveRef.current = true;
    if (!isConnected) {
      connect();
      return;
    }
    void startRecording();
  }, [isConnected, connect, startRecording]);

  const handlePointerUp = useCallback(() => {
    if (!holdActiveRef.current) return;
    holdActiveRef.current = false;
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  // Release recording if pointer leaves the button
  const handlePointerLeave = useCallback(() => {
    if (holdActiveRef.current && isRecording) {
      holdActiveRef.current = false;
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  // Ensure recording stops on global pointer up (in case pointer leaves button)
  useEffect(() => {
    const handleGlobalUp = () => {
      if (holdActiveRef.current && isRecording) {
        holdActiveRef.current = false;
        stopRecording();
      }
    };
    window.addEventListener("pointerup", handleGlobalUp);
    return () => window.removeEventListener("pointerup", handleGlobalUp);
  }, [isRecording, stopRecording]);

  const isDisabled = status === "processing" || status === "playing";

  // Button visual state classes
  const ringClass =
    status === "recording"
      ? "shadow-[0_0_0_4px_rgba(245,166,35,0.3)] border-[#F5A623]"
      : status === "playing"
        ? "border-[#F5A623]/60"
        : status === "error"
          ? "border-[#E84393]/50"
          : isConnected
            ? "border-[#F5A623]/40 hover:border-[#F5A623]/70 hover:shadow-[0_0_12px_rgba(245,166,35,0.15)]"
            : "border-[#2A2A2A] hover:border-[#F5A623]/30";

  return (
    <div
      data-testid="push-to-talk"
      className={`flex flex-col items-center gap-3 ${className ?? ""}`}
    >
      {/* Main button */}
      <button
        ref={buttonRef}
        type="button"
        data-testid="ptt-button"
        aria-label={statusLabel(status)}
        disabled={isDisabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-[#141414] transition-all select-none ${ringClass} ${
          isDisabled ? "cursor-default opacity-80" : "cursor-pointer active:scale-95"
        } ${status === "recording" ? "animate-[ptt-pulse_1.5s_ease-in-out_infinite]" : ""}`}
      >
        {/* Icon based on status */}
        {status === "processing" || status === "connecting" ? (
          <SpinnerIcon className="h-6 w-6 animate-spin text-[#F5A623]" />
        ) : status === "playing" ? (
          <WaveformBars />
        ) : (
          <MicIcon
            className={`h-6 w-6 transition-colors ${
              status === "recording"
                ? "text-[#F5A623]"
                : status === "error"
                  ? "text-[#E84393]"
                  : isConnected
                    ? "text-[#F5A623]/80"
                    : "text-[#6B6860]"
            }`}
          />
        )}
      </button>

      {/* Status label */}
      <span
        data-testid="ptt-status"
        className={`font-mono text-[0.65rem] uppercase tracking-wider ${
          status === "error" ? "text-[#E84393]" : "text-[#6B6860]"
        }`}
      >
        {statusLabel(status)}
      </span>

      {/* Error message */}
      {error && status === "error" && (
        <div
          data-testid="ptt-error"
          className="w-full max-w-xs rounded-md border border-[#E84393]/30 bg-[#E84393]/10 px-3 py-2"
        >
          <p className="text-center font-mono text-[0.65rem] text-[#E84393]">
            {error}
          </p>
        </div>
      )}

      {/* Transcript (what the user said) */}
      {transcript && (
        <div
          data-testid="ptt-transcript"
          className="w-full max-w-xs rounded-md border border-[#2A2A2A] bg-[#141414] px-3 py-2"
        >
          <p className="mb-1 font-mono text-[0.55rem] uppercase tracking-wider text-[#6B6860]">
            You said
          </p>
          <p className="text-[0.8rem] leading-relaxed text-[#F0EDE4]">
            {transcript}
          </p>
        </div>
      )}

      {/* Response text (what Ralph said) */}
      {responseText && (
        <div
          data-testid="ptt-response"
          className="w-full max-w-xs rounded-md border border-[#F5A623]/20 bg-[#F5A623]/5 px-3 py-2"
        >
          <p className="mb-1 font-mono text-[0.55rem] uppercase tracking-wider text-[#F5A623]/60">
            Ralph
          </p>
          <p className="text-[0.8rem] leading-relaxed text-[#F0EDE4]">
            {responseText}
          </p>
        </div>
      )}

      {/* Keyframe animations injected via style tag */}
      <style>{`
        @keyframes ptt-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(245,166,35,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(245,166,35,0.1); }
        }
        @keyframes ptt-wave {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

export type { PushToTalkProps };
export default PushToTalk;
