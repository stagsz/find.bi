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

import LineChart from "./LineChart";

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
  { month: "Jan", revenue: 100, cost: 60 },
  { month: "Feb", revenue: 200, cost: 80 },
  { month: "Mar", revenue: 150, cost: 70 },
  { month: "Apr", revenue: 300, cost: 120 },
];

describe("LineChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an echart container", () => {
    render(<LineChart data={mockData} xField="month" yField="revenue" />);
    expect(screen.getByTestId("echart-container")).toBeInTheDocument();
  });

  it("generates single line option by default", () => {
    render(<LineChart data={mockData} xField="month" yField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis).toEqual({
      type: "category",
      data: ["Jan", "Feb", "Mar", "Apr"],
    });
    expect(option.yAxis).toEqual({ type: "value" });
    expect(option.series).toEqual([
      { type: "line", smooth: false, data: [100, 200, 150, 300] },
    ]);
  });

  it("supports smooth lines", () => {
    render(
      <LineChart data={mockData} xField="month" yField="revenue" smooth />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].smooth).toBe(true);
  });

  it("generates multi-line option with series prop", () => {
    render(
      <LineChart
        data={mockData}
        xField="month"
        yField="revenue"
        series={["revenue", "cost"]}
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series).toHaveLength(2);
    expect(option.series[0]).toEqual({
      name: "revenue",
      type: "line",
      smooth: false,
      data: [100, 200, 150, 300],
    });
    expect(option.series[1]).toEqual({
      name: "cost",
      type: "line",
      smooth: false,
      data: [60, 80, 70, 120],
    });
  });

  it("includes legend for multi-line charts", () => {
    render(
      <LineChart
        data={mockData}
        xField="month"
        yField="revenue"
        series={["revenue", "cost"]}
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.legend).toEqual({ data: ["revenue", "cost"] });
  });

  it("does not include legend for single-line charts", () => {
    render(<LineChart data={mockData} xField="month" yField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.legend).toBeUndefined();
  });

  it("includes title when provided", () => {
    render(
      <LineChart
        data={mockData}
        xField="month"
        yField="revenue"
        title="Monthly Revenue"
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.title).toEqual({ text: "Monthly Revenue" });
  });

  it("omits title when not provided", () => {
    render(<LineChart data={mockData} xField="month" yField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.title).toBeUndefined();
  });

  it("enables axis tooltip", () => {
    render(<LineChart data={mockData} xField="month" yField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.tooltip).toEqual({ trigger: "axis" });
  });

  it("handles empty data array", () => {
    render(<LineChart data={[]} xField="month" yField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis).toEqual({ type: "category", data: [] });
    expect(option.series).toEqual([
      { type: "line", smooth: false, data: [] },
    ]);
  });

  it("converts non-numeric yField values to 0", () => {
    const data = [
      { name: "A", val: "not a number" },
      { name: "B", val: null },
      { name: "C", val: undefined },
    ];
    render(
      <LineChart
        data={data as Record<string, unknown>[]}
        xField="name"
        yField="val"
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data).toEqual([0, 0, 0]);
  });

  it("converts xField values to strings", () => {
    const data = [
      { id: 1, count: 10 },
      { id: 2, count: 20 },
    ];
    render(<LineChart data={data} xField="id" yField="count" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis.data).toEqual(["1", "2"]);
  });

  it("handles missing fields gracefully", () => {
    const data = [{ a: 1 }, { a: 2 }];
    render(<LineChart data={data} xField="missing" yField="also_missing" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis.data).toEqual(["", ""]);
    expect(option.series[0].data).toEqual([0, 0]);
  });

  it("applies smooth to all multi-line series", () => {
    render(
      <LineChart
        data={mockData}
        xField="month"
        yField="revenue"
        series={["revenue", "cost"]}
        smooth
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].smooth).toBe(true);
    expect(option.series[1].smooth).toBe(true);
  });

  it("passes className to EChart", () => {
    render(
      <LineChart
        data={mockData}
        xField="month"
        yField="revenue"
        className="custom-class"
      />,
    );
    expect(screen.getByTestId("echart-container")).toHaveClass("custom-class");
  });

  it("passes style to EChart", () => {
    render(
      <LineChart
        data={mockData}
        xField="month"
        yField="revenue"
        style={{ height: 400 }}
      />,
    );
    const container = screen.getByTestId("echart-container");
    expect(container.style.height).toBe("400px");
  });

  it("passes loading to EChart", () => {
    render(
      <LineChart
        data={mockData}
        xField="month"
        yField="revenue"
        loading={true}
      />,
    );
    expect(mocks.chartInstance.showLoading).toHaveBeenCalled();
  });

  it("passes renderer to EChart", () => {
    render(
      <LineChart
        data={mockData}
        xField="month"
        yField="revenue"
        renderer="svg"
      />,
    );
    expect(mocks.init).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      undefined,
      { renderer: "svg" },
    );
  });

  it("updates chart when data changes", () => {
    const { rerender } = render(
      <LineChart data={mockData} xField="month" yField="revenue" />,
    );
    mocks.chartInstance.setOption.mockClear();

    const newData = [
      { month: "May", revenue: 500 },
      { month: "Jun", revenue: 600 },
    ];
    rerender(<LineChart data={newData} xField="month" yField="revenue" />);

    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis.data).toEqual(["May", "Jun"]);
    expect(option.series[0].data).toEqual([500, 600]);
  });

  it("handles multi-line with missing series field values", () => {
    const data = [
      { month: "Jan", revenue: 100 },
      { month: "Feb", revenue: 200 },
    ];
    render(
      <LineChart
        data={data}
        xField="month"
        yField="revenue"
        series={["revenue", "nonexistent"]}
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[1].data).toEqual([0, 0]);
  });
});
