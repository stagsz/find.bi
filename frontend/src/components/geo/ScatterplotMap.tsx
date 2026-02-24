import { useState, useMemo, useCallback } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { MapViewState } from "@deck.gl/core";
import BaseMap from "./BaseMap";

/** RGB color tuple */
type RGBColor = [number, number, number];

/** Default amber from the find.bi palette (#F5A623) */
const AMBER: RGBColor = [245, 166, 35];

/** Hot pink accent for highlighted state (#E84393) */
const HIGHLIGHT_PINK: RGBColor = [232, 67, 147];

const DEFAULT_RADIUS = 4;
interface TooltipData {
  x: number;
  y: number;
  object: Record<string, unknown>;
}

interface ScatterplotMapProps {
  /** Array of data objects, each containing at least lat/lon fields */
  data: Record<string, unknown>[];
  /** Key in each data object for latitude */
  latField: string;
  /** Key in each data object for longitude */
  lonField: string;
  /** Optional key for coloring points. When absent, all points use amber. */
  colorField?: string;
  /** Optional key for sizing points. When absent, all points use uniform radius. */
  sizeField?: string;
  /** Optional color map: maps colorField values to RGB tuples */
  colorMap?: Record<string, RGBColor>;
  /** Radius in pixels (default 4) */
  radiusPixels?: number;
  /** Initial map view state */
  initialViewState?: MapViewState;
  /** Additional CSS class on the container */
  className?: string;
  /** Additional inline styles on the container */
  style?: React.CSSProperties;
  /** Show loading overlay on BaseMap */
  loading?: boolean;
}

function ScatterplotMap({
  data,
  latField,
  lonField,
  colorField,
  sizeField,
  colorMap,
  radiusPixels = DEFAULT_RADIUS,
  initialViewState,
  className,
  style,
  loading = false,
}: ScatterplotMapProps) {
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
      new ScatterplotLayer({
        id: "scatterplot-layer",
        data,
        pickable: true,
        getPosition: (d: Record<string, unknown>) => [
          Number(d[lonField]),
          Number(d[latField]),
        ],
        getFillColor: (d: Record<string, unknown>) => {
          if (colorField && colorMap && d[colorField] != null) {
            return colorMap[String(d[colorField])] ?? AMBER;
          }
          return AMBER;
        },
        getRadius: (d: Record<string, unknown>) => {
          if (sizeField && d[sizeField] != null) {
            return Number(d[sizeField]);
          }
          return radiusPixels;
        },
        radiusUnits: "pixels" as const,
        radiusMinPixels: 2,
        radiusMaxPixels: 40,
        highlightColor: [...HIGHLIGHT_PINK, 200],
        autoHighlight: true,
        onHover,
        updateTriggers: {
          getFillColor: [colorField, colorMap],
          getRadius: [sizeField, radiusPixels],
        },
      }),
    [data, latField, lonField, colorField, sizeField, colorMap, radiusPixels, onHover],
  );

  const computedInitialViewState = useMemo(() => {
    if (initialViewState) return initialViewState;
    if (data.length === 0) return undefined;

    let minLat = 90;
    let maxLat = -90;
    let minLon = 180;
    let maxLon = -180;
    for (const d of data) {
      const lat = Number(d[latField]);
      const lon = Number(d[lonField]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }

    return {
      longitude: (minLon + maxLon) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom: 3,
      pitch: 0,
      bearing: 0,
    };
  }, [data, latField, lonField, initialViewState]);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      data-testid="scatterplot-map"
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
          data-testid="scatterplot-tooltip"
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

export type { ScatterplotMapProps, RGBColor };
export { AMBER, HIGHLIGHT_PINK };
export default ScatterplotMap;
