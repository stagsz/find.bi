/**
 * SchedulePage — Manage cron-based data refresh jobs for a workspace.
 *
 * Allows creating scheduled refresh jobs and viewing/removing them.
 * Uses the backend scheduler API: /api/scheduler/{workspace_id}/jobs
 */

import { useCallback, useEffect, useState } from "react";
import { listWorkspaces } from "@/services/workspaces";
import api from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RefreshJob {
  job_id: string;
  name: string;
  next_run_time: string | null;
}

// ─── Cron presets ─────────────────────────────────────────────────────────────

const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every week (Mon 9am)", value: "0 9 * * 1" },
  { label: "Custom", value: "" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function SchedulePage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<RefreshJob[]>([]);

  // Form state
  const [tableName, setTableName] = useState("");
  const [preset, setPreset] = useState(CRON_PRESETS[1].value);
  const [customCron, setCustomCron] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  const cronExpr = preset || customCron;

  const loadJobs = useCallback(async (wsId: string) => {
    try {
      const res = await api.get<RefreshJob[]>(`/api/scheduler/${wsId}/jobs`);
      setJobs(res.data);
    } catch {
      setJobs([]);
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
        return loadJobs(wsId);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load workspace.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [loadJobs]);

  const handleAdd = useCallback(async () => {
    if (!workspaceId || !tableName.trim() || !cronExpr.trim()) {
      setFormError("Table name and cron schedule are required.");
      return;
    }
    setAdding(true);
    setFormError("");
    try {
      await api.post(`/api/scheduler/${workspaceId}/jobs`, {
        table_name: tableName.trim(),
        cron_expr: cronExpr.trim(),
      });
      setTableName("");
      setCustomCron("");
      await loadJobs(workspaceId);
    } catch (err: unknown) {
      const detail =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      setFormError(detail ?? "Failed to add schedule.");
    } finally {
      setAdding(false);
    }
  }, [workspaceId, tableName, cronExpr, loadJobs]);

  const handleDelete = useCallback(
    async (jobId: string) => {
      if (!workspaceId) return;
      try {
        await api.delete(`/api/scheduler/${workspaceId}/jobs/${encodeURIComponent(jobId)}`);
        await loadJobs(workspaceId);
      } catch {
        // Non-fatal
      }
    },
    [workspaceId, loadJobs],
  );

  if (loading) {
    return (
      <div data-testid="schedule-page" className="flex h-full items-center justify-center">
        <p className="font-mono text-sm text-[#6B6860]">Loading...</p>
      </div>
    );
  }

  return (
    <div data-testid="schedule-page" className="p-6 max-w-2xl">
      <h1 className="mb-6 font-mono text-xl font-bold uppercase tracking-widest text-[#F5A623]">
        Schedules
      </h1>

      {error && (
        <div
          data-testid="schedule-error"
          className="mb-4 rounded-md border border-[#E84393]/40 bg-[#E84393]/10 px-4 py-2 font-mono text-sm text-[#E84393]"
        >
          {error}
        </div>
      )}

      {/* Job list */}
      <div data-testid="schedule-list" className="mb-6 flex flex-col gap-2">
        {jobs.length === 0 ? (
          <p className="font-mono text-sm text-[#6B6860]">No scheduled jobs yet.</p>
        ) : (
          jobs.map((job) => (
            <div
              key={job.job_id}
              data-testid={`schedule-item-${job.job_id}`}
              className="flex items-center justify-between rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3"
            >
              <div>
                <p className="font-mono text-sm font-medium text-[#F0EDE4]">{job.name}</p>
                {job.next_run_time && (
                  <p className="mt-0.5 font-mono text-[0.6rem] text-[#6B6860]">
                    Next run: {new Date(job.next_run_time).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                type="button"
                data-testid={`delete-schedule-${job.job_id}`}
                onClick={() => void handleDelete(job.job_id)}
                className="rounded border border-[#E84393]/30 bg-[#E84393]/10 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-[#E84393] transition-colors hover:bg-[#E84393]/20"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add schedule form */}
      {workspaceId && (
        <div
          data-testid="add-schedule-form"
          className="rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-4"
        >
          <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860]">
            Add Refresh Schedule
          </p>

          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                Table Name
              </label>
              <input
                data-testid="schedule-table-name-input"
                type="text"
                placeholder="my_table"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                Schedule
              </label>
              <select
                data-testid="schedule-preset-select"
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="mb-2 w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] focus:border-[#F5A623]/50 focus:outline-none"
              >
                {CRON_PRESETS.map((p) => (
                  <option key={p.label} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              {!preset && (
                <input
                  data-testid="schedule-cron-input"
                  type="text"
                  placeholder="0 9 * * * (min hour day month dow)"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1.5 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none"
                />
              )}
            </div>
          </div>

          {formError && (
            <p className="mt-2 font-mono text-[0.65rem] text-[#E84393]">{formError}</p>
          )}

          <button
            type="button"
            data-testid="add-schedule-button"
            disabled={adding || !tableName.trim() || !cronExpr.trim()}
            onClick={() => void handleAdd()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#F5A623]/40 bg-[#F5A623]/10 px-3 py-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-[#F5A623] transition-colors hover:bg-[#F5A623]/20 disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add Schedule"}
          </button>
        </div>
      )}

      <div className="mt-6 rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3">
        <p className="font-mono text-[0.65rem] text-[#6B6860]">
          Schedules run a placeholder refresh job. Full data source refresh (from external DBs or webhooks) will be connected in a future update.
        </p>
      </div>
    </div>
  );
}

export default SchedulePage;
