import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadTableCsv, downloadTableExcel, downloadTableJson } from "@/services/export";
import api from "@/services/api";

vi.mock("@/services/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("export service", () => {
  const fakeBlob = new Blob(["data"], { type: "text/csv" });

  let anchorClickSpy: ReturnType<typeof vi.fn>;
  let fakeAnchor: HTMLAnchorElement;
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // jsdom doesn't implement URL.createObjectURL — assign mocks directly.
    createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    revokeObjectURLMock = vi.fn();
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;

    anchorClickSpy = vi.fn();
    fakeAnchor = {
      href: "",
      download: "",
      click: anchorClickSpy,
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, "createElement").mockReturnValue(fakeAnchor);
  });

  // ─── downloadTableCsv ────────────────────────────────────────────────────

  describe("downloadTableCsv", () => {
    it("calls GET /api/export/{workspaceId}/tables/{tableName}/csv with responseType blob", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: fakeBlob });

      await downloadTableCsv("ws1", "sales");

      expect(api.get).toHaveBeenCalledWith(
        "/api/export/ws1/tables/sales/csv",
        { responseType: "blob" },
      );
    });

    it("creates an anchor, sets download to tableName.csv, and clicks it", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: fakeBlob });

      await downloadTableCsv("ws1", "sales");

      expect(createObjectURLMock).toHaveBeenCalledWith(fakeBlob);
      expect(fakeAnchor.href).toBe("blob:mock-url");
      expect(fakeAnchor.download).toBe("sales.csv");
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    });

    it("revokes the object URL after triggering the CSV download", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: fakeBlob });

      await downloadTableCsv("ws1", "sales");

      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");
    });

    it("propagates errors thrown by the API call", async () => {
      vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

      await expect(downloadTableCsv("ws1", "sales")).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── downloadTableExcel ──────────────────────────────────────────────────

  describe("downloadTableExcel", () => {
    it("calls GET /api/export/{workspaceId}/tables/{tableName}/excel with responseType blob", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: fakeBlob });

      await downloadTableExcel("ws1", "orders");

      expect(api.get).toHaveBeenCalledWith(
        "/api/export/ws1/tables/orders/excel",
        { responseType: "blob" },
      );
    });

    it("sets download filename to tableName.xlsx for Excel", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: fakeBlob });

      await downloadTableExcel("ws1", "orders");

      expect(fakeAnchor.download).toBe("orders.xlsx");
    });

    it("clicks the anchor element to trigger the Excel download", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: fakeBlob });

      await downloadTableExcel("ws1", "orders");

      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    });

    it("revokes the object URL after triggering the Excel download", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: fakeBlob });

      await downloadTableExcel("ws1", "orders");

      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");
    });
  });

  // ─── downloadTableJson ───────────────────────────────────────────────────

  describe("downloadTableJson", () => {
    it("calls GET /api/export/{workspaceId}/tables/{tableName}/json with responseType blob", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: fakeBlob });

      await downloadTableJson("ws1", "events");

      expect(api.get).toHaveBeenCalledWith(
        "/api/export/ws1/tables/events/json",
        { responseType: "blob" },
      );
    });

    it("sets download filename to tableName.json for JSON", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: fakeBlob });

      await downloadTableJson("ws1", "events");

      expect(fakeAnchor.download).toBe("events.json");
    });

    it("revokes the object URL after triggering the JSON download", async () => {
      vi.mocked(api.get).mockResolvedValue({ data: fakeBlob });

      await downloadTableJson("ws1", "events");

      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");
    });

    it("propagates errors thrown by the API call", async () => {
      vi.mocked(api.get).mockRejectedValue(new Error("Export failed"));

      await expect(downloadTableJson("ws1", "events")).rejects.toThrow(
        "Export failed",
      );
    });
  });
});
