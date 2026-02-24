/**
 * useVoiceQuery - Voice-to-data query pipeline.
 *
 * Watches the shared voice context for completed transcripts.
 * When a transcript arrives, classifies intent via the backend.
 * If intent=query, injects the transcript into ChatPanel as a
 * voice-originated message and speaks the response summary via
 * the browser SpeechSynthesis API.
 *
 * This is the end-to-end "Hey Ralph, show me sales by region" flow:
 *   Mic -> OpenAI Realtime STT -> transcript -> classify intent
 *   -> chat API (text-to-SQL + plot) -> DuckDB -> chart + TTS
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceContext } from "@/contexts/VoiceContext";
import { classifyIntent } from "@/services/api";
import type { ClassifyIntentResult } from "@/services/api";

export interface VoiceQueryState {
  /** The last voice transcript that was classified as a data query. */
  pendingQuery: string | null;
  /** Whether the pipeline is currently classifying / processing. */
  isClassifying: boolean;
  /** The last classification result (for debugging / display). */
  lastIntent: ClassifyIntentResult | null;
  /** Error from intent classification. */
  error: string | null;
}

export interface UseVoiceQueryReturn extends VoiceQueryState {
  /** Call after ChatPanel has consumed the pending query. */
  clearPendingQuery: () => void;
  /** Speak text aloud via browser SpeechSynthesis. */
  speak: (text: string) => void;
  /** Stop any ongoing speech. */
  stopSpeaking: () => void;
  /** Whether TTS is currently speaking. */
  isSpeaking: boolean;
}

/**
 * Hook that bridges voice transcripts to the data query pipeline.
 *
 * @param workspaceId - Current workspace (needed to gate classification)
 */
export function useVoiceQuery(
  workspaceId: string | null,
): UseVoiceQueryReturn {
  const { voice } = useVoiceContext();
  const { transcript, status } = voice;

  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [lastIntent, setLastIntent] = useState<ClassifyIntentResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Track the last processed transcript to avoid re-processing.
  const lastTranscriptRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);

  // ── Intent classification on transcript change ─────────────────────

  useEffect(() => {
    // Only process when we have a new transcript and voice has moved
    // past recording (processing or playing means STT is done).
    if (
      !transcript ||
      transcript === lastTranscriptRef.current ||
      !workspaceId
    ) {
      return;
    }

    // Wait until the voice status indicates transcript is final.
    if (status !== "processing" && status !== "playing" && status !== "connected") {
      return;
    }

    lastTranscriptRef.current = transcript;

    // Cancel any in-flight classification.
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setIsClassifying(true);
    setError(null);

    classifyIntent(transcript)
      .then((result) => {
        if (controller.signal.aborted) return;

        setLastIntent(result);
        setIsClassifying(false);

        if (result.intent === "query" && result.confidence >= 0.5) {
          setPendingQuery(transcript);
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        setIsClassifying(false);
        setError(
          err instanceof Error ? err.message : "Intent classification failed",
        );
      });

    return () => {
      controller.abort();
    };
  }, [transcript, status, workspaceId]);

  // ── Cleanup on unmount ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ── Public API ─────────────────────────────────────────────────────

  const clearPendingQuery = useCallback(() => {
    setPendingQuery(null);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return {
    pendingQuery,
    isClassifying,
    lastIntent,
    error,
    clearPendingQuery,
    speak,
    stopSpeaking,
    isSpeaking,
  };
}
