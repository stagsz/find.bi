import { describe, it, expect } from "vitest";
import { escapeSQL, buildFilteredQuery, isActiveValue } from "./filterQuery";
import type { FilterConfig, FilterValue } from "@/hooks/useFilters";

// --- escapeSQL ---

describe("escapeSQL", () => {
  it("returns unchanged string with no quotes", () => {
    expect(escapeSQL("hello")).toBe("hello");
  });

  it("doubles single quotes", () => {
    expect(escapeSQL("O'Reilly")).toBe("O''Reilly");
  });

  it("doubles multiple single quotes", () => {
    expect(escapeSQL("it's a 'test'")).toBe("it''s a ''test''");
  });

  it("handles empty string", () => {
    expect(escapeSQL("")).toBe("");
  });
});

// --- isActiveValue ---

describe("isActiveValue", () => {
  it("returns false for null", () => {
    expect(isActiveValue("dropdown", null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isActiveValue("dropdown", undefined as unknown as FilterValue)).toBe(false);
  });

  it("returns false for empty string (search)", () => {
    expect(isActiveValue("search", "")).toBe(false);
  });

  it("returns true for non-empty string (search)", () => {
    expect(isActiveValue("search", "hello")).toBe(true);
  });

  it("returns false for empty array (multiSelect)", () => {
    expect(isActiveValue("multiSelect", [])).toBe(false);
  });

  it("returns true for non-empty array (multiSelect)", () => {
    expect(isActiveValue("multiSelect", ["a", "b"])).toBe(true);
  });

  it("returns false for dateRange with empty start and end", () => {
    expect(isActiveValue("dateRange", { start: "", end: "" })).toBe(false);
  });

  it("returns true for dateRange with start only", () => {
    expect(isActiveValue("dateRange", { start: "2024-01-01", end: "" })).toBe(true);
  });

  it("returns true for dateRange with end only", () => {
    expect(isActiveValue("dateRange", { start: "", end: "2024-12-31" })).toBe(true);
  });

  it("returns true for dateRange with both start and end", () => {
    expect(isActiveValue("dateRange", { start: "2024-01-01", end: "2024-12-31" })).toBe(true);
  });

  it("returns true for non-empty dropdown value", () => {
    expect(isActiveValue("dropdown", "option1")).toBe(true);
  });
});

// --- buildFilteredQuery ---

describe("buildFilteredQuery", () => {
  const baseQuery = "SELECT * FROM sales";

  it("returns base query when no filters", () => {
    expect(buildFilteredQuery(baseQuery, [], {})).toBe(baseQuery);
  });

  it("returns base query when filters exist but have no active values", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "search", label: "Name", column: "name" },
    ];
    expect(buildFilteredQuery(baseQuery, filters, { f1: "" })).toBe(baseQuery);
  });

  it("returns base query when filter has no column", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "search", label: "Name", column: "" },
    ];
    expect(buildFilteredQuery(baseQuery, filters, { f1: "test" })).toBe(baseQuery);
  });

  // --- Search filter ---

  it("builds ILIKE condition for search filter", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "search", label: "Name", column: "name" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, { f1: "test" });
    expect(result).toBe(
      `SELECT * FROM (SELECT * FROM sales) AS _filtered WHERE CAST("name" AS VARCHAR) ILIKE '%test%'`,
    );
  });

  it("escapes single quotes in search value", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "search", label: "Name", column: "name" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, { f1: "O'Brien" });
    expect(result).toContain("O''Brien");
  });

  // --- Dropdown filter ---

  it("builds equality condition for dropdown filter", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "dropdown", label: "Region", column: "region" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, { f1: "North" });
    expect(result).toBe(
      `SELECT * FROM (SELECT * FROM sales) AS _filtered WHERE "region" = 'North'`,
    );
  });

  it("escapes column name with single quotes", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "dropdown", label: "Region", column: "user's region" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, { f1: "North" });
    expect(result).toContain(`"user''s region"`);
  });

  // --- MultiSelect filter ---

  it("builds IN condition for multiSelect filter", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "multiSelect", label: "Region", column: "region" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, {
      f1: ["North", "South"],
    });
    expect(result).toBe(
      `SELECT * FROM (SELECT * FROM sales) AS _filtered WHERE "region" IN ('North', 'South')`,
    );
  });

  it("skips multiSelect with empty array", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "multiSelect", label: "Region", column: "region" },
    ];
    expect(buildFilteredQuery(baseQuery, filters, { f1: [] })).toBe(baseQuery);
  });

  // --- DateRange filter ---

  it("builds >= condition for dateRange with start only", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "dateRange", label: "Date", column: "created_at" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, {
      f1: { start: "2024-01-01", end: "" },
    });
    expect(result).toBe(
      `SELECT * FROM (SELECT * FROM sales) AS _filtered WHERE "created_at" >= '2024-01-01'`,
    );
  });

  it("builds <= condition for dateRange with end only", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "dateRange", label: "Date", column: "created_at" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, {
      f1: { start: "", end: "2024-12-31" },
    });
    expect(result).toBe(
      `SELECT * FROM (SELECT * FROM sales) AS _filtered WHERE "created_at" <= '2024-12-31'`,
    );
  });

  it("builds both >= and <= for dateRange with start and end", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "dateRange", label: "Date", column: "created_at" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, {
      f1: { start: "2024-01-01", end: "2024-12-31" },
    });
    expect(result).toBe(
      `SELECT * FROM (SELECT * FROM sales) AS _filtered WHERE "created_at" >= '2024-01-01' AND "created_at" <= '2024-12-31'`,
    );
  });

  it("skips dateRange with empty start and end", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "dateRange", label: "Date", column: "created_at" },
    ];
    expect(
      buildFilteredQuery(baseQuery, filters, { f1: { start: "", end: "" } }),
    ).toBe(baseQuery);
  });

  // --- Multiple filters combined ---

  it("combines multiple active filters with AND", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "search", label: "Name", column: "name" },
      { id: "f2", type: "dropdown", label: "Region", column: "region" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, {
      f1: "test",
      f2: "North",
    });
    expect(result).toContain("ILIKE '%test%'");
    expect(result).toContain(`"region" = 'North'`);
    expect(result).toContain(" AND ");
  });

  it("skips inactive filters in multi-filter query", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "search", label: "Name", column: "name" },
      { id: "f2", type: "dropdown", label: "Region", column: "region" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, {
      f1: "",
      f2: "North",
    });
    // Only dropdown condition should appear
    expect(result).not.toContain("ILIKE");
    expect(result).toContain(`"region" = 'North'`);
  });

  // --- SQL injection protection ---

  it("escapes single quotes in dropdown values to prevent injection", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "dropdown", label: "Region", column: "region" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, {
      f1: "'; DROP TABLE sales; --",
    });
    // The leading single quote in the injection string is doubled to ''
    expect(result).toContain("'''; DROP TABLE sales; --'");
    // The value is wrapped safely — no unescaped quote breaks out of the string literal
    expect(result).toBe(
      `SELECT * FROM (SELECT * FROM sales) AS _filtered WHERE "region" = '''; DROP TABLE sales; --'`,
    );
  });

  it("escapes single quotes in multiSelect values", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "multiSelect", label: "Region", column: "region" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, {
      f1: ["O'Brien", "normal"],
    });
    expect(result).toContain("'O''Brien'");
  });

  it("escapes single quotes in dateRange values", () => {
    const filters: FilterConfig[] = [
      { id: "f1", type: "dateRange", label: "Date", column: "created_at" },
    ];
    const result = buildFilteredQuery(baseQuery, filters, {
      f1: { start: "2024-01-01'; DROP TABLE x; --", end: "" },
    });
    expect(result).toContain("''");
  });
});
