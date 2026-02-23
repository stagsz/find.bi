import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import DateRangeFilter from "./DateRangeFilter";

describe("DateRangeFilter", () => {
  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders the filter container", () => {
    render(<DateRangeFilter label="Date" value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("date-range-filter")).toBeInTheDocument();
  });

  it("displays the label", () => {
    render(
      <DateRangeFilter label="Created Date" value={null} onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("date-range-label")).toHaveTextContent(
      "Created Date",
    );
  });

  it("renders start and end date inputs", () => {
    render(<DateRangeFilter label="Date" value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("date-range-start")).toBeInTheDocument();
    expect(screen.getByTestId("date-range-end")).toBeInTheDocument();
  });

  it("renders the 'to' separator text", () => {
    render(<DateRangeFilter label="Date" value={null} onChange={vi.fn()} />);
    expect(screen.getByText("to")).toBeInTheDocument();
  });

  it("shows empty inputs when value is null", () => {
    render(<DateRangeFilter label="Date" value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("date-range-start")).toHaveValue("");
    expect(screen.getByTestId("date-range-end")).toHaveValue("");
  });

  it("shows date values when provided", () => {
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "2026-01-01", end: "2026-01-31" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("date-range-start")).toHaveValue("2026-01-01");
    expect(screen.getByTestId("date-range-end")).toHaveValue("2026-01-31");
  });

  // --- Clear button ---

  it("does not show clear button when value is null", () => {
    render(<DateRangeFilter label="Date" value={null} onChange={vi.fn()} />);
    expect(screen.queryByTestId("date-range-clear")).not.toBeInTheDocument();
  });

  it("shows clear button when value is set", () => {
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "2026-01-01", end: "2026-01-31" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("date-range-clear")).toBeInTheDocument();
  });

  it("clears value when clear button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "2026-01-01", end: "2026-01-31" }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId("date-range-clear"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  // --- Start date changes ---

  it("calls onChange with new start date preserving end", () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "2026-01-01", end: "2026-01-31" }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId("date-range-start"), {
      target: { value: "2026-02-01" },
    });
    expect(onChange).toHaveBeenCalledWith({
      start: "2026-02-01",
      end: "2026-01-31",
    });
  });

  it("calls onChange with null when start is cleared and no end", () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "2026-01-01", end: "" }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId("date-range-start"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  // --- End date changes ---

  it("calls onChange with new end date preserving start", () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "2026-01-01", end: "2026-01-31" }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId("date-range-end"), {
      target: { value: "2026-02-28" },
    });
    expect(onChange).toHaveBeenCalledWith({
      start: "2026-01-01",
      end: "2026-02-28",
    });
  });

  it("calls onChange with null when end is cleared and no start", () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "", end: "2026-01-31" }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId("date-range-end"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("preserves start when end is cleared but start exists", () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "2026-01-01", end: "2026-01-31" }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId("date-range-end"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith({ start: "2026-01-01", end: "" });
  });

  // --- Min/Max constraints ---

  it("sets min attribute on start input", () => {
    render(
      <DateRangeFilter
        label="Date"
        value={null}
        onChange={vi.fn()}
        min="2025-01-01"
      />,
    );
    expect(screen.getByTestId("date-range-start")).toHaveAttribute(
      "min",
      "2025-01-01",
    );
  });

  it("sets max attribute on end input", () => {
    render(
      <DateRangeFilter
        label="Date"
        value={null}
        onChange={vi.fn()}
        max="2026-12-31"
      />,
    );
    expect(screen.getByTestId("date-range-end")).toHaveAttribute(
      "max",
      "2026-12-31",
    );
  });

  it("constrains start max to end date when end is set", () => {
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "2026-01-01", end: "2026-06-30" }}
        onChange={vi.fn()}
        max="2026-12-31"
      />,
    );
    expect(screen.getByTestId("date-range-start")).toHaveAttribute(
      "max",
      "2026-06-30",
    );
  });

  it("constrains end min to start date when start is set", () => {
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "2026-03-15", end: "2026-06-30" }}
        onChange={vi.fn()}
        min="2025-01-01"
      />,
    );
    expect(screen.getByTestId("date-range-end")).toHaveAttribute(
      "min",
      "2026-03-15",
    );
  });

  // --- Accessibility ---

  it("has accessible labels on date inputs", () => {
    render(
      <DateRangeFilter label="Order Date" value={null} onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("date-range-start")).toHaveAttribute(
      "aria-label",
      "Order Date start date",
    );
    expect(screen.getByTestId("date-range-end")).toHaveAttribute(
      "aria-label",
      "Order Date end date",
    );
  });

  it("has accessible label on clear button", () => {
    render(
      <DateRangeFilter
        label="Order Date"
        value={{ start: "2026-01-01", end: "2026-01-31" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("date-range-clear")).toHaveAttribute(
      "aria-label",
      "Clear Order Date filter",
    );
  });

  // --- Styling ---

  it("applies custom className", () => {
    render(
      <DateRangeFilter
        label="Date"
        value={null}
        onChange={vi.fn()}
        className="w-64"
      />,
    );
    expect(screen.getByTestId("date-range-filter")).toHaveClass("w-64");
  });

  it("has proper label styling", () => {
    render(<DateRangeFilter label="Date" value={null} onChange={vi.fn()} />);
    const label = screen.getByTestId("date-range-label");
    expect(label).toHaveClass("text-xs");
    expect(label).toHaveClass("font-medium");
    expect(label).toHaveClass("text-gray-600");
  });

  // --- Edge cases ---

  it("handles value with only start date", () => {
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "2026-01-01", end: "" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("date-range-start")).toHaveValue("2026-01-01");
    expect(screen.getByTestId("date-range-end")).toHaveValue("");
  });

  it("handles value with only end date", () => {
    render(
      <DateRangeFilter
        label="Date"
        value={{ start: "", end: "2026-12-31" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("date-range-start")).toHaveValue("");
    expect(screen.getByTestId("date-range-end")).toHaveValue("2026-12-31");
  });
});
