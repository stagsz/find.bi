import { render, screen, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Hoisted mocks (accessible inside vi.mock factories) ---

const mocks = vi.hoisted(() => {
  const mapInstance = {
    remove: vi.fn(),
    jumpTo: vi.fn(),
  };
  const MapConstructor = vi.fn(() => mapInstance);
  const deckGLPropsLog: Record<string, unknown>[] = [];
  return { mapInstance, MapConstructor, deckGLPropsLog };
});

vi.mock("maplibre-gl", () => ({
  Map: mocks.MapConstructor,
}));

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

vi.mock("@deck.gl/react", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.deckGLPropsLog.push(props);
    return <div data-testid="deckgl-overlay" />;
  },
  __esModule: true,
}));

import BaseMap from "./BaseMap";

describe("BaseMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deckGLPropsLog.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a basemap container", () => {
    render(<BaseMap />);
    expect(screen.getByTestId("basemap-container")).toBeInTheDocument();
  });

  it("renders MapLibre container element", () => {
    render(<BaseMap />);
    expect(screen.getByTestId("basemap-maplibre")).toBeInTheDocument();
  });

  it("renders DeckGL overlay", () => {
    render(<BaseMap />);
    expect(screen.getByTestId("deckgl-overlay")).toBeInTheDocument();
  });

  it("initializes MapLibre with default view state", () => {
    render(<BaseMap />);
    expect(mocks.MapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [0, 20],
        zoom: 2,
        pitch: 0,
        bearing: 0,
        interactive: false,
      }),
    );
  });

  it("initializes MapLibre with custom view state", () => {
    render(
      <BaseMap
        initialViewState={{
          longitude: -73.99,
          latitude: 40.71,
          zoom: 10,
          pitch: 45,
          bearing: 90,
        }}
      />,
    );
    expect(mocks.MapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [-73.99, 40.71],
        zoom: 10,
        pitch: 45,
        bearing: 90,
      }),
    );
  });

  it("uses default dark-matter map style", () => {
    render(<BaseMap />);
    expect(mocks.MapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        style:
          "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      }),
    );
  });

  it("uses custom map style when provided", () => {
    const customStyle = "https://example.com/custom-style.json";
    render(<BaseMap mapStyle={customStyle} />);
    expect(mocks.MapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        style: customStyle,
      }),
    );
  });

  it("disables MapLibre interactivity (DeckGL handles controls)", () => {
    render(<BaseMap />);
    expect(mocks.MapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        interactive: false,
      }),
    );
  });

  it("passes viewState to DeckGL", () => {
    render(
      <BaseMap
        initialViewState={{
          longitude: 10,
          latitude: 20,
          zoom: 5,
        }}
      />,
    );
    const deckProps = mocks.deckGLPropsLog[0];
    expect(deckProps.viewState).toEqual(
      expect.objectContaining({
        longitude: 10,
        latitude: 20,
        zoom: 5,
      }),
    );
  });

  it("passes controller=true to DeckGL for zoom/pan", () => {
    render(<BaseMap />);
    const deckProps = mocks.deckGLPropsLog[0];
    expect(deckProps.controller).toBe(true);
  });

  it("passes empty layers by default", () => {
    render(<BaseMap />);
    const deckProps = mocks.deckGLPropsLog[0];
    expect(deckProps.layers).toEqual([]);
  });

  it("passes provided layers to DeckGL", () => {
    const fakeLayers = [{ id: "test-layer" }];
    render(<BaseMap layers={fakeLayers as never} />);
    const deckProps = mocks.deckGLPropsLog[0];
    expect(deckProps.layers).toBe(fakeLayers);
  });

  it("passes onViewStateChange callback to DeckGL", () => {
    render(<BaseMap />);
    const deckProps = mocks.deckGLPropsLog[0];
    expect(typeof deckProps.onViewStateChange).toBe("function");
  });

  it("syncs MapLibre when DeckGL view state changes", () => {
    render(<BaseMap />);
    const deckProps = mocks.deckGLPropsLog[0];
    const onViewStateChange = deckProps.onViewStateChange as (params: {
      viewState: {
        longitude: number;
        latitude: number;
        zoom: number;
        pitch: number;
        bearing: number;
      };
    }) => void;

    act(() => {
      onViewStateChange({
        viewState: {
          longitude: 15,
          latitude: 30,
          zoom: 8,
          pitch: 30,
          bearing: 45,
        },
      });
    });

    expect(mocks.mapInstance.jumpTo).toHaveBeenCalledWith({
      center: [15, 30],
      zoom: 8,
      pitch: 30,
      bearing: 45,
    });
  });

  it("removes MapLibre map on unmount", () => {
    const { unmount } = render(<BaseMap />);
    unmount();
    expect(mocks.mapInstance.remove).toHaveBeenCalled();
  });

  it("does not show loading overlay by default", () => {
    render(<BaseMap />);
    expect(screen.queryByTestId("basemap-loading")).not.toBeInTheDocument();
  });

  it("shows loading overlay when loading=true", () => {
    render(<BaseMap loading={true} />);
    expect(screen.getByTestId("basemap-loading")).toBeInTheDocument();
  });

  it("hides loading overlay when loading=false", () => {
    render(<BaseMap loading={false} />);
    expect(screen.queryByTestId("basemap-loading")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<BaseMap className="w-full h-96" />);
    const container = screen.getByTestId("basemap-container");
    expect(container).toHaveClass("w-full");
    expect(container).toHaveClass("h-96");
  });

  it("applies custom style", () => {
    render(<BaseMap style={{ maxWidth: 800 }} />);
    const container = screen.getByTestId("basemap-container");
    expect(container.style.maxWidth).toBe("800px");
  });

  it("has position relative on container for overlay stacking", () => {
    render(<BaseMap />);
    const container = screen.getByTestId("basemap-container");
    expect(container.style.position).toBe("relative");
  });

  it("has 100% width and height on container", () => {
    render(<BaseMap />);
    const container = screen.getByTestId("basemap-container");
    expect(container.style.width).toBe("100%");
    expect(container.style.height).toBe("100%");
  });

  it("has minHeight 200px on container", () => {
    render(<BaseMap />);
    const container = screen.getByTestId("basemap-container");
    expect(container.style.minHeight).toBe("200px");
  });

  it("positions MapLibre container absolutely", () => {
    render(<BaseMap />);
    const mapEl = screen.getByTestId("basemap-maplibre");
    expect(mapEl.style.position).toBe("absolute");
    expect(mapEl.style.inset).toBe("0");
  });

  it("positions DeckGL overlay absolutely", () => {
    render(<BaseMap />);
    const deckProps = mocks.deckGLPropsLog[0];
    const deckStyle = deckProps.style as React.CSSProperties;
    expect(deckStyle.position).toBe("absolute");
    expect(deckStyle.inset).toBe(0);
  });
});
