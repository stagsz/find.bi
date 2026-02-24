import { useState, useMemo, useCallback } from "react";
import { HexagonLayer } from "@deck.gl/aggregation-layers";
import type { PickingInfo, MapViewState } from "@deck.gl/core";
import BaseMap from "./BaseMap";

/** RGB color tuple */
type RGBColor = [number, number, number];

/** Default color range: dark brown → amber → bright yellow (find.bi palette) */
const DEFAULT_COLOR_RANGE: RGBColor[] = [
  [26, 18, 11],
  [77, 50, 15],
  [153, 102, 20],
  [204, 143, 28],
  [245, 166, 35],
  [255, 220, 100],
];

const DEFAULT_RADIUS = 1000;
const DEFAULT_ELEVATION_SCALE = 4;
const DEFAULT_UPPER_PERCENTILE = 100;

interface TooltipData {
  x: number;
  y: number;
  count: number;
  position: [number, number];
}

interface HexagonMapProps {
  /** Array of data objects, each containing at least lat/lon fields */
  data: Record<string, unknown>[];
  /** Key in each data object for latitude */
  latField: string;
  /** Key in each data object for longitude */
  lonField: string;
  /** Optional key for weighting aggregation. When absent, each point counts as 1. */
  weightField?: string;
  /** Hex bin radius in meters (default 1000) */
  radius?: number;
  /** Elevation scale multiplier (default 4) */
  elevationScale?: number;
  /** Upper percentile for color/elevation (default 100) */
  upperPercentile?: number;
  /** Color range as array of RGB tuples (default: dark-to-amber gradient) */
  colorRange?: RGBColor[];
  /** Whether to extrude hexagons in 3D (default false) */
  extruded?: boolean;
  /** Initial map view state */
  initialViewState?: MapViewState;
  /** Additional CSS class on the container */
  className?: string;
  /** Additional inline styles on the container */
  style?: React.CSSProperties;
  /** Show loading overlay on BaseMap */
  loading?: boolean;
}

function HexagonMap({
  data,
  latField,
  lonField,
  weightField,
  radius = DEFAULT_RADIUS,
  elevationScale = DEFAULT_ELEVATION_SCALE,
  upperPercentile = DEFAULT_UPPER_PERCENTILE,
  colorRange = DEFAULT_COLOR_RANGE,
  extruded = false,
  initialViewState,
  className,
  style,
  loading = false,
}: HexagonMapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const onHover = useCallback((info: PickingInfo) => {
    if (info.object) {
      const obj = info.object as { count?: number; position?: [number, number] };
      setTooltip({
        x: info.x,
        y: info.y,
        count: obj.count ?? 0,
        position: obj.position ?? [0, 0],
      });
    } else {
      setTooltip(null);
    }
  }, []);

  const layer = useMemo(
    () =>
      new HexagonLayer({
        id: "hexagon-layer",
        data,
        pickable: true,
        getPosition: (d: Record<string, unknown>) => [
          Number(d[lonField]),
          Number(d[latField]),
        ],
        getElevationWeight: weightField
          ? (d: Record<string, unknown>) => Number(d[weightField])
          : undefined,
        getColorWeight: weightField
          ? (d: Record<string, unknown>) => Number(d[weightField])
          : undefined,
        radius,
        elevationScale,
        upperPercentile,
        colorRange,
        extruded,
        // deck.gl aggregation layer types use an intersection for onHover
        // that requires boolean & void return — cast to satisfy the constraint
        onHover: onHover as never,
        updateTriggers: {
          getElevationWeight: [weightField],
          getColorWeight: [weightField],
        },
      }),
    [
      data,
      latField,
      lonField,
      weightField,
      radius,
      elevationScale,
      upperPercentile,
      colorRange,
      extruded,
      onHover,
    ],
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
      pitch: extruded ? 45 : 0,
      bearing: 0,
    };
  }, [data, latField, lonField, initialViewState, extruded]);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      data-testid="hexagon-map"
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
          data-testid="hexagon-tooltip"
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
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ color: "#6B6860", flexShrink: 0 }}>count:</span>
            <span
              style={{
                color: "#F5A623",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
              }}
            >
              {tooltip.count}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ color: "#6B6860", flexShrink: 0 }}>center:</span>
            <span
              style={{
                color: "#F5A623",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
              }}
            >
              {tooltip.position[1].toFixed(4)}, {tooltip.position[0].toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export type { HexagonMapProps, RGBColor };
export { DEFAULT_COLOR_RANGE, DEFAULT_RADIUS, DEFAULT_ELEVATION_SCALE };
export default HexagonMap;
