/**
 * Table export service — typed wrappers that trigger browser file downloads
 * for /api/export/{workspace_id}/tables/{table_name}/{format} endpoints.
 *
 * The `api` axios instance is used so the JWT Authorization header is sent
 * automatically via the existing request interceptor.
 */

import api from "@/services/api";

// ─── Internal helper ─────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Downloads the given table as a CSV file.
 * The browser will receive a file named `<tableName>.csv`.
 */
export async function downloadTableCsv(
  workspaceId: string,
  tableName: string,
): Promise<void> {
  const res = await api.get(
    `/api/export/${encodeURIComponent(workspaceId)}/tables/${encodeURIComponent(tableName)}/csv`,
    { responseType: "blob" },
  );
  triggerDownload(res.data as Blob, `${tableName}.csv`);
}

/**
 * Downloads the given table as an Excel (.xlsx) file.
 * The browser will receive a file named `<tableName>.xlsx`.
 */
export async function downloadTableExcel(
  workspaceId: string,
  tableName: string,
): Promise<void> {
  const res = await api.get(
    `/api/export/${encodeURIComponent(workspaceId)}/tables/${encodeURIComponent(tableName)}/excel`,
    { responseType: "blob" },
  );
  triggerDownload(res.data as Blob, `${tableName}.xlsx`);
}

/**
 * Downloads the given table as a JSON file.
 * The browser will receive a file named `<tableName>.json`.
 */
export async function downloadTableJson(
  workspaceId: string,
  tableName: string,
): Promise<void> {
  const res = await api.get(
    `/api/export/${encodeURIComponent(workspaceId)}/tables/${encodeURIComponent(tableName)}/json`,
    { responseType: "blob" },
  );
  triggerDownload(res.data as Blob, `${tableName}.json`);
}
