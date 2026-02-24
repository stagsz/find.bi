import { useCallback, useState } from "react";
import api from "@/services/api";
import { useDuckDB } from "@/hooks/useDuckDB";
import type { QueryResult as QueryResultData } from "@/hooks/useDuckDB";
import QueryResult from "@/components/editor/QueryResult";

interface NLQueryInputProps {
  workspaceId: string | null;
  className?: string;
}

interface TextToSqlResponse {
  sql: string;
  explanation: string;
}

function NLQueryInput({ workspaceId, className }: NLQueryInputProps) {
  const { query, isReady } = useDuckDB();

  // Question input state
  const [question, setQuestion] = useState("");

  // AI response state
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Query execution state
  const [queryResult, setQueryResult] = useState<QueryResultData | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const handleAsk = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (!workspaceId) return;

    setAiLoading(true);
    setAiError(null);
    setGeneratedSql(null);
    setExplanation("");
    setQueryResult(null);
    setQueryError(null);

    try {
      const res = await api.post<TextToSqlResponse>("/api/ai/text-to-sql", {
        question: trimmed,
        workspace_id: workspaceId,
      });
      setGeneratedSql(res.data.sql);
      setExplanation(res.data.explanation);
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
        setAiError(err.response.data.detail);
      } else {
        setAiError(err instanceof Error ? err.message : "Failed to generate SQL");
      }
    } finally {
      setAiLoading(false);
    }
  }, [question, workspaceId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAsk();
      }
    },
    [handleAsk],
  );

  const handleRunQuery = useCallback(async () => {
    const trimmed = (generatedSql ?? "").trim();
    if (!trimmed) return;
    if (!isReady) return;

    setQueryLoading(true);
    setQueryError(null);

    try {
      const result = await query(trimmed);
      setQueryResult(result);
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : String(err));
      setQueryResult(null);
    } finally {
      setQueryLoading(false);
    }
  }, [query, generatedSql, isReady]);

  return (
    <div
      data-testid="nl-query-input"
      className={`flex flex-col gap-4 ${className ?? ""}`}
    >
      {/* Question input */}
      <div className="flex gap-2" data-testid="nl-question-row">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your data..."
          disabled={aiLoading}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          data-testid="nl-question-input"
        />
        <button
          type="button"
          onClick={handleAsk}
          disabled={aiLoading || !question.trim() || !workspaceId}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          data-testid="nl-ask-button"
        >
          {aiLoading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
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
              Thinking...
            </>
          ) : (
            "Ask"
          )}
        </button>
      </div>

      {/* AI error */}
      {aiError && (
        <div
          data-testid="nl-ai-error"
          className="rounded-lg border border-red-200 bg-red-50 p-3"
        >
          <p className="text-sm text-red-800">{aiError}</p>
        </div>
      )}

      {/* Generated SQL section */}
      {generatedSql !== null && (
        <div data-testid="nl-sql-section" className="flex flex-col gap-2">
          {/* Explanation */}
          {explanation && (
            <p data-testid="nl-explanation" className="text-sm text-gray-600">
              {explanation}
            </p>
          )}

          {/* Editable SQL */}
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Generated SQL (editable)
            </label>
            <textarea
              value={generatedSql}
              onChange={(e) => setGeneratedSql(e.target.value)}
              rows={Math.min(Math.max(generatedSql.split("\n").length, 2), 10)}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="nl-sql-editor"
            />
          </div>

          {/* Run button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRunQuery}
              disabled={queryLoading || !(generatedSql ?? "").trim() || !isReady}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              data-testid="nl-run-button"
            >
              <svg
                className="h-3 w-3"
                viewBox="0 0 12 12"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3 1.5v9l7.5-4.5L3 1.5z" />
              </svg>
              Run Query
            </button>
            {queryLoading && (
              <span className="text-xs text-gray-500">Executing...</span>
            )}
          </div>
        </div>
      )}

      {/* Query results */}
      {(queryResult || queryLoading || queryError) && (
        <QueryResult
          result={queryResult}
          loading={queryLoading}
          error={queryError}
          className="min-h-[200px]"
        />
      )}
    </div>
  );
}

export type { NLQueryInputProps };
export default NLQueryInput;
