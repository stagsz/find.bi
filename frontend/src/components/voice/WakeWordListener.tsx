/**
 * WakeWordListener - Continuous "Hey Ralph" detection with toggle control.
 *
 * Uses the Web Speech API for passive speech recognition. When the wake
 * phrase is detected, it automatically connects to the voice backend and
 * starts recording. After the voice interaction completes, wake word
 * listening resumes.
 *
 * States:
 *   off          — toggle disabled, not listening
 *   listening    — Web Speech API running, waiting for "Hey Ralph"
 *   activating   — wake word detected, connecting voice
 *   recording    — microphone active, user speaking
 *   processing   — server processing transcript
 *   playing      — Ralph speaking response
 *   unsupported  — browser lacks Web Speech API
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useWakeWord } from "@/hooks/useWakeWord";
import { useVoice } from "@/hooks/useVoice";
import type { VoiceStatus } from "@/hooks/useVoice";

interface WakeWordListenerProps {
  className?: string;
}

const RESUME_DELAY_MS = 1500;

// ─── Inline SVG Icons ───────────────────────────────────────────────

function EarIcon({ className }: { className?: string }) {
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
      <path d="M6 8.5a6 6 0 0 1 12 0c0 6-6 5.5-6 11" />
      <path d="M14.5 8.5a2.5 2.5 0 0 0-5 0v.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

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

// ─── Status Helpers ─────────────────────────────────────────────────

function getStatusLabel(
  enabled: boolean,
  isSupported: boolean,
  isWakeListening: boolean,
  triggered: boolean,
  voiceStatus: VoiceStatus,
): string {
  if (!isSupported) return "Not supported";
  if (!enabled) return "Off";
  if (triggered) {
    switch (voiceStatus) {
      case "recording":
        return "Listening...";
      case "processing":
        return "Thinking...";
      case "playing":
        return "Speaking...";
      case "connecting":
        return "Connecting...";
      default:
        return "Activating...";
    }
  }
  if (isWakeListening) return 'Say "Hey Ralph"';
  return "Starting...";
}

// ─── Component ──────────────────────────────────────────────────────

function WakeWordListener({ className }: WakeWordListenerProps) {
  const [enabled, setEnabled] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const voice = useVoice();
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const {
    status: voiceStatus,
    startRecording,
    disconnect: voiceDisconnect,
  } = voice;

  const prevStatusRef = useRef<VoiceStatus>(voiceStatus);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Stable ref for re-enabling wake word inside timeouts.
  const enableWakeWordRef = useRef<() => void>(() => {});

  const handleWakeWord = useCallback(() => {
    setTriggered(true);
    const v = voiceRef.current;
    if (v.isConnected) {
      void v.startRecording();
    } else {
      v.connect();
    }
  }, []);

  const {
    isListening: wakeIsListening,
    isSupported: wakeIsSupported,
    enable: enableWakeWord,
    disable: disableWakeWord,
  } = useWakeWord({ onWakeWord: handleWakeWord });
  enableWakeWordRef.current = enableWakeWord;

  // Sync toggle state with the wake word hook.
  useEffect(() => {
    if (enabled) {
      enableWakeWord();
    } else {
      disableWakeWord();
      setTriggered(false);
      clearTimeout(resumeTimerRef.current);
    }
  }, [enabled, enableWakeWord, disableWakeWord]);

  // React to voice status transitions for the wake-word-triggered flow.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = voiceStatus;

    if (!triggered) return;

    // Connection established after wake word → begin recording.
    if (voiceStatus === "connected" && prev === "connecting") {
      void startRecording();
      return;
    }

    // Voice interaction complete → disconnect and schedule resume.
    if (
      voiceStatus === "connected" &&
      (prev === "playing" || prev === "processing")
    ) {
      voiceDisconnect();
      setTriggered(false);
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        if (enabledRef.current) enableWakeWordRef.current();
      }, RESUME_DELAY_MS);
      return;
    }

    // Error during voice interaction → reset and retry.
    if (voiceStatus === "error") {
      setTriggered(false);
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        if (enabledRef.current) enableWakeWordRef.current();
      }, RESUME_DELAY_MS);
    }
  }, [voiceStatus, triggered, startRecording, voiceDisconnect]);

  // Cleanup timers on unmount.
  useEffect(() => () => clearTimeout(resumeTimerRef.current), []);

  const toggleEnabled = useCallback(() => setEnabled((p) => !p), []);

  const isVoiceActive =
    triggered &&
    (voiceStatus === "recording" ||
      voiceStatus === "processing" ||
      voiceStatus === "playing");

  const statusText = getStatusLabel(
    enabled,
    wakeIsSupported,
    wakeIsListening,
    triggered,
    voiceStatus,
  );

  return (
    <div
      data-testid="wake-word-listener"
      className={`inline-flex flex-col items-start ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={toggleEnabled}
        disabled={!wakeIsSupported}
        data-testid="wake-word-toggle"
        aria-label={
          enabled ? "Disable wake word detection" : "Enable wake word detection"
        }
        aria-pressed={enabled}
        className={`flex items-center gap-2.5 rounded-full border px-3.5 py-2 font-mono text-[0.7rem] uppercase tracking-wider transition-all ${
          !wakeIsSupported
            ? "cursor-not-allowed border-[#2A2A2A] text-[#4A4A4A] opacity-40"
            : enabled
              ? "cursor-pointer border-[#F5A623]/25 bg-[#F5A623]/[0.08] text-[#F5A623] hover:border-[#F5A623]/40"
              : "cursor-pointer border-[#3A3A3A] bg-[#2A2A2A] text-[#6B6860] hover:border-[#6B6860] hover:text-[#8A8880]"
        }`}
      >
        {/* Icon: ear when passively listening, mic when voice is active */}
        <span
          data-testid="wake-word-icon"
          className={`inline-flex ${
            wakeIsListening ? "animate-[ww-glow_2.5s_ease-in-out_infinite]" : ""
          }`}
        >
          {isVoiceActive ? (
            <MicIcon className="h-4 w-4" />
          ) : (
            <EarIcon className="h-4 w-4" />
          )}
        </span>

        {/* Status text */}
        <span data-testid="wake-word-status" className="whitespace-nowrap">
          {statusText}
        </span>

        {/* Toggle switch */}
        <span
          data-testid="wake-word-switch"
          className={`relative h-[18px] w-[34px] flex-shrink-0 rounded-full transition-colors ${
            enabled ? "bg-[#F5A623]" : "bg-[#4A4A4A]"
          }`}
        >
          <span
            className={`absolute top-[2px] h-[14px] w-[14px] rounded-full transition-all ${
              enabled
                ? "left-[18px] bg-[#141414] shadow-[0_0_6px_rgba(245,166,35,0.4)]"
                : "left-[2px] bg-[#6B6860]"
            }`}
          />
        </span>
      </button>

      {/* Keyframe animations */}
      <style>{`
        @keyframes ww-glow {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 0 transparent); }
          50% { opacity: 0.7; filter: drop-shadow(0 0 4px rgba(245,166,35,0.5)); }
        }
      `}</style>
    </div>
  );
}

export type { WakeWordListenerProps };
export default WakeWordListener;
