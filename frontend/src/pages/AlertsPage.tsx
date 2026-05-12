/**
 * AlertsPage — Create and manage data quality alerts.
 *
 * Allows users to set up threshold alerts on DuckDB queries that trigger
 * browser notifications, email, or webhook callbacks.
 * Uses the backend alerts API: /api/alerts/{workspace_id}
 */

import { useCallback, useEffect, useState } from "react";
import { listWorkspaces } from "@/services/workspaces";
import api from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  name: string;
  sql_query: string;
  condition: string;
  threshold: number;
  channel: string;
  is_active: boolean;
  last_triggered_at: string | null;
  last_value: number | null;
}

const CONDITIONS = [
  { value: "gt", label: "Greater than (>)" },
  { value: "gte", label: "Greater than or equal (>=)" },
  { value: "lt", label: "Less than (<)" },
  { value: "lte", label: "Less than or equal (<=)" },
  { value: "eq", label: "Equal to (=)" },
];

const CHANNELS = [
  { value: "browser", label: "Browser notification" },
  { value: "email", label: "Email" },
  { value: "webhook", label: "Webhook POST" },
];

// ─── AlertItem ────────────────────────────────────────────────────────────────

function AlertItem({
  alert,
  workspaceId,
  onDeleted,
  onEvaluated,
}: {
  alert: Alert;
  workspaceId: string;
  onDeleted: () => void;
  onEvaluated: (result: { triggered: boolean; value: number | null; error: string | null }) => void;
}) {
  const [evaluating, setEvaluating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleEvaluate = useCallback(async () => {
    setEvaluating(true);
    try {
      const res = await api.post<{ triggered: boolean; value: number | null; error: string | null }>(
        `/api/alerts/${workspaceId}/${alert.id}/evaluate`,
      );
      onEvaluated(res.data);
    } catch {
      onEvaluated({ triggered: false, value: null, error: "Evaluation failed." });
    } finally {
      setEvaluating(false);
    }
  }, [workspaceId, alert.id, onEvaluated]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Delete alert "${alert.name}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/api/alerts/${workspaceId}/${alert.id}`);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }, [workspaceId, alert.id, alert.name, onDeleted]);

  const conditionLabel = CONDITIONS.find((c) => c.value === alert.condition)?.label ?? alert.condition;

  return (
    <div
      data-testid={`alert-item-${alert.id}`}
      className="rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-[#F0EDE4]">{alert.name}</span>
            <span
              className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider ${
                alert.is_active
                  ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : "border-[#2A2A2A] text-[#6B6860]"
              }`}
            >
              {alert.is_active ? "Active" : "Inactive"}
            </span>
            <span className="inline-block rounded border border-[#2A2A2A] bg-[#0E0E0E] px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-[#6B6860]">
              {alert.channel}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-[0.65rem] text-[#6B6860]">
            {conditionLabel} {alert.threshold}
          </p>
          {alert.last_triggered_at && (
            <p className="mt-0.5 font-mono text-[0.6rem] text-[#F5A623]/60">
              Last triggered: {new Date(alert.last_triggered_at).toLocaleString()}
              {alert.last_value !== null ? ` (value: ${alert.last_value})` : ""}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid={`evaluate-alert-${alert.id}`}
            disabled={evaluating}
            onClick={() => void handleEvaluate()}
            className="rounded border border-[#2A2A2A] bg-[#0E0E0E] px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860] transition-colors hover:border-[#F5A623]/40 hover:text-[#F5A623] disabled:opacity-50"
          >
            {evaluating ? "..." : "Test"}
          </button>
          <button
            type="button"
            data-testid={`delete-alert-${alert.id}`}
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="rounded border border-[#E84393]/30 bg-[#E84393]/10 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-[#E84393] transition-colors hover:bg-[#E84393]/20 disabled:opacity-50"
          >
            {deleting ? "..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AlertsPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Form
  const [name, setName] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [condition, setCondition] = useState("gt");
  const [threshold, setThreshold] = useState("0");
  const [channel, setChannel] = useState("browser");
  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Eval result banner
  const [evalResult, setEvalResult] = useState<{
    triggered: boolean;
    value: number | null;
    error: string | null;
  } | null>(null);

  const loadAlerts = useCallback(async (wsId: string) => {
    try {
      const res = await api.get<Alert[]>(`/api/alerts/${wsId}`);
      setAlerts(res.data);
    } catch {
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listWorkspaces()
      .then((ws) => {
        if (cancelled) return;
        if (ws.length === 0) {
          setError("No workspace found.");
          setLoading(false);
          return;
        }
        const wsId = ws[0].id;
        setWorkspaceId(wsId);
        return loadAlerts(wsId);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load workspace.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [loadAlerts]);

  const handleSave = useCallback(async () => {
    if (!workspaceId || !name.trim() || !sqlQuery.trim()) {
      setFormError("Name and SQL query are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await api.post(`/api/alerts/${workspaceId}`, {
        name: name.trim(),
        sql_query: sqlQuery.trim(),
        condition,
        threshold: parseFloat(threshold) || 0,
        channel,
        ...(channel === "email" ? { email: email.trim() || undefined } : {}),
        ...(channel === "webhook" ? { webhook_url: webhookUrl.trim() || undefined } : {}),
      });
      setName("");
      setSqlQuery("");
      setThreshold("0");
      setEmail("");
      setWebhookUrl("");
      await loadAlerts(workspaceId);
    } catch (err: unknown) {
      const detail =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      setFormError(detail ?? "Failed to create alert.");
    } finally {
      setSaving(false);
    }
  }, [workspaceId, name, sqlQuery, condition, threshold, channel, email, webhookUrl, loadAlerts]);

  if (loading) {
    return (
      <div data-testid="alerts-page" className="flex h-full items-center justify-center">
        <p className="font-mono text-sm text-[#6B6860]">Loading...</p>
      </div>
    );
  }

  return (
    <div data-testid="alerts-page" className="p-6 max-w-2xl">
      <h1 className="mb-6 font-mono text-xl font-bold uppercase tracking-widest text-[#F5A623]">
        Alerts
      </h1>

      {error && (
        <div
          data-testid="alerts-error"
          className="mb-4 rounded-md border border-[#E84393]/40 bg-[#E84393]/10 px-4 py-2 font-mono text-sm text-[#E84393]"
        >
          {error}
        </div>
      )}

      {evalResult && (
        <div
          data-testid="alert-eval-result"
          className={`mb-4 rounded-md border px-4 py-2 font-mono text-sm ${
            evalResult.error
              ? "border-[#E84393]/40 bg-[#E84393]/10 text-[#E84393]"
              : evalResult.triggered
                ? "border-[#F5A623]/40 bg-[#F5A623]/10 text-[#F5A623]"
                : "border-green-500/30 bg-green-500/10 text-green-400"
          }`}
        >
          {evalResult.error
            ? `Error: ${evalResult.error}`
            : evalResult.triggered
              ? `Alert triggered! Value: ${evalResult.value}`
              : `No trigger. Value: ${evalResult.value}`}
          <button
            type="button"
            onClick={() => setEvalResult(null)}
            className="ml-3 text-[0.65rem] opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Alert list */}
      <div data-testid="alerts-list" className="mb-6 flex flex-col gap-2">
        {alerts.length === 0 ? (
          <p className="font-mono text-sm text-[#6B6860]">No alerts yet. Create one below.</p>
        ) : (
          alerts.map((a) => (
            <AlertItem
              key={a.id}
              alert={a}
              workspaceId={workspaceId!}
              onDeleted={() => workspaceId && void loadAlerts(workspaceId)}
              onEvaluated={setEvalResult}
            />
          ))
        )}
      </div>

      {/* Create form */}
      {workspaceId && (
        <div
          data-testid="add-alert-form"
          className="rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-4"
        >
          <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860]">
            Create Alert
          </p>

          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                Alert Name
              </label>
              <input
                data-testid="alert-name-input"
                type="text"
                placeholder="High null rate"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                SQL Query (must return a single number)
              </label>
              <textarea
                data-testid="alert-sql-input"
                placeholder="SELECT COUNT(*) FROM my_table WHERE value IS NULL"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                  Condition
                </label>
                <select
                  data-testid="alert-condition-select"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] focus:border-[#F5A623]/50 focus:outline-none"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                  Threshold
                </label>
                <input
                  data-testid="alert-threshold-input"
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] focus:border-[#F5A623]/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                Notification Channel
              </label>
              <select
                data-testid="alert-channel-select"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] focus:border-[#F5A623]/50 focus:outline-none"
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {channel === "email" && (
              <div>
                <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                  Email Address
                </label>
                <input
                  data-testid="alert-email-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
                />
              </div>
            )}

            {channel === "webhook" && (
              <div>
                <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                  Webhook URL
                </label>
                <input
                  data-testid="alert-webhook-url-input"
                  type="url"
                  placeholder="https://hooks.example.com/notify"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
                />
              </div>
            )}
          </div>

          {formError && (
            <p className="mt-2 font-mono text-[0.65rem] text-[#E84393]">{formError}</p>
          )}

          <button
            type="button"
            data-testid="save-alert-button"
            disabled={saving || !name.trim() || !sqlQuery.trim()}
            onClick={() => void handleSave()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#F5A623]/40 bg-[#F5A623]/10 px-3 py-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-[#F5A623] transition-colors hover:bg-[#F5A623]/20 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Alert"}
          </button>
        </div>
      )}
    </div>
  );
}

export default AlertsPage;
