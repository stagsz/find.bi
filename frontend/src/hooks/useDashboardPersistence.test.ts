import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import useDashboardPersistence from "./useDashboardPersistence";
import type { DashboardDTO } from "@/services/dashboards";

const mocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  updateDashboard: vi.fn(),
}));

vi.mock("@/services/dashboards", () => ({
  getDashboard: (...args: unknown[]) => mocks.getDashboard(...args),
  updateDashboard: (...args: unknown[]) => mocks.updateDashboard(...args),
}));

const SAMPLE_DTO: DashboardDTO = {
  id: "d-1",
  workspace_id: "ws-1",
  name: "Test Dashboard",
  layout_json: { items: [{ i: "c1", x: 0, y: 0, w: 4, h: 3 }] },
  cards_json: {
    cards: [
      { id: "c1", type: "bar", title: "Test", query: "SELECT 1", columnMappings: {} },
    ],
  },
  filters_json: { filters: [], values: {} },
  created_at: "2024-01-01T00:00:00",
  updated_at: "2024-01-01T00:00:00",
};

describe("useDashboardPersistence", () => {
  let setCards: ReturnType<typeof vi.fn>;
  let setLayout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    setCards = vi.fn();
    setLayout = vi.fn();
    mocks.getDashboard.mockResolvedValue(SAMPLE_DTO);
    mocks.updateDashboard.mockResolvedValue(SAMPLE_DTO);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderPersistence(
    dashboardId: string | undefined,
    cards: unknown[] = [],
    layout: unknown[] = [],
    filters: unknown[] = [],
    filterValues: Record<string, unknown> = {},
  ) {
    return renderHook(
      ({ id, c, l, f, fv }) =>
        useDashboardPersistence(
          id,
          c as never,
          l as never,
          f as never,
          fv as never,
          setCards,
          setLayout,
        ),
      {
        initialProps: {
          id: dashboardId,
          c: cards,
          l: layout,
          f: filters,
          fv: filterValues,
        },
      },
    );
  }

  // Helper: wait for load to complete (real timers)
  async function waitForLoad() {
    // Flush the getDashboard promise + the setTimeout(0) that sets loadedRef
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }

  // --- Loading ---

  it("starts with loading=true when dashboardId is provided", async () => {
    mocks.getDashboard.mockReturnValue(new Promise(() => {}));
    const { result } = renderPersistence("d-1");
    expect(result.current.loading).toBe(true);
  });

  it("does not load when dashboardId is undefined", async () => {
    const { result } = renderPersistence(undefined);
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(mocks.getDashboard).not.toHaveBeenCalled();
  });

  it("sets loading=false after load completes", async () => {
    const { result } = renderPersistence("d-1");
    await waitForLoad();
    expect(result.current.loading).toBe(false);
  });

  // --- Successful load ---

  it("sets dashboard after successful load", async () => {
    const { result } = renderPersistence("d-1");
    await waitForLoad();
    expect(result.current.dashboard).toEqual(SAMPLE_DTO);
  });

  it("calls setCards with cards from API response", async () => {
    renderPersistence("d-1");
    await waitForLoad();
    expect(setCards).toHaveBeenCalledWith(SAMPLE_DTO.cards_json.cards);
  });

  it("calls setLayout with layout items from API response", async () => {
    renderPersistence("d-1");
    await waitForLoad();
    expect(setLayout).toHaveBeenCalledWith(
      (SAMPLE_DTO.layout_json as { items: unknown[] }).items,
    );
  });

  // --- Error on load ---

  it("sets error when load fails", async () => {
    mocks.getDashboard.mockRejectedValue({
      response: { data: { detail: "Not found" } },
    });
    const { result } = renderPersistence("d-1");
    await waitForLoad();
    expect(result.current.error).toBe("Not found");
  });

  it("sets generic error when load fails without detail", async () => {
    mocks.getDashboard.mockRejectedValue(new Error("Network error"));
    const { result } = renderPersistence("d-1");
    await waitForLoad();
    expect(result.current.error).toBe("Failed to load dashboard");
  });

  // --- Auto-save ---

  it("does not auto-save before load completes", async () => {
    vi.useFakeTimers();
    mocks.getDashboard.mockReturnValue(new Promise(() => {}));
    const { rerender } = renderPersistence("d-1", [], []);

    // Change cards to trigger auto-save
    rerender({ id: "d-1", c: [{ id: "new" }], l: [], f: [], fv: {} });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mocks.updateDashboard).not.toHaveBeenCalled();
  });

  it("auto-saves after load and change with 2s debounce", async () => {
    vi.useFakeTimers();
    const { rerender } = renderPersistence("d-1", [], []);

    // Wait for load: flush the promise and the setTimeout(0) that sets loadedRef
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Change cards — triggers the debounced auto-save effect
    rerender({
      id: "d-1",
      c: [{ id: "c2", type: "line", title: "New", query: "SELECT 1", columnMappings: {} }],
      l: [],
      f: [],
      fv: {},
    });

    // Before debounce — should NOT have saved yet
    expect(mocks.updateDashboard).not.toHaveBeenCalled();

    // Advance past the 2s debounce + flush promise
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(mocks.updateDashboard).toHaveBeenCalled();
  });

  // --- Immediate save ---

  it("save() triggers immediate persist", async () => {
    const { result } = renderPersistence("d-1", [], []);
    await waitForLoad();

    await act(async () => {
      await result.current.save();
    });

    expect(mocks.updateDashboard).toHaveBeenCalledWith("d-1", expect.objectContaining({
      layout_json: expect.any(Object),
      cards_json: expect.any(Object),
      filters_json: expect.any(Object),
    }));
  });

  // --- Save error ---

  it("sets error when save fails", async () => {
    mocks.updateDashboard.mockRejectedValue({
      response: { data: { detail: "Save failed" } },
    });
    const { result } = renderPersistence("d-1", [], []);
    await waitForLoad();

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.error).toBe("Save failed");
  });

  // --- Empty JSON defaults ---

  it("handles empty cards_json and layout_json gracefully", async () => {
    mocks.getDashboard.mockResolvedValue({
      ...SAMPLE_DTO,
      layout_json: {},
      cards_json: {},
    });
    renderPersistence("d-1");
    await waitForLoad();
    expect(setCards).toHaveBeenCalledWith([]);
    expect(setLayout).toHaveBeenCalledWith([]);
  });
});
