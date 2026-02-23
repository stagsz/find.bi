import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { FiltersProvider, useFilters } from "./useFilters";
import type { FilterType } from "./useFilters";

// --- Wrapper ---

function wrapper({ children }: { children: ReactNode }) {
  return <FiltersProvider>{children}</FiltersProvider>;
}

// --- Tests ---

describe("useFilters", () => {
  // --- Context requirement ---

  it("throws if used outside FiltersProvider", () => {
    expect(() => {
      renderHook(() => useFilters());
    }).toThrow("useFilters must be used within a FiltersProvider");
  });

  // --- Initialization ---

  it("starts with empty filters and values", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    expect(result.current.filters).toEqual([]);
    expect(result.current.values).toEqual({});
  });

  // --- addFilter ---

  it("adds a dateRange filter with null default value", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id: string;
    act(() => {
      id = result.current.addFilter({
        type: "dateRange",
        label: "Created Date",
        column: "created_at",
      });
    });
    expect(result.current.filters).toHaveLength(1);
    expect(result.current.filters[0].id).toBe(id!);
    expect(result.current.filters[0].type).toBe("dateRange");
    expect(result.current.filters[0].label).toBe("Created Date");
    expect(result.current.filters[0].column).toBe("created_at");
    expect(result.current.values[id!]).toBeNull();
  });

  it("adds a dropdown filter with null default value", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id: string;
    act(() => {
      id = result.current.addFilter({
        type: "dropdown",
        label: "Region",
        column: "region",
        options: [
          { label: "North", value: "north" },
          { label: "South", value: "south" },
        ],
      });
    });
    expect(result.current.filters).toHaveLength(1);
    expect(result.current.filters[0].type).toBe("dropdown");
    expect(result.current.filters[0].options).toHaveLength(2);
    expect(result.current.values[id!]).toBeNull();
  });

  it("adds a multiSelect filter with empty array default", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id: string;
    act(() => {
      id = result.current.addFilter({
        type: "multiSelect",
        label: "Categories",
        column: "category",
      });
    });
    expect(result.current.values[id!]).toEqual([]);
  });

  it("adds a search filter with empty string default", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id: string;
    act(() => {
      id = result.current.addFilter({
        type: "search",
        label: "Name",
        column: "name",
      });
    });
    expect(result.current.values[id!]).toBe("");
  });

  it("returns a unique id for each filter added", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id1: string, id2: string;
    act(() => {
      id1 = result.current.addFilter({
        type: "search",
        label: "Name",
        column: "name",
      });
    });
    act(() => {
      id2 = result.current.addFilter({
        type: "dropdown",
        label: "Status",
        column: "status",
      });
    });
    expect(id1!).not.toBe(id2!);
    expect(result.current.filters).toHaveLength(2);
  });

  it("maintains insertion order of filters", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    act(() => {
      result.current.addFilter({ type: "search", label: "A", column: "a" });
    });
    act(() => {
      result.current.addFilter({ type: "dropdown", label: "B", column: "b" });
    });
    act(() => {
      result.current.addFilter({ type: "dateRange", label: "C", column: "c" });
    });
    expect(result.current.filters.map((f) => f.label)).toEqual(["A", "B", "C"]);
  });

  // --- removeFilter ---

  it("removes a filter by id", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id: string;
    act(() => {
      id = result.current.addFilter({
        type: "search",
        label: "Name",
        column: "name",
      });
    });
    act(() => {
      result.current.removeFilter(id!);
    });
    expect(result.current.filters).toHaveLength(0);
    expect(result.current.values[id!]).toBeUndefined();
  });

  it("does not affect other filters when removing", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id1: string;
    act(() => {
      id1 = result.current.addFilter({
        type: "search",
        label: "A",
        column: "a",
      });
    });
    act(() => {
      result.current.addFilter({ type: "dropdown", label: "B", column: "b" });
    });
    act(() => {
      result.current.removeFilter(id1!);
    });
    expect(result.current.filters).toHaveLength(1);
    expect(result.current.filters[0].label).toBe("B");
  });

  it("removing a non-existent id is a no-op", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    act(() => {
      result.current.addFilter({
        type: "search",
        label: "A",
        column: "a",
      });
    });
    act(() => {
      result.current.removeFilter("non-existent-id");
    });
    expect(result.current.filters).toHaveLength(1);
  });

  // --- updateFilterValue ---

  it("updates a dateRange filter value", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id: string;
    act(() => {
      id = result.current.addFilter({
        type: "dateRange",
        label: "Date",
        column: "date",
      });
    });
    act(() => {
      result.current.updateFilterValue(id!, {
        start: "2026-01-01",
        end: "2026-12-31",
      });
    });
    expect(result.current.values[id!]).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
  });

  it("updates a dropdown filter value", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id: string;
    act(() => {
      id = result.current.addFilter({
        type: "dropdown",
        label: "Region",
        column: "region",
      });
    });
    act(() => {
      result.current.updateFilterValue(id!, "north");
    });
    expect(result.current.values[id!]).toBe("north");
  });

  it("updates a multiSelect filter value", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id: string;
    act(() => {
      id = result.current.addFilter({
        type: "multiSelect",
        label: "Tags",
        column: "tag",
      });
    });
    act(() => {
      result.current.updateFilterValue(id!, ["a", "b"]);
    });
    expect(result.current.values[id!]).toEqual(["a", "b"]);
  });

  it("updates a search filter value", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id: string;
    act(() => {
      id = result.current.addFilter({
        type: "search",
        label: "Query",
        column: "q",
      });
    });
    act(() => {
      result.current.updateFilterValue(id!, "hello");
    });
    expect(result.current.values[id!]).toBe("hello");
  });

  it("allows setting value back to null", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let id: string;
    act(() => {
      id = result.current.addFilter({
        type: "dropdown",
        label: "Status",
        column: "status",
      });
    });
    act(() => {
      result.current.updateFilterValue(id!, "active");
    });
    act(() => {
      result.current.updateFilterValue(id!, null);
    });
    expect(result.current.values[id!]).toBeNull();
  });

  // --- clearAllValues ---

  it("resets all filter values to their defaults", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    let idDate: string, idSearch: string, idMulti: string, idDrop: string;
    act(() => {
      idDate = result.current.addFilter({
        type: "dateRange",
        label: "Date",
        column: "date",
      });
    });
    act(() => {
      idSearch = result.current.addFilter({
        type: "search",
        label: "Name",
        column: "name",
      });
    });
    act(() => {
      idMulti = result.current.addFilter({
        type: "multiSelect",
        label: "Tags",
        column: "tag",
      });
    });
    act(() => {
      idDrop = result.current.addFilter({
        type: "dropdown",
        label: "Status",
        column: "status",
      });
    });

    // Set some values
    act(() => {
      result.current.updateFilterValue(idDate!, {
        start: "2026-01-01",
        end: "2026-06-30",
      });
      result.current.updateFilterValue(idSearch!, "test");
      result.current.updateFilterValue(idMulti!, ["a", "b"]);
      result.current.updateFilterValue(idDrop!, "active");
    });

    // Clear all
    act(() => {
      result.current.clearAllValues();
    });

    expect(result.current.values[idDate!]).toBeNull();
    expect(result.current.values[idSearch!]).toBe("");
    expect(result.current.values[idMulti!]).toEqual([]);
    expect(result.current.values[idDrop!]).toBeNull();
  });

  it("clearAllValues preserves filter configurations", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    act(() => {
      result.current.addFilter({
        type: "search",
        label: "Name",
        column: "name",
      });
    });
    act(() => {
      result.current.updateFilterValue(
        result.current.filters[0].id,
        "test",
      );
    });
    act(() => {
      result.current.clearAllValues();
    });
    expect(result.current.filters).toHaveLength(1);
    expect(result.current.filters[0].label).toBe("Name");
  });

  // --- removeAllFilters ---

  it("removes all filters and values", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    act(() => {
      result.current.addFilter({
        type: "search",
        label: "A",
        column: "a",
      });
    });
    act(() => {
      result.current.addFilter({
        type: "dropdown",
        label: "B",
        column: "b",
      });
    });
    act(() => {
      result.current.removeAllFilters();
    });
    expect(result.current.filters).toEqual([]);
    expect(result.current.values).toEqual({});
  });

  // --- All four types have correct defaults ---

  it.each([
    ["dateRange", null],
    ["dropdown", null],
    ["multiSelect", []],
    ["search", ""],
  ] as [FilterType, unknown][])(
    "type %s has default value %j",
    (type, expectedDefault) => {
      const { result } = renderHook(() => useFilters(), { wrapper });
      let id: string;
      act(() => {
        id = result.current.addFilter({ type, label: "Test", column: "test" });
      });
      expect(result.current.values[id!]).toEqual(expectedDefault);
    },
  );

  // --- Complex sequence ---

  it("supports add, update, remove, clear sequence", () => {
    const { result } = renderHook(() => useFilters(), { wrapper });

    // Add two filters
    let id1: string, id2: string;
    act(() => {
      id1 = result.current.addFilter({
        type: "search",
        label: "Name",
        column: "name",
      });
    });
    act(() => {
      id2 = result.current.addFilter({
        type: "dropdown",
        label: "Status",
        column: "status",
      });
    });
    expect(result.current.filters).toHaveLength(2);

    // Update values
    act(() => {
      result.current.updateFilterValue(id1!, "test");
      result.current.updateFilterValue(id2!, "active");
    });
    expect(result.current.values[id1!]).toBe("test");
    expect(result.current.values[id2!]).toBe("active");

    // Remove first filter
    act(() => {
      result.current.removeFilter(id1!);
    });
    expect(result.current.filters).toHaveLength(1);
    expect(result.current.values[id1!]).toBeUndefined();
    expect(result.current.values[id2!]).toBe("active");

    // Clear remaining
    act(() => {
      result.current.clearAllValues();
    });
    expect(result.current.values[id2!]).toBeNull();
    expect(result.current.filters).toHaveLength(1);

    // Remove all
    act(() => {
      result.current.removeAllFilters();
    });
    expect(result.current.filters).toEqual([]);
    expect(result.current.values).toEqual({});
  });
});
