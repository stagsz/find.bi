/**
 * InsightPanel — lists AI-generated insight cards for the current dataset.
 *
 * Fetches insights from POST /api/ai/insights, renders them via InsightCard,
 * and handles loading / error / empty states with Ralph personality.
 */

import { useCallback, useState } from "react";
import api from "@/services/api";
import InsightCard from "./InsightCard";
import type { Insight } from "./InsightCard";

interface InsightPanelProps {
  workspaceId: string | null;
  className?: string;
}

interface InsightsResponse {
  insights: Insight[];
}

const LOADING_PHRASES = [
  "Calculating with my brain...",
  "I found a leprechaun!",
  "The numbers are doing things",
];

function pickLoadingPhrase(): string {
  return LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
}

function InsightPanel({ workspaceId, className }: InsightPanelProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadingPhrase] = useState(pickLoadingPhrase);

  const handleAnalyze = useCallback(async () => {
    if (!workspaceId) return;

    setLoading(true);
    setError(null);
    setInsights([]);

    try {
      const res = await api.post<InsightsResponse>("/api/ai/insights", {
        workspace_id: workspaceId,
      });
      setInsights(res.data.insights);
      setHasLoaded(true);
    } catch (err: unknown) {
      if (
        err !== null &&
        typeof err === "object" &&
        "response" in err &&
        err.response !== null &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data !== null &&
        typeof err.response.data === "object" &&
        "detail" in err.response.data &&
        typeof err.response.data.detail === "string"
      ) {
        setError(err.response.data.detail);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to generate insights",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  return (
    <div
      data-testid="insight-panel"
      className={`flex flex-col gap-4 ${className ?? ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F5A623]">
          Insights
        </h2>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading || !workspaceId}
          data-testid="insight-analyze-button"
          className="inline-flex items-center gap-1.5 rounded border border-[#F5A623]/40 bg-[#F5A623]/10 px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-wider text-[#F5A623] transition-colors hover:bg-[#F5A623]/20 hover:text-[#FFB84D] disabled:opacity-40"
        >
          {loading ? (
            <>
              <svg
                className="h-3 w-3 animate-spin"
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
              Analyzing...
            </>
          ) : hasLoaded ? (
            "Refresh"
          ) : (
            "Analyze"
          )}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div
          data-testid="insight-loading"
          className="flex flex-col items-center gap-2 py-8"
        >
          <svg
            className="h-6 w-6 animate-spin text-[#F5A623]"
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
          <p className="text-xs text-[#6B6860]">{loadingPhrase}</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div
          data-testid="insight-error"
          className="rounded-md border border-[#E84393]/30 bg-[#E84393]/10 p-3"
        >
          <p className="text-xs text-[#E84393]">{error}</p>
        </div>
      )}

      {/* Empty state (after load, no insights) */}
      {!loading && !error && hasLoaded && insights.length === 0 && (
        <div
          data-testid="insight-empty"
          className="py-8 text-center"
        >
          <p className="text-xs text-[#6B6860]">
            No insights found. Try uploading more data.
          </p>
        </div>
      )}

      {/* Insight cards */}
      {!loading && insights.length > 0 && (
        <div data-testid="insight-list" className="flex flex-col gap-3">
          {insights.map((insight, index) => (
            <InsightCard key={`${insight.type}-${index}`} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

export type { InsightPanelProps };
export default InsightPanel;
