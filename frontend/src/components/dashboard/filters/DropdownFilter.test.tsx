import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import DropdownFilter from "./DropdownFilter";

const sampleOptions = [
  { label: "North", value: "north" },
  { label: "South", value: "south" },
  { label: "East", value: "east" },
  { label: "West", value: "west" },
];

describe("DropdownFilter", () => {
  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders the filter container", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("dropdown-filter")).toBeInTheDocument();
  });

  it("displays the label", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("dropdown-label")).toHaveTextContent("Region");
  });

  it("renders the select element", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("dropdown-select")).toBeInTheDocument();
  });

  it("renders all options plus placeholder", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByTestId("dropdown-select");
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(5); // 4 options + 1 placeholder
  });

  it("shows default placeholder text", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByTestId("dropdown-select");
    const firstOption = select.querySelector("option");
    expect(firstOption).toHaveTextContent("All");
  });

  it("shows custom placeholder text", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
        placeholder="Choose region..."
      />,
    );
    const select = screen.getByTestId("dropdown-select");
    const firstOption = select.querySelector("option");
    expect(firstOption).toHaveTextContent("Choose region...");
  });

  it("displays option labels", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("North")).toBeInTheDocument();
    expect(screen.getByText("South")).toBeInTheDocument();
    expect(screen.getByText("East")).toBeInTheDocument();
    expect(screen.getByText("West")).toBeInTheDocument();
  });

  // --- Selection ---

  it("shows no selection when value is null", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("dropdown-select")).toHaveValue("");
  });

  it("shows selected value", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value="south"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("dropdown-select")).toHaveValue("south");
  });

  it("calls onChange with selected value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByTestId("dropdown-select"), "east");
    expect(onChange).toHaveBeenCalledWith("east");
  });

  it("calls onChange with null when placeholder is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value="north"
        onChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByTestId("dropdown-select"), "");
    expect(onChange).toHaveBeenCalledWith(null);
  });

  // --- Empty options ---

  it("renders with empty options array", () => {
    render(
      <DropdownFilter
        label="Region"
        options={[]}
        value={null}
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByTestId("dropdown-select");
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(1); // Only placeholder
  });

  // --- Accessibility ---

  it("has aria-label on select", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("dropdown-select")).toHaveAttribute(
      "aria-label",
      "Region",
    );
  });

  // --- Styling ---

  it("applies custom className", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
        className="w-48"
      />,
    );
    expect(screen.getByTestId("dropdown-filter")).toHaveClass("w-48");
  });

  it("has proper label styling", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />,
    );
    const label = screen.getByTestId("dropdown-label");
    expect(label).toHaveClass("text-xs");
    expect(label).toHaveClass("font-medium");
    expect(label).toHaveClass("text-gray-600");
  });

  it("has proper select styling", () => {
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByTestId("dropdown-select");
    expect(select).toHaveClass("rounded-md");
    expect(select).toHaveClass("border");
    expect(select).toHaveClass("text-sm");
  });

  // --- Multiple selections ---

  it("handles changing selection between options", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DropdownFilter
        label="Region"
        options={sampleOptions}
        value={null}
        onChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByTestId("dropdown-select"), "north");
    expect(onChange).toHaveBeenCalledWith("north");
  });

  // --- Single option ---

  it("works with single option", () => {
    render(
      <DropdownFilter
        label="Status"
        options={[{ label: "Active", value: "active" }]}
        value="active"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("dropdown-select")).toHaveValue("active");
  });
});
