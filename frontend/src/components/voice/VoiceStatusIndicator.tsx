/**
 * VoiceStatusIndicator - Persistent top-bar element reflecting voice system state.
 *
 * States:
 *   idle             — hidden (no indicator shown)
 *   wake-listening   — ear icon with slow pulse, "Listening"
 *   connecting       — spinner icon, "Connecting"
 *   recording        — microphone icon with amber pulse ring, "Recording"
 *   processing       — dots animation, "Thinking"
 *   playing          — waveform bars, "Speaking"
 *   error            — warning icon, "Error"
 *
 * Consumes shared VoiceContext so it reflects the same state as PushToTalk
 * and WakeWordListener without creating duplicate connections.
 */

import { useVoiceContext } from "@/contexts/VoiceContext";

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

function WarnIcon({ className }: { className?: string }) {
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
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function MiniWaveform() {
  return (
    <span
      className="inline-flex items-center gap-[2px]"
      aria-hidden="true"
      data-testid="vsi-waveform"
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="inline-block w-[2px] rounded-full bg-[#F5A623]"
          style={{
            height: [8, 12, 6, 10][i],
            animation: `vsi-wave 0.7s ease-in-out ${i * 0.1}s infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}

function ThinkingDots() {
  return (
    <span
      className="inline-flex items-center gap-[3px]"
      aria-hidden="true"
      data-testid="vsi-dots"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-[4px] w-[4px] rounded-full bg-[#F5A623]"
          style={{
            animation: `vsi-bounce 1s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

// ─── Status Resolution ──────────────────────────────────────────────

type IndicatorState =
  | "idle"
  | "wake-listening"
  | "connecting"
  | "recording"
  | "processing"
  | "playing"
  | "error";

function resolveState(
  voiceStatus: string,
  wakeListening: boolean,
  wakeWordEnabled: boolean,
): IndicatorState {
  // Active voice states take priority.
  switch (voiceStatus) {
    case "recording":
      return "recording";
    case "processing":
      return "processing";
    case "playing":
      return "playing";
    case "connecting":
      return "connecting";
    case "error":
      return "error";
  }
  // Passive wake word listening.
  if (wakeWordEnabled && wakeListening) return "wake-listening";
  return "idle";
}

const LABELS: Record<IndicatorState, string> = {
  idle: "",
  "wake-listening": "Listening",
  connecting: "Connecting",
  recording: "Recording",
  processing: "Thinking",
  playing: "Speaking",
  error: "Error",
};

// ─── Component ──────────────────────────────────────────────────────

function VoiceStatusIndicator({ className }: { className?: string }) {
  const { voice, wakeWord, wakeWordEnabled } = useVoiceContext();
  const state = resolveState(voice.status, wakeWord.isListening, wakeWordEnabled);

  // Don't render anything when completely idle.
  if (state === "idle") return null;

  const label = LABELS[state];

  return (
    <div
      data-testid="voice-status-indicator"
      data-state={state}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all ${
        state === "error"
          ? "border-[#E84393]/30 bg-[#E84393]/10"
          : state === "recording"
            ? "border-[#F5A623]/40 bg-[#F5A623]/[0.12] shadow-[0_0_8px_rgba(245,166,35,0.15)]"
            : "border-[#F5A623]/20 bg-[#F5A623]/[0.06]"
      } ${className ?? ""}`}
      role="status"
      aria-live="polite"
      aria-label={`Voice: ${label}`}
    >
      {/* State icon */}
      <span
        data-testid="vsi-icon"
        className={`inline-flex ${
          state === "wake-listening"
            ? "animate-[vsi-ear-pulse_2.5s_ease-in-out_infinite]"
            : state === "recording"
              ? "animate-[vsi-rec-pulse_1.2s_ease-in-out_infinite]"
              : ""
        }`}
      >
        {state === "wake-listening" && (
          <EarIcon className="h-3.5 w-3.5 text-[#F5A623]/80" />
        )}
        {state === "connecting" && (
          <SpinnerIcon className="h-3.5 w-3.5 animate-spin text-[#F5A623]" />
        )}
        {state === "recording" && (
          <MicIcon className="h-3.5 w-3.5 text-[#F5A623]" />
        )}
        {state === "processing" && <ThinkingDots />}
        {state === "playing" && <MiniWaveform />}
        {state === "error" && (
          <WarnIcon className="h-3.5 w-3.5 text-[#E84393]" />
        )}
      </span>

      {/* Label */}
      <span
        data-testid="vsi-label"
        className={`font-mono text-[0.6rem] uppercase tracking-wider ${
          state === "error" ? "text-[#E84393]" : "text-[#F5A623]/80"
        }`}
      >
        {label}
      </span>

      {/* Recording live dot */}
      {state === "recording" && (
        <span
          data-testid="vsi-live-dot"
          className="h-[5px] w-[5px] rounded-full bg-[#F5A623] animate-[vsi-rec-dot_1s_ease-in-out_infinite]"
        />
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes vsi-wave {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
        @keyframes vsi-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
        @keyframes vsi-ear-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes vsi-rec-pulse {
          0%, 100% { filter: drop-shadow(0 0 0 transparent); }
          50% { filter: drop-shadow(0 0 4px rgba(245,166,35,0.5)); }
        }
        @keyframes vsi-rec-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default VoiceStatusIndicator;
