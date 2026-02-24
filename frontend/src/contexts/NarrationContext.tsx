/**
 * NarrationContext - Global state for dashboard narration playback.
 *
 * Manages the narration lifecycle: fetching segments from the AI service,
 * converting text to speech via the TTS API, and coordinating chart-by-chart
 * playback with visual highlighting. Provides pause/resume/stop controls.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  narrateDashboard,
  fetchTTSAudio,
  type NarrationSegment,
} from "@/services/api";

export type NarrationStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "error";

export interface NarrationState {
  /** Current playback status. */
  status: NarrationStatus;
  /** All narration segments for the current dashboard. */
  segments: NarrationSegment[];
  /** Index of the currently playing segment. */
  currentIndex: number;
  /** The card_id currently being narrated (for highlighting). */
  activeCardId: string | null;
  /** Error message if narration failed. */
  error: string | null;
  /** Progress: currentIndex / total segments. */
  progress: { current: number; total: number };
}

export interface NarrationActions {
  /** Start narration for a dashboard. Fetches segments and begins playback. */
  startNarration: (dashboardId: string, workspaceId: string) => Promise<void>;
  /** Pause the current narration. */
  pause: () => void;
  /** Resume a paused narration. */
  resume: () => void;
  /** Stop narration and reset state. */
  stop: () => void;
  /** Skip to the next segment. */
  next: () => void;
  /** Go back to the previous segment. */
  previous: () => void;
}

export interface NarrationContextValue {
  state: NarrationState;
  actions: NarrationActions;
}

const NarrationContext = createContext<NarrationContextValue | null>(null);

const INITIAL_STATE: NarrationState = {
  status: "idle",
  segments: [],
  currentIndex: 0,
  activeCardId: null,
  error: null,
  progress: { current: 0, total: 0 },
};

export function NarrationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NarrationState>(INITIAL_STATE);

  // Refs for controlling playback across async boundaries
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stoppedRef = useRef(false);
  const segmentsRef = useRef<NarrationSegment[]>([]);
  const currentIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }
  }, []);

  const playSegment = useCallback(
    async (index: number): Promise<void> => {
      const segs = segmentsRef.current;
      if (index >= segs.length || stoppedRef.current) {
        // Narration complete
        cleanup();
        setState((prev) => ({
          ...prev,
          status: "idle",
          activeCardId: null,
          currentIndex: 0,
        }));
        return;
      }

      const segment = segs[index];
      currentIndexRef.current = index;

      setState((prev) => ({
        ...prev,
        currentIndex: index,
        activeCardId: segment.card_id,
        progress: { current: index + 1, total: segs.length },
      }));

      try {
        // Fetch TTS audio for this segment
        const blob = await fetchTTSAudio(segment.narration);

        if (stoppedRef.current) return;

        // Create audio element for playback
        cleanup();
        const audio = new Audio();
        const url = URL.createObjectURL(blob);
        audio.src = url;
        audioRef.current = audio;

        // Wait for audio to finish, then play next segment
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`Audio playback failed for segment ${index}`));
          };
          audio.play().catch(reject);
        });

        if (!stoppedRef.current) {
          await playSegment(index + 1);
        }
      } catch (err) {
        if (stoppedRef.current) return;
        setState((prev) => ({
          ...prev,
          status: "error",
          error:
            err instanceof Error
              ? err.message
              : "Narration playback failed",
        }));
      }
    },
    [cleanup],
  );

  const startNarration = useCallback(
    async (dashboardId: string, workspaceId: string) => {
      // Reset state
      stoppedRef.current = false;
      cleanup();

      setState((prev) => ({
        ...prev,
        status: "loading",
        error: null,
        segments: [],
        currentIndex: 0,
        activeCardId: null,
        progress: { current: 0, total: 0 },
      }));

      try {
        const response = await narrateDashboard(dashboardId, workspaceId);

        if (stoppedRef.current) return;

        if (response.segments.length === 0) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "No narration segments generated.",
          }));
          return;
        }

        segmentsRef.current = response.segments;

        setState((prev) => ({
          ...prev,
          status: "playing",
          segments: response.segments,
          progress: { current: 1, total: response.segments.length },
        }));

        await playSegment(0);
      } catch (err) {
        if (stoppedRef.current) return;
        setState((prev) => ({
          ...prev,
          status: "error",
          error:
            err instanceof Error
              ? err.message
              : "Failed to generate narration",
        }));
      }
    },
    [cleanup, playSegment],
  );

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, status: "paused" }));
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {
        // Playback interrupted — ignore
      });
      setState((prev) => ({ ...prev, status: "playing" }));
    }
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    cleanup();
    segmentsRef.current = [];
    currentIndexRef.current = 0;
    setState(INITIAL_STATE);
  }, [cleanup]);

  const next = useCallback(() => {
    const nextIdx = currentIndexRef.current + 1;
    if (nextIdx < segmentsRef.current.length) {
      cleanup();
      setState((prev) => ({ ...prev, status: "playing" }));
      void playSegment(nextIdx);
    }
  }, [cleanup, playSegment]);

  const previous = useCallback(() => {
    const prevIdx = currentIndexRef.current - 1;
    if (prevIdx >= 0) {
      cleanup();
      setState((prev) => ({ ...prev, status: "playing" }));
      void playSegment(prevIdx);
    }
  }, [cleanup, playSegment]);

  const actions: NarrationActions = {
    startNarration,
    pause,
    resume,
    stop,
    next,
    previous,
  };

  return (
    <NarrationContext.Provider value={{ state, actions }}>
      {children}
    </NarrationContext.Provider>
  );
}

/**
 * Consume shared narration state. Must be used inside a NarrationProvider.
 */
export function useNarrationContext(): NarrationContextValue {
  const ctx = useContext(NarrationContext);
  if (!ctx) {
    throw new Error(
      "useNarrationContext must be used within a NarrationProvider",
    );
  }
  return ctx;
}

export default NarrationContext;
