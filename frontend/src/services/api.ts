import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearAccessToken();
    }
    return Promise.reject(error);
  },
);

// ─── AI Voice Query Helpers ──────────────────────────────────────────

export interface ClassifyIntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
}

export async function classifyIntent(
  transcript: string,
): Promise<ClassifyIntentResult> {
  const res = await api.post<ClassifyIntentResult>(
    "/api/ai/classify-intent",
    { transcript },
  );
  return res.data;
}

// ─── Narration Helpers ───────────────────────────────────────────────

export interface NarrationSegment {
  card_id: string;
  title: string;
  narration: string;
}

export interface NarrateDashboardResponse {
  segments: NarrationSegment[];
}

export async function narrateDashboard(
  dashboardId: string,
  workspaceId: string,
): Promise<NarrateDashboardResponse> {
  const res = await api.post<NarrateDashboardResponse>(
    "/api/ai/narrate-dashboard",
    { dashboard_id: dashboardId, workspace_id: workspaceId },
  );
  return res.data;
}

/**
 * Fetch TTS audio for a narration text segment.
 * Returns a Blob containing audio data (mp3 by default).
 */
export async function fetchTTSAudio(
  text: string,
  voice: string = "alloy",
  format: string = "mp3",
): Promise<Blob> {
  const params = new URLSearchParams({
    text,
    voice,
    response_format: format,
  });
  const res = await api.post(`/api/narration/tts?${params.toString()}`, null, {
    responseType: "blob",
  });
  return res.data as Blob;
}

export default api;
