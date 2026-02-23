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

import BarChart from "./BarChart";

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
  { region: "North", revenue: 100 },
  { region: "South", revenue: 200 },
  { region: "East", revenue: 150 },
  { region: "West", revenue: 300 },
];

describe("BarChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an echart container", () => {
    render(<BarChart data={mockData} xField="region" yField="revenue" />);
    expect(screen.getByTestId("echart-container")).toBeInTheDocument();
  });

  it("generates vertical bar option by default", () => {
    render(<BarChart data={mockData} xField="region" yField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis).toEqual({
      type: "category",
      data: ["North", "South", "East", "West"],
    });
    expect(option.yAxis).toEqual({ type: "value" });
    expect(option.series).toEqual([
      { type: "bar", data: [100, 200, 150, 300] },
    ]);
  });

  it("generates horizontal bar option when horizontal=true", () => {
    render(
      <BarChart
        data={mockData}
        xField="region"
        yField="revenue"
        horizontal
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis).toEqual({ type: "value" });
    expect(option.yAxis).toEqual({
      type: "category",
      data: ["North", "South", "East", "West"],
    });
    expect(option.series).toEqual([
      { type: "bar", data: [100, 200, 150, 300] },
    ]);
  });

  it("includes title when provided", () => {
    render(
      <BarChart
        data={mockData}
        xField="region"
        yField="revenue"
        title="Revenue by Region"
      />,
    );
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.title).toEqual({ text: "Revenue by Region" });
  });

  it("omits title when not provided", () => {
    render(<BarChart data={mockData} xField="region" yField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.title).toBeUndefined();
  });

  it("enables axis tooltip", () => {
    render(<BarChart data={mockData} xField="region" yField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.tooltip).toEqual({ trigger: "axis" });
  });

  it("handles empty data array", () => {
    render(<BarChart data={[]} xField="region" yField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis).toEqual({ type: "category", data: [] });
    expect(option.series).toEqual([{ type: "bar", data: [] }]);
  });

  it("converts non-numeric yField values to 0", () => {
    const data = [
      { name: "A", val: "not a number" },
      { name: "B", val: null },
      { name: "C", val: undefined },
    ];
    render(
      <BarChart
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
    render(<BarChart data={data} xField="id" yField="count" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis.data).toEqual(["1", "2"]);
  });

  it("handles missing fields gracefully", () => {
    const data = [{ a: 1 }, { a: 2 }];
    render(<BarChart data={data} xField="missing" yField="also_missing" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis.data).toEqual(["", ""]);
    expect(option.series[0].data).toEqual([0, 0]);
  });

  it("passes className to EChart", () => {
    render(
      <BarChart
        data={mockData}
        xField="region"
        yField="revenue"
        className="custom-class"
      />,
    );
    expect(screen.getByTestId("echart-container")).toHaveClass("custom-class");
  });

  it("passes style to EChart", () => {
    render(
      <BarChart
        data={mockData}
        xField="region"
        yField="revenue"
        style={{ height: 400 }}
      />,
    );
    const container = screen.getByTestId("echart-container");
    expect(container.style.height).toBe("400px");
  });

  it("passes loading to EChart", () => {
    render(
      <BarChart
        data={mockData}
        xField="region"
        yField="revenue"
        loading={true}
      />,
    );
    expect(mocks.chartInstance.showLoading).toHaveBeenCalled();
  });

  it("passes renderer to EChart", () => {
    render(
      <BarChart
        data={mockData}
        xField="region"
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
      <BarChart data={mockData} xField="region" yField="revenue" />,
    );
    mocks.chartInstance.setOption.mockClear();

    const newData = [
      { region: "Alpha", revenue: 500 },
      { region: "Beta", revenue: 600 },
    ];
    rerender(<BarChart data={newData} xField="region" yField="revenue" />);

    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis.data).toEqual(["Alpha", "Beta"]);
    expect(option.series[0].data).toEqual([500, 600]);
  });

  it("updates chart when orientation changes", () => {
    const { rerender } = render(
      <BarChart data={mockData} xField="region" yField="revenue" />,
    );
    mocks.chartInstance.setOption.mockClear();

    rerender(
      <BarChart
        data={mockData}
        xField="region"
        yField="revenue"
        horizontal
      />,
    );

    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.xAxis).toEqual({ type: "value" });
    expect(option.yAxis).toEqual({
      type: "category",
      data: ["North", "South", "East", "West"],
    });
  });
});
