import { useState, useCallback, useRef, useEffect } from "react";
import { getAccessToken } from "@/services/api";

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "recording"
  | "processing"
  | "playing"
  | "error";

export interface UseVoiceReturn {
  status: VoiceStatus;
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  transcript: string;
  responseText: string;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

const SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;

/** Convert Float32 audio samples to 16-bit signed PCM. */
export function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

/** Encode an ArrayBuffer as a base64 string. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Decode a base64 string to an Int16Array of PCM samples. */
export function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/**
 * React hook for voice interaction via the backend WebSocket proxy
 * to the OpenAI Realtime API.
 *
 * Handles microphone capture (PCM16), audio playback via Web Audio API,
 * and transcript/response state management.
 */
export function useVoice(): UseVoiceReturn {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [responseText, setResponseText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackTimeRef = useRef(0);
  const isRecordingRef = useRef(false);

  /** Schedule a PCM16 audio chunk for gapless playback. */
  const playAudioChunk = useCallback((pcm16Data: Int16Array) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    const ctx = playbackContextRef.current;

    const float32 = new Float32Array(pcm16Data.length);
    for (let i = 0; i < pcm16Data.length; i++) {
      float32[i] = pcm16Data[i] / (pcm16Data[i] < 0 ? 0x8000 : 0x7fff);
    }

    const buffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const bufferSource = ctx.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, playbackTimeRef.current);
    bufferSource.start(startTime);
    playbackTimeRef.current = startTime + buffer.duration;
  }, []);

  /** Handle incoming OpenAI Realtime API events forwarded by the backend proxy. */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (typeof event.data !== "string") return;

      try {
        const msg = JSON.parse(event.data) as Record<string, unknown>;

        switch (msg.type) {
          case "session.created":
          case "session.updated":
            break;

          case "input_audio_buffer.speech_started":
            setStatus("recording");
            break;

          case "input_audio_buffer.speech_stopped":
            setStatus("processing");
            break;

          case "conversation.item.input_audio_transcription.completed":
            if (typeof msg.transcript === "string") {
              setTranscript(msg.transcript);
            }
            break;

          case "response.audio.delta":
            setStatus("playing");
            if (typeof msg.delta === "string") {
              const pcm16 = base64ToInt16Array(msg.delta);
              playAudioChunk(pcm16);
            }
            break;

          case "response.audio.done":
            break;

          case "response.text.delta":
            if (typeof msg.delta === "string") {
              setResponseText((prev) => prev + msg.delta);
            }
            break;

          case "response.done":
            setStatus((prev) => (prev === "playing" ? "connected" : prev));
            break;

          case "error": {
            const errMsg =
              typeof msg.message === "string"
                ? msg.message
                : typeof (msg.error as Record<string, unknown> | undefined)
                      ?.message === "string"
                  ? ((msg.error as Record<string, unknown>).message as string)
                  : "Unknown error";
            setError(errMsg);
            setStatus("error");
            break;
          }
        }
      } catch {
        // Non-JSON message — ignore
      }
    },
    [playAudioChunk],
  );

  /** Stop microphone capture and release audio resources. */
  const stopCapture = useCallback(() => {
    isRecordingRef.current = false;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (captureContextRef.current) {
      void captureContextRef.current.close();
      captureContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  /** Tear down the full voice session: capture, playback, and WebSocket. */
  const disconnect = useCallback(() => {
    stopCapture();

    if (playbackContextRef.current) {
      void playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    playbackTimeRef.current = 0;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("idle");
    setError(null);
  }, [stopCapture]);

  // Clean up everything on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  /** Open a WebSocket connection to the voice proxy. */
  const connect = useCallback(() => {
    if (wsRef.current) return;

    const token = getAccessToken();
    if (!token) {
      setError("Not authenticated");
      setStatus("error");
      return;
    }

    setStatus("connecting");
    setError(null);
    setTranscript("");
    setResponseText("");

    const apiUrl =
      (import.meta.env.VITE_API_URL as string | undefined) ??
      "http://localhost:8000";
    const wsUrl =
      apiUrl.replace(/^http/, "ws") +
      "/ws/voice?token=" +
      encodeURIComponent(token);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (e) => handleMessage(e);

    ws.onerror = () => {
      setError("WebSocket connection failed");
      setStatus("error");
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      isRecordingRef.current = false;

      if (event.code === 1008) {
        setError("Authentication failed");
        setStatus("error");
      } else if (event.code === 1011) {
        setError("Server error — check API key configuration");
        setStatus("error");
      } else {
        setStatus("idle");
      }
    };
  }, [handleMessage]);

  /** Start capturing microphone audio and streaming PCM16 chunks over WebSocket. */
  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("Not connected");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      captureContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (
          !isRecordingRef.current ||
          !wsRef.current ||
          wsRef.current.readyState !== WebSocket.OPEN
        )
          return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = floatTo16BitPCM(inputData);
        const base64 = arrayBufferToBase64(pcm16.buffer);

        wsRef.current.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64,
          }),
        );
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      isRecordingRef.current = true;
      setStatus("recording");

      // Reset playback scheduling for the next response
      playbackTimeRef.current = 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  /** Stop recording and signal the end of the audio input buffer. */
  const stopRecording = useCallback(() => {
    stopCapture();

    // Signal end of input to the server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "input_audio_buffer.commit" }),
      );
      setStatus("processing");
    } else {
      setStatus(wsRef.current ? "connected" : "idle");
    }
  }, [stopCapture]);

  return {
    status,
    isConnected:
      status !== "idle" && status !== "error" && status !== "connecting",
    isRecording: status === "recording",
    isPlaying: status === "playing",
    transcript,
    responseText,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
}
