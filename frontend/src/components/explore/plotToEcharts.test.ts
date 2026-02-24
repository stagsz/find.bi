import { describe, it, expect } from "vitest";
import {
  convertPlotSpec,
  findPrimaryMark,
  extractMappings,
  generateSqlFromData,
  escapeSql,
  MARK_TYPE_MAP,
  DECORATIVE_MARKS,
} from "./plotToEcharts";
import type { PlotSpec, MarkDef } from "./PlotRenderer";

describe("escapeSql", () => {
  it("returns NULL for null and undefined", () => {
    expect(escapeSql(null)).toBe("NULL");
    expect(escapeSql(undefined)).toBe("NULL");
  });

  it("returns number as string", () => {
    expect(escapeSql(42)).toBe("42");
    expect(escapeSql(3.14)).toBe("3.14");
    expect(escapeSql(0)).toBe("0");
    expect(escapeSql(-7)).toBe("-7");
  });

  it("returns NULL for non-finite numbers", () => {
    expect(escapeSql(Infinity)).toBe("NULL");
    expect(escapeSql(-Infinity)).toBe("NULL");
    expect(escapeSql(NaN)).toBe("NULL");
  });

  it("returns boolean as TRUE/FALSE", () => {
    expect(escapeSql(true)).toBe("TRUE");
    expect(escapeSql(false)).toBe("FALSE");
  });

  it("wraps strings in single quotes", () => {
    expect(escapeSql("hello")).toBe("'hello'");
  });

  it("escapes single quotes by doubling", () => {
    expect(escapeSql("it's")).toBe("'it''s'");
    expect(escapeSql("a'b'c")).toBe("'a''b''c'");
  });
});

describe("generateSqlFromData", () => {
  it("returns empty string for empty array", () => {
    expect(generateSqlFromData([])).toBe("");
  });

  it("returns empty string for null/undefined", () => {
    expect(generateSqlFromData(null as unknown as Record<string, unknown>[])).toBe("");
    expect(generateSqlFromData(undefined as unknown as Record<string, unknown>[])).toBe("");
  });

  it("returns empty string for rows with no columns", () => {
    expect(generateSqlFromData([{}])).toBe("");
  });

  it("generates valid VALUES SQL for simple data", () => {
    const data = [
      { region: "North", revenue: 100 },
      { region: "South", revenue: 200 },
    ];
    const sql = generateSqlFromData(data);
    expect(sql).toBe(
      `SELECT * FROM (VALUES ('North', 100), ('South', 200)) AS t("region", "revenue")`,
    );
  });

  it("handles null values in data", () => {
    const data = [{ name: "A", value: null }];
    const sql = generateSqlFromData(data);
    expect(sql).toContain("NULL");
  });

  it("handles mixed types", () => {
    const data = [{ label: "test", count: 5, active: true }];
    const sql = generateSqlFromData(data);
    expect(sql).toBe(
      `SELECT * FROM (VALUES ('test', 5, TRUE)) AS t("label", "count", "active")`,
    );
  });
});

describe("findPrimaryMark", () => {
  it("returns first non-decorative mark", () => {
    const spec: PlotSpec = {
      marks: [
        { type: "frame" },
        { type: "barY", data: [{ x: 1 }], options: { x: "x", y: "y" } },
      ],
    };
    const mark = findPrimaryMark(spec);
    expect(mark).not.toBeNull();
    expect(mark!.type).toBe("barY");
  });

  it("returns null when all marks are decorative", () => {
    const spec: PlotSpec = {
      marks: [{ type: "frame" }, { type: "ruleY" }, { type: "tip" }],
    };
    expect(findPrimaryMark(spec)).toBeNull();
  });

  it("returns null for empty marks array", () => {
    const spec: PlotSpec = { marks: [] };
    expect(findPrimaryMark(spec)).toBeNull();
  });

  it("skips unknown mark types not in MARK_TYPE_MAP", () => {
    const spec: PlotSpec = {
      marks: [
        { type: "unknownMark", data: [{ x: 1 }] },
        { type: "dot", data: [{ x: 1, y: 2 }], options: { x: "x", y: "y" } },
      ],
    };
    const mark = findPrimaryMark(spec);
    expect(mark!.type).toBe("dot");
  });

  it("all decorative types are properly classified", () => {
    for (const type of DECORATIVE_MARKS) {
      const spec: PlotSpec = { marks: [{ type }] };
      expect(findPrimaryMark(spec)).toBeNull();
    }
  });
});

describe("extractMappings", () => {
  it("extracts bar chart mappings", () => {
    const mark: MarkDef = {
      type: "barY",
      options: { x: "region", y: "revenue" },
    };
    const mappings = extractMappings(mark, "bar", false);
    expect(mappings).toEqual({ xField: "region", yField: "revenue" });
  });

  it("sets horizontal for barX", () => {
    const mark: MarkDef = {
      type: "barX",
      options: { x: "revenue", y: "region" },
    };
    const mappings = extractMappings(mark, "bar", true);
    expect(mappings).toEqual({
      xField: "revenue",
      yField: "region",
      horizontal: "true",
    });
  });

  it("extracts line chart mappings", () => {
    const mark: MarkDef = {
      type: "line",
      options: { x: "date", y: "price" },
    };
    const mappings = extractMappings(mark, "line", false);
    expect(mappings).toEqual({ xField: "date", yField: "price" });
  });

  it("extracts area chart mappings", () => {
    const mark: MarkDef = {
      type: "areaY",
      options: { x: "month", y: "sales" },
    };
    const mappings = extractMappings(mark, "area", false);
    expect(mappings).toEqual({ xField: "month", yField: "sales" });
  });

  it("extracts scatter chart mappings with size and color", () => {
    const mark: MarkDef = {
      type: "dot",
      options: { x: "weight", y: "height", r: "age", fill: "category" },
    };
    const mappings = extractMappings(mark, "scatter", false);
    expect(mappings).toEqual({
      xField: "weight",
      yField: "height",
      sizeField: "age",
      colorField: "category",
    });
  });

  it("ignores non-string fill for scatter (e.g. color literal)", () => {
    const mark: MarkDef = {
      type: "dot",
      options: { x: "x", y: "y", fill: { scheme: "blues" } },
    };
    const mappings = extractMappings(mark, "scatter", false);
    expect(mappings.colorField).toBeUndefined();
  });

  it("returns empty mappings for table type", () => {
    const mark: MarkDef = {
      type: "cell",
      options: { x: "col", y: "row" },
    };
    const mappings = extractMappings(mark, "table", false);
    expect(mappings).toEqual({});
  });

  it("handles missing options", () => {
    const mark: MarkDef = { type: "barY" };
    const mappings = extractMappings(mark, "bar", false);
    expect(mappings).toEqual({});
  });
});

describe("MARK_TYPE_MAP", () => {
  it("maps barY to bar chart", () => {
    expect(MARK_TYPE_MAP.barY).toEqual({ chartType: "bar" });
  });

  it("maps barX to horizontal bar chart", () => {
    expect(MARK_TYPE_MAP.barX).toEqual({ chartType: "bar", horizontal: true });
  });

  it("maps dot/dotX/dotY to scatter", () => {
    expect(MARK_TYPE_MAP.dot.chartType).toBe("scatter");
    expect(MARK_TYPE_MAP.dotX.chartType).toBe("scatter");
    expect(MARK_TYPE_MAP.dotY.chartType).toBe("scatter");
  });

  it("maps line variants to line chart", () => {
    expect(MARK_TYPE_MAP.line.chartType).toBe("line");
    expect(MARK_TYPE_MAP.lineX.chartType).toBe("line");
    expect(MARK_TYPE_MAP.lineY.chartType).toBe("line");
  });

  it("maps area variants to area chart", () => {
    expect(MARK_TYPE_MAP.area.chartType).toBe("area");
    expect(MARK_TYPE_MAP.areaX.chartType).toBe("area");
    expect(MARK_TYPE_MAP.areaY.chartType).toBe("area");
  });

  it("maps cell variants to table", () => {
    expect(MARK_TYPE_MAP.cell.chartType).toBe("table");
    expect(MARK_TYPE_MAP.cellX.chartType).toBe("table");
    expect(MARK_TYPE_MAP.cellY.chartType).toBe("table");
  });

  it("maps rect to bar chart", () => {
    expect(MARK_TYPE_MAP.rect.chartType).toBe("bar");
    expect(MARK_TYPE_MAP.rectX).toEqual({ chartType: "bar", horizontal: true });
    expect(MARK_TYPE_MAP.rectY.chartType).toBe("bar");
  });
});

describe("convertPlotSpec", () => {
  const sampleData = [
    { region: "North", revenue: 100 },
    { region: "South", revenue: 200 },
    { region: "East", revenue: 150 },
  ];

  it("converts a barY spec to bar card config", () => {
    const spec: PlotSpec = {
      marks: [
        { type: "barY", data: sampleData, options: { x: "region", y: "revenue" } },
      ],
    };
    const result = convertPlotSpec(spec, "Revenue by Region");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("bar");
    expect(result!.title).toBe("Revenue by Region");
    expect(result!.columnMappings).toEqual({
      xField: "region",
      yField: "revenue",
    });
    expect(result!.query).toContain("VALUES");
    expect(result!.query).toContain("'North'");
  });

  it("converts a dot spec to scatter card config", () => {
    const spec: PlotSpec = {
      marks: [
        { type: "dot", data: [{ x: 1, y: 2 }, { x: 3, y: 4 }], options: { x: "x", y: "y" } },
      ],
    };
    const result = convertPlotSpec(spec);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("scatter");
    expect(result!.title).toBe("Promoted Chart");
    expect(result!.columnMappings).toEqual({ xField: "x", yField: "y" });
  });

  it("converts a line spec to line card config", () => {
    const spec: PlotSpec = {
      marks: [
        { type: "line", data: [{ date: "Jan", value: 10 }], options: { x: "date", y: "value" } },
      ],
    };
    const result = convertPlotSpec(spec);
    expect(result!.type).toBe("line");
  });

  it("converts an areaY spec to area card config", () => {
    const spec: PlotSpec = {
      marks: [
        { type: "areaY", data: [{ month: "Jan", sales: 50 }], options: { x: "month", y: "sales" } },
      ],
    };
    const result = convertPlotSpec(spec);
    expect(result!.type).toBe("area");
  });

  it("converts a barX spec to horizontal bar card config", () => {
    const spec: PlotSpec = {
      marks: [
        { type: "barX", data: sampleData, options: { x: "revenue", y: "region" } },
      ],
    };
    const result = convertPlotSpec(spec);
    expect(result!.type).toBe("bar");
    expect(result!.columnMappings.horizontal).toBe("true");
  });

  it("skips decorative marks to find primary", () => {
    const spec: PlotSpec = {
      marks: [
        { type: "frame" },
        { type: "ruleY", data: [], options: {} },
        { type: "barY", data: sampleData, options: { x: "region", y: "revenue" } },
      ],
    };
    const result = convertPlotSpec(spec);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("bar");
  });

  it("returns null for specs with only decorative marks", () => {
    const spec: PlotSpec = {
      marks: [{ type: "frame" }, { type: "tip" }],
    };
    expect(convertPlotSpec(spec)).toBeNull();
  });

  it("returns null for empty marks", () => {
    const spec: PlotSpec = { marks: [] };
    expect(convertPlotSpec(spec)).toBeNull();
  });

  it("returns null for marks with no data (non-table)", () => {
    const spec: PlotSpec = {
      marks: [{ type: "barY", data: [], options: { x: "x", y: "y" } }],
    };
    expect(convertPlotSpec(spec)).toBeNull();
  });

  it("uses default title when not provided", () => {
    const spec: PlotSpec = {
      marks: [
        { type: "dot", data: [{ x: 1, y: 2 }], options: { x: "x", y: "y" } },
      ],
    };
    const result = convertPlotSpec(spec);
    expect(result!.title).toBe("Promoted Chart");
  });

  it("generates valid SQL in the result", () => {
    const spec: PlotSpec = {
      marks: [
        {
          type: "barY",
          data: [
            { name: "A", value: 10 },
            { name: "B", value: 20 },
          ],
          options: { x: "name", y: "value" },
        },
      ],
    };
    const result = convertPlotSpec(spec);
    expect(result!.query).toBe(
      `SELECT * FROM (VALUES ('A', 10), ('B', 20)) AS t("name", "value")`,
    );
  });
});
