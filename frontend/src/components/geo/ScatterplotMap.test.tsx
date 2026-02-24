import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Hoisted mocks ---

const mocks = vi.hoisted(() => {
  const baseMapPropsLog: Record<string, unknown>[] = [];
  const scatterplotLayerInstances: Record<string, unknown>[] = [];
  return { baseMapPropsLog, scatterplotLayerInstances };
});

vi.mock("./BaseMap", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.baseMapPropsLog.push(props);
    return <div data-testid="basemap-mock" />;
  },
  __esModule: true,
}));

vi.mock("@deck.gl/layers", () => ({
  ScatterplotLayer: class MockScatterplotLayer {
    props: Record<string, unknown>;
    constructor(props: Record<string, unknown>) {
      this.props = props;
      mocks.scatterplotLayerInstances.push(props);
    }
  },
}));

import ScatterplotMap, { AMBER, HIGHLIGHT_PINK } from "./ScatterplotMap";

const SAMPLE_DATA = [
  { lat: 40.71, lon: -73.99, city: "New York", pop: 8336817 },
  { lat: 34.05, lon: -118.24, city: "Los Angeles", pop: 3979576 },
  { lat: 41.88, lon: -87.63, city: "Chicago", pop: 2693976 },
];

describe("ScatterplotMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.baseMapPropsLog.length = 0;
    mocks.scatterplotLayerInstances.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders scatterplot-map container", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(screen.getByTestId("scatterplot-map")).toBeInTheDocument();
  });

  it("renders BaseMap inside container", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(screen.getByTestId("basemap-mock")).toBeInTheDocument();
  });

  // --- Layer creation ---

  it("creates a ScatterplotLayer", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(mocks.scatterplotLayerInstances).toHaveLength(1);
  });

  it("passes data to ScatterplotLayer", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    expect(layerProps.data).toBe(SAMPLE_DATA);
  });

  it("sets pickable to true for hover support", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    expect(layerProps.pickable).toBe(true);
  });

  it("sets autoHighlight to true", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    expect(layerProps.autoHighlight).toBe(true);
  });

  it("uses pixels for radius units", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    expect(layerProps.radiusUnits).toBe("pixels");
  });

  it("sets radiusMinPixels and radiusMaxPixels", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    expect(layerProps.radiusMinPixels).toBe(2);
    expect(layerProps.radiusMaxPixels).toBe(40);
  });

  // --- getPosition accessor ---

  it("getPosition reads lat/lon from specified fields", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    const getPosition = layerProps.getPosition as (d: Record<string, unknown>) => number[];
    expect(getPosition(SAMPLE_DATA[0])).toEqual([-73.99, 40.71]);
    expect(getPosition(SAMPLE_DATA[1])).toEqual([-118.24, 34.05]);
  });

  it("getPosition works with custom field names", () => {
    const customData = [{ latitude: 51.5, longitude: -0.12 }];
    render(<ScatterplotMap data={customData} latField="latitude" lonField="longitude" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    const getPosition = layerProps.getPosition as (d: Record<string, unknown>) => number[];
    expect(getPosition(customData[0])).toEqual([-0.12, 51.5]);
  });

  // --- getFillColor accessor ---

  it("defaults to amber fill color when no colorField", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    const getFillColor = layerProps.getFillColor as (d: Record<string, unknown>) => number[];
    expect(getFillColor(SAMPLE_DATA[0])).toEqual(AMBER);
  });

  it("uses colorMap when colorField and colorMap provided", () => {
    const colorMap = { "New York": [255, 0, 0] as [number, number, number] };
    render(
      <ScatterplotMap
        data={SAMPLE_DATA}
        latField="lat"
        lonField="lon"
        colorField="city"
        colorMap={colorMap}
      />,
    );
    const layerProps = mocks.scatterplotLayerInstances[0];
    const getFillColor = layerProps.getFillColor as (d: Record<string, unknown>) => number[];
    expect(getFillColor(SAMPLE_DATA[0])).toEqual([255, 0, 0]);
  });

  it("falls back to amber when colorField value not in colorMap", () => {
    const colorMap = { "New York": [255, 0, 0] as [number, number, number] };
    render(
      <ScatterplotMap
        data={SAMPLE_DATA}
        latField="lat"
        lonField="lon"
        colorField="city"
        colorMap={colorMap}
      />,
    );
    const layerProps = mocks.scatterplotLayerInstances[0];
    const getFillColor = layerProps.getFillColor as (d: Record<string, unknown>) => number[];
    // "Los Angeles" not in colorMap → amber fallback
    expect(getFillColor(SAMPLE_DATA[1])).toEqual(AMBER);
  });

  it("falls back to amber when colorField provided but no colorMap", () => {
    render(
      <ScatterplotMap
        data={SAMPLE_DATA}
        latField="lat"
        lonField="lon"
        colorField="city"
      />,
    );
    const layerProps = mocks.scatterplotLayerInstances[0];
    const getFillColor = layerProps.getFillColor as (d: Record<string, unknown>) => number[];
    expect(getFillColor(SAMPLE_DATA[0])).toEqual(AMBER);
  });

  // --- getRadius accessor ---

  it("uses default radius when no sizeField", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    const getRadius = layerProps.getRadius as (d: Record<string, unknown>) => number;
    expect(getRadius(SAMPLE_DATA[0])).toBe(4);
  });

  it("uses custom radiusPixels when provided", () => {
    render(
      <ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" radiusPixels={10} />,
    );
    const layerProps = mocks.scatterplotLayerInstances[0];
    const getRadius = layerProps.getRadius as (d: Record<string, unknown>) => number;
    expect(getRadius(SAMPLE_DATA[0])).toBe(10);
  });

  it("reads radius from sizeField when provided", () => {
    render(
      <ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" sizeField="pop" />,
    );
    const layerProps = mocks.scatterplotLayerInstances[0];
    const getRadius = layerProps.getRadius as (d: Record<string, unknown>) => number;
    expect(getRadius(SAMPLE_DATA[0])).toBe(8336817);
  });

  // --- Highlight color ---

  it("uses hot pink highlight color with alpha", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    expect(layerProps.highlightColor).toEqual([...HIGHLIGHT_PINK, 200]);
  });

  // --- BaseMap props passthrough ---

  it("passes layer to BaseMap", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.layers).toHaveLength(1);
  });

  it("passes loading to BaseMap", () => {
    render(
      <ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" loading={true} />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.loading).toBe(true);
  });

  it("passes className to BaseMap", () => {
    render(
      <ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" className="h-96" />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.className).toBe("h-96");
  });

  it("passes style to BaseMap", () => {
    render(
      <ScatterplotMap
        data={SAMPLE_DATA}
        latField="lat"
        lonField="lon"
        style={{ maxWidth: 600 }}
      />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.style).toEqual({ maxWidth: 600 });
  });

  it("passes custom initialViewState to BaseMap", () => {
    const viewState = { longitude: -73.99, latitude: 40.71, zoom: 10, pitch: 0, bearing: 0 };
    render(
      <ScatterplotMap
        data={SAMPLE_DATA}
        latField="lat"
        lonField="lon"
        initialViewState={viewState}
      />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.initialViewState).toEqual(viewState);
  });

  // --- Auto view state from data ---

  it("computes center view state from data when no initialViewState", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    const vs = baseMapProps.initialViewState as {
      longitude: number;
      latitude: number;
      zoom: number;
    };
    // Center of NYC (-73.99), LA (-118.24), Chicago (-87.63)
    expect(vs.longitude).toBeCloseTo((-118.24 + -73.99) / 2, 1);
    expect(vs.latitude).toBeCloseTo((34.05 + 41.88) / 2, 1);
    expect(vs.zoom).toBe(3);
  });

  it("passes undefined initialViewState for empty data", () => {
    render(<ScatterplotMap data={[]} latField="lat" lonField="lon" />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.initialViewState).toBeUndefined();
  });

  // --- Tooltip ---

  it("does not show tooltip by default", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(screen.queryByTestId("scatterplot-tooltip")).not.toBeInTheDocument();
  });

  it("provides onHover callback to ScatterplotLayer", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.scatterplotLayerInstances[0];
    expect(typeof layerProps.onHover).toBe("function");
  });

  // --- Tooltip styling ---

  it("renders tooltip with find.bi dark surface styling when hovered", () => {
    const { rerender } = render(
      <ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />,
    );

    // Simulate hover by calling onHover from the layer
    const layerProps = mocks.scatterplotLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: Record<string, unknown> | null;
      x: number;
      y: number;
    }) => void;

    // Trigger hover with an object inside act
    act(() => {
      onHover({ object: { city: "New York", pop: 8336817 }, x: 100, y: 200 });
    });

    // Re-render to pick up state change
    rerender(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);

    const tooltip = screen.getByTestId("scatterplot-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.style.background).toBe("rgb(20, 20, 20)"); // #141414
    // jsdom normalizes hex colors to rgb
    expect(tooltip.style.border).toBe("1px solid rgb(42, 42, 42)"); // #2A2A2A
    expect(tooltip.style.pointerEvents).toBe("none");
    expect(tooltip.style.left).toBe("112px"); // x + 12
    expect(tooltip.style.top).toBe("188px"); // y - 12
  });

  it("renders tooltip field names and values", () => {
    const { rerender } = render(
      <ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />,
    );
    const layerProps = mocks.scatterplotLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: Record<string, unknown> | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({ object: { city: "Chicago", pop: 2693976 }, x: 50, y: 80 });
    });

    rerender(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);

    const tooltip = screen.getByTestId("scatterplot-tooltip");
    expect(tooltip.textContent).toContain("city:");
    expect(tooltip.textContent).toContain("Chicago");
    expect(tooltip.textContent).toContain("pop:");
    expect(tooltip.textContent).toContain("2693976");
  });

  it("hides tooltip when hover leaves point", () => {
    const { rerender } = render(
      <ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />,
    );
    const layerProps = mocks.scatterplotLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: Record<string, unknown> | null;
      x: number;
      y: number;
    }) => void;

    // Hover on then off
    act(() => {
      onHover({ object: { city: "New York" }, x: 100, y: 200 });
    });
    act(() => {
      onHover({ object: null, x: 100, y: 200 });
    });

    rerender(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);

    expect(screen.queryByTestId("scatterplot-tooltip")).not.toBeInTheDocument();
  });

  // --- Container styling ---

  it("has position relative on outer container", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const container = screen.getByTestId("scatterplot-map");
    expect(container.style.position).toBe("relative");
  });

  it("has 100% width and height on outer container", () => {
    render(<ScatterplotMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const container = screen.getByTestId("scatterplot-map");
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

  // --- Update triggers ---

  it("sets updateTriggers for getFillColor and getRadius", () => {
    render(
      <ScatterplotMap
        data={SAMPLE_DATA}
        latField="lat"
        lonField="lon"
        colorField="city"
        sizeField="pop"
      />,
    );
    const layerProps = mocks.scatterplotLayerInstances[0];
    const triggers = layerProps.updateTriggers as Record<string, unknown[]>;
    expect(triggers.getFillColor).toContain("city");
    expect(triggers.getRadius).toContain("pop");
  });
});
