import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_PHRASE = "hey ralph";
const RESTART_DELAY_MS = 300;

/**
 * Returns the SpeechRecognition constructor for the current browser,
 * or null if unsupported. Exported for testing.
 */
export function getSpeechRecognitionConstructor(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export interface UseWakeWordOptions {
  /** Called when the wake phrase is detected in speech. */
  onWakeWord: () => void;
  /** Override the default wake phrase ("hey ralph"). */
  phrase?: string;
}

export interface UseWakeWordReturn {
  /** Whether the Web Speech API is actively listening for the wake phrase. */
  isListening: boolean;
  /** Whether the browser supports the Web Speech API. */
  isSupported: boolean;
  /** Start listening for the wake phrase. */
  enable: () => void;
  /** Stop listening and tear down recognition. */
  disable: () => void;
  /** Toggle between enabled and disabled. */
  toggle: () => void;
}

/**
 * Hook that continuously listens for a wake phrase using the Web Speech API.
 *
 * When the phrase is detected, `onWakeWord` fires and recognition pauses.
 * Call `enable()` again to resume listening after handling the wake event.
 */
export function useWakeWord({
  onWakeWord,
  phrase = DEFAULT_PHRASE,
}: UseWakeWordOptions): UseWakeWordReturn {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const enabledRef = useRef(false);
  const detectedRef = useRef(false);
  const onWakeWordRef = useRef(onWakeWord);
  const phraseRef = useRef(phrase.toLowerCase());
  const restartTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isSupported = getSpeechRecognitionConstructor() !== null;

  // Keep callback and phrase refs in sync without recreating recognition.
  useEffect(() => {
    onWakeWordRef.current = onWakeWord;
  }, [onWakeWord]);

  useEffect(() => {
    phraseRef.current = phrase.toLowerCase();
  }, [phrase]);

  /**
   * Create a new SpeechRecognition instance and start listening.
   * Stable callback (empty deps) — uses refs for mutable state.
   */
  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor || !enabledRef.current) return;

    // Tear down any existing instance.
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* noop */
      }
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
          .toLowerCase()
          .trim();
        if (transcript.includes(phraseRef.current)) {
          // Pause recognition — caller must re-enable to resume.
          detectedRef.current = true;
          enabledRef.current = false;
          try {
            recognition.abort();
          } catch {
            /* noop */
          }
          setIsListening(false);
          onWakeWordRef.current();
          return;
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'aborted' is expected when we intentionally stop.
      // 'no-speech' fires during silence — onend handles restart.
      if (event.error === "aborted" || event.error === "no-speech") return;

      if (event.error === "not-allowed") {
        enabledRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);

      // After wake word detection, do NOT auto-restart.
      if (detectedRef.current) {
        detectedRef.current = false;
        return;
      }

      // Otherwise restart automatically (e.g. after silence timeout).
      if (enabledRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (enabledRef.current) {
            startRecognition();
          }
        }, RESTART_DELAY_MS);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }, []);

  const enable = useCallback(() => {
    if (!isSupported) return;
    enabledRef.current = true;
    detectedRef.current = false;
    startRecognition();
  }, [isSupported, startRecognition]);

  const disable = useCallback(() => {
    enabledRef.current = false;
    detectedRef.current = false;
    clearTimeout(restartTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (enabledRef.current) {
      disable();
    } else {
      enable();
    }
  }, [enable, disable]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      enabledRef.current = false;
      clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return { isListening, isSupported, enable, disable, toggle };
}
