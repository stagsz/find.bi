import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => {
  const chartInstance = {
    setOption: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    chartInstance,
    init: vi.fn(() => chartInstance),
    use: vi.fn(),
  };
});

vi.mock("echarts/core", () => ({
  default: { init: mocks.init, use: mocks.use },
  init: mocks.init,
  use: mocks.use,
}));

vi.mock("echarts/charts", () => ({
  BarChart: "BarChart",
  LineChart: "LineChart",
  PieChart: "PieChart",
  ScatterChart: "ScatterChart",
  RadarChart: "RadarChart",
}));

vi.mock("echarts/components", () => ({
  TitleComponent: "TitleComponent",
  TooltipComponent: "TooltipComponent",
  LegendComponent: "LegendComponent",
  GridComponent: "GridComponent",
  DatasetComponent: "DatasetComponent",
  TransformComponent: "TransformComponent",
  ToolboxComponent: "ToolboxComponent",
}));

vi.mock("echarts/features", () => ({
  LabelLayout: "LabelLayout",
  UniversalTransition: "UniversalTransition",
}));

vi.mock("echarts/renderers", () => ({
  CanvasRenderer: "CanvasRenderer",
  SVGRenderer: "SVGRenderer",
}));

import ScatterChart from "./ScatterChart";

class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});

const mockData = [
  { x: 10, y: 20, size: 100, category: "A" },
  { x: 30, y: 40, size: 200, category: "A" },
  { x: 50, y: 60, size: 300, category: "B" },
  { x: 70, y: 80, size: 400, category: "B" },
];

describe("ScatterChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an echart container", () => {
    render(<ScatterChart data={mockData} xField="x" yField="y" />);
    expect(screen.getByTestId("echart-container")).toBeInTheDocument();
  });

  it("generates scatter option with value axes", () => {
    render(<ScatterChart data={mockData} xField="x" yField="y" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis).toEqual({ type: "value" });
    expect(option.yAxis).toEqual({ type: "value" });
  });

  it("generates scatter data as [x, y] arrays", () => {
    render(<ScatterChart data={mockData} xField="x" yField="y" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series).toHaveLength(1);
    expect(option.series[0].type).toBe("scatter");
    expect(option.series[0].data).toEqual([
      { value: [10, 20] },
      { value: [30, 40] },
      { value: [50, 60] },
      { value: [70, 80] },
    ]);
  });

  it("includes title when provided", () => {
    render(
      <ScatterChart
        data={mockData}
        xField="x"
        yField="y"
        title="Scatter Plot"
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.title).toEqual({ text: "Scatter Plot" });
  });

  it("omits title when not provided", () => {
    render(<ScatterChart data={mockData} xField="x" yField="y" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.title).toBeUndefined();
  });

  it("uses item tooltip trigger", () => {
    render(<ScatterChart data={mockData} xField="x" yField="y" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.tooltip.trigger).toBe("item");
  });

  it("handles empty data array", () => {
    render(<ScatterChart data={[]} xField="x" yField="y" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series).toEqual([{ type: "scatter", data: [] }]);
  });

  it("converts non-numeric values to 0", () => {
    const data = [
      { x: "not a number", y: null },
      { x: undefined, y: "abc" },
    ];
    render(
      <ScatterChart
        data={data as Record<string, unknown>[]}
        xField="x"
        yField="y"
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data).toEqual([
      { value: [0, 0] },
      { value: [0, 0] },
    ]);
  });

  it("handles missing fields gracefully", () => {
    const data = [{ a: 1 }, { a: 2 }];
    render(<ScatterChart data={data} xField="missing" yField="also_missing" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data).toEqual([
      { value: [0, 0] },
      { value: [0, 0] },
    ]);
  });

  it("supports sizeField with normalized symbolSize", () => {
    render(
      <ScatterChart data={mockData} xField="x" yField="y" sizeField="size" />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    const points = option.series[0].data;

    // All points should have symbolSize
    points.forEach((p: { symbolSize?: number }) => {
      expect(p.symbolSize).toBeGreaterThanOrEqual(5);
      expect(p.symbolSize).toBeLessThanOrEqual(40);
    });

    // value arrays should include original size as 3rd element
    expect(points[0].value).toEqual([10, 20, 100]);
    expect(points[3].value).toEqual([70, 80, 400]);

    // Smallest size should map to MIN_SYMBOL (5), largest to MAX_SYMBOL (40)
    expect(points[0].symbolSize).toBe(5);
    expect(points[3].symbolSize).toBe(40);
  });

  it("assigns uniform symbolSize when all sizes are equal", () => {
    const data = [
      { x: 10, y: 20, size: 50 },
      { x: 30, y: 40, size: 50 },
    ];
    render(
      <ScatterChart data={data} xField="x" yField="y" sizeField="size" />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    const points = option.series[0].data;

    // When range is 0, all points get DEFAULT_SYMBOL (20)
    expect(points[0].symbolSize).toBe(20);
    expect(points[1].symbolSize).toBe(20);
  });

  it("supports colorField with grouped series", () => {
    render(
      <ScatterChart
        data={mockData}
        xField="x"
        yField="y"
        colorField="category"
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];

    expect(option.series).toHaveLength(2);
    expect(option.series[0].name).toBe("A");
    expect(option.series[0].type).toBe("scatter");
    expect(option.series[0].data).toEqual([
      { value: [10, 20] },
      { value: [30, 40] },
    ]);
    expect(option.series[1].name).toBe("B");
    expect(option.series[1].data).toEqual([
      { value: [50, 60] },
      { value: [70, 80] },
    ]);
  });

  it("includes legend when colorField is provided", () => {
    render(
      <ScatterChart
        data={mockData}
        xField="x"
        yField="y"
        colorField="category"
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.legend).toEqual({ data: ["A", "B"] });
  });

  it("omits legend when colorField is not provided", () => {
    render(<ScatterChart data={mockData} xField="x" yField="y" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.legend).toBeUndefined();
  });

  it("supports both sizeField and colorField together", () => {
    render(
      <ScatterChart
        data={mockData}
        xField="x"
        yField="y"
        sizeField="size"
        colorField="category"
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];

    // Grouped by color
    expect(option.series).toHaveLength(2);

    // Each point has symbolSize and 3-element value array
    const pointA = option.series[0].data[0];
    expect(pointA.value).toHaveLength(3);
    expect(pointA.symbolSize).toBeDefined();

    const pointB = option.series[1].data[0];
    expect(pointB.value).toHaveLength(3);
    expect(pointB.symbolSize).toBeDefined();
  });

  it("tooltip formatter shows x and y fields", () => {
    render(<ScatterChart data={mockData} xField="x" yField="y" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    const result = option.tooltip.formatter({ value: [10, 20] });
    expect(result).toContain("x:");
    expect(result).toContain("10");
    expect(result).toContain("y:");
    expect(result).toContain("20");
  });

  it("tooltip formatter shows sizeField when present", () => {
    render(
      <ScatterChart data={mockData} xField="x" yField="y" sizeField="size" />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    const result = option.tooltip.formatter({ value: [10, 20, 100] });
    expect(result).toContain("size:");
    expect(result).toContain("100");
  });

  it("tooltip formatter shows colorField series name", () => {
    render(
      <ScatterChart
        data={mockData}
        xField="x"
        yField="y"
        colorField="category"
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    const result = option.tooltip.formatter({
      value: [10, 20],
      seriesName: "A",
    });
    expect(result).toContain("category:");
    expect(result).toContain("A");
  });

  it("passes className to EChart", () => {
    render(
      <ScatterChart
        data={mockData}
        xField="x"
        yField="y"
        className="custom-class"
      />,
    );
    expect(screen.getByTestId("echart-container")).toHaveClass("custom-class");
  });

  it("passes style to EChart", () => {
    render(
      <ScatterChart
        data={mockData}
        xField="x"
        yField="y"
        style={{ height: 400 }}
      />,
    );
    const container = screen.getByTestId("echart-container");
    expect(container.style.height).toBe("400px");
  });

  it("passes loading to EChart", () => {
    render(
      <ScatterChart data={mockData} xField="x" yField="y" loading={true} />,
    );
    expect(mocks.chartInstance.showLoading).toHaveBeenCalled();
  });

  it("passes renderer to EChart", () => {
    render(
      <ScatterChart data={mockData} xField="x" yField="y" renderer="svg" />,
    );
    expect(mocks.init).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      undefined,
      { renderer: "svg" },
    );
  });

  it("updates chart when data changes", () => {
    const { rerender } = render(
      <ScatterChart data={mockData} xField="x" yField="y" />,
    );
    mocks.chartInstance.setOption.mockClear();

    const newData = [
      { x: 100, y: 200 },
      { x: 300, y: 400 },
    ];
    rerender(<ScatterChart data={newData} xField="x" yField="y" />);

    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data).toEqual([
      { value: [100, 200] },
      { value: [300, 400] },
    ]);
  });
});
