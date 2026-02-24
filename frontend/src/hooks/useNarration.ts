/**
 * useNarration - Convenience hook for dashboard narration playback.
 *
 * Wraps NarrationContext to provide a flat API for components that
 * need to control or display narration state.
 */

import { useNarrationContext } from "@/contexts/NarrationContext";
import type { NarrationStatus } from "@/contexts/NarrationContext";
import type { NarrationSegment } from "@/services/api";

export interface UseNarrationReturn {
  /** Current playback status. */
  status: NarrationStatus;
  /** Whether narration is currently playing. */
  isPlaying: boolean;
  /** Whether narration is paused. */
  isPaused: boolean;
  /** Whether narration is loading (fetching segments or TTS). */
  isLoading: boolean;
  /** The card_id currently being narrated (for highlighting). */
  activeCardId: string | null;
  /** The current segment being narrated. */
  currentSegment: NarrationSegment | null;
  /** All narration segments. */
  segments: NarrationSegment[];
  /** Progress: { current, total }. */
  progress: { current: number; total: number };
  /** Error message, if any. */
  error: string | null;
  /** Start narration for a dashboard. */
  startNarration: (dashboardId: string, workspaceId: string) => Promise<void>;
  /** Pause playback. */
  pause: () => void;
  /** Resume playback. */
  resume: () => void;
  /** Stop and reset. */
  stop: () => void;
  /** Skip to next segment. */
  next: () => void;
  /** Go to previous segment. */
  previous: () => void;
}

export function useNarration(): UseNarrationReturn {
  const { state, actions } = useNarrationContext();

  const currentSegment =
    state.segments.length > 0 && state.currentIndex < state.segments.length
      ? state.segments[state.currentIndex]
      : null;

  return {
    status: state.status,
    isPlaying: state.status === "playing",
    isPaused: state.status === "paused",
    isLoading: state.status === "loading",
    activeCardId: state.activeCardId,
    currentSegment,
    segments: state.segments,
    progress: state.progress,
    error: state.error,
    startNarration: actions.startNarration,
    pause: actions.pause,
    resume: actions.resume,
    stop: actions.stop,
    next: actions.next,
    previous: actions.previous,
  };
}
