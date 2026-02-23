import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import SearchFilter from "./SearchFilter";

describe("SearchFilter", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // --- Rendering ---

  it("renders the filter container", () => {
    render(<SearchFilter label="Search" value="" onChange={vi.fn()} />);
    expect(screen.getByTestId("search-filter")).toBeInTheDocument();
  });

  it("displays the label", () => {
    render(
      <SearchFilter label="Product Name" value="" onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("search-label")).toHaveTextContent(
      "Product Name",
    );
  });

  it("renders the text input", () => {
    render(<SearchFilter label="Search" value="" onChange={vi.fn()} />);
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("shows default placeholder", () => {
    render(<SearchFilter label="Search" value="" onChange={vi.fn()} />);
    expect(screen.getByTestId("search-input")).toHaveAttribute(
      "placeholder",
      "Search...",
    );
  });

  it("shows custom placeholder", () => {
    render(
      <SearchFilter
        label="Search"
        value=""
        onChange={vi.fn()}
        placeholder="Filter by name..."
      />,
    );
    expect(screen.getByTestId("search-input")).toHaveAttribute(
      "placeholder",
      "Filter by name...",
    );
  });

  it("displays current value", () => {
    render(
      <SearchFilter label="Search" value="hello" onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("search-input")).toHaveValue("hello");
  });

  it("renders search icon", () => {
    render(<SearchFilter label="Search" value="" onChange={vi.fn()} />);
    const svg = screen
      .getByTestId("search-filter")
      .querySelector("svg[aria-hidden]");
    expect(svg).toBeInTheDocument();
  });

  // --- Value changes (no debounce) ---

  it("calls onChange immediately when typing without debounce", () => {
    const onChange = vi.fn();
    render(<SearchFilter label="Search" value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "test" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("test");
  });

  // --- Clear button ---

  it("does not show clear button when value is empty", () => {
    render(<SearchFilter label="Search" value="" onChange={vi.fn()} />);
    expect(screen.queryByTestId("search-clear")).not.toBeInTheDocument();
  });

  it("shows clear button when value is present", () => {
    render(
      <SearchFilter label="Search" value="something" onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("search-clear")).toBeInTheDocument();
  });

  it("calls onChange with empty string when clear is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SearchFilter label="Search" value="test" onChange={onChange} />,
    );
    await user.click(screen.getByTestId("search-clear"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  // --- Debounce ---

  it("debounces onChange when debounceMs is set", () => {
    const onChange = vi.fn();
    render(
      <SearchFilter
        label="Search"
        value=""
        onChange={onChange}
        debounceMs={300}
      />,
    );
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "abc" },
    });
    // Should not have been called yet
    expect(onChange).not.toHaveBeenCalled();
    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("resets debounce timer on new input", () => {
    const onChange = vi.fn();
    render(
      <SearchFilter
        label="Search"
        value=""
        onChange={onChange}
        debounceMs={300}
      />,
    );
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "ab" },
    });
    act(() => {
      vi.advanceTimersByTime(200); // Not yet expired
    });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "abc" },
    });
    act(() => {
      vi.advanceTimersByTime(200); // Still not expired (timer reset)
    });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(100); // Now expired (total 300ms from last keystroke)
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("clear bypasses debounce", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SearchFilter
        label="Search"
        value="test"
        onChange={onChange}
        debounceMs={300}
      />,
    );
    await user.click(screen.getByTestId("search-clear"));
    // Clear should call onChange immediately without waiting for debounce
    expect(onChange).toHaveBeenCalledWith("");
  });

  // --- Accessibility ---

  it("has aria-label on input", () => {
    render(
      <SearchFilter label="Product Name" value="" onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("search-input")).toHaveAttribute(
      "aria-label",
      "Product Name",
    );
  });

  it("has aria-label on clear button", () => {
    render(
      <SearchFilter
        label="Product Name"
        value="test"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("search-clear")).toHaveAttribute(
      "aria-label",
      "Clear Product Name filter",
    );
  });

  // --- Styling ---

  it("applies custom className", () => {
    render(
      <SearchFilter
        label="Search"
        value=""
        onChange={vi.fn()}
        className="w-64"
      />,
    );
    expect(screen.getByTestId("search-filter")).toHaveClass("w-64");
  });

  it("has proper label styling", () => {
    render(<SearchFilter label="Search" value="" onChange={vi.fn()} />);
    const label = screen.getByTestId("search-label");
    expect(label).toHaveClass("text-xs");
    expect(label).toHaveClass("font-medium");
    expect(label).toHaveClass("text-gray-600");
  });

  it("has proper input styling", () => {
    render(<SearchFilter label="Search" value="" onChange={vi.fn()} />);
    const input = screen.getByTestId("search-input");
    expect(input).toHaveClass("rounded-md");
    expect(input).toHaveClass("border");
    expect(input).toHaveClass("text-sm");
  });

  it("has search icon with pointer-events-none", () => {
    render(<SearchFilter label="Search" value="" onChange={vi.fn()} />);
    const svg = screen
      .getByTestId("search-filter")
      .querySelector("svg[aria-hidden]");
    expect(svg).toHaveClass("pointer-events-none");
  });

  // --- Edge cases ---

  it("handles empty string value", () => {
    render(<SearchFilter label="Search" value="" onChange={vi.fn()} />);
    expect(screen.getByTestId("search-input")).toHaveValue("");
  });

  it("handles whitespace value", () => {
    render(<SearchFilter label="Search" value="  " onChange={vi.fn()} />);
    expect(screen.getByTestId("search-input")).toHaveValue("  ");
    // Clear button should still be visible for whitespace
    expect(screen.getByTestId("search-clear")).toBeInTheDocument();
  });
});
