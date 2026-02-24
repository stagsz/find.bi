import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => {
  const fakeSvg = document.createElement("svg");
  fakeSvg.setAttribute("data-plot", "true");
  return {
    plot: vi.fn(() => fakeSvg),
    barY: vi.fn(() => "barY-mark"),
    dot: vi.fn(() => "dot-mark"),
    line: vi.fn(() => "line-mark"),
    lineY: vi.fn(() => "lineY-mark"),
    ruleY: vi.fn(() => "ruleY-mark"),
    frame: vi.fn(() => "frame-mark"),
    area: vi.fn(() => "area-mark"),
    areaX: vi.fn(() => "areaX-mark"),
    areaY: vi.fn(() => "areaY-mark"),
    barX: vi.fn(() => "barX-mark"),
    cell: vi.fn(() => "cell-mark"),
    cellX: vi.fn(() => "cellX-mark"),
    cellY: vi.fn(() => "cellY-mark"),
    dotX: vi.fn(() => "dotX-mark"),
    dotY: vi.fn(() => "dotY-mark"),
    lineX: vi.fn(() => "lineX-mark"),
    link: vi.fn(() => "link-mark"),
    rect: vi.fn(() => "rect-mark"),
    rectX: vi.fn(() => "rectX-mark"),
    rectY: vi.fn(() => "rectY-mark"),
    ruleX: vi.fn(() => "ruleX-mark"),
    text: vi.fn(() => "text-mark"),
    textX: vi.fn(() => "textX-mark"),
    textY: vi.fn(() => "textY-mark"),
    tickX: vi.fn(() => "tickX-mark"),
    tickY: vi.fn(() => "tickY-mark"),
    tip: vi.fn(() => "tip-mark"),
  };
});

vi.mock("@observablehq/plot", () => mocks);

import PlotRenderer from "./PlotRenderer";
import type { PlotSpec } from "./PlotRenderer";

const sampleData = [
  { region: "North", revenue: 100 },
  { region: "South", revenue: 200 },
  { region: "East", revenue: 150 },
];

const barSpec: PlotSpec = {
  marks: [
    { type: "barY", data: sampleData, options: { x: "region", y: "revenue" } },
  ],
};

describe("PlotRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a plot container", () => {
    render(<PlotRenderer spec={barSpec} />);
    expect(screen.getByTestId("plot-container")).toBeInTheDocument();
  });

  it("calls Plot.plot with resolved marks", () => {
    render(<PlotRenderer spec={barSpec} />);
    expect(mocks.barY).toHaveBeenCalledWith(sampleData, {
      x: "region",
      y: "revenue",
    });
    expect(mocks.plot).toHaveBeenCalledWith({
      marks: ["barY-mark"],
    });
  });

  it("appends the returned SVG element to the container", () => {
    render(<PlotRenderer spec={barSpec} />);
    const container = screen.getByTestId("plot-container");
    const svg = container.querySelector("svg[data-plot]");
    expect(svg).toBeInTheDocument();
  });

  it("handles multiple marks", () => {
    const multiSpec: PlotSpec = {
      marks: [
        {
          type: "barY",
          data: sampleData,
          options: { x: "region", y: "revenue" },
        },
        {
          type: "ruleY",
          data: [{ value: 0 }],
          options: {},
        },
      ],
    };
    render(<PlotRenderer spec={multiSpec} />);
    expect(mocks.barY).toHaveBeenCalledWith(sampleData, {
      x: "region",
      y: "revenue",
    });
    expect(mocks.ruleY).toHaveBeenCalledWith([{ value: 0 }], {});
    expect(mocks.plot).toHaveBeenCalledWith({
      marks: ["barY-mark", "ruleY-mark"],
    });
  });

  it("passes top-level options to Plot.plot", () => {
    const specWithOptions: PlotSpec = {
      marks: [{ type: "dot", data: sampleData, options: { x: "region", y: "revenue" } }],
      width: 800,
      height: 400,
      marginLeft: 60,
    };
    render(<PlotRenderer spec={specWithOptions} />);
    expect(mocks.plot).toHaveBeenCalledWith({
      marks: ["dot-mark"],
      width: 800,
      height: 400,
      marginLeft: 60,
    });
  });

  it("skips unknown mark types", () => {
    const specWithUnknown: PlotSpec = {
      marks: [
        { type: "barY", data: sampleData, options: { x: "region", y: "revenue" } },
        { type: "unknownMark", data: [], options: {} },
      ],
    };
    render(<PlotRenderer spec={specWithUnknown} />);
    expect(mocks.plot).toHaveBeenCalledWith({
      marks: ["barY-mark"],
    });
  });

  it("uses empty array for marks with no data", () => {
    const frameSpec: PlotSpec = {
      marks: [{ type: "frame" }],
    };
    render(<PlotRenderer spec={frameSpec} />);
    expect(mocks.frame).toHaveBeenCalledWith([], {});
  });

  it("passes className to the container", () => {
    render(<PlotRenderer spec={barSpec} className="custom-plot" />);
    expect(screen.getByTestId("plot-container")).toHaveClass("custom-plot");
  });

  it("passes style to the container", () => {
    render(<PlotRenderer spec={barSpec} style={{ height: 500 }} />);
    const container = screen.getByTestId("plot-container");
    expect(container.style.height).toBe("500px");
  });

  it("applies default minHeight", () => {
    render(<PlotRenderer spec={barSpec} />);
    const container = screen.getByTestId("plot-container");
    expect(container.style.minHeight).toBe("200px");
  });

  it("replaces content when spec changes", () => {
    const { rerender } = render(<PlotRenderer spec={barSpec} />);
    mocks.plot.mockClear();
    mocks.barY.mockClear();

    const newSpec: PlotSpec = {
      marks: [
        {
          type: "dot",
          data: [{ x: 1, y: 2 }],
          options: { x: "x", y: "y" },
        },
      ],
    };
    rerender(<PlotRenderer spec={newSpec} />);

    expect(mocks.dot).toHaveBeenCalledWith([{ x: 1, y: 2 }], {
      x: "x",
      y: "y",
    });
    expect(mocks.plot).toHaveBeenCalledTimes(1);
  });

  it("handles empty marks array", () => {
    const emptySpec: PlotSpec = { marks: [] };
    render(<PlotRenderer spec={emptySpec} />);
    expect(mocks.plot).toHaveBeenCalledWith({ marks: [] });
  });
});
