import { useState, useMemo, useCallback } from "react";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { MapViewState } from "@deck.gl/core";
import BaseMap from "./BaseMap";

/** RGB color tuple */
type RGBColor = [number, number, number];

/** Default amber from the find.bi palette (#F5A623) */
const AMBER: RGBColor = [245, 166, 35];

/** Hot pink accent for highlighted state (#E84393) */
const HIGHLIGHT_PINK: RGBColor = [232, 67, 147];

/** Default line color — muted warm gray */
const DEFAULT_LINE_COLOR: RGBColor = [107, 104, 96];

const DEFAULT_LINE_WIDTH = 1;

interface TooltipData {
  x: number;
  y: number;
  properties: Record<string, unknown>;
}

interface GeoJsonMapProps {
  /** GeoJSON FeatureCollection or array of Features */
  geojsonData: GeoJSON.FeatureCollection | GeoJSON.Feature[];
  /** Property name for fill color mapping. When absent, all features use amber. */
  fillField?: string;
  /** Property name for stroke color mapping. When absent, uses default line color. */
  strokeField?: string;
  /** Optional color map: maps field values to RGB tuples */
  colorMap?: Record<string, RGBColor>;
  /** Line width in pixels (default 1) */
  lineWidth?: number;
  /** Fill opacity 0–255 (default 180) */
  fillOpacity?: number;
  /** Initial map view state */
  initialViewState?: MapViewState;
  /** Additional CSS class on the container */
  className?: string;
  /** Additional inline styles on the container */
  style?: React.CSSProperties;
  /** Show loading overlay on BaseMap */
  loading?: boolean;
}

/** Extract all coordinate numbers from a GeoJSON geometry for bounding box computation */
function extractCoordinateBounds(geometry: GeoJSON.Geometry): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} | null {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  let found = false;

  function processCoord(lon: number, lat: number) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    found = true;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  function processCoords(coords: GeoJSON.Position[]) {
    for (const c of coords) {
      processCoord(c[0], c[1]);
    }
  }

  switch (geometry.type) {
    case "Point":
      processCoord(geometry.coordinates[0], geometry.coordinates[1]);
      break;
    case "MultiPoint":
    case "LineString":
      processCoords(geometry.coordinates);
      break;
    case "MultiLineString":
    case "Polygon":
      for (const ring of geometry.coordinates) {
        processCoords(ring);
      }
      break;
    case "MultiPolygon":
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          processCoords(ring);
        }
      }
      break;
    case "GeometryCollection":
      for (const geom of geometry.geometries) {
        const bounds = extractCoordinateBounds(geom);
        if (bounds) {
          found = true;
          if (bounds.minLat < minLat) minLat = bounds.minLat;
          if (bounds.maxLat > maxLat) maxLat = bounds.maxLat;
          if (bounds.minLon < minLon) minLon = bounds.minLon;
          if (bounds.maxLon > maxLon) maxLon = bounds.maxLon;
        }
      }
      break;
  }

  return found ? { minLat, maxLat, minLon, maxLon } : null;
}

function GeoJsonMap({
  geojsonData,
  fillField,
  strokeField,
  colorMap,
  lineWidth = DEFAULT_LINE_WIDTH,
  fillOpacity = 180,
  initialViewState,
  className,
  style,
  loading = false,
}: GeoJsonMapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  /** Normalize input to a FeatureCollection */
  const featureCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    if (Array.isArray(geojsonData)) {
      return { type: "FeatureCollection", features: geojsonData };
    }
    return geojsonData;
  }, [geojsonData]);

  const onHover = useCallback(
    (info: PickingInfo) => {
      if (info.object) {
        const feature = info.object as GeoJSON.Feature;
        setTooltip({
          x: info.x,
          y: info.y,
          properties: (feature.properties ?? {}) as Record<string, unknown>,
        });
      } else {
        setTooltip(null);
      }
    },
    [],
  );

  const layer = useMemo(
    () =>
      new GeoJsonLayer({
        id: "geojson-layer",
        data: featureCollection,
        pickable: true,
        stroked: true,
        filled: true,
        getFillColor: (feature: GeoJSON.Feature) => {
          const props = feature.properties ?? {};
          if (fillField && colorMap && props[fillField] != null) {
            const color = colorMap[String(props[fillField])];
            return color ? [...color, fillOpacity] : [...AMBER, fillOpacity];
          }
          return [...AMBER, fillOpacity];
        },
        getLineColor: (feature: GeoJSON.Feature) => {
          const props = feature.properties ?? {};
          if (strokeField && colorMap && props[strokeField] != null) {
            return colorMap[String(props[strokeField])] ?? DEFAULT_LINE_COLOR;
          }
          return DEFAULT_LINE_COLOR;
        },
        getLineWidth: lineWidth,
        lineWidthUnits: "pixels" as const,
        lineWidthMinPixels: 1,
        highlightColor: [...HIGHLIGHT_PINK, 200],
        autoHighlight: true,
        onHover,
        updateTriggers: {
          getFillColor: [fillField, colorMap, fillOpacity],
          getLineColor: [strokeField, colorMap],
        },
      }),
    [featureCollection, fillField, strokeField, colorMap, lineWidth, fillOpacity, onHover],
  );

  const computedInitialViewState = useMemo(() => {
    if (initialViewState) return initialViewState;

    const features = featureCollection.features;
    if (features.length === 0) return undefined;

    let minLat = 90;
    let maxLat = -90;
    let minLon = 180;
    let maxLon = -180;
    let found = false;

    for (const feature of features) {
      const bounds = extractCoordinateBounds(feature.geometry);
      if (bounds) {
        found = true;
        if (bounds.minLat < minLat) minLat = bounds.minLat;
        if (bounds.maxLat > maxLat) maxLat = bounds.maxLat;
        if (bounds.minLon < minLon) minLon = bounds.minLon;
        if (bounds.maxLon > maxLon) maxLon = bounds.maxLon;
      }
    }

    if (!found) return undefined;

    return {
      longitude: (minLon + maxLon) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom: 3,
      pitch: 0,
      bearing: 0,
    };
  }, [featureCollection, initialViewState]);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      data-testid="geojson-map"
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
          data-testid="geojson-tooltip"
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
          {Object.entries(tooltip.properties).map(([key, value]) => (
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

export type { GeoJsonMapProps, RGBColor };
export { AMBER, HIGHLIGHT_PINK, DEFAULT_LINE_COLOR, DEFAULT_LINE_WIDTH, extractCoordinateBounds };
export default GeoJsonMap;
