import { useCallback, useMemo, useState } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
  type LayoutItem,
  type Layout,
  type ResponsiveLayouts,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";

/** Breakpoint column counts matching common screen sizes */
const BREAKPOINT_COLS: Record<string, number> = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
};

/** Breakpoint pixel widths */
const BREAKPOINTS: Record<string, number> = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};

export interface DashboardCardConfig {
  /** Unique identifier for the card */
  id: string;
  /** Chart type to render */
  type: "bar" | "line" | "area" | "scatter" | "pie" | "radar" | "kpi" | "table" | "text"
    | "map-scatterplot" | "map-hexagon" | "map-heatmap" | "map-arc" | "map-geojson";
  /** Display title for the card */
  title: string;
  /** SQL query that produces the card's data */
  query: string;
  /** Maps chart prop names to column names from query result */
  columnMappings: Record<string, string>;
}

export interface DashboardGridProps {
  /** Layout positions for all cards */
  layout: LayoutItem[];
  /** Card configurations (chart type, query, mappings) */
  cards: DashboardCardConfig[];
  /** Called when layout changes (drag/resize) */
  onLayoutChange?: (layout: LayoutItem[]) => void;
  /** Whether the grid is in edit mode (drag/resize enabled) */
  editMode?: boolean;
  /** Render function for each card */
  renderCard?: (card: DashboardCardConfig) => React.ReactNode;
  /** Row height in pixels */
  rowHeight?: number;
  /** Custom className */
  className?: string;
}

function DashboardGrid({
  layout,
  cards,
  onLayoutChange,
  editMode = false,
  renderCard,
  rowHeight = 120,
  className,
}: DashboardGridProps) {
  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const { width, containerRef, mounted } = useContainerWidth();

  /** Build ResponsiveLayouts for all breakpoints from the single layout */
  const layouts = useMemo<ResponsiveLayouts>(() => {
    return {
      lg: layout,
      md: layout,
      sm: layout,
      xs: layout,
      xxs: layout,
    };
  }, [layout]);

  const handleLayoutChange = useCallback(
    (currentLayout: Layout) => {
      if (!onLayoutChange) return;
      onLayoutChange([...currentLayout]);
    },
    [onLayoutChange],
  );

  const handleBreakpointChange = useCallback((newBreakpoint: string) => {
    setCurrentBreakpoint(newBreakpoint);
  }, []);

  /** Map card IDs for quick lookup */
  const cardMap = useMemo(() => {
    const map = new Map<string, DashboardCardConfig>();
    for (const card of cards) {
      map.set(card.id, card);
    }
    return map;
  }, [cards]);

  return (
    <div data-testid="dashboard-grid" className={className} ref={containerRef as React.RefObject<HTMLDivElement>}>
      {mounted && (
        <ResponsiveGridLayout
          width={width}
          layouts={layouts}
          breakpoints={BREAKPOINTS}
          cols={BREAKPOINT_COLS}
          rowHeight={rowHeight}
          dragConfig={{ enabled: editMode, handle: ".dashboard-card-drag-handle", threshold: 3, bounded: false }}
          resizeConfig={{ enabled: editMode, handles: ["se"] }}
          onLayoutChange={handleLayoutChange}
          onBreakpointChange={handleBreakpointChange}
          compactor={verticalCompactor}
          margin={[16, 16] as const}
          containerPadding={[0, 0] as const}
        >
          {layout.map((item) => {
            const card = cardMap.get(item.i);
            return (
              <div
                key={item.i}
                data-testid={`grid-item-${item.i}`}
                data-card-id={item.i}
                data-breakpoint={currentBreakpoint}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                {card && renderCard ? renderCard(card) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-400">
                    {card ? card.title : "Unknown card"}
                  </div>
                )}
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}

export default DashboardGrid;

export type { LayoutItem };
export { BREAKPOINTS, BREAKPOINT_COLS };
