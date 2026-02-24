import { useState, useMemo, useCallback } from "react";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { PickingInfo, MapViewState } from "@deck.gl/core";
import BaseMap from "./BaseMap";

/** RGB-Alpha color tuple */
type RGBAColor = [number, number, number, number];

/** Default color domain: transparent dark → semi-opaque amber → bright amber (find.bi palette) */
const DEFAULT_COLOR_RANGE: RGBAColor[] = [
  [26, 18, 11, 25],
  [77, 50, 15, 100],
  [153, 102, 20, 160],
  [204, 143, 28, 200],
  [245, 166, 35, 230],
  [255, 220, 100, 255],
];

const DEFAULT_RADIUS = 30;
const DEFAULT_INTENSITY = 1;
const DEFAULT_THRESHOLD = 0.05;

interface TooltipData {
  x: number;
  y: number;
  object: Record<string, unknown>;
}

interface HeatmapMapProps {
  /** Array of data objects, each containing at least lat/lon fields */
  data: Record<string, unknown>[];
  /** Key in each data object for latitude */
  latField: string;
  /** Key in each data object for longitude */
  lonField: string;
  /** Optional key for weighting each point. When absent, each point has weight 1. */
  weightField?: string;
  /** Radius of influence of each point in pixels (default 30) */
  radiusPixels?: number;
  /** Intensity scaling factor (default 1) */
  intensity?: number;
  /** Threshold below which heatmap is not drawn (default 0.05) */
  threshold?: number;
  /** Color range as array of RGBA tuples (default: transparent-to-amber gradient) */
  colorRange?: RGBAColor[];
  /** Initial map view state */
  initialViewState?: MapViewState;
  /** Additional CSS class on the container */
  className?: string;
  /** Additional inline styles on the container */
  style?: React.CSSProperties;
  /** Show loading overlay on BaseMap */
  loading?: boolean;
}

function HeatmapMap({
  data,
  latField,
  lonField,
  weightField,
  radiusPixels = DEFAULT_RADIUS,
  intensity = DEFAULT_INTENSITY,
  threshold = DEFAULT_THRESHOLD,
  colorRange = DEFAULT_COLOR_RANGE,
  initialViewState,
  className,
  style,
  loading = false,
}: HeatmapMapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const onHover = useCallback((info: PickingInfo) => {
    if (info.object) {
      setTooltip({
        x: info.x,
        y: info.y,
        object: info.object as Record<string, unknown>,
      });
    } else {
      setTooltip(null);
    }
  }, []);

  const layer = useMemo(
    () =>
      new HeatmapLayer({
        id: "heatmap-layer",
        data,
        pickable: true,
        getPosition: (d: Record<string, unknown>) => [
          Number(d[lonField]),
          Number(d[latField]),
        ],
        getWeight: weightField
          ? (d: Record<string, unknown>) => Number(d[weightField])
          : () => 1,
        radiusPixels,
        intensity,
        threshold,
        colorRange,
        // deck.gl aggregation layer types use an intersection for onHover
        // that requires boolean & void return — cast to satisfy the constraint
        onHover: onHover as never,
        updateTriggers: {
          getWeight: [weightField],
        },
      }),
    [
      data,
      latField,
      lonField,
      weightField,
      radiusPixels,
      intensity,
      threshold,
      colorRange,
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
      pitch: 0,
      bearing: 0,
    };
  }, [data, latField, lonField, initialViewState]);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      data-testid="heatmap-map"
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
          data-testid="heatmap-tooltip"
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
              <span
                style={{
                  color: "#F5A623",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                }}
              >
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { HeatmapMapProps, RGBAColor };
export { DEFAULT_COLOR_RANGE, DEFAULT_RADIUS, DEFAULT_INTENSITY, DEFAULT_THRESHOLD };
export default HeatmapMap;
