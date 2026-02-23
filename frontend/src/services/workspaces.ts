/**
 * Workspace API service — typed wrappers around /api/workspaces endpoints.
 */

import api from "@/services/api";

export interface WorkspaceDTO {
  id: string;
  name: string;
  duckdb_path: string;
  created_at: string;
}

export async function listWorkspaces(): Promise<WorkspaceDTO[]> {
  const res = await api.get<WorkspaceDTO[]>("/api/workspaces/");
  return res.data;
}
