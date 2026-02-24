/**
 * NarrationPlayback - Dashboard narration controls with segment display.
 *
 * A docked control bar that appears during narration playback, showing:
 *   - Play/Pause, Stop, Previous, Next controls
 *   - Current segment title and narration text
 *   - Progress indicator (segment X of Y)
 *   - Segment timeline dots
 *
 * Aesthetic: retro-futuristic editorial, amber-on-dark, monospace labels.
 */

import { useNarration } from "@/hooks/useNarration";
import type { NarrationStatus } from "@/contexts/NarrationContext";

// ─── Inline SVG Icons ───────────────────────────────────────────────

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function PrevIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
    </svg>
  );
}

function NextIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16 6h2v12h-2V6zm-1.5 6-8.5 6V6l8.5 6z" />
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

// ─── Status Helpers ─────────────────────────────────────────────────

function statusLabel(status: NarrationStatus): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "loading":
      return "Generating narration...";
    case "playing":
      return "Narrating";
    case "paused":
      return "Paused";
    case "error":
      return "Error";
  }
}

// ─── Component ──────────────────────────────────────────────────────

function NarrationPlayback() {
  const {
    status,
    isPlaying,
    isLoading,
    currentSegment,
    segments,
    progress,
    error,
    pause,
    resume,
    stop,
    next,
    previous,
  } = useNarration();

  // Don't render if idle and no segments
  if (status === "idle" && segments.length === 0) {
    return null;
  }

  const canPrevious = progress.current > 1;
  const canNext = progress.current < progress.total;

  return (
    <div
      data-testid="narration-playback"
      className="border-t border-[#2A2A2A] bg-[#0D0D0D]"
    >
      {/* Progress track */}
      {segments.length > 0 && (
        <div
          data-testid="narration-progress-bar"
          className="h-[2px] w-full bg-[#1A1A1A]"
        >
          <div
            className="h-full bg-[#F5A623] transition-all duration-500"
            style={{
              width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-4 px-4 py-3">
        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Previous */}
          <button
            type="button"
            data-testid="narration-prev"
            disabled={!canPrevious || isLoading}
            onClick={previous}
            aria-label="Previous segment"
            className="rounded-md p-1.5 text-[#6B6860] transition-colors hover:text-[#F5A623] disabled:opacity-30 disabled:hover:text-[#6B6860]"
          >
            <PrevIcon className="h-4 w-4" />
          </button>

          {/* Play/Pause */}
          {isLoading ? (
            <div
              data-testid="narration-loading"
              className="flex h-9 w-9 items-center justify-center"
            >
              <SpinnerIcon className="h-5 w-5 animate-spin text-[#F5A623]" />
            </div>
          ) : (
            <button
              type="button"
              data-testid="narration-play-pause"
              onClick={isPlaying ? pause : resume}
              disabled={status === "idle" || status === "error"}
              aria-label={isPlaying ? "Pause narration" : "Resume narration"}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F5A623]/40 bg-[#F5A623]/10 text-[#F5A623] transition-all hover:bg-[#F5A623]/20 hover:shadow-[0_0_12px_rgba(245,166,35,0.15)] disabled:opacity-30"
            >
              {isPlaying ? (
                <PauseIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Next */}
          <button
            type="button"
            data-testid="narration-next"
            disabled={!canNext || isLoading}
            onClick={next}
            aria-label="Next segment"
            className="rounded-md p-1.5 text-[#6B6860] transition-colors hover:text-[#F5A623] disabled:opacity-30 disabled:hover:text-[#6B6860]"
          >
            <NextIcon className="h-4 w-4" />
          </button>

          {/* Stop */}
          <button
            type="button"
            data-testid="narration-stop"
            onClick={stop}
            aria-label="Stop narration"
            className="rounded-md p-1.5 text-[#6B6860] transition-colors hover:text-[#E84393] disabled:opacity-30"
          >
            <StopIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Segment info */}
        <div className="min-w-0 flex-1">
          {error ? (
            <p
              data-testid="narration-error"
              className="truncate font-mono text-[0.7rem] text-[#E84393]"
            >
              {error}
            </p>
          ) : currentSegment ? (
            <div className="min-w-0">
              <p
                data-testid="narration-segment-title"
                className="truncate text-[0.8rem] font-medium text-[#F0EDE4]"
              >
                {currentSegment.title}
              </p>
              <p
                data-testid="narration-segment-text"
                className="mt-0.5 line-clamp-1 text-[0.7rem] leading-snug text-[#6B6860]"
              >
                {currentSegment.narration}
              </p>
            </div>
          ) : isLoading ? (
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860]">
              {statusLabel(status)}
            </p>
          ) : null}
        </div>

        {/* Segment counter & timeline dots */}
        {segments.length > 0 && (
          <div className="flex flex-shrink-0 items-center gap-3">
            {/* Dots timeline (max 10 visible) */}
            <div
              data-testid="narration-dots"
              className="hidden items-center gap-1 sm:flex"
            >
              {segments.slice(0, 10).map((seg, idx) => (
                <span
                  key={seg.card_id}
                  className={`inline-block h-1.5 w-1.5 rounded-full transition-all ${
                    idx === progress.current - 1
                      ? "scale-125 bg-[#F5A623]"
                      : idx < progress.current - 1
                        ? "bg-[#F5A623]/40"
                        : "bg-[#2A2A2A]"
                  }`}
                />
              ))}
            </div>

            {/* Counter */}
            <span
              data-testid="narration-counter"
              className="font-mono text-[0.65rem] tabular-nums text-[#6B6860]"
            >
              {progress.current}/{progress.total}
            </span>
          </div>
        )}
      </div>

      {/* Keyframe for the loading pulse */}
      <style>{`
        @keyframes narration-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default NarrationPlayback;
