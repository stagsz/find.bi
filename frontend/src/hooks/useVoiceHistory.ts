/**
 * useVoiceHistory - Accumulates completed voice interactions into a
 * persistent history list stored in localStorage.
 *
 * An interaction is considered complete when the voice status transitions
 * from "playing" → "connected", and both transcript and responseText are
 * non-empty. Duplicate completions (same responseText) are skipped.
 *
 * Must be rendered inside a VoiceProvider.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useVoiceContext } from "@/contexts/VoiceContext";

const STORAGE_KEY = "findbi-voice-history";
const MAX_ENTRIES = 100;

export interface TranscriptEntry {
  id: string;
  /** Unix timestamp (ms). */
  timestamp: number;
  userSpeech: string;
  ralphResponse: string;
}

export interface UseVoiceHistoryReturn {
  entries: TranscriptEntry[];
  clearHistory: () => void;
}

function loadFromStorage(): TranscriptEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TranscriptEntry[];
  } catch {
    return [];
  }
}

function saveToStorage(entries: TranscriptEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

export function useVoiceHistory(): UseVoiceHistoryReturn {
  const { voice } = useVoiceContext();
  const [entries, setEntries] = useState<TranscriptEntry[]>(loadFromStorage);

  // Track the previous status to detect playing → connected transitions.
  const prevStatusRef = useRef(voice.status);
  // Avoid saving the same response twice if the effect fires multiple times.
  const lastSavedResponseRef = useRef<string>("");

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = voice.status;

    if (
      prevStatus === "playing" &&
      voice.status === "connected" &&
      voice.transcript.trim() &&
      voice.responseText.trim() &&
      voice.responseText !== lastSavedResponseRef.current
    ) {
      const entry: TranscriptEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        userSpeech: voice.transcript.trim(),
        ralphResponse: voice.responseText.trim(),
      };

      lastSavedResponseRef.current = voice.responseText;

      setEntries((prev) => {
        const next = [entry, ...prev].slice(0, MAX_ENTRIES);
        saveToStorage(next);
        return next;
      });
    }
  }, [voice.status, voice.transcript, voice.responseText]);

  const clearHistory = useCallback(() => {
    setEntries([]);
    saveToStorage([]);
    lastSavedResponseRef.current = "";
  }, []);

  return { entries, clearHistory };
}
