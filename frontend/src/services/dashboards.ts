/**
 * Dashboard API service — typed wrappers around /api/dashboards endpoints.
 */

import api from "@/services/api";

export interface DashboardDTO {
  id: string;
  workspace_id: string;
  name: string;
  layout_json: Record<string, unknown>;
  cards_json: Record<string, unknown>;
  filters_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateDashboardPayload {
  workspace_id: string;
  name: string;
  layout_json?: Record<string, unknown>;
  cards_json?: Record<string, unknown>;
  filters_json?: Record<string, unknown>;
}

export interface UpdateDashboardPayload {
  name?: string;
  layout_json?: Record<string, unknown>;
  cards_json?: Record<string, unknown>;
  filters_json?: Record<string, unknown>;
}

export async function listDashboards(
  workspaceId: string,
): Promise<DashboardDTO[]> {
  const res = await api.get<DashboardDTO[]>("/api/dashboards/", {
    params: { workspace_id: workspaceId },
  });
  return res.data;
}

export async function createDashboard(
  payload: CreateDashboardPayload,
): Promise<DashboardDTO> {
  const res = await api.post<DashboardDTO>("/api/dashboards/", payload);
  return res.data;
}

export async function getDashboard(id: string): Promise<DashboardDTO> {
  const res = await api.get<DashboardDTO>(`/api/dashboards/${id}`);
  return res.data;
}

export async function updateDashboard(
  id: string,
  payload: UpdateDashboardPayload,
): Promise<DashboardDTO> {
  const res = await api.put<DashboardDTO>(
    `/api/dashboards/${id}`,
    payload,
  );
  return res.data;
}

export async function deleteDashboard(id: string): Promise<void> {
  await api.delete(`/api/dashboards/${id}`);
}

export interface DashboardExport {
  version: number;
  name: string;
  layout_json: Record<string, unknown>;
  cards_json: Record<string, unknown>;
  filters_json: Record<string, unknown>;
}

export async function exportDashboard(id: string): Promise<DashboardExport> {
  const res = await api.get<DashboardExport>(
    `/api/dashboards/${id}/export`,
  );
  return res.data;
}

export async function importDashboard(
  workspaceId: string,
  dashboard: DashboardExport,
): Promise<DashboardDTO> {
  const res = await api.post<DashboardDTO>("/api/dashboards/import", {
    workspace_id: workspaceId,
    dashboard,
  });
  return res.data;
}
