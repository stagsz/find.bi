import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import MultiSelectFilter from "./MultiSelectFilter";

const sampleOptions = [
  { label: "North", value: "north" },
  { label: "South", value: "south" },
  { label: "East", value: "east" },
  { label: "West", value: "west" },
];

describe("MultiSelectFilter", () => {
  afterEach(() => {
    cleanup();
  });

  // --- Rendering ---

  it("renders the filter container", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("multiselect-filter")).toBeInTheDocument();
  });

  it("displays the label", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("multiselect-label")).toHaveTextContent(
      "Regions",
    );
  });

  it("renders all options", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("multiselect-option-north")).toBeInTheDocument();
    expect(screen.getByTestId("multiselect-option-south")).toBeInTheDocument();
    expect(screen.getByTestId("multiselect-option-east")).toBeInTheDocument();
    expect(screen.getByTestId("multiselect-option-west")).toBeInTheDocument();
  });

  it("displays option labels", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("North")).toBeInTheDocument();
    expect(screen.getByText("South")).toBeInTheDocument();
    expect(screen.getByText("East")).toBeInTheDocument();
    expect(screen.getByText("West")).toBeInTheDocument();
  });

  it("renders options container", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("multiselect-options")).toBeInTheDocument();
  });

  // --- Selection state ---

  it("shows unchecked checkboxes when value is empty", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((cb) => {
      expect(cb).not.toBeChecked();
    });
  });

  it("shows checked checkboxes for selected values", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["north", "east"]}
        onChange={vi.fn()}
      />,
    );
    const northCheckbox = screen
      .getByTestId("multiselect-option-north")
      .querySelector("input");
    const southCheckbox = screen
      .getByTestId("multiselect-option-south")
      .querySelector("input");
    const eastCheckbox = screen
      .getByTestId("multiselect-option-east")
      .querySelector("input");
    expect(northCheckbox).toBeChecked();
    expect(southCheckbox).not.toBeChecked();
    expect(eastCheckbox).toBeChecked();
  });

  // --- Toggle selection ---

  it("adds value when unchecked option is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["north"]}
        onChange={onChange}
      />,
    );
    const southCheckbox = screen
      .getByTestId("multiselect-option-south")
      .querySelector("input")!;
    await user.click(southCheckbox);
    expect(onChange).toHaveBeenCalledWith(["north", "south"]);
  });

  it("removes value when checked option is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["north", "south"]}
        onChange={onChange}
      />,
    );
    const northCheckbox = screen
      .getByTestId("multiselect-option-north")
      .querySelector("input")!;
    await user.click(northCheckbox);
    expect(onChange).toHaveBeenCalledWith(["south"]);
  });

  it("results in empty array when last item is unchecked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["north"]}
        onChange={onChange}
      />,
    );
    const northCheckbox = screen
      .getByTestId("multiselect-option-north")
      .querySelector("input")!;
    await user.click(northCheckbox);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  // --- Select All / Clear ---

  it("shows Select All button when not all are selected", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["north"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("multiselect-select-all")).toBeInTheDocument();
  });

  it("hides Select All button when all are selected", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["north", "south", "east", "west"]}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("multiselect-select-all"),
    ).not.toBeInTheDocument();
  });

  it("selects all options when Select All is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["north"]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId("multiselect-select-all"));
    expect(onChange).toHaveBeenCalledWith([
      "north",
      "south",
      "east",
      "west",
    ]);
  });

  it("shows Clear button when values are selected", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["north"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("multiselect-clear")).toBeInTheDocument();
  });

  it("hides Clear button when no values are selected", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("multiselect-clear")).not.toBeInTheDocument();
  });

  it("clears all selections when Clear is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["north", "south"]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId("multiselect-clear"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  // --- Selected count ---

  it("shows selected count when items are selected", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["north", "east"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("multiselect-count")).toHaveTextContent(
      "2 selected",
    );
  });

  it("does not show count when nothing is selected", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("multiselect-count")).not.toBeInTheDocument();
  });

  it("shows correct count for single selection", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={["west"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("multiselect-count")).toHaveTextContent(
      "1 selected",
    );
  });

  // --- Empty options ---

  it("shows empty message when no options are provided", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={[]}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("multiselect-empty")).toHaveTextContent(
      "No options",
    );
  });

  it("does not show Select All button with empty options", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={[]}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("multiselect-select-all"),
    ).not.toBeInTheDocument();
  });

  // --- Max visible / scrolling ---

  it("sets max height based on maxVisible prop", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
        maxVisible={3}
      />,
    );
    const container = screen.getByTestId("multiselect-options");
    expect(container.style.maxHeight).toBe("84px"); // 3 * 28
  });

  it("uses default maxVisible of 6", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    const container = screen.getByTestId("multiselect-options");
    expect(container.style.maxHeight).toBe("168px"); // 6 * 28
  });

  it("has overflow-y-auto for scrolling", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("multiselect-options")).toHaveClass(
      "overflow-y-auto",
    );
  });

  // --- Styling ---

  it("applies custom className", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
        className="w-56"
      />,
    );
    expect(screen.getByTestId("multiselect-filter")).toHaveClass("w-56");
  });

  it("has proper label styling", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    const label = screen.getByTestId("multiselect-label");
    expect(label).toHaveClass("text-xs");
    expect(label).toHaveClass("font-medium");
    expect(label).toHaveClass("text-gray-600");
  });

  it("has hover styling on option labels", () => {
    render(
      <MultiSelectFilter
        label="Regions"
        options={sampleOptions}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    const option = screen.getByTestId("multiselect-option-north");
    expect(option).toHaveClass("hover:bg-gray-50");
    expect(option).toHaveClass("cursor-pointer");
  });
});
