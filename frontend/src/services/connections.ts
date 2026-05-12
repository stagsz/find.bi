/**
 * Connections service — typed wrappers for external DB connection endpoints.
 */

import api from "@/services/api";

export interface ExternalConnection {
  id: string;
  name: string;
  conn_type: "postgresql" | "mysql" | "sqlite";
  host: string | null;
  port: number | null;
  database: string;
  username: string | null;
}

export interface TestConnectionResult {
  success: boolean;
  error: string | null;
  tables: string[];
}

export interface ConnectionPayload {
  name: string;
  conn_type: "postgresql" | "mysql" | "sqlite";
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
}

export async function listConnections(workspaceId: string): Promise<ExternalConnection[]> {
  const res = await api.get<ExternalConnection[]>(`/api/connections/${workspaceId}`);
  return res.data;
}

export async function testConnection(
  workspaceId: string,
  payload: Omit<ConnectionPayload, "name">,
): Promise<TestConnectionResult> {
  const res = await api.post<TestConnectionResult>(`/api/connections/${workspaceId}/test`, payload);
  return res.data;
}

export async function createConnection(
  workspaceId: string,
  payload: ConnectionPayload,
): Promise<ExternalConnection> {
  const res = await api.post<ExternalConnection>(`/api/connections/${workspaceId}`, payload);
  return res.data;
}

export async function deleteConnection(workspaceId: string, connectionId: string): Promise<void> {
  await api.delete(`/api/connections/${workspaceId}/${connectionId}`);
}

export async function listConnectionTables(
  workspaceId: string,
  connectionId: string,
): Promise<string[]> {
  const res = await api.post<{ tables: string[] }>(
    `/api/connections/${workspaceId}/${connectionId}/tables`,
    {},
  );
  return res.data.tables;
}
