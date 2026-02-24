import { useCallback, useEffect, useMemo, useRef } from "react";
import * as Plot from "@observablehq/plot";
import { convertPlotSpec, findPrimaryMark } from "./plotToEcharts";
import type { PromoteResult } from "./plotToEcharts";

/**
 * JSON-serializable mark definition that Claude generates.
 * Each entry maps to a Plot mark function (e.g. "barY" → Plot.barY).
 */
interface MarkDef {
  type: string;
  data?: Record<string, unknown>[];
  options?: Record<string, unknown>;
}

/**
 * JSON-serializable Plot spec that the AI produces.
 * Contains mark definitions plus optional top-level Plot.plot() options.
 */
interface PlotSpec {
  marks: MarkDef[];
  width?: number;
  height?: number;
  color?: Record<string, unknown>;
  x?: Record<string, unknown>;
  y?: Record<string, unknown>;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  style?: Record<string, string>;
}

interface PlotRendererProps {
  spec: PlotSpec;
  className?: string;
  style?: React.CSSProperties;
  /** When provided, a "Promote to Dashboard" button is shown below the chart. */
  onPromote?: (result: PromoteResult) => void;
  /** Title used for the promoted dashboard card. */
  promoteTitle?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarkFactory = (...args: any[]) => Plot.Markish;

/** Supported Plot mark factory names. */
const MARK_MAP: Record<string, MarkFactory | undefined> = {
  area: Plot.area,
  areaX: Plot.areaX,
  areaY: Plot.areaY,
  barX: Plot.barX,
  barY: Plot.barY,
  cell: Plot.cell,
  cellX: Plot.cellX,
  cellY: Plot.cellY,
  dot: Plot.dot,
  dotX: Plot.dotX,
  dotY: Plot.dotY,
  frame: Plot.frame,
  line: Plot.line,
  lineX: Plot.lineX,
  lineY: Plot.lineY,
  link: Plot.link,
  rect: Plot.rect,
  rectX: Plot.rectX,
  rectY: Plot.rectY,
  ruleX: Plot.ruleX,
  ruleY: Plot.ruleY,
  text: Plot.text,
  textX: Plot.textX,
  textY: Plot.textY,
  tickX: Plot.tickX,
  tickY: Plot.tickY,
  tip: Plot.tip,
};

function buildMarks(defs: MarkDef[]): Plot.Markish[] {
  return defs
    .map((def) => {
      const factory = MARK_MAP[def.type];
      if (!factory) return null;
      return factory(def.data ?? [], def.options ?? {});
    })
    .filter((m): m is Plot.Markish => m !== null);
}

function PlotRenderer({ spec, className, style, onPromote, promoteTitle }: PlotRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const marks = buildMarks(spec.marks);
    const { width, height, color, x, y, marginTop, marginRight, marginBottom, marginLeft, style: plotStyle } = spec;

    const figure = Plot.plot({
      marks,
      ...(width != null && { width }),
      ...(height != null && { height }),
      ...(color != null && { color }),
      ...(x != null && { x }),
      ...(y != null && { y }),
      ...(marginTop != null && { marginTop }),
      ...(marginRight != null && { marginRight }),
      ...(marginBottom != null && { marginBottom }),
      ...(marginLeft != null && { marginLeft }),
      ...(plotStyle != null && { style: plotStyle }),
    });

    // Clear previous render and append new one
    el.replaceChildren(figure);

    return () => {
      el.replaceChildren();
    };
  }, [spec]);

  const canPromote = useMemo(
    () => onPromote != null && findPrimaryMark(spec) != null,
    [spec, onPromote],
  );

  const handlePromote = useCallback(() => {
    if (!onPromote) return;
    const result = convertPlotSpec(spec, promoteTitle);
    if (result) onPromote(result);
  }, [spec, promoteTitle, onPromote]);

  return (
    <div data-testid="plot-renderer">
      <div
        ref={containerRef}
        className={className}
        style={{ width: "100%", minHeight: 200, ...style }}
        data-testid="plot-container"
      />
      {canPromote && (
        <button
          data-testid="promote-to-dashboard"
          type="button"
          onClick={handlePromote}
          className="mt-2 inline-flex items-center gap-1.5 rounded border border-amber-600/40 bg-amber-600/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-amber-400 transition-colors hover:bg-amber-600/20 hover:text-amber-300"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10 5a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H6a1 1 0 1 1 0-2h3V6a1 1 0 0 1 1-1Z" />
          </svg>
          Promote to Dashboard
        </button>
      )}
    </div>
  );
}

export type { PlotSpec, MarkDef, PlotRendererProps };
export default PlotRenderer;
