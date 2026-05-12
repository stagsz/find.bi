/**
 * Webhook API service — typed wrappers around /api/webhooks endpoints.
 */

import api from "@/services/api";

export interface WebhookConfigStatus {
  has_config: boolean;
  table_name?: string;
  workspace_id: string;
}

export interface WebhookConfigureResponse {
  api_key: string;
  table_name: string;
  workspace_id: string;
}

export async function getWebhookConfig(
  workspaceId: string,
): Promise<WebhookConfigStatus> {
  const res = await api.get<WebhookConfigStatus>(
    `/api/webhooks/${workspaceId}/config`,
  );
  return res.data;
}

export async function configureWebhook(
  workspaceId: string,
  tableName: string,
): Promise<WebhookConfigureResponse> {
  const res = await api.post<WebhookConfigureResponse>(
    `/api/webhooks/${workspaceId}/configure`,
    { table_name: tableName },
  );
  return res.data;
}
