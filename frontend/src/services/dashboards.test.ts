import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listDashboards,
  createDashboard,
  getDashboard,
  updateDashboard,
  deleteDashboard,
  exportDashboard,
  importDashboard,
} from "@/services/dashboards";
import type { DashboardDTO, DashboardExport } from "@/services/dashboards";
import api from "@/services/api";

vi.mock("@/services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const SAMPLE_DASHBOARD: DashboardDTO = {
  id: "d1",
  workspace_id: "ws1",
  name: "Sales",
  layout_json: { items: [] },
  cards_json: { cards: [] },
  filters_json: {},
  created_at: "2024-01-01T00:00:00",
  updated_at: "2024-01-01T00:00:00",
};

describe("dashboards service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listDashboards", () => {
    it("calls GET /api/dashboards/ with workspace_id param", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: [SAMPLE_DASHBOARD] });

      const result = await listDashboards("ws1");

      expect(api.get).toHaveBeenCalledWith("/api/dashboards/", {
        params: { workspace_id: "ws1" },
      });
      expect(result).toEqual([SAMPLE_DASHBOARD]);
    });

    it("returns empty array when no dashboards", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: [] });

      const result = await listDashboards("ws1");
      expect(result).toEqual([]);
    });
  });

  describe("createDashboard", () => {
    it("calls POST /api/dashboards/ with payload", async () => {
      vi.mocked(api.post).mockResolvedValue({ data: SAMPLE_DASHBOARD });

      const result = await createDashboard({
        workspace_id: "ws1",
        name: "Sales",
      });

      expect(api.post).toHaveBeenCalledWith("/api/dashboards/", {
        workspace_id: "ws1",
        name: "Sales",
      });
      expect(result).toEqual(SAMPLE_DASHBOARD);
    });

    it("passes optional JSON fields", async () => {
      vi.mocked(api.post).mockResolvedValue({ data: SAMPLE_DASHBOARD });

      await createDashboard({
        workspace_id: "ws1",
        name: "Test",
        layout_json: { items: [{ i: "c1", x: 0, y: 0, w: 4, h: 3 }] },
      });

      expect(vi.mocked(api.post).mock.calls[0][1]).toHaveProperty(
        "layout_json",
      );
    });
  });

  describe("getDashboard", () => {
    it("calls GET /api/dashboards/:id", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: SAMPLE_DASHBOARD });

      const result = await getDashboard("d1");

      expect(api.get).toHaveBeenCalledWith("/api/dashboards/d1");
      expect(result).toEqual(SAMPLE_DASHBOARD);
    });
  });

  describe("updateDashboard", () => {
    it("calls PUT /api/dashboards/:id with payload", async () => {
      const updated = { ...SAMPLE_DASHBOARD, name: "Updated" };
      vi.mocked(api.put).mockResolvedValue({ data: updated });

      const result = await updateDashboard("d1", { name: "Updated" });

      expect(api.put).toHaveBeenCalledWith("/api/dashboards/d1", {
        name: "Updated",
      });
      expect(result.name).toBe("Updated");
    });

    it("can update layout_json only", async () => {
      vi.mocked(api.put).mockResolvedValue({ data: SAMPLE_DASHBOARD });

      await updateDashboard("d1", { layout_json: { items: [] } });

      expect(vi.mocked(api.put).mock.calls[0][1]).toEqual({
        layout_json: { items: [] },
      });
    });
  });

  describe("deleteDashboard", () => {
    it("calls DELETE /api/dashboards/:id", async () => {
      vi.mocked(api.delete).mockResolvedValue({ data: null });

      await deleteDashboard("d1");

      expect(api.delete).toHaveBeenCalledWith("/api/dashboards/d1");
    });
  });

  describe("exportDashboard", () => {
    const SAMPLE_EXPORT: DashboardExport = {
      version: 1,
      name: "Sales",
      layout_json: { items: [] },
      cards_json: { cards: [] },
      filters_json: {},
    };

    it("calls GET /api/dashboards/:id/export", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: SAMPLE_EXPORT });

      const result = await exportDashboard("d1");

      expect(api.get).toHaveBeenCalledWith("/api/dashboards/d1/export");
      expect(result).toEqual(SAMPLE_EXPORT);
    });
  });

  describe("importDashboard", () => {
    const IMPORT_DATA: DashboardExport = {
      version: 1,
      name: "Imported",
      layout_json: { items: [] },
      cards_json: { cards: [] },
      filters_json: {},
    };

    it("calls POST /api/dashboards/import with workspace_id and dashboard", async () => {
      vi.mocked(api.post).mockResolvedValue({ data: SAMPLE_DASHBOARD });

      const result = await importDashboard("ws1", IMPORT_DATA);

      expect(api.post).toHaveBeenCalledWith("/api/dashboards/import", {
        workspace_id: "ws1",
        dashboard: IMPORT_DATA,
      });
      expect(result).toEqual(SAMPLE_DASHBOARD);
    });
  });
});
