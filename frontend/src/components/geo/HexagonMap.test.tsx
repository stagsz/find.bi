import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Hoisted mocks ---

const mocks = vi.hoisted(() => {
  const baseMapPropsLog: Record<string, unknown>[] = [];
  const hexagonLayerInstances: Record<string, unknown>[] = [];
  return { baseMapPropsLog, hexagonLayerInstances };
});

vi.mock("./BaseMap", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.baseMapPropsLog.push(props);
    return <div data-testid="basemap-mock" />;
  },
  __esModule: true,
}));

vi.mock("@deck.gl/aggregation-layers", () => ({
  HexagonLayer: class MockHexagonLayer {
    props: Record<string, unknown>;
    constructor(props: Record<string, unknown>) {
      this.props = props;
      mocks.hexagonLayerInstances.push(props);
    }
  },
}));

import HexagonMap, {
  DEFAULT_COLOR_RANGE,
  DEFAULT_RADIUS,
  DEFAULT_ELEVATION_SCALE,
} from "./HexagonMap";

const SAMPLE_DATA = [
  { lat: 40.71, lon: -73.99, city: "New York", pop: 8336817 },
  { lat: 34.05, lon: -118.24, city: "Los Angeles", pop: 3979576 },
  { lat: 41.88, lon: -87.63, city: "Chicago", pop: 2693976 },
];

describe("HexagonMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.baseMapPropsLog.length = 0;
    mocks.hexagonLayerInstances.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders hexagon-map container", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(screen.getByTestId("hexagon-map")).toBeInTheDocument();
  });

  it("renders BaseMap inside container", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(screen.getByTestId("basemap-mock")).toBeInTheDocument();
  });

  // --- Layer creation ---

  it("creates a HexagonLayer", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(mocks.hexagonLayerInstances).toHaveLength(1);
  });

  it("passes data to HexagonLayer", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.data).toBe(SAMPLE_DATA);
  });

  it("sets pickable to true for hover support", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.pickable).toBe(true);
  });

  it("uses default radius of 1000 meters", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.radius).toBe(DEFAULT_RADIUS);
  });

  it("uses custom radius when provided", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" radius={5000} />);
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.radius).toBe(5000);
  });

  it("uses default elevation scale", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.elevationScale).toBe(DEFAULT_ELEVATION_SCALE);
  });

  it("uses custom elevation scale when provided", () => {
    render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" elevationScale={10} />,
    );
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.elevationScale).toBe(10);
  });

  it("uses default upper percentile of 100", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.upperPercentile).toBe(100);
  });

  it("uses custom upper percentile when provided", () => {
    render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" upperPercentile={90} />,
    );
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.upperPercentile).toBe(90);
  });

  it("uses default color range", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.colorRange).toEqual(DEFAULT_COLOR_RANGE);
  });

  it("uses custom color range when provided", () => {
    const customColors: [number, number, number][] = [
      [0, 0, 0],
      [255, 255, 255],
    ];
    render(
      <HexagonMap
        data={SAMPLE_DATA}
        latField="lat"
        lonField="lon"
        colorRange={customColors}
      />,
    );
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.colorRange).toEqual(customColors);
  });

  it("defaults extruded to false", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.extruded).toBe(false);
  });

  it("sets extruded when provided", () => {
    render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" extruded={true} />,
    );
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.extruded).toBe(true);
  });

  // --- getPosition accessor ---

  it("getPosition reads lat/lon from specified fields", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    const getPosition = layerProps.getPosition as (d: Record<string, unknown>) => number[];
    expect(getPosition(SAMPLE_DATA[0])).toEqual([-73.99, 40.71]);
    expect(getPosition(SAMPLE_DATA[1])).toEqual([-118.24, 34.05]);
  });

  it("getPosition works with custom field names", () => {
    const customData = [{ latitude: 51.5, longitude: -0.12 }];
    render(<HexagonMap data={customData} latField="latitude" lonField="longitude" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    const getPosition = layerProps.getPosition as (d: Record<string, unknown>) => number[];
    expect(getPosition(customData[0])).toEqual([-0.12, 51.5]);
  });

  // --- Weight accessors ---

  it("does not set weight accessors when no weightField", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(layerProps.getElevationWeight).toBeUndefined();
    expect(layerProps.getColorWeight).toBeUndefined();
  });

  it("sets getElevationWeight when weightField provided", () => {
    render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" weightField="pop" />,
    );
    const layerProps = mocks.hexagonLayerInstances[0];
    const getWeight = layerProps.getElevationWeight as (
      d: Record<string, unknown>,
    ) => number;
    expect(getWeight(SAMPLE_DATA[0])).toBe(8336817);
  });

  it("sets getColorWeight when weightField provided", () => {
    render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" weightField="pop" />,
    );
    const layerProps = mocks.hexagonLayerInstances[0];
    const getWeight = layerProps.getColorWeight as (
      d: Record<string, unknown>,
    ) => number;
    expect(getWeight(SAMPLE_DATA[0])).toBe(8336817);
  });

  // --- Update triggers ---

  it("sets updateTriggers for weight accessors", () => {
    render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" weightField="pop" />,
    );
    const layerProps = mocks.hexagonLayerInstances[0];
    const triggers = layerProps.updateTriggers as Record<string, unknown[]>;
    expect(triggers.getElevationWeight).toContain("pop");
    expect(triggers.getColorWeight).toContain("pop");
  });

  // --- BaseMap props passthrough ---

  it("passes layer to BaseMap", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.layers).toHaveLength(1);
  });

  it("passes loading to BaseMap", () => {
    render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" loading={true} />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.loading).toBe(true);
  });

  it("passes className to BaseMap", () => {
    render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" className="h-96" />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.className).toBe("h-96");
  });

  it("passes style to BaseMap", () => {
    render(
      <HexagonMap
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
    const viewState = {
      longitude: -73.99,
      latitude: 40.71,
      zoom: 10,
      pitch: 0,
      bearing: 0,
    };
    render(
      <HexagonMap
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
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    const vs = baseMapProps.initialViewState as {
      longitude: number;
      latitude: number;
      zoom: number;
      pitch: number;
    };
    expect(vs.longitude).toBeCloseTo((-118.24 + -73.99) / 2, 1);
    expect(vs.latitude).toBeCloseTo((34.05 + 41.88) / 2, 1);
    expect(vs.zoom).toBe(3);
    expect(vs.pitch).toBe(0);
  });

  it("sets pitch to 45 in auto view state when extruded", () => {
    render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" extruded={true} />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    const vs = baseMapProps.initialViewState as { pitch: number };
    expect(vs.pitch).toBe(45);
  });

  it("passes undefined initialViewState for empty data", () => {
    render(<HexagonMap data={[]} latField="lat" lonField="lon" />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.initialViewState).toBeUndefined();
  });

  // --- Tooltip ---

  it("does not show tooltip by default", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(screen.queryByTestId("hexagon-tooltip")).not.toBeInTheDocument();
  });

  it("provides onHover callback to HexagonLayer", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.hexagonLayerInstances[0];
    expect(typeof layerProps.onHover).toBe("function");
  });

  it("renders tooltip with find.bi dark surface styling when hovered", () => {
    const { rerender } = render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />,
    );

    const layerProps = mocks.hexagonLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: { count: number; position: [number, number] } | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({
        object: { count: 42, position: [-73.99, 40.71] },
        x: 100,
        y: 200,
      });
    });

    rerender(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);

    const tooltip = screen.getByTestId("hexagon-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.style.background).toBe("rgb(20, 20, 20)");
    expect(tooltip.style.border).toBe("1px solid rgb(42, 42, 42)");
    expect(tooltip.style.pointerEvents).toBe("none");
    expect(tooltip.style.left).toBe("112px");
    expect(tooltip.style.top).toBe("188px");
  });

  it("renders tooltip with count and center coordinates", () => {
    const { rerender } = render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />,
    );

    const layerProps = mocks.hexagonLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: { count: number; position: [number, number] } | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({
        object: { count: 42, position: [-73.99, 40.71] },
        x: 50,
        y: 80,
      });
    });

    rerender(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);

    const tooltip = screen.getByTestId("hexagon-tooltip");
    expect(tooltip.textContent).toContain("count:");
    expect(tooltip.textContent).toContain("42");
    expect(tooltip.textContent).toContain("center:");
    expect(tooltip.textContent).toContain("40.7100");
    expect(tooltip.textContent).toContain("-73.9900");
  });

  it("hides tooltip when hover leaves hex bin", () => {
    const { rerender } = render(
      <HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />,
    );

    const layerProps = mocks.hexagonLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: { count: number; position: [number, number] } | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({
        object: { count: 10, position: [0, 0] },
        x: 100,
        y: 200,
      });
    });
    act(() => {
      onHover({ object: null, x: 100, y: 200 });
    });

    rerender(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);

    expect(screen.queryByTestId("hexagon-tooltip")).not.toBeInTheDocument();
  });

  // --- Container styling ---

  it("has position relative on outer container", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const container = screen.getByTestId("hexagon-map");
    expect(container.style.position).toBe("relative");
  });

  it("has 100% width and height on outer container", () => {
    render(<HexagonMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const container = screen.getByTestId("hexagon-map");
    expect(container.style.width).toBe("100%");
    expect(container.style.height).toBe("100%");
  });

  // --- Exported constants ---

  it("exports DEFAULT_COLOR_RANGE with 6 colors", () => {
    expect(DEFAULT_COLOR_RANGE).toHaveLength(6);
    expect(DEFAULT_COLOR_RANGE[4]).toEqual([245, 166, 35]); // amber
  });

  it("exports DEFAULT_RADIUS as 1000", () => {
    expect(DEFAULT_RADIUS).toBe(1000);
  });

  it("exports DEFAULT_ELEVATION_SCALE as 4", () => {
    expect(DEFAULT_ELEVATION_SCALE).toBe(4);
  });
});
