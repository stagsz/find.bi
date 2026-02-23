import { useState, useCallback } from "react";
import type { DashboardCardConfig, LayoutItem } from "@/components/dashboard/DashboardGrid";

/** Default size for new cards on the grid (columns x rows) */
const DEFAULT_CARD_W = 4;
const DEFAULT_CARD_H = 3;
/** Max columns at the lg breakpoint */
const LG_COLS = 12;

function generateId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Find the next available Y position (below all existing items) */
function nextY(layout: LayoutItem[]): number {
  if (layout.length === 0) return 0;
  let maxBottom = 0;
  for (const item of layout) {
    const bottom = item.y + item.h;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return maxBottom;
}

export interface UseDashboardCardsReturn {
  cards: DashboardCardConfig[];
  layout: LayoutItem[];
  addCard: (config: Omit<DashboardCardConfig, "id">) => string;
  updateCard: (id: string, config: Omit<DashboardCardConfig, "id">) => void;
  removeCard: (id: string) => void;
  onLayoutChange: (layout: LayoutItem[]) => void;
  setCards: React.Dispatch<React.SetStateAction<DashboardCardConfig[]>>;
  setLayout: React.Dispatch<React.SetStateAction<LayoutItem[]>>;
}

function useDashboardCards(
  initialCards: DashboardCardConfig[] = [],
  initialLayout: LayoutItem[] = [],
): UseDashboardCardsReturn {
  const [cards, setCards] = useState<DashboardCardConfig[]>(initialCards);
  const [layout, setLayout] = useState<LayoutItem[]>(initialLayout);

  const addCard = useCallback(
    (config: Omit<DashboardCardConfig, "id">): string => {
      const id = generateId();
      const newCard: DashboardCardConfig = { ...config, id };

      setCards((prev) => [...prev, newCard]);

      // Place new card at the bottom-left of the grid
      setLayout((prev) => {
        const y = nextY(prev);
        const newItem: LayoutItem = {
          i: id,
          x: 0,
          y,
          w: DEFAULT_CARD_W,
          h: DEFAULT_CARD_H,
          minW: 2,
          minH: 2,
        };
        return [...prev, newItem];
      });

      return id;
    },
    [],
  );

  const updateCard = useCallback(
    (id: string, config: Omit<DashboardCardConfig, "id">) => {
      setCards((prev) =>
        prev.map((card) => (card.id === id ? { ...config, id } : card)),
      );
    },
    [],
  );

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
    setLayout((prev) => prev.filter((item) => item.i !== id));
  }, []);

  const onLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    setLayout(newLayout);
  }, []);

  return {
    cards,
    layout,
    addCard,
    updateCard,
    removeCard,
    onLayoutChange,
    setCards,
    setLayout,
  };
}

export default useDashboardCards;
export { DEFAULT_CARD_W, DEFAULT_CARD_H, LG_COLS, generateId, nextY };
