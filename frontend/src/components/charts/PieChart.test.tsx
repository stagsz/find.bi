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

import PieChart from "./PieChart";

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
  { category: "Electronics", revenue: 4200 },
  { category: "Clothing", revenue: 3100 },
  { category: "Food", revenue: 2800 },
  { category: "Books", revenue: 1500 },
];

describe("PieChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an echart container", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" />);
    expect(screen.getByTestId("echart-container")).toBeInTheDocument();
  });

  it("generates pie option with correct data mapping", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series).toHaveLength(1);
    expect(option.series[0].type).toBe("pie");
    expect(option.series[0].data).toEqual([
      { name: "Electronics", value: 4200 },
      { name: "Clothing", value: 3100 },
      { name: "Food", value: 2800 },
      { name: "Books", value: 1500 },
    ]);
  });

  it("renders as standard pie by default (not donut)", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].radius).toBe("70%");
  });

  it("renders as donut when donut prop is true", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" donut />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].radius).toEqual(["40%", "70%"]);
  });

  it("includes title when provided", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" title="Revenue by Category" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.title).toEqual({ text: "Revenue by Category" });
  });

  it("omits title when not provided", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.title).toBeUndefined();
  });

  it("uses item tooltip trigger with percentage format", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.tooltip.trigger).toBe("item");
    expect(option.tooltip.formatter).toBe("{b}: {c} ({d}%)");
  });

  it("includes legend with all category names", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.legend).toEqual({
      orient: "vertical",
      left: "left",
      data: ["Electronics", "Clothing", "Food", "Books"],
    });
  });

  it("includes percentage labels", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].label).toEqual({ formatter: "{b}: {d}%" });
  });

  it("includes emphasis shadow effect", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].emphasis.itemStyle.shadowBlur).toBe(10);
  });

  it("handles empty data array", () => {
    render(<PieChart data={[]} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data).toEqual([]);
    expect(option.legend.data).toEqual([]);
  });

  it("converts non-numeric values to 0", () => {
    const data = [
      { category: "A", revenue: "not a number" },
      { category: "B", revenue: null },
    ];
    render(<PieChart data={data as Record<string, unknown>[]} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data).toEqual([
      { name: "A", value: 0 },
      { name: "B", value: 0 },
    ]);
  });

  it("converts missing name fields to empty string", () => {
    const data = [
      { revenue: 100 },
      { category: undefined, revenue: 200 },
    ];
    render(<PieChart data={data as Record<string, unknown>[]} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].name).toBe("");
    expect(option.series[0].data[1].name).toBe("");
  });

  it("handles missing fields gracefully", () => {
    const data = [{ a: 1 }, { a: 2 }];
    render(<PieChart data={data} nameField="missing" valueField="also_missing" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data).toEqual([
      { name: "", value: 0 },
      { name: "", value: 0 },
    ]);
  });

  it("passes className to EChart", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" className="custom-class" />);
    expect(screen.getByTestId("echart-container")).toHaveClass("custom-class");
  });

  it("passes style to EChart", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" style={{ height: 400 }} />);
    const container = screen.getByTestId("echart-container");
    expect(container.style.height).toBe("400px");
  });

  it("passes loading to EChart", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" loading={true} />);
    expect(mocks.chartInstance.showLoading).toHaveBeenCalled();
  });

  it("passes renderer to EChart", () => {
    render(<PieChart data={mockData} nameField="category" valueField="revenue" renderer="svg" />);
    expect(mocks.init).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      undefined,
      { renderer: "svg" },
    );
  });

  it("updates chart when data changes", () => {
    const { rerender } = render(
      <PieChart data={mockData} nameField="category" valueField="revenue" />,
    );
    mocks.chartInstance.setOption.mockClear();

    const newData = [
      { category: "Toys", revenue: 500 },
      { category: "Games", revenue: 900 },
    ];
    rerender(<PieChart data={newData} nameField="category" valueField="revenue" />);

    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data).toEqual([
      { name: "Toys", value: 500 },
      { name: "Games", value: 900 },
    ]);
  });

  it("updates chart when donut prop toggles", () => {
    const { rerender } = render(
      <PieChart data={mockData} nameField="category" valueField="revenue" />,
    );
    mocks.chartInstance.setOption.mockClear();

    rerender(<PieChart data={mockData} nameField="category" valueField="revenue" donut />);

    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].radius).toEqual(["40%", "70%"]);
  });

  it("handles single data point", () => {
    const data = [{ category: "Only", revenue: 1000 }];
    render(<PieChart data={data} nameField="category" valueField="revenue" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data).toEqual([{ name: "Only", value: 1000 }]);
    expect(option.legend.data).toEqual(["Only"]);
  });

  it("handles numeric name fields by converting to string", () => {
    const data = [
      { id: 1, count: 10 },
      { id: 2, count: 20 },
    ];
    render(<PieChart data={data} nameField="id" valueField="count" />);
    const option = mocks.chartInstance.setOption.mock.calls[0][0];
    expect(option.series[0].data).toEqual([
      { name: "1", value: 10 },
      { name: "2", value: 20 },
    ]);
  });
});
