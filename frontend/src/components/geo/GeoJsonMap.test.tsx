import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Hoisted mocks ---

const mocks = vi.hoisted(() => {
  const baseMapPropsLog: Record<string, unknown>[] = [];
  const geojsonLayerInstances: Record<string, unknown>[] = [];
  return { baseMapPropsLog, geojsonLayerInstances };
});

vi.mock("./BaseMap", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.baseMapPropsLog.push(props);
    return <div data-testid="basemap-mock" />;
  },
  __esModule: true,
}));

vi.mock("@deck.gl/layers", () => ({
  GeoJsonLayer: class MockGeoJsonLayer {
    props: Record<string, unknown>;
    constructor(props: Record<string, unknown>) {
      this.props = props;
      mocks.geojsonLayerInstances.push(props);
    }
  },
}));

import GeoJsonMap, {
  AMBER,
  HIGHLIGHT_PINK,
  DEFAULT_LINE_COLOR,
  DEFAULT_LINE_WIDTH,
  extractCoordinateBounds,
} from "./GeoJsonMap";

const SAMPLE_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Region A", value: 100, category: "north" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-73.99, 40.71],
            [-73.98, 40.71],
            [-73.98, 40.72],
            [-73.99, 40.72],
            [-73.99, 40.71],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Region B", value: 250, category: "south" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-118.24, 34.05],
            [-118.23, 34.05],
            [-118.23, 34.06],
            [-118.24, 34.06],
            [-118.24, 34.05],
          ],
        ],
      },
    },
  ],
};

const SAMPLE_FEATURES: GeoJSON.Feature[] = [
  {
    type: "Feature",
    properties: { name: "Point A" },
    geometry: { type: "Point", coordinates: [10, 20] },
  },
  {
    type: "Feature",
    properties: { name: "Point B" },
    geometry: { type: "Point", coordinates: [30, 40] },
  },
];

describe("GeoJsonMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.baseMapPropsLog.length = 0;
    mocks.geojsonLayerInstances.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders geojson-map container", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    expect(screen.getByTestId("geojson-map")).toBeInTheDocument();
  });

  it("renders BaseMap inside container", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    expect(screen.getByTestId("basemap-mock")).toBeInTheDocument();
  });

  // --- Layer creation ---

  it("creates a GeoJsonLayer", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    expect(mocks.geojsonLayerInstances).toHaveLength(1);
  });

  it("passes FeatureCollection data to GeoJsonLayer", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    const data = layerProps.data as GeoJSON.FeatureCollection;
    expect(data.type).toBe("FeatureCollection");
    expect(data.features).toHaveLength(2);
  });

  it("wraps Feature array into FeatureCollection", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURES} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    const data = layerProps.data as GeoJSON.FeatureCollection;
    expect(data.type).toBe("FeatureCollection");
    expect(data.features).toHaveLength(2);
  });

  it("sets pickable to true for hover support", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    expect(layerProps.pickable).toBe(true);
  });

  it("sets stroked and filled to true", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    expect(layerProps.stroked).toBe(true);
    expect(layerProps.filled).toBe(true);
  });

  it("sets autoHighlight to true", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    expect(layerProps.autoHighlight).toBe(true);
  });

  it("uses pixels for line width units", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    expect(layerProps.lineWidthUnits).toBe("pixels");
  });

  it("sets lineWidthMinPixels to 1", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    expect(layerProps.lineWidthMinPixels).toBe(1);
  });

  // --- getFillColor accessor ---

  it("defaults to amber fill color with opacity when no fillField", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    const getFillColor = layerProps.getFillColor as (f: GeoJSON.Feature) => number[];
    expect(getFillColor(SAMPLE_FEATURE_COLLECTION.features[0])).toEqual([...AMBER, 180]);
  });

  it("uses colorMap when fillField and colorMap provided", () => {
    const colorMap = { north: [255, 0, 0] as [number, number, number] };
    render(
      <GeoJsonMap
        geojsonData={SAMPLE_FEATURE_COLLECTION}
        fillField="category"
        colorMap={colorMap}
      />,
    );
    const layerProps = mocks.geojsonLayerInstances[0];
    const getFillColor = layerProps.getFillColor as (f: GeoJSON.Feature) => number[];
    expect(getFillColor(SAMPLE_FEATURE_COLLECTION.features[0])).toEqual([255, 0, 0, 180]);
  });

  it("falls back to amber when fillField value not in colorMap", () => {
    const colorMap = { north: [255, 0, 0] as [number, number, number] };
    render(
      <GeoJsonMap
        geojsonData={SAMPLE_FEATURE_COLLECTION}
        fillField="category"
        colorMap={colorMap}
      />,
    );
    const layerProps = mocks.geojsonLayerInstances[0];
    const getFillColor = layerProps.getFillColor as (f: GeoJSON.Feature) => number[];
    // "south" not in colorMap → amber fallback
    expect(getFillColor(SAMPLE_FEATURE_COLLECTION.features[1])).toEqual([...AMBER, 180]);
  });

  it("falls back to amber when fillField provided but no colorMap", () => {
    render(
      <GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} fillField="category" />,
    );
    const layerProps = mocks.geojsonLayerInstances[0];
    const getFillColor = layerProps.getFillColor as (f: GeoJSON.Feature) => number[];
    expect(getFillColor(SAMPLE_FEATURE_COLLECTION.features[0])).toEqual([...AMBER, 180]);
  });

  it("respects custom fillOpacity", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} fillOpacity={100} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    const getFillColor = layerProps.getFillColor as (f: GeoJSON.Feature) => number[];
    expect(getFillColor(SAMPLE_FEATURE_COLLECTION.features[0])).toEqual([...AMBER, 100]);
  });

  // --- getLineColor accessor ---

  it("defaults to muted gray line color when no strokeField", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    const getLineColor = layerProps.getLineColor as (f: GeoJSON.Feature) => number[];
    expect(getLineColor(SAMPLE_FEATURE_COLLECTION.features[0])).toEqual(DEFAULT_LINE_COLOR);
  });

  it("uses colorMap for line color when strokeField provided", () => {
    const colorMap = { north: [0, 255, 0] as [number, number, number] };
    render(
      <GeoJsonMap
        geojsonData={SAMPLE_FEATURE_COLLECTION}
        strokeField="category"
        colorMap={colorMap}
      />,
    );
    const layerProps = mocks.geojsonLayerInstances[0];
    const getLineColor = layerProps.getLineColor as (f: GeoJSON.Feature) => number[];
    expect(getLineColor(SAMPLE_FEATURE_COLLECTION.features[0])).toEqual([0, 255, 0]);
  });

  it("falls back to default line color when strokeField value not in colorMap", () => {
    const colorMap = { north: [0, 255, 0] as [number, number, number] };
    render(
      <GeoJsonMap
        geojsonData={SAMPLE_FEATURE_COLLECTION}
        strokeField="category"
        colorMap={colorMap}
      />,
    );
    const layerProps = mocks.geojsonLayerInstances[0];
    const getLineColor = layerProps.getLineColor as (f: GeoJSON.Feature) => number[];
    // "south" not in colorMap → default line color fallback
    expect(getLineColor(SAMPLE_FEATURE_COLLECTION.features[1])).toEqual(DEFAULT_LINE_COLOR);
  });

  // --- Line width ---

  it("uses default line width", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    expect(layerProps.getLineWidth).toBe(DEFAULT_LINE_WIDTH);
  });

  it("uses custom line width when provided", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} lineWidth={3} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    expect(layerProps.getLineWidth).toBe(3);
  });

  // --- Highlight color ---

  it("uses hot pink highlight color with alpha", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    expect(layerProps.highlightColor).toEqual([...HIGHLIGHT_PINK, 200]);
  });

  // --- BaseMap props passthrough ---

  it("passes layer to BaseMap", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.layers).toHaveLength(1);
  });

  it("passes loading to BaseMap", () => {
    render(
      <GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} loading={true} />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.loading).toBe(true);
  });

  it("passes className to BaseMap", () => {
    render(
      <GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} className="h-96" />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.className).toBe("h-96");
  });

  it("passes style to BaseMap", () => {
    render(
      <GeoJsonMap
        geojsonData={SAMPLE_FEATURE_COLLECTION}
        style={{ maxWidth: 600 }}
      />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.style).toEqual({ maxWidth: 600 });
  });

  it("passes custom initialViewState to BaseMap", () => {
    const viewState = { longitude: -73.99, latitude: 40.71, zoom: 10, pitch: 0, bearing: 0 };
    render(
      <GeoJsonMap
        geojsonData={SAMPLE_FEATURE_COLLECTION}
        initialViewState={viewState}
      />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.initialViewState).toEqual(viewState);
  });

  // --- Auto view state from data ---

  it("computes center view state from GeoJSON bounds when no initialViewState", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    const vs = baseMapProps.initialViewState as {
      longitude: number;
      latitude: number;
      zoom: number;
    };
    // Bounding box: lon [-118.24, -73.98], lat [34.05, 40.72]
    expect(vs.longitude).toBeCloseTo((-118.24 + -73.98) / 2, 1);
    expect(vs.latitude).toBeCloseTo((34.05 + 40.72) / 2, 1);
    expect(vs.zoom).toBe(3);
  });

  it("passes undefined initialViewState for empty FeatureCollection", () => {
    const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    render(<GeoJsonMap geojsonData={empty} />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.initialViewState).toBeUndefined();
  });

  it("passes undefined initialViewState for empty Feature array", () => {
    render(<GeoJsonMap geojsonData={[]} />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.initialViewState).toBeUndefined();
  });

  // --- Tooltip ---

  it("does not show tooltip by default", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    expect(screen.queryByTestId("geojson-tooltip")).not.toBeInTheDocument();
  });

  it("provides onHover callback to GeoJsonLayer", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const layerProps = mocks.geojsonLayerInstances[0];
    expect(typeof layerProps.onHover).toBe("function");
  });

  // --- Tooltip styling ---

  it("renders tooltip with find.bi dark surface styling when hovered", () => {
    const { rerender } = render(
      <GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />,
    );

    const layerProps = mocks.geojsonLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: GeoJSON.Feature | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({
        object: SAMPLE_FEATURE_COLLECTION.features[0],
        x: 100,
        y: 200,
      });
    });

    rerender(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);

    const tooltip = screen.getByTestId("geojson-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.style.background).toBe("rgb(20, 20, 20)"); // #141414
    expect(tooltip.style.border).toBe("1px solid rgb(42, 42, 42)"); // #2A2A2A
    expect(tooltip.style.pointerEvents).toBe("none");
    expect(tooltip.style.left).toBe("112px"); // x + 12
    expect(tooltip.style.top).toBe("188px"); // y - 12
  });

  it("renders tooltip with feature properties", () => {
    const { rerender } = render(
      <GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />,
    );
    const layerProps = mocks.geojsonLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: GeoJSON.Feature | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({
        object: SAMPLE_FEATURE_COLLECTION.features[0],
        x: 50,
        y: 80,
      });
    });

    rerender(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);

    const tooltip = screen.getByTestId("geojson-tooltip");
    expect(tooltip.textContent).toContain("name:");
    expect(tooltip.textContent).toContain("Region A");
    expect(tooltip.textContent).toContain("value:");
    expect(tooltip.textContent).toContain("100");
  });

  it("hides tooltip when hover leaves feature", () => {
    const { rerender } = render(
      <GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />,
    );
    const layerProps = mocks.geojsonLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: GeoJSON.Feature | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({ object: SAMPLE_FEATURE_COLLECTION.features[0], x: 100, y: 200 });
    });
    act(() => {
      onHover({ object: null, x: 100, y: 200 });
    });

    rerender(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);

    expect(screen.queryByTestId("geojson-tooltip")).not.toBeInTheDocument();
  });

  // --- Container styling ---

  it("has position relative on outer container", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const container = screen.getByTestId("geojson-map");
    expect(container.style.position).toBe("relative");
  });

  it("has 100% width and height on outer container", () => {
    render(<GeoJsonMap geojsonData={SAMPLE_FEATURE_COLLECTION} />);
    const container = screen.getByTestId("geojson-map");
    expect(container.style.width).toBe("100%");
    expect(container.style.height).toBe("100%");
  });

  // --- Exported constants ---

  it("exports AMBER color constant", () => {
    expect(AMBER).toEqual([245, 166, 35]);
  });

  it("exports HIGHLIGHT_PINK color constant", () => {
    expect(HIGHLIGHT_PINK).toEqual([232, 67, 147]);
  });

  it("exports DEFAULT_LINE_COLOR constant", () => {
    expect(DEFAULT_LINE_COLOR).toEqual([107, 104, 96]);
  });

  it("exports DEFAULT_LINE_WIDTH constant", () => {
    expect(DEFAULT_LINE_WIDTH).toBe(1);
  });

  // --- Update triggers ---

  it("sets updateTriggers for getFillColor and getLineColor", () => {
    render(
      <GeoJsonMap
        geojsonData={SAMPLE_FEATURE_COLLECTION}
        fillField="category"
        strokeField="category"
      />,
    );
    const layerProps = mocks.geojsonLayerInstances[0];
    const triggers = layerProps.updateTriggers as Record<string, unknown[]>;
    expect(triggers.getFillColor).toContain("category");
    expect(triggers.getLineColor).toContain("category");
  });
});

// --- extractCoordinateBounds utility tests ---

describe("extractCoordinateBounds", () => {
  it("extracts bounds from Point geometry", () => {
    const bounds = extractCoordinateBounds({ type: "Point", coordinates: [10, 20] });
    expect(bounds).toEqual({ minLat: 20, maxLat: 20, minLon: 10, maxLon: 10 });
  });

  it("extracts bounds from MultiPoint geometry", () => {
    const bounds = extractCoordinateBounds({
      type: "MultiPoint",
      coordinates: [
        [10, 20],
        [30, 40],
      ],
    });
    expect(bounds).toEqual({ minLat: 20, maxLat: 40, minLon: 10, maxLon: 30 });
  });

  it("extracts bounds from LineString geometry", () => {
    const bounds = extractCoordinateBounds({
      type: "LineString",
      coordinates: [
        [0, 0],
        [10, 10],
      ],
    });
    expect(bounds).toEqual({ minLat: 0, maxLat: 10, minLon: 0, maxLon: 10 });
  });

  it("extracts bounds from Polygon geometry", () => {
    const bounds = extractCoordinateBounds({
      type: "Polygon",
      coordinates: [
        [
          [-73.99, 40.71],
          [-73.98, 40.71],
          [-73.98, 40.72],
          [-73.99, 40.72],
          [-73.99, 40.71],
        ],
      ],
    });
    expect(bounds).toEqual({ minLat: 40.71, maxLat: 40.72, minLon: -73.99, maxLon: -73.98 });
  });

  it("extracts bounds from MultiPolygon geometry", () => {
    const bounds = extractCoordinateBounds({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
        ],
        [
          [
            [20, 20],
            [30, 20],
            [30, 30],
            [20, 30],
            [20, 20],
          ],
        ],
      ],
    });
    expect(bounds).toEqual({ minLat: 0, maxLat: 30, minLon: 0, maxLon: 30 });
  });

  it("extracts bounds from MultiLineString geometry", () => {
    const bounds = extractCoordinateBounds({
      type: "MultiLineString",
      coordinates: [
        [
          [0, 0],
          [5, 5],
        ],
        [
          [10, 10],
          [15, 15],
        ],
      ],
    });
    expect(bounds).toEqual({ minLat: 0, maxLat: 15, minLon: 0, maxLon: 15 });
  });

  it("extracts bounds from GeometryCollection", () => {
    const bounds = extractCoordinateBounds({
      type: "GeometryCollection",
      geometries: [
        { type: "Point", coordinates: [5, 10] },
        { type: "Point", coordinates: [15, 20] },
      ],
    });
    expect(bounds).toEqual({ minLat: 10, maxLat: 20, minLon: 5, maxLon: 15 });
  });

  it("returns null for empty GeometryCollection", () => {
    const bounds = extractCoordinateBounds({
      type: "GeometryCollection",
      geometries: [],
    });
    expect(bounds).toBeNull();
  });
});
