import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  isReady: true,
  filters: [] as import("@/hooks/useFilters").FilterConfig[],
  filterValues: {} as Record<string, import("@/hooks/useFilters").FilterValue>,
}));

vi.mock("@/hooks/useDuckDB", () => ({
  useDuckDB: () => ({
    query: mocks.query,
    loadTable: vi.fn(),
    loading: false,
    error: null,
    isReady: mocks.isReady,
    initError: null,
  }),
}));

vi.mock("@/hooks/useFilters", () => ({
  useFiltersOptional: () => ({
    filters: mocks.filters,
    values: mocks.filterValues,
    addFilter: () => "",
    removeFilter: () => {},
    updateFilterValue: () => {},
    clearAllValues: () => {},
    removeAllFilters: () => {},
  }),
}));

// Mock chart components to simple divs for testing
vi.mock("@/components/charts/BarChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-bar" data-x={props.xField} data-y={props.yField} data-horizontal={String(props.horizontal)} />
  ),
}));

vi.mock("@/components/charts/LineChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-line" data-x={props.xField} data-y={props.yField} data-smooth={String(props.smooth)} />
  ),
}));

vi.mock("@/components/charts/AreaChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-area" data-x={props.xField} data-y={props.yField} data-smooth={String(props.smooth)} />
  ),
}));

vi.mock("@/components/charts/ScatterChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-scatter" data-x={props.xField} data-y={props.yField} data-size={props.sizeField} data-color={props.colorField} />
  ),
}));

vi.mock("@/components/charts/PieChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-pie" data-name={props.nameField} data-value={props.valueField} data-donut={String(props.donut)} />
  ),
}));

vi.mock("@/components/charts/RadarChart", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-radar" data-indicators={JSON.stringify(props.indicators)} />
  ),
}));

vi.mock("@/components/charts/KPICard", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-kpi" data-title={props.title} data-value={props.value} data-unit={props.unit} />
  ),
}));

vi.mock("@/components/charts/DataTable", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-table" data-columns={JSON.stringify(props.columns)} />
  ),
}));

// Mock geo map components
vi.mock("@/components/geo/ScatterplotMap", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-map-scatterplot" data-lat={props.latField} data-lon={props.lonField} data-color={props.colorField} data-size={props.sizeField} />
  ),
}));

vi.mock("@/components/geo/HexagonMap", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-map-hexagon" data-lat={props.latField} data-lon={props.lonField} data-weight={props.weightField} data-extruded={String(props.extruded)} />
  ),
}));

vi.mock("@/components/geo/HeatmapMap", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-map-heatmap" data-lat={props.latField} data-lon={props.lonField} data-weight={props.weightField} />
  ),
}));

vi.mock("@/components/geo/ArcMap", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-map-arc" data-origin-lat={props.originLat} data-origin-lon={props.originLon} data-dest-lat={props.destLat} data-dest-lon={props.destLon} data-color={props.colorField} />
  ),
}));

vi.mock("@/components/geo/GeoJsonMap", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="chart-map-geojson" data-fill={props.fillField} data-stroke={props.strokeField} />
  ),
}));

import CardRenderer from "./CardRenderer";
import type { DashboardCardConfig } from "./DashboardGrid";

// --- Helpers ---

const makeConfig = (
  overrides: Partial<DashboardCardConfig> = {},
): DashboardCardConfig => ({
  id: "card-1",
  type: "bar",
  title: "Test Card",
  query: "SELECT region, revenue FROM sales",
  columnMappings: { xField: "region", yField: "revenue" },
  ...overrides,
});

const queryResultFixture = {
  columns: ["region", "revenue"],
  rows: [
    ["North", 100],
    ["South", 200],
    ["East", 150],
  ],
  duration: 5,
};

describe("CardRenderer", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.isReady = true;
    mocks.filters = [];
    mocks.filterValues = {};
  });

  afterEach(() => {
    cleanup();
  });

  // --- Text card ---

  it("renders text content without executing a query", () => {
    const config = makeConfig({
      type: "text",
      query: "",
      columnMappings: { content: "Hello world" },
    });
    render(<CardRenderer config={config} />);
    expect(screen.getByTestId("card-renderer-text")).toHaveTextContent("Hello world");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("renders fallback for text card with no content", () => {
    const config = makeConfig({
      type: "text",
      query: "",
      columnMappings: {},
    });
    render(<CardRenderer config={config} />);
    expect(screen.getByTestId("card-renderer-text")).toHaveTextContent("No content");
  });

  // --- Loading state ---

  it("shows loading state while query is executing", async () => {
    mocks.query.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CardRenderer config={makeConfig()} />);
    expect(screen.getByTestId("card-renderer-loading")).toBeInTheDocument();
  });

  // --- Error state ---

  it("shows error state when query fails", async () => {
    mocks.query.mockRejectedValue(new Error("Syntax error"));
    render(<CardRenderer config={makeConfig()} />);
    await waitFor(() => {
      expect(screen.getByTestId("card-renderer-error")).toHaveTextContent("Syntax error");
    });
  });

  it("shows error string for non-Error throws", async () => {
    mocks.query.mockRejectedValue("Something went wrong");
    render(<CardRenderer config={makeConfig()} />);
    await waitFor(() => {
      expect(screen.getByTestId("card-renderer-error")).toHaveTextContent("Something went wrong");
    });
  });

  // --- Empty state ---

  it("shows empty state when query returns no rows", async () => {
    mocks.query.mockResolvedValue({ columns: ["region"], rows: [], duration: 1 });
    render(<CardRenderer config={makeConfig()} />);
    await waitFor(() => {
      expect(screen.getByTestId("card-renderer-empty")).toHaveTextContent("No data");
    });
  });

  // --- DuckDB not ready ---

  it("does not execute query when DuckDB is not ready", () => {
    mocks.isReady = false;
    render(<CardRenderer config={makeConfig()} />);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  // --- Bar chart ---

  it("renders a bar chart with query results", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    render(<CardRenderer config={makeConfig()} />);
    await waitFor(() => {
      const chart = screen.getByTestId("chart-bar");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-x", "region");
      expect(chart).toHaveAttribute("data-y", "revenue");
    });
  });

  it("passes horizontal flag to bar chart", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      columnMappings: { xField: "region", yField: "revenue", horizontal: "true" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-bar")).toHaveAttribute("data-horizontal", "true");
    });
  });

  // --- Line chart ---

  it("renders a line chart", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "line",
      columnMappings: { xField: "region", yField: "revenue" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-line")).toHaveAttribute("data-x", "region");
    });
  });

  it("passes smooth flag to line chart", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "line",
      columnMappings: { xField: "region", yField: "revenue", smooth: "true" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-line")).toHaveAttribute("data-smooth", "true");
    });
  });

  // --- Area chart ---

  it("renders an area chart", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "area",
      columnMappings: { xField: "region", yField: "revenue" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-area")).toHaveAttribute("data-x", "region");
    });
  });

  // --- Scatter chart ---

  it("renders a scatter chart", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "scatter",
      columnMappings: { xField: "region", yField: "revenue" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-scatter")).toHaveAttribute("data-x", "region");
    });
  });

  it("passes optional sizeField and colorField to scatter", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "scatter",
      columnMappings: {
        xField: "region",
        yField: "revenue",
        sizeField: "size",
        colorField: "color",
      },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      const chart = screen.getByTestId("chart-scatter");
      expect(chart).toHaveAttribute("data-size", "size");
      expect(chart).toHaveAttribute("data-color", "color");
    });
  });

  // --- Pie chart ---

  it("renders a pie chart", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "pie",
      columnMappings: { nameField: "region", valueField: "revenue" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      const chart = screen.getByTestId("chart-pie");
      expect(chart).toHaveAttribute("data-name", "region");
      expect(chart).toHaveAttribute("data-value", "revenue");
    });
  });

  it("passes donut flag to pie chart", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "pie",
      columnMappings: { nameField: "region", valueField: "revenue", donut: "true" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-pie")).toHaveAttribute("data-donut", "true");
    });
  });

  // --- Radar chart ---

  it("renders a radar chart from multi-column data", async () => {
    const radarResult = {
      columns: ["metric", "sales", "profit"],
      rows: [
        ["Q1", 100, 50],
        ["Q2", 200, 80],
        ["Q3", 150, 70],
      ],
      duration: 3,
    };
    mocks.query.mockResolvedValue(radarResult);
    const config = makeConfig({
      type: "radar",
      columnMappings: {},
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-radar")).toBeInTheDocument();
    });
  });

  it("does not render radar chart with fewer than 2 columns", async () => {
    mocks.query.mockResolvedValue({
      columns: ["metric"],
      rows: [["Q1"]],
      duration: 1,
    });
    const config = makeConfig({ type: "radar", columnMappings: {} });
    const { container } = render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.queryByTestId("chart-radar")).not.toBeInTheDocument();
      // Should render nothing (null return)
      expect(container.firstChild).toBeNull();
    });
  });

  // --- KPI card ---

  it("renders a KPI card", async () => {
    mocks.query.mockResolvedValue({
      columns: ["total"],
      rows: [[42000]],
      duration: 1,
    });
    const config = makeConfig({
      type: "kpi",
      title: "Total Revenue",
      columnMappings: { valueField: "total", unit: "$" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      const card = screen.getByTestId("chart-kpi");
      expect(card).toHaveAttribute("data-value", "42000");
      expect(card).toHaveAttribute("data-unit", "$");
    });
  });

  it("renders dash for KPI when value is null", async () => {
    mocks.query.mockResolvedValue({
      columns: ["total"],
      rows: [[null]],
      duration: 1,
    });
    const config = makeConfig({
      type: "kpi",
      columnMappings: { valueField: "total" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-kpi")).toHaveAttribute("data-value", "-");
    });
  });

  // --- Table ---

  it("renders a data table", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({ type: "table", columnMappings: {} });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-table")).toBeInTheDocument();
    });
  });

  // --- Missing column mappings ---

  it("returns null for bar chart with missing xField", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({ columnMappings: { yField: "revenue" } });
    const { container } = render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.queryByTestId("chart-bar")).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });
  });

  it("returns null for pie chart with missing nameField", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "pie",
      columnMappings: { valueField: "revenue" },
    });
    const { container } = render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("returns null for kpi with missing valueField", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({ type: "kpi", columnMappings: {} });
    const { container } = render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  // --- Query execution ---

  it("executes the SQL query from config", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    render(<CardRenderer config={makeConfig()} />);
    await waitFor(() => {
      expect(mocks.query).toHaveBeenCalledWith("SELECT region, revenue FROM sales");
    });
  });

  it("does not execute query for empty query string", () => {
    const config = makeConfig({ query: "   " });
    render(<CardRenderer config={config} />);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  // --- Filter integration ---

  it("executes filtered query when a search filter is active", async () => {
    mocks.filters = [
      { id: "f1", type: "search", label: "Name", column: "region" },
    ];
    mocks.filterValues = { f1: "North" };
    mocks.query.mockResolvedValue(queryResultFixture);

    render(<CardRenderer config={makeConfig()} />);

    await waitFor(() => {
      expect(mocks.query).toHaveBeenCalledWith(
        `SELECT * FROM (SELECT region, revenue FROM sales) AS _filtered WHERE CAST("region" AS VARCHAR) ILIKE '%North%'`,
      );
    });
  });

  it("executes filtered query when a dropdown filter is active", async () => {
    mocks.filters = [
      { id: "f1", type: "dropdown", label: "Region", column: "region" },
    ];
    mocks.filterValues = { f1: "South" };
    mocks.query.mockResolvedValue(queryResultFixture);

    render(<CardRenderer config={makeConfig()} />);

    await waitFor(() => {
      expect(mocks.query).toHaveBeenCalledWith(
        `SELECT * FROM (SELECT region, revenue FROM sales) AS _filtered WHERE "region" = 'South'`,
      );
    });
  });

  it("executes filtered query with multiple active filters", async () => {
    mocks.filters = [
      { id: "f1", type: "search", label: "Name", column: "region" },
      { id: "f2", type: "dropdown", label: "Status", column: "status" },
    ];
    mocks.filterValues = { f1: "test", f2: "active" };
    mocks.query.mockResolvedValue(queryResultFixture);

    render(<CardRenderer config={makeConfig()} />);

    await waitFor(() => {
      const calledWith = mocks.query.mock.calls[0][0] as string;
      expect(calledWith).toContain("ILIKE '%test%'");
      expect(calledWith).toContain(`"status" = 'active'`);
      expect(calledWith).toContain(" AND ");
    });
  });

  it("executes unmodified query when filters have no active values", async () => {
    mocks.filters = [
      { id: "f1", type: "search", label: "Name", column: "region" },
    ];
    mocks.filterValues = { f1: "" };
    mocks.query.mockResolvedValue(queryResultFixture);

    render(<CardRenderer config={makeConfig()} />);

    await waitFor(() => {
      expect(mocks.query).toHaveBeenCalledWith("SELECT region, revenue FROM sales");
    });
  });

  it("does not apply filters to text cards", () => {
    mocks.filters = [
      { id: "f1", type: "search", label: "Name", column: "region" },
    ];
    mocks.filterValues = { f1: "test" };

    const config = makeConfig({
      type: "text",
      query: "",
      columnMappings: { content: "Hello" },
    });
    render(<CardRenderer config={config} />);

    expect(screen.getByTestId("card-renderer-text")).toBeInTheDocument();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  // --- Map: Scatterplot ---

  it("renders a scatterplot map with lat/lon fields", async () => {
    const geoResult = {
      columns: ["lat", "lon", "value"],
      rows: [[40.7, -74.0, 100], [34.0, -118.2, 200]],
      duration: 3,
    };
    mocks.query.mockResolvedValue(geoResult);
    const config = makeConfig({
      type: "map-scatterplot",
      query: "SELECT lat, lon, value FROM geo",
      columnMappings: { latField: "lat", lonField: "lon" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      const chart = screen.getByTestId("chart-map-scatterplot");
      expect(chart).toHaveAttribute("data-lat", "lat");
      expect(chart).toHaveAttribute("data-lon", "lon");
    });
  });

  it("passes optional colorField and sizeField to scatterplot map", async () => {
    const geoResult = {
      columns: ["lat", "lon", "cat", "pop"],
      rows: [[40.7, -74.0, "A", 100]],
      duration: 2,
    };
    mocks.query.mockResolvedValue(geoResult);
    const config = makeConfig({
      type: "map-scatterplot",
      query: "SELECT lat, lon, cat, pop FROM geo",
      columnMappings: { latField: "lat", lonField: "lon", colorField: "cat", sizeField: "pop" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      const chart = screen.getByTestId("chart-map-scatterplot");
      expect(chart).toHaveAttribute("data-color", "cat");
      expect(chart).toHaveAttribute("data-size", "pop");
    });
  });

  it("returns null for map-scatterplot with missing latField", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "map-scatterplot",
      columnMappings: { lonField: "lon" },
    });
    const { container } = render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  // --- Map: Hexagon ---

  it("renders a hexagon map", async () => {
    const geoResult = {
      columns: ["lat", "lon"],
      rows: [[40.7, -74.0], [34.0, -118.2]],
      duration: 2,
    };
    mocks.query.mockResolvedValue(geoResult);
    const config = makeConfig({
      type: "map-hexagon",
      query: "SELECT lat, lon FROM geo",
      columnMappings: { latField: "lat", lonField: "lon" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      const chart = screen.getByTestId("chart-map-hexagon");
      expect(chart).toHaveAttribute("data-lat", "lat");
      expect(chart).toHaveAttribute("data-lon", "lon");
    });
  });

  it("passes extruded flag to hexagon map", async () => {
    const geoResult = {
      columns: ["lat", "lon"],
      rows: [[40.7, -74.0]],
      duration: 1,
    };
    mocks.query.mockResolvedValue(geoResult);
    const config = makeConfig({
      type: "map-hexagon",
      query: "SELECT lat, lon FROM geo",
      columnMappings: { latField: "lat", lonField: "lon", extruded: "true" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(screen.getByTestId("chart-map-hexagon")).toHaveAttribute("data-extruded", "true");
    });
  });

  // --- Map: Heatmap ---

  it("renders a heatmap map", async () => {
    const geoResult = {
      columns: ["lat", "lon", "weight"],
      rows: [[40.7, -74.0, 50], [34.0, -118.2, 80]],
      duration: 2,
    };
    mocks.query.mockResolvedValue(geoResult);
    const config = makeConfig({
      type: "map-heatmap",
      query: "SELECT lat, lon, weight FROM geo",
      columnMappings: { latField: "lat", lonField: "lon", weightField: "weight" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      const chart = screen.getByTestId("chart-map-heatmap");
      expect(chart).toHaveAttribute("data-lat", "lat");
      expect(chart).toHaveAttribute("data-lon", "lon");
      expect(chart).toHaveAttribute("data-weight", "weight");
    });
  });

  // --- Map: Arc ---

  it("renders an arc map with origin/destination fields", async () => {
    const arcResult = {
      columns: ["olat", "olon", "dlat", "dlon"],
      rows: [[40.7, -74.0, 34.0, -118.2]],
      duration: 2,
    };
    mocks.query.mockResolvedValue(arcResult);
    const config = makeConfig({
      type: "map-arc",
      query: "SELECT olat, olon, dlat, dlon FROM arcs",
      columnMappings: { originLat: "olat", originLon: "olon", destLat: "dlat", destLon: "dlon" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      const chart = screen.getByTestId("chart-map-arc");
      expect(chart).toHaveAttribute("data-origin-lat", "olat");
      expect(chart).toHaveAttribute("data-origin-lon", "olon");
      expect(chart).toHaveAttribute("data-dest-lat", "dlat");
      expect(chart).toHaveAttribute("data-dest-lon", "dlon");
    });
  });

  it("returns null for map-arc with missing destination fields", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "map-arc",
      columnMappings: { originLat: "olat", originLon: "olon" },
    });
    const { container } = render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  // --- Map: GeoJSON ---

  it("renders a geojson map from query results", async () => {
    const geojsonResult = {
      columns: ["geom", "name", "value"],
      rows: [
        [JSON.stringify({ type: "Point", coordinates: [-74, 40.7] }), "NYC", 100],
        [JSON.stringify({ type: "Point", coordinates: [-118.2, 34] }), "LA", 200],
      ],
      duration: 3,
    };
    mocks.query.mockResolvedValue(geojsonResult);
    const config = makeConfig({
      type: "map-geojson",
      query: "SELECT geom, name, value FROM regions",
      columnMappings: { geojsonColumn: "geom", fillField: "name" },
    });
    render(<CardRenderer config={config} />);
    await waitFor(() => {
      const chart = screen.getByTestId("chart-map-geojson");
      expect(chart).toHaveAttribute("data-fill", "name");
    });
  });

  it("returns null for map-geojson with missing geojsonColumn", async () => {
    mocks.query.mockResolvedValue(queryResultFixture);
    const config = makeConfig({
      type: "map-geojson",
      columnMappings: {},
    });
    const { container } = render(<CardRenderer config={config} />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
