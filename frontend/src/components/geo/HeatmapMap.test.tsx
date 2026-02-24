import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Hoisted mocks ---

const mocks = vi.hoisted(() => {
  const baseMapPropsLog: Record<string, unknown>[] = [];
  const heatmapLayerInstances: Record<string, unknown>[] = [];
  return { baseMapPropsLog, heatmapLayerInstances };
});

vi.mock("./BaseMap", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.baseMapPropsLog.push(props);
    return <div data-testid="basemap-mock" />;
  },
  __esModule: true,
}));

vi.mock("@deck.gl/aggregation-layers", () => ({
  HeatmapLayer: class MockHeatmapLayer {
    props: Record<string, unknown>;
    constructor(props: Record<string, unknown>) {
      this.props = props;
      mocks.heatmapLayerInstances.push(props);
    }
  },
}));

import HeatmapMap, {
  DEFAULT_COLOR_RANGE,
  DEFAULT_RADIUS,
  DEFAULT_INTENSITY,
  DEFAULT_THRESHOLD,
} from "./HeatmapMap";

const SAMPLE_DATA = [
  { lat: 40.71, lon: -73.99, city: "New York", pop: 8336817 },
  { lat: 34.05, lon: -118.24, city: "Los Angeles", pop: 3979576 },
  { lat: 41.88, lon: -87.63, city: "Chicago", pop: 2693976 },
];

describe("HeatmapMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.baseMapPropsLog.length = 0;
    mocks.heatmapLayerInstances.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders heatmap-map container", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(screen.getByTestId("heatmap-map")).toBeInTheDocument();
  });

  it("renders BaseMap inside container", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(screen.getByTestId("basemap-mock")).toBeInTheDocument();
  });

  // --- Layer creation ---

  it("creates a HeatmapLayer", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(mocks.heatmapLayerInstances).toHaveLength(1);
  });

  it("passes data to HeatmapLayer", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(layerProps.data).toBe(SAMPLE_DATA);
  });

  it("sets pickable to true for hover support", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(layerProps.pickable).toBe(true);
  });

  it("uses default radiusPixels of 30", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(layerProps.radiusPixels).toBe(DEFAULT_RADIUS);
  });

  it("uses custom radiusPixels when provided", () => {
    render(
      <HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" radiusPixels={50} />,
    );
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(layerProps.radiusPixels).toBe(50);
  });

  it("uses default intensity of 1", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(layerProps.intensity).toBe(DEFAULT_INTENSITY);
  });

  it("uses custom intensity when provided", () => {
    render(
      <HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" intensity={2.5} />,
    );
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(layerProps.intensity).toBe(2.5);
  });

  it("uses default threshold of 0.05", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(layerProps.threshold).toBe(DEFAULT_THRESHOLD);
  });

  it("uses custom threshold when provided", () => {
    render(
      <HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" threshold={0.1} />,
    );
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(layerProps.threshold).toBe(0.1);
  });

  it("uses default color range", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(layerProps.colorRange).toEqual(DEFAULT_COLOR_RANGE);
  });

  it("uses custom color range when provided", () => {
    const customColors: [number, number, number, number][] = [
      [0, 0, 0, 0],
      [255, 255, 255, 255],
    ];
    render(
      <HeatmapMap
        data={SAMPLE_DATA}
        latField="lat"
        lonField="lon"
        colorRange={customColors}
      />,
    );
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(layerProps.colorRange).toEqual(customColors);
  });

  // --- getPosition accessor ---

  it("getPosition reads lat/lon from specified fields", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.heatmapLayerInstances[0];
    const getPosition = layerProps.getPosition as (d: Record<string, unknown>) => number[];
    expect(getPosition(SAMPLE_DATA[0])).toEqual([-73.99, 40.71]);
    expect(getPosition(SAMPLE_DATA[1])).toEqual([-118.24, 34.05]);
  });

  it("getPosition works with custom field names", () => {
    const customData = [{ latitude: 51.5, longitude: -0.12 }];
    render(<HeatmapMap data={customData} latField="latitude" lonField="longitude" />);
    const layerProps = mocks.heatmapLayerInstances[0];
    const getPosition = layerProps.getPosition as (d: Record<string, unknown>) => number[];
    expect(getPosition(customData[0])).toEqual([-0.12, 51.5]);
  });

  // --- Weight accessor ---

  it("uses default weight of 1 when no weightField", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.heatmapLayerInstances[0];
    const getWeight = layerProps.getWeight as (d: Record<string, unknown>) => number;
    expect(getWeight(SAMPLE_DATA[0])).toBe(1);
  });

  it("reads weight from weightField when provided", () => {
    render(
      <HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" weightField="pop" />,
    );
    const layerProps = mocks.heatmapLayerInstances[0];
    const getWeight = layerProps.getWeight as (d: Record<string, unknown>) => number;
    expect(getWeight(SAMPLE_DATA[0])).toBe(8336817);
  });

  // --- Update triggers ---

  it("sets updateTriggers for getWeight", () => {
    render(
      <HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" weightField="pop" />,
    );
    const layerProps = mocks.heatmapLayerInstances[0];
    const triggers = layerProps.updateTriggers as Record<string, unknown[]>;
    expect(triggers.getWeight).toContain("pop");
  });

  // --- BaseMap props passthrough ---

  it("passes layer to BaseMap", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.layers).toHaveLength(1);
  });

  it("passes loading to BaseMap", () => {
    render(
      <HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" loading={true} />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.loading).toBe(true);
  });

  it("passes className to BaseMap", () => {
    render(
      <HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" className="h-96" />,
    );
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.className).toBe("h-96");
  });

  it("passes style to BaseMap", () => {
    render(
      <HeatmapMap
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
      <HeatmapMap
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
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
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

  it("passes undefined initialViewState for empty data", () => {
    render(<HeatmapMap data={[]} latField="lat" lonField="lon" />);
    const baseMapProps = mocks.baseMapPropsLog[0];
    expect(baseMapProps.initialViewState).toBeUndefined();
  });

  // --- Tooltip ---

  it("does not show tooltip by default", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    expect(screen.queryByTestId("heatmap-tooltip")).not.toBeInTheDocument();
  });

  it("provides onHover callback to HeatmapLayer", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const layerProps = mocks.heatmapLayerInstances[0];
    expect(typeof layerProps.onHover).toBe("function");
  });

  it("renders tooltip with find.bi dark surface styling when hovered", () => {
    const { rerender } = render(
      <HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />,
    );

    const layerProps = mocks.heatmapLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: Record<string, unknown> | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({ object: { intensity: 0.85 }, x: 100, y: 200 });
    });

    rerender(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);

    const tooltip = screen.getByTestId("heatmap-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.style.background).toBe("rgb(20, 20, 20)");
    expect(tooltip.style.border).toBe("1px solid rgb(42, 42, 42)");
    expect(tooltip.style.pointerEvents).toBe("none");
    expect(tooltip.style.left).toBe("112px");
    expect(tooltip.style.top).toBe("188px");
  });

  it("renders tooltip field names and values", () => {
    const { rerender } = render(
      <HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />,
    );

    const layerProps = mocks.heatmapLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: Record<string, unknown> | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({ object: { intensity: 0.85, count: 12 }, x: 50, y: 80 });
    });

    rerender(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);

    const tooltip = screen.getByTestId("heatmap-tooltip");
    expect(tooltip.textContent).toContain("intensity:");
    expect(tooltip.textContent).toContain("0.85");
    expect(tooltip.textContent).toContain("count:");
    expect(tooltip.textContent).toContain("12");
  });

  it("hides tooltip when hover leaves", () => {
    const { rerender } = render(
      <HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />,
    );

    const layerProps = mocks.heatmapLayerInstances[0];
    const onHover = layerProps.onHover as (info: {
      object: Record<string, unknown> | null;
      x: number;
      y: number;
    }) => void;

    act(() => {
      onHover({ object: { intensity: 0.5 }, x: 100, y: 200 });
    });
    act(() => {
      onHover({ object: null, x: 100, y: 200 });
    });

    rerender(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);

    expect(screen.queryByTestId("heatmap-tooltip")).not.toBeInTheDocument();
  });

  // --- Container styling ---

  it("has position relative on outer container", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const container = screen.getByTestId("heatmap-map");
    expect(container.style.position).toBe("relative");
  });

  it("has 100% width and height on outer container", () => {
    render(<HeatmapMap data={SAMPLE_DATA} latField="lat" lonField="lon" />);
    const container = screen.getByTestId("heatmap-map");
    expect(container.style.width).toBe("100%");
    expect(container.style.height).toBe("100%");
  });

  // --- Exported constants ---

  it("exports DEFAULT_COLOR_RANGE with 6 RGBA colors", () => {
    expect(DEFAULT_COLOR_RANGE).toHaveLength(6);
    expect(DEFAULT_COLOR_RANGE[4]).toEqual([245, 166, 35, 230]); // amber with alpha
  });

  it("exports DEFAULT_RADIUS as 30", () => {
    expect(DEFAULT_RADIUS).toBe(30);
  });

  it("exports DEFAULT_INTENSITY as 1", () => {
    expect(DEFAULT_INTENSITY).toBe(1);
  });

  it("exports DEFAULT_THRESHOLD as 0.05", () => {
    expect(DEFAULT_THRESHOLD).toBe(0.05);
  });
});
