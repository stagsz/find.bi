/**
 * VoiceContext - Shared voice state for the entire application.
 *
 * Wraps useVoice and useWakeWord so that a single voice session and
 * wake word listener can be consumed by the TopBar status indicator,
 * PushToTalk, WakeWordListener, and any future voice-dependent component
 * without creating duplicate WebSocket connections.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useVoice } from "@/hooks/useVoice";
import type { VoiceStatus, UseVoiceReturn } from "@/hooks/useVoice";
import { useWakeWord } from "@/hooks/useWakeWord";
import type { UseWakeWordReturn } from "@/hooks/useWakeWord";

export interface VoiceContextValue {
  /** Full voice hook return (WebSocket, recording, playback). */
  voice: UseVoiceReturn;
  /** Full wake word hook return (speech recognition listener). */
  wakeWord: UseWakeWordReturn;
  /** Whether the wake word toggle is enabled by the user. */
  wakeWordEnabled: boolean;
  /** Toggle wake word detection on or off. */
  setWakeWordEnabled: (enabled: boolean) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

const RESUME_DELAY_MS = 1500;

export function VoiceProvider({ children }: { children: ReactNode }) {
  const voice = useVoice();
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const enabledRef = useRef(wakeWordEnabled);
  enabledRef.current = wakeWordEnabled;

  const [triggered, setTriggered] = useState(false);
  const prevStatusRef = useRef<VoiceStatus>(voice.status);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout>>();
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

  const wakeWord = useWakeWord({ onWakeWord: handleWakeWord });
  const { enable: enableWake, disable: disableWake } = wakeWord;
  enableWakeWordRef.current = enableWake;

  const {
    status: voiceStatus,
    startRecording,
    disconnect: voiceDisconnect,
  } = voice;

  // Sync toggle with wake word hook.
  useEffect(() => {
    if (wakeWordEnabled) {
      enableWake();
    } else {
      disableWake();
      setTriggered(false);
      clearTimeout(resumeTimerRef.current);
    }
  }, [wakeWordEnabled, enableWake, disableWake]);

  // React to voice status transitions for the wake-word-triggered flow.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = voiceStatus;

    if (!triggered) return;

    if (voiceStatus === "connected" && prev === "connecting") {
      void startRecording();
      return;
    }

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

  return (
    <VoiceContext.Provider
      value={{ voice, wakeWord, wakeWordEnabled, setWakeWordEnabled }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

/**
 * Consume shared voice state. Must be used inside a VoiceProvider.
 */
export function useVoiceContext(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error("useVoiceContext must be used within a VoiceProvider");
  }
  return ctx;
}

export default VoiceContext;
