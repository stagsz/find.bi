import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import useDashboardCards, {
  DEFAULT_CARD_W,
  DEFAULT_CARD_H,
  nextY,
} from "./useDashboardCards";
import type { DashboardCardConfig } from "@/components/dashboard/DashboardGrid";
import type { LayoutItem } from "react-grid-layout";

// --- Helper ---

const barConfig = {
  type: "bar" as const,
  title: "Revenue",
  query: "SELECT region, revenue FROM sales",
  columnMappings: { xField: "region", yField: "revenue" },
};

const lineConfig = {
  type: "line" as const,
  title: "Trend",
  query: "SELECT month, total FROM monthly",
  columnMappings: { xField: "month", yField: "total" },
};

const textConfig = {
  type: "text" as const,
  title: "Note",
  query: "",
  columnMappings: { content: "Hello world" },
};

// --- Tests ---

describe("useDashboardCards", () => {
  // --- Initialization ---

  it("starts with empty cards and layout by default", () => {
    const { result } = renderHook(() => useDashboardCards());
    expect(result.current.cards).toEqual([]);
    expect(result.current.layout).toEqual([]);
  });

  it("accepts initial cards and layout", () => {
    const initialCards: DashboardCardConfig[] = [
      { id: "c1", ...barConfig },
    ];
    const initialLayout: LayoutItem[] = [
      { i: "c1", x: 0, y: 0, w: 4, h: 3 },
    ];
    const { result } = renderHook(() =>
      useDashboardCards(initialCards, initialLayout),
    );
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].id).toBe("c1");
    expect(result.current.layout).toHaveLength(1);
  });

  // --- addCard ---

  it("addCard adds a new card with generated id", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id: string;
    act(() => {
      id = result.current.addCard(barConfig);
    });
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].id).toBe(id!);
    expect(result.current.cards[0].type).toBe("bar");
    expect(result.current.cards[0].title).toBe("Revenue");
    expect(result.current.cards[0].query).toBe(barConfig.query);
    expect(result.current.cards[0].columnMappings).toEqual(barConfig.columnMappings);
  });

  it("addCard creates a layout item at y=0 for first card", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id: string;
    act(() => {
      id = result.current.addCard(barConfig);
    });
    expect(result.current.layout).toHaveLength(1);
    const item = result.current.layout[0];
    expect(item.i).toBe(id!);
    expect(item.x).toBe(0);
    expect(item.y).toBe(0);
    expect(item.w).toBe(DEFAULT_CARD_W);
    expect(item.h).toBe(DEFAULT_CARD_H);
  });

  it("addCard places second card below the first", () => {
    const { result } = renderHook(() => useDashboardCards());
    act(() => {
      result.current.addCard(barConfig);
    });
    act(() => {
      result.current.addCard(lineConfig);
    });
    expect(result.current.layout).toHaveLength(2);
    expect(result.current.layout[1].y).toBe(DEFAULT_CARD_H);
  });

  it("addCard returns a unique id each time", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id1: string, id2: string;
    act(() => {
      id1 = result.current.addCard(barConfig);
    });
    act(() => {
      id2 = result.current.addCard(lineConfig);
    });
    expect(id1!).not.toBe(id2!);
  });

  it("addCard sets minW and minH on layout item", () => {
    const { result } = renderHook(() => useDashboardCards());
    act(() => {
      result.current.addCard(barConfig);
    });
    expect(result.current.layout[0].minW).toBe(2);
    expect(result.current.layout[0].minH).toBe(2);
  });

  // --- updateCard ---

  it("updateCard modifies an existing card", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id: string;
    act(() => {
      id = result.current.addCard(barConfig);
    });
    act(() => {
      result.current.updateCard(id!, lineConfig);
    });
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].id).toBe(id!);
    expect(result.current.cards[0].type).toBe("line");
    expect(result.current.cards[0].title).toBe("Trend");
  });

  it("updateCard preserves the card id", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id: string;
    act(() => {
      id = result.current.addCard(barConfig);
    });
    act(() => {
      result.current.updateCard(id!, { ...textConfig });
    });
    expect(result.current.cards[0].id).toBe(id!);
  });

  it("updateCard does not affect other cards", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id1: string, id2: string;
    act(() => {
      id1 = result.current.addCard(barConfig);
    });
    act(() => {
      id2 = result.current.addCard(lineConfig);
    });
    act(() => {
      result.current.updateCard(id1!, textConfig);
    });
    expect(result.current.cards).toHaveLength(2);
    expect(result.current.cards[0].type).toBe("text");
    expect(result.current.cards[1].id).toBe(id2!);
    expect(result.current.cards[1].type).toBe("line");
  });

  it("updateCard does not change layout", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id: string;
    act(() => {
      id = result.current.addCard(barConfig);
    });
    const layoutBefore = [...result.current.layout];
    act(() => {
      result.current.updateCard(id!, lineConfig);
    });
    expect(result.current.layout).toEqual(layoutBefore);
  });

  // --- removeCard ---

  it("removeCard removes card from cards array", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id: string;
    act(() => {
      id = result.current.addCard(barConfig);
    });
    act(() => {
      result.current.removeCard(id!);
    });
    expect(result.current.cards).toHaveLength(0);
  });

  it("removeCard removes the layout item", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id: string;
    act(() => {
      id = result.current.addCard(barConfig);
    });
    act(() => {
      result.current.removeCard(id!);
    });
    expect(result.current.layout).toHaveLength(0);
  });

  it("removeCard does not affect other cards", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id1: string;
    act(() => {
      id1 = result.current.addCard(barConfig);
    });
    act(() => {
      result.current.addCard(lineConfig);
    });
    act(() => {
      result.current.removeCard(id1!);
    });
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].type).toBe("line");
    expect(result.current.layout).toHaveLength(1);
  });

  // --- onLayoutChange ---

  it("onLayoutChange updates the layout", () => {
    const { result } = renderHook(() => useDashboardCards());
    act(() => {
      result.current.addCard(barConfig);
    });
    const newLayout: LayoutItem[] = [
      { i: result.current.cards[0].id, x: 2, y: 1, w: 6, h: 4 },
    ];
    act(() => {
      result.current.onLayoutChange(newLayout);
    });
    expect(result.current.layout[0].x).toBe(2);
    expect(result.current.layout[0].y).toBe(1);
    expect(result.current.layout[0].w).toBe(6);
  });

  // --- Multiple operations ---

  it("supports add, update, remove sequence", () => {
    const { result } = renderHook(() => useDashboardCards());
    let id1: string, id2: string;
    act(() => {
      id1 = result.current.addCard(barConfig);
    });
    act(() => {
      id2 = result.current.addCard(lineConfig);
    });
    act(() => {
      result.current.addCard(textConfig);
    });
    expect(result.current.cards).toHaveLength(3);

    act(() => {
      result.current.updateCard(id2!, { ...barConfig, title: "Updated" });
    });
    expect(result.current.cards[1].title).toBe("Updated");

    act(() => {
      result.current.removeCard(id1!);
    });
    expect(result.current.cards).toHaveLength(2);
    expect(result.current.layout).toHaveLength(2);
  });
});

// --- nextY utility ---

describe("nextY", () => {
  it("returns 0 for empty layout", () => {
    expect(nextY([])).toBe(0);
  });

  it("returns sum of y + h for single item", () => {
    expect(nextY([{ i: "a", x: 0, y: 0, w: 4, h: 3 }])).toBe(3);
  });

  it("returns the max bottom of all items", () => {
    expect(
      nextY([
        { i: "a", x: 0, y: 0, w: 4, h: 3 },
        { i: "b", x: 4, y: 0, w: 4, h: 5 },
        { i: "c", x: 0, y: 3, w: 4, h: 2 },
      ]),
    ).toBe(5);
  });
});
