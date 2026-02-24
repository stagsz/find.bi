import { useState, useMemo, useCallback } from "react";
import { ArcLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { MapViewState } from "@deck.gl/core";
import BaseMap from "./BaseMap";

/** RGB color tuple */
type RGBColor = [number, number, number];

/** Default amber from the find.bi palette (#F5A623) */
const AMBER: RGBColor = [245, 166, 35];

/** Hot pink accent for highlighted state (#E84393) */
const HIGHLIGHT_PINK: RGBColor = [232, 67, 147];

const DEFAULT_STROKE_WIDTH = 1;

interface TooltipData {
  x: number;
  y: number;
  object: Record<string, unknown>;
}

interface ArcMapProps {
  /** Array of data objects, each containing origin/destination lat/lon fields */
  data: Record<string, unknown>[];
  /** Key in each data object for origin latitude */
  originLat: string;
  /** Key in each data object for origin longitude */
  originLon: string;
  /** Key in each data object for destination latitude */
  destLat: string;
  /** Key in each data object for destination longitude */
  destLon: string;
  /** Optional key for coloring arcs. When absent, all arcs use amber. */
  colorField?: string;
  /** Optional color map: maps colorField values to RGB tuples */
  colorMap?: Record<string, RGBColor>;
  /** Stroke width in pixels (default 1) */
  strokeWidth?: number;
  /** Initial map view state */
  initialViewState?: MapViewState;
  /** Additional CSS class on the container */
  className?: string;
  /** Additional inline styles on the container */
  style?: React.CSSProperties;
  /** Show loading overlay on BaseMap */
  loading?: boolean;
}

function ArcMap({
  data,
  originLat,
  originLon,
  destLat,
  destLon,
  colorField,
  colorMap,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  initialViewState,
  className,
  style,
  loading = false,
}: ArcMapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const onHover = useCallback(
    (info: PickingInfo) => {
      if (info.object) {
        setTooltip({
          x: info.x,
          y: info.y,
          object: info.object as Record<string, unknown>,
        });
      } else {
        setTooltip(null);
      }
    },
    [],
  );

  const layer = useMemo(
    () =>
      new ArcLayer({
        id: "arc-layer",
        data,
        pickable: true,
        getSourcePosition: (d: Record<string, unknown>) => [
          Number(d[originLon]),
          Number(d[originLat]),
        ],
        getTargetPosition: (d: Record<string, unknown>) => [
          Number(d[destLon]),
          Number(d[destLat]),
        ],
        getSourceColor: (d: Record<string, unknown>) => {
          if (colorField && colorMap && d[colorField] != null) {
            return colorMap[String(d[colorField])] ?? AMBER;
          }
          return AMBER;
        },
        getTargetColor: (d: Record<string, unknown>) => {
          if (colorField && colorMap && d[colorField] != null) {
            return colorMap[String(d[colorField])] ?? AMBER;
          }
          return AMBER;
        },
        getWidth: strokeWidth,
        widthUnits: "pixels" as const,
        widthMinPixels: 1,
        highlightColor: [...HIGHLIGHT_PINK, 200],
        autoHighlight: true,
        onHover,
        updateTriggers: {
          getSourceColor: [colorField, colorMap],
          getTargetColor: [colorField, colorMap],
        },
      }),
    [data, originLat, originLon, destLat, destLon, colorField, colorMap, strokeWidth, onHover],
  );

  const computedInitialViewState = useMemo(() => {
    if (initialViewState) return initialViewState;
    if (data.length === 0) return undefined;

    let minLat = 90;
    let maxLat = -90;
    let minLon = 180;
    let maxLon = -180;
    for (const d of data) {
      const oLat = Number(d[originLat]);
      const oLon = Number(d[originLon]);
      const dLat = Number(d[destLat]);
      const dLon = Number(d[destLon]);
      if (Number.isFinite(oLat) && Number.isFinite(oLon)) {
        if (oLat < minLat) minLat = oLat;
        if (oLat > maxLat) maxLat = oLat;
        if (oLon < minLon) minLon = oLon;
        if (oLon > maxLon) maxLon = oLon;
      }
      if (Number.isFinite(dLat) && Number.isFinite(dLon)) {
        if (dLat < minLat) minLat = dLat;
        if (dLat > maxLat) maxLat = dLat;
        if (dLon < minLon) minLon = dLon;
        if (dLon > maxLon) maxLon = dLon;
      }
    }

    return {
      longitude: (minLon + maxLon) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom: 3,
      pitch: 0,
      bearing: 0,
    };
  }, [data, originLat, originLon, destLat, destLon, initialViewState]);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      data-testid="arc-map"
    >
      <BaseMap
        layers={[layer]}
        initialViewState={computedInitialViewState}
        className={className}
        style={style}
        loading={loading}
      />
      {tooltip && (
        <div
          data-testid="arc-tooltip"
          style={{
            position: "absolute",
            left: tooltip.x + 12,
            top: tooltip.y - 12,
            pointerEvents: "none",
            zIndex: 20,
            background: "#141414",
            border: "1px solid #2A2A2A",
            borderRadius: 6,
            padding: "8px 12px",
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 12,
            lineHeight: 1.5,
            color: "#F0EDE4",
            maxWidth: 280,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
          }}
        >
          {Object.entries(tooltip.object).map(([key, value]) => (
            <div key={key} style={{ display: "flex", gap: 6 }}>
              <span style={{ color: "#6B6860", flexShrink: 0 }}>{key}:</span>
              <span style={{ color: "#F5A623", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { ArcMapProps, RGBColor };
export { AMBER, HIGHLIGHT_PINK, DEFAULT_STROKE_WIDTH };
export default ArcMap;
