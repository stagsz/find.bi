import { useCallback, useEffect, useState } from "react";
import { listWorkspaces } from "@/services/workspaces";
import { getWebhookConfig, configureWebhook } from "@/services/webhooks";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function WebhookPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Config status
  const [hasConfig, setHasConfig] = useState(false);
  const [configuredTable, setConfiguredTable] = useState<string | null>(null);

  // Form
  const [tableName, setTableName] = useState("");
  const [generating, setGenerating] = useState(false);

  // Generated key
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const fetchConfig = useCallback(async (wsId: string) => {
    try {
      const cfg = await getWebhookConfig(wsId);
      setHasConfig(cfg.has_config);
      setConfiguredTable(cfg.table_name ?? null);
    } catch {
      // If config fetch fails, treat as no config
      setHasConfig(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listWorkspaces()
      .then((workspaces) => {
        if (cancelled) return;
        if (workspaces.length === 0) {
          setError("No workspace found. Please create a workspace first.");
          setLoading(false);
          return;
        }
        const wsId = workspaces[0].id;
        setWorkspaceId(wsId);
        return fetchConfig(wsId);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load workspace.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchConfig]);

  const ingestUrl = workspaceId
    ? `${API_URL}/api/webhooks/${workspaceId}/ingest`
    : "";

  const handleGenerate = useCallback(async () => {
    if (!workspaceId || !tableName.trim()) return;
    setGenerating(true);
    setError(null);
    setGeneratedKey(null);
    try {
      const result = await configureWebhook(workspaceId, tableName.trim());
      setGeneratedKey(result.api_key);
      setHasConfig(true);
      setConfiguredTable(result.table_name);
    } catch {
      setError("Failed to configure webhook. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [workspaceId, tableName]);

  const handleCopyUrl = useCallback(() => {
    if (!ingestUrl) return;
    void navigator.clipboard.writeText(ingestUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
  }, [ingestUrl]);

  const handleCopyKey = useCallback(() => {
    if (!generatedKey) return;
    void navigator.clipboard.writeText(generatedKey).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    });
  }, [generatedKey]);

  const curlExample = ingestUrl
    ? `curl -X POST "${ingestUrl}" \\\n  -H "X-Webhook-Key: <your-api-key>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"field": "value"}'`
    : `curl -X POST "<ingest-url>" \\\n  -H "X-Webhook-Key: <your-api-key>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"field": "value"}'`;

  if (loading) {
    return (
      <div
        data-testid="webhook-page"
        className="flex h-full items-center justify-center"
      >
        <p className="font-mono text-sm text-[#6B6860]">Loading...</p>
      </div>
    );
  }

  return (
    <div data-testid="webhook-page" className="p-6 max-w-2xl">
      {/* Header */}
      <h1 className="mb-6 font-mono text-xl font-bold uppercase tracking-widest text-[#F5A623]">
        Webhook
      </h1>

      {/* Error banner */}
      {error && (
        <div
          data-testid="webhook-error"
          className="mb-4 rounded-md border border-[#E84393]/40 bg-[#E84393]/10 px-4 py-2 font-mono text-sm text-[#E84393]"
        >
          {error}
        </div>
      )}

      {/* Config status */}
      <div
        data-testid="webhook-config-status"
        className="mb-6 rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3"
      >
        <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860]">
          Current Status
        </p>
        {hasConfig && configuredTable ? (
          <p className="font-mono text-sm text-[#F0EDE4]">
            Configured &mdash; table:{" "}
            <span className="text-[#F5A623]">{configuredTable}</span>
          </p>
        ) : (
          <p className="font-mono text-sm text-[#6B6860]">
            No webhook configured
          </p>
        )}
      </div>

      {/* Configure form */}
      <div className="mb-6 rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-4">
        <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860]">
          Configure Webhook
        </p>
        <div className="flex items-center gap-3">
          <input
            data-testid="webhook-table-name-input"
            type="text"
            placeholder="table_name"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleGenerate();
            }}
            className="flex-1 rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none focus:ring-1 focus:ring-[#F5A623]/30"
          />
          <button
            data-testid="webhook-generate-button"
            type="button"
            disabled={generating || !tableName.trim()}
            onClick={() => void handleGenerate()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#F5A623]/40 bg-[#F5A623]/10 px-3 py-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-[#F5A623] transition-colors hover:bg-[#F5A623]/20 hover:text-[#FFB84D] disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Webhook"}
          </button>
        </div>
      </div>

      {/* Generated API key */}
      {generatedKey && (
        <div className="mb-6 rounded-md border border-[#F5A623]/30 bg-[#141414] px-4 py-4">
          <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860]">
            API Key
          </p>
          <p className="mb-3 font-mono text-xs text-[#E84393]">
            Save this key now &mdash; it won&apos;t be shown again
          </p>
          <div className="flex items-center gap-2">
            <code
              data-testid="webhook-api-key-display"
              className="flex-1 overflow-x-auto rounded bg-[#0E0E0E] px-3 py-2 font-mono text-xs text-[#F5A623] break-all"
            >
              {generatedKey}
            </code>
            <button
              data-testid="webhook-api-key-copy"
              type="button"
              onClick={handleCopyKey}
              className="shrink-0 rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860] transition-colors hover:border-[#F5A623]/40 hover:text-[#F5A623]"
            >
              {keyCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Webhook URL */}
      {workspaceId && (
        <div className="mb-6 rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-4">
          <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860]">
            Ingest URL
          </p>
          <div className="flex items-center gap-2">
            <code
              data-testid="webhook-url-display"
              className="flex-1 overflow-x-auto rounded bg-[#0E0E0E] px-3 py-2 font-mono text-xs text-[#F0EDE4] break-all"
            >
              {ingestUrl}
            </code>
            <button
              data-testid="webhook-url-copy"
              type="button"
              onClick={handleCopyUrl}
              className="shrink-0 rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860] transition-colors hover:border-[#F5A623]/40 hover:text-[#F5A623]"
            >
              {urlCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Usage example */}
      <div className="rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-4">
        <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860]">
          Usage Example
        </p>
        <pre className="overflow-x-auto rounded bg-[#0E0E0E] px-3 py-3 font-mono text-xs text-[#F0EDE4]">
          {curlExample}
        </pre>
      </div>
    </div>
  );
}

export default WebhookPage;
