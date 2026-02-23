import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import DashboardCard from "./DashboardCard";
import type { DashboardCardConfig } from "./DashboardGrid";

const sampleConfig: DashboardCardConfig = {
  id: "card-1",
  type: "bar",
  title: "Revenue by Region",
  query: "SELECT region, SUM(revenue) FROM sales GROUP BY region",
  columnMappings: { xField: "region", yField: "revenue" },
};

describe("DashboardCard", () => {
  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders the card container", () => {
    render(<DashboardCard config={sampleConfig} />);
    expect(screen.getByTestId("dashboard-card-card-1")).toBeInTheDocument();
  });

  it("renders the title bar", () => {
    render(<DashboardCard config={sampleConfig} />);
    expect(screen.getByTestId("card-title-bar-card-1")).toBeInTheDocument();
  });

  it("renders the card title", () => {
    render(<DashboardCard config={sampleConfig} />);
    expect(screen.getByTestId("card-title-card-1")).toHaveTextContent("Revenue by Region");
  });

  it("renders the content area", () => {
    render(<DashboardCard config={sampleConfig} />);
    expect(screen.getByTestId("card-content-card-1")).toBeInTheDocument();
  });

  it("renders children in the content area", () => {
    render(
      <DashboardCard config={sampleConfig}>
        <div data-testid="chart-child">Chart goes here</div>
      </DashboardCard>,
    );
    const content = screen.getByTestId("card-content-card-1");
    expect(content).toContainElement(screen.getByTestId("chart-child"));
  });

  it("shows fallback text when no children are provided", () => {
    render(<DashboardCard config={sampleConfig} />);
    const content = screen.getByTestId("card-content-card-1");
    expect(content).toHaveTextContent("No content");
  });

  it("does not show fallback text when children are provided", () => {
    render(
      <DashboardCard config={sampleConfig}>
        <div>Chart</div>
      </DashboardCard>,
    );
    const content = screen.getByTestId("card-content-card-1");
    expect(content).not.toHaveTextContent("No content");
  });

  // --- View mode (default) ---

  it("does not show drag icon in view mode", () => {
    render(<DashboardCard config={sampleConfig} />);
    expect(screen.queryByTestId("card-drag-icon-card-1")).not.toBeInTheDocument();
  });

  it("does not show settings button in view mode", () => {
    render(<DashboardCard config={sampleConfig} />);
    expect(screen.queryByTestId("card-settings-card-1")).not.toBeInTheDocument();
  });

  it("does not show remove button in view mode", () => {
    render(<DashboardCard config={sampleConfig} />);
    expect(screen.queryByTestId("card-remove-card-1")).not.toBeInTheDocument();
  });

  it("title bar does not have drag handle class in view mode", () => {
    render(<DashboardCard config={sampleConfig} />);
    const titleBar = screen.getByTestId("card-title-bar-card-1");
    expect(titleBar).not.toHaveClass("dashboard-card-drag-handle");
  });

  it("title bar does not have cursor-grab in view mode", () => {
    render(<DashboardCard config={sampleConfig} />);
    const titleBar = screen.getByTestId("card-title-bar-card-1");
    expect(titleBar).not.toHaveClass("cursor-grab");
  });

  // --- Edit mode ---

  it("shows drag icon in edit mode", () => {
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    expect(screen.getByTestId("card-drag-icon-card-1")).toBeInTheDocument();
  });

  it("shows settings button in edit mode", () => {
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    expect(screen.getByTestId("card-settings-card-1")).toBeInTheDocument();
  });

  it("shows remove button in edit mode", () => {
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    expect(screen.getByTestId("card-remove-card-1")).toBeInTheDocument();
  });

  it("title bar has drag handle class in edit mode", () => {
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    const titleBar = screen.getByTestId("card-title-bar-card-1");
    expect(titleBar).toHaveClass("dashboard-card-drag-handle");
  });

  it("title bar has cursor-grab in edit mode", () => {
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    const titleBar = screen.getByTestId("card-title-bar-card-1");
    expect(titleBar).toHaveClass("cursor-grab");
  });

  // --- Callbacks ---

  it("calls onSettings with config when settings button is clicked", async () => {
    const user = userEvent.setup();
    const onSettings = vi.fn();
    render(
      <DashboardCard config={sampleConfig} editMode={true} onSettings={onSettings} />,
    );
    await user.click(screen.getByTestId("card-settings-card-1"));
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onSettings).toHaveBeenCalledWith(sampleConfig);
  });

  it("calls onRemove with card id when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <DashboardCard config={sampleConfig} editMode={true} onRemove={onRemove} />,
    );
    await user.click(screen.getByTestId("card-remove-card-1"));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith("card-1");
  });

  it("does not throw when settings button clicked without onSettings callback", async () => {
    const user = userEvent.setup();
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    await expect(
      user.click(screen.getByTestId("card-settings-card-1")),
    ).resolves.not.toThrow();
  });

  it("does not throw when remove button clicked without onRemove callback", async () => {
    const user = userEvent.setup();
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    await expect(
      user.click(screen.getByTestId("card-remove-card-1")),
    ).resolves.not.toThrow();
  });

  // --- Accessibility ---

  it("settings button has accessible label", () => {
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    const button = screen.getByTestId("card-settings-card-1");
    expect(button).toHaveAttribute("aria-label", "Settings for Revenue by Region");
  });

  it("remove button has accessible label", () => {
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    const button = screen.getByTestId("card-remove-card-1");
    expect(button).toHaveAttribute("aria-label", "Remove Revenue by Region");
  });

  it("drag icon is hidden from screen readers", () => {
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    const icon = screen.getByTestId("card-drag-icon-card-1");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  // --- Different card types ---

  it("renders with kpi card type", () => {
    const kpiConfig: DashboardCardConfig = {
      id: "kpi-1",
      type: "kpi",
      title: "Total Revenue",
      query: "SELECT SUM(revenue) FROM sales",
      columnMappings: { value: "revenue" },
    };
    render(<DashboardCard config={kpiConfig} />);
    expect(screen.getByTestId("dashboard-card-kpi-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-title-kpi-1")).toHaveTextContent("Total Revenue");
  });

  it("renders with text card type", () => {
    const textConfig: DashboardCardConfig = {
      id: "text-1",
      type: "text",
      title: "Notes",
      query: "",
      columnMappings: {},
    };
    render(
      <DashboardCard config={textConfig}>
        <p>Some markdown content</p>
      </DashboardCard>,
    );
    expect(screen.getByTestId("dashboard-card-text-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-content-text-1")).toHaveTextContent("Some markdown content");
  });

  it("renders with line chart type", () => {
    const lineConfig: DashboardCardConfig = {
      id: "line-1",
      type: "line",
      title: "Trend",
      query: "SELECT month, total FROM monthly_sales",
      columnMappings: { xField: "month", yField: "total" },
    };
    render(<DashboardCard config={lineConfig} editMode={true} />);
    expect(screen.getByTestId("card-title-line-1")).toHaveTextContent("Trend");
    expect(screen.getByTestId("card-settings-line-1")).toBeInTheDocument();
  });

  // --- Title truncation ---

  it("title element has truncate class for long titles", () => {
    const longTitleConfig: DashboardCardConfig = {
      ...sampleConfig,
      title: "This is a very long title that should be truncated when it exceeds the available width",
    };
    render(<DashboardCard config={longTitleConfig} />);
    const title = screen.getByTestId("card-title-card-1");
    expect(title).toHaveClass("truncate");
  });

  // --- Layout structure ---

  it("card uses flex column layout for full height", () => {
    render(<DashboardCard config={sampleConfig} />);
    const card = screen.getByTestId("dashboard-card-card-1");
    expect(card).toHaveClass("flex", "flex-col", "h-full");
  });

  it("content area uses flex-1 to fill remaining space", () => {
    render(<DashboardCard config={sampleConfig} />);
    const content = screen.getByTestId("card-content-card-1");
    expect(content).toHaveClass("flex-1");
  });

  it("content area has overflow-auto for scrollable content", () => {
    render(<DashboardCard config={sampleConfig} />);
    const content = screen.getByTestId("card-content-card-1");
    expect(content).toHaveClass("overflow-auto");
  });

  // --- Title bar styling ---

  it("title bar has bottom border", () => {
    render(<DashboardCard config={sampleConfig} />);
    const titleBar = screen.getByTestId("card-title-bar-card-1");
    expect(titleBar).toHaveClass("border-b", "border-gray-100");
  });

  it("title bar has gray background", () => {
    render(<DashboardCard config={sampleConfig} />);
    const titleBar = screen.getByTestId("card-title-bar-card-1");
    expect(titleBar).toHaveClass("bg-gray-50");
  });

  // --- Edit mode toggle ---

  it("switching from view to edit mode shows controls", () => {
    const { rerender } = render(
      <DashboardCard config={sampleConfig} editMode={false} />,
    );
    expect(screen.queryByTestId("card-settings-card-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-remove-card-1")).not.toBeInTheDocument();

    rerender(<DashboardCard config={sampleConfig} editMode={true} />);
    expect(screen.getByTestId("card-settings-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-remove-card-1")).toBeInTheDocument();
  });

  it("switching from edit to view mode hides controls", () => {
    const { rerender } = render(
      <DashboardCard config={sampleConfig} editMode={true} />,
    );
    expect(screen.getByTestId("card-settings-card-1")).toBeInTheDocument();

    rerender(<DashboardCard config={sampleConfig} editMode={false} />);
    expect(screen.queryByTestId("card-settings-card-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-remove-card-1")).not.toBeInTheDocument();
  });

  // --- Children rendering ---

  it("renders complex children", () => {
    render(
      <DashboardCard config={sampleConfig}>
        <div data-testid="outer">
          <span data-testid="inner">Nested content</span>
        </div>
      </DashboardCard>,
    );
    expect(screen.getByTestId("outer")).toBeInTheDocument();
    expect(screen.getByTestId("inner")).toHaveTextContent("Nested content");
  });

  it("renders multiple children", () => {
    render(
      <DashboardCard config={sampleConfig}>
        <div data-testid="child-1">First</div>
        <div data-testid="child-2">Second</div>
      </DashboardCard>,
    );
    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  // --- Empty title ---

  it("renders with empty title", () => {
    const emptyTitleConfig: DashboardCardConfig = {
      ...sampleConfig,
      title: "",
    };
    render(<DashboardCard config={emptyTitleConfig} />);
    expect(screen.getByTestId("card-title-card-1")).toHaveTextContent("");
  });

  // --- Buttons have type="button" ---

  it("settings button has type button", () => {
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    const button = screen.getByTestId("card-settings-card-1");
    expect(button).toHaveAttribute("type", "button");
  });

  it("remove button has type button", () => {
    render(<DashboardCard config={sampleConfig} editMode={true} />);
    const button = screen.getByTestId("card-remove-card-1");
    expect(button).toHaveAttribute("type", "button");
  });
});
