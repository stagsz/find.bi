import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  listDashboards,
  createDashboard,
  deleteDashboard,
} from "@/services/dashboards";
import type { DashboardDTO } from "@/services/dashboards";
import { listWorkspaces } from "@/services/workspaces";

function DashboardListPage() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<DashboardDTO[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Fetch default workspace, then dashboards
  const fetchDashboards = useCallback(async (wsId: string) => {
    try {
      const list = await listDashboards(wsId);
      setDashboards(list);
    } catch {
      setError("Failed to load dashboards");
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
        return fetchDashboards(wsId);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load workspaces");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchDashboards]);

  const handleCreate = useCallback(async () => {
    if (!workspaceId || !newName.trim()) return;
    setCreating(true);
    try {
      const created = await createDashboard({
        workspace_id: workspaceId,
        name: newName.trim(),
      });
      setShowCreate(false);
      setNewName("");
      navigate(`/dashboards/${created.id}`);
    } catch {
      setError("Failed to create dashboard");
    } finally {
      setCreating(false);
    }
  }, [workspaceId, newName, navigate]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!workspaceId) return;
      try {
        await deleteDashboard(id);
        setDashboards((prev) => prev.filter((d) => d.id !== id));
      } catch {
        setError("Failed to delete dashboard");
      }
    },
    [workspaceId],
  );

  if (loading) {
    return (
      <div
        data-testid="dashboards-loading"
        className="flex h-full items-center justify-center"
      >
        <p className="text-sm text-gray-500">Loading dashboards...</p>
      </div>
    );
  }

  if (error && dashboards.length === 0) {
    return (
      <div
        data-testid="dashboards-error"
        className="flex h-full items-center justify-center"
      >
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-list-page" className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboards</h1>
        <button
          data-testid="new-dashboard-button"
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => setShowCreate(true)}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          New Dashboard
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          data-testid="dashboards-error-banner"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <div
          data-testid="create-dashboard-form"
          className="mb-6 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <input
            data-testid="create-dashboard-input"
            type="text"
            placeholder="Dashboard name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") {
                setShowCreate(false);
                setNewName("");
              }
            }}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button
            data-testid="create-dashboard-confirm"
            type="button"
            disabled={creating || !newName.trim()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => void handleCreate()}
          >
            {creating ? "Creating..." : "Create"}
          </button>
          <button
            data-testid="create-dashboard-cancel"
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => {
              setShowCreate(false);
              setNewName("");
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Dashboard list */}
      {dashboards.length === 0 ? (
        <div
          data-testid="dashboards-empty"
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <svg
            className="mb-4 h-12 w-12 text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
            />
          </svg>
          <p className="text-sm font-medium text-gray-600">
            No dashboards yet
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Click &quot;New Dashboard&quot; to create your first dashboard
          </p>
        </div>
      ) : (
        <div
          data-testid="dashboard-list"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {dashboards.map((dash) => (
            <div
              key={dash.id}
              data-testid={`dashboard-card-${dash.id}`}
              className="group relative cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              onClick={() => navigate(`/dashboards/${dash.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/dashboards/${dash.id}`);
              }}
              role="button"
              tabIndex={0}
            >
              <h3 className="text-sm font-medium text-gray-900">
                {dash.name}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Updated {new Date(dash.updated_at).toLocaleDateString()}
              </p>
              <button
                data-testid={`delete-dashboard-${dash.id}`}
                type="button"
                className="absolute right-2 top-2 hidden rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:block"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(dash.id);
                }}
                aria-label={`Delete ${dash.name}`}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DashboardListPage;
