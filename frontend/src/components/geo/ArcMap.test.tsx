import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Hoisted mocks ---

const mocks = vi.hoisted(() => {
  const baseMapPropsLog: Record<string, unknown>[] = [];
  const arcLayerInstances: Record<string, unknown>[] = [];
  return { baseMapPropsLog, arcLayerInstances };
});

vi.mock("./BaseMap", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.baseMapPropsLog.push(props);
    return <div data-testid="basemap-mock" />;
  },
  __esModule: true,
}));

vi.mock("@deck.gl/layers", () => ({
  ArcLayer: class MockArcLayer {
    props: Record<string, unknown>;
    constructor(props: Record<string, unknown>) {
      this.props = props;
      mocks.arcLayerInstances.push(props);
    }
  },
}));

import ArcMap, { AMBER, HIGHLIGHT_PINK, DEFAULT_STROKE_WIDTH } from "./ArcMap";

const SAMPLE_DATA = [
  { oLat: 40.71, oLon: -73.99, dLat: 51.51, dLon: -0.13, route: "NYC-LON", volume: 5000 },
  { oLat: 34.05, oLon: -118.24, dLat: 35.68, dLon: 139.69, route: "LA-TKY", volume: 3000 },
  { oLat: 48.86, oLon: 2.35, dLat: -33.87, dLon: 151.21, route: "PAR-SYD", volume: 2000 },
];

describe("ArcMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.baseMapPropsLog.length = 0;
    mocks.arcLayerInstances.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders arc-map container", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    expect(screen.getByTestId("arc-map")).toBeInTheDocument();
  });

  it("renders BaseMap inside container", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    expect(screen.getByTestId("basemap-mock")).toBeInTheDocument();
  });

  // --- Layer creation ---

  it("creates an ArcLayer", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    expect(mocks.arcLayerInstances).toHaveLength(1);
  });

  it("passes data to ArcLayer", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    expect(layerProps.data).toBe(SAMPLE_DATA);
  });

  it("sets pickable to true for hover support", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    expect(layerProps.pickable).toBe(true);
  });

  it("sets autoHighlight to true", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    expect(layerProps.autoHighlight).toBe(true);
  });

  it("uses pixels for width units", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    expect(layerProps.widthUnits).toBe("pixels");
  });

  it("sets widthMinPixels to 1", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    expect(layerProps.widthMinPixels).toBe(1);
  });

  // --- getSourcePosition accessor ---

  it("getSourcePosition reads origin lat/lon from specified fields", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const getSourcePosition = layerProps.getSourcePosition as (d: Record<string, unknown>) => number[];
    expect(getSourcePosition(SAMPLE_DATA[0])).toEqual([-73.99, 40.71]);
    expect(getSourcePosition(SAMPLE_DATA[1])).toEqual([-118.24, 34.05]);
  });

  // --- getTargetPosition accessor ---

  it("getTargetPosition reads dest lat/lon from specified fields", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const getTargetPosition = layerProps.getTargetPosition as (d: Record<string, unknown>) => number[];
    expect(getTargetPosition(SAMPLE_DATA[0])).toEqual([-0.13, 51.51]);
    expect(getTargetPosition(SAMPLE_DATA[1])).toEqual([139.69, 35.68]);
  });

  it("position accessors work with custom field names", () => {
    const customData = [{ srcLat: 51.5, srcLng: -0.12, tgtLat: 48.86, tgtLng: 2.35 }];
    render(
      <ArcMap
        data={customData}
        originLat="srcLat"
        originLon="srcLng"
        destLat="tgtLat"
        destLon="tgtLng"
      />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const getSourcePosition = layerProps.getSourcePosition as (d: Record<string, unknown>) => number[];
    const getTargetPosition = layerProps.getTargetPosition as (d: Record<string, unknown>) => number[];
    expect(getSourcePosition(customData[0])).toEqual([-0.12, 51.5]);
    expect(getTargetPosition(customData[0])).toEqual([2.35, 48.86]);
  });

  // --- getSourceColor / getTargetColor accessors ---

  it("defaults to amber source color when no colorField", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const getSourceColor = layerProps.getSourceColor as (d: Record<string, unknown>) => number[];
    expect(getSourceColor(SAMPLE_DATA[0])).toEqual(AMBER);
  });

  it("defaults to amber target color when no colorField", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const getTargetColor = layerProps.getTargetColor as (d: Record<string, unknown>) => number[];
    expect(getTargetColor(SAMPLE_DATA[0])).toEqual(AMBER);
  });

  it("uses colorMap when colorField and colorMap provided", () => {
    const colorMap = { "NYC-LON": [255, 0, 0] as [number, number, number] };
    render(
      <ArcMap
        data={SAMPLE_DATA}
        originLat="oLat"
        originLon="oLon"
        destLat="dLat"
        destLon="dLon"
        colorField="route"
        colorMap={colorMap}
      />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const getSourceColor = layerProps.getSourceColor as (d: Record<string, unknown>) => number[];
    const getTargetColor = layerProps.getTargetColor as (d: Record<string, unknown>) => number[];
    expect(getSourceColor(SAMPLE_DATA[0])).toEqual([255, 0, 0]);
    expect(getTargetColor(SAMPLE_DATA[0])).toEqual([255, 0, 0]);
  });

  it("falls back to amber when colorField value not in colorMap", () => {
    const colorMap = { "NYC-LON": [255, 0, 0] as [number, number, number] };
    render(
      <ArcMap
        data={SAMPLE_DATA}
        originLat="oLat"
        originLon="oLon"
        destLat="dLat"
        destLon="dLon"
        colorField="route"
        colorMap={colorMap}
      />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const getSourceColor = layerProps.getSourceColor as (d: Record<string, unknown>) => number[];
    // "LA-TKY" not in colorMap → amber fallback
    expect(getSourceColor(SAMPLE_DATA[1])).toEqual(AMBER);
  });

  it("falls back to amber when colorField provided but no colorMap", () => {
    render(
      <ArcMap
        data={SAMPLE_DATA}
        originLat="oLat"
        originLon="oLon"
        destLat="dLat"
        destLon="dLon"
        colorField="route"
      />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const getSourceColor = layerProps.getSourceColor as (d: Record<string, unknown>) => number[];
    expect(getSourceColor(SAMPLE_DATA[0])).toEqual(AMBER);
  });

  // --- Stroke width ---

  it("uses default stroke width when not provided", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    expect(layerProps.getWidth).toBe(DEFAULT_STROKE_WIDTH);
  });

  it("uses custom stroke width when provided", () => {
    render(
      <ArcMap
        data={SAMPLE_DATA}
        originLat="oLat"
        originLon="oLon"
        destLat="dLat"
        destLon="dLon"
        strokeWidth={3}
      />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    expect(layerProps.getWidth).toBe(3);
  });

  // --- Highlight color ---

  it("uses hot pink highlight color with alpha", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    expect(layerProps.highlightColor).toEqual([...HIGHLIGHT_PINK, 200]);
  });

  // --- BaseMap props passthrough ---

  it("passes layer to BaseMap", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.layers).toHaveLength(1);
  });

  it("passes loading to BaseMap", () => {
    render(
      <ArcMap
        data={SAMPLE_DATA}
        originLat="oLat"
        originLon="oLon"
        destLat="dLat"
        destLon="dLon"
        loading={true}
      />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.loading).toBe(true);
  });

  it("passes className to BaseMap", () => {
    render(
      <ArcMap
        data={SAMPLE_DATA}
        originLat="oLat"
        originLon="oLon"
        destLat="dLat"
        destLon="dLon"
        className="h-96"
      />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.className).toBe("h-96");
  });

  it("passes style to BaseMap", () => {
    render(
      <ArcMap
        data={SAMPLE_DATA}
        originLat="oLat"
        originLon="oLon"
        destLat="dLat"
        destLon="dLon"
        style={{ maxWidth: 600 }}
      />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.style).toEqual({ maxWidth: 600 });
  });

  it("passes custom initialViewState to BaseMap", () => {
    const viewState = { longitude: -73.99, latitude: 40.71, zoom: 10, pitch: 0, bearing: 0 };
    render(
      <ArcMap
        data={SAMPLE_DATA}
        originLat="oLat"
        originLon="oLon"
        destLat="dLat"
        destLon="dLon"
        initialViewState={viewState}
      />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.initialViewState).toEqual(viewState);
  });

  // --- Auto view state from data ---

  it("computes center view state from both source and dest coordinates", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    const vs = baseMapProps.initialViewState as {
      longitude: number;
      latitude: number;
      zoom: number;
    };
    // Min lon: -118.24 (LA origin), Max lon: 151.21 (Sydney dest)
    // Min lat: -33.87 (Sydney dest), Max lat: 51.51 (London dest)
    expect(vs.longitude).toBeCloseTo((-118.24 + 151.21) / 2, 1);
    expect(vs.latitude).toBeCloseTo((-33.87 + 51.51) / 2, 1);
    expect(vs.zoom).toBe(3);
  });

  it("passes undefined initialViewState for empty data", () => {
    render(
      <ArcMap data={[]} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.initialViewState).toBeUndefined();
  });

  // --- Tooltip ---

  it("does not show tooltip by default", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    expect(screen.queryByTestId("arc-tooltip")).not.toBeInTheDocument();
  });

  it("provides onHover callback to ArcLayer", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    expect(typeof layerProps.onHover).toBe("function");
  });

  // --- Tooltip styling ---

  it("renders tooltip with find.bi dark surface styling when hovered", () => {
    const { rerender } = render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );

    const layerProps = mocks.arcLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: Record<string, unknown> | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({ object: { route: "NYC-LON", volume: 5000 }, x: 100, y: 200 });
    });

    rerender(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );

    const tooltip = screen.getByTestId("arc-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.style.background).toBe("rgb(20, 20, 20)"); // #141414
    expect(tooltip.style.border).toBe("1px solid rgb(42, 42, 42)"); // #2A2A2A
    expect(tooltip.style.pointerEvents).toBe("none");
    expect(tooltip.style.left).toBe("112px"); // x + 12
    expect(tooltip.style.top).toBe("188px"); // y - 12
  });

  it("renders tooltip field names and values", () => {
    const { rerender } = render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: Record<string, unknown> | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({ object: { route: "PAR-SYD", volume: 2000 }, x: 50, y: 80 });
    });

    rerender(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );

    const tooltip = screen.getByTestId("arc-tooltip");
    expect(tooltip.textContent).toContain("route:");
    expect(tooltip.textContent).toContain("PAR-SYD");
    expect(tooltip.textContent).toContain("volume:");
    expect(tooltip.textContent).toContain("2000");
  });

  it("hides tooltip when hover leaves arc", () => {
    const { rerender } = render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: Record<string, unknown> | null;
      x: number;
      y: number;
    }) => void;

    // Hover on then off
    act(() => {
      onHover({ object: { route: "NYC-LON" }, x: 100, y: 200 });
    });
    act(() => {
      onHover({ object: null, x: 100, y: 200 });
    });

    rerender(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );

    expect(screen.queryByTestId("arc-tooltip")).not.toBeInTheDocument();
  });

  // --- Container styling ---

  it("has position relative on outer container", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const container = screen.getByTestId("arc-map");
    expect(container.style.position).toBe("relative");
  });

  it("has 100% width and height on outer container", () => {
    render(
      <ArcMap data={SAMPLE_DATA} originLat="oLat" originLon="oLon" destLat="dLat" destLon="dLon" />,
    );
    const container = screen.getByTestId("arc-map");
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

  it("exports DEFAULT_STROKE_WIDTH as 1", () => {
    expect(DEFAULT_STROKE_WIDTH).toBe(1);
  });

  // --- Update triggers ---

  it("sets updateTriggers for getSourceColor and getTargetColor", () => {
    render(
      <ArcMap
        data={SAMPLE_DATA}
        originLat="oLat"
        originLon="oLon"
        destLat="dLat"
        destLon="dLon"
        colorField="route"
      />,
    );
    const layerProps = mocks.arcLayerInstances[0];
    const triggers = layerProps.updateTriggers as Record<string, unknown[]>;
    expect(triggers.getSourceColor).toContain("route");
    expect(triggers.getTargetColor).toContain("route");
  });
});
