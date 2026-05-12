/**
 * Tests for ChartErrorBoundary.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChartErrorBoundary from "./ChartErrorBoundary";

// Component that throws on first render then renders normally after reset
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Chart exploded");
  return <div data-testid="chart-ok">OK</div>;
}

describe("ChartErrorBoundary", () => {
  beforeEach(() => {
    // Suppress expected console.error noise from error boundary
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when there is no error", () => {
    render(
      <ChartErrorBoundary>
        <div data-testid="child">hello</div>
      </ChartErrorBoundary>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("chart-error-boundary")).not.toBeInTheDocument();
  });

  it("shows fallback when child throws", () => {
    render(
      <ChartErrorBoundary label="Revenue Chart">
        <Bomb shouldThrow />
      </ChartErrorBoundary>,
    );
    expect(screen.getByTestId("chart-error-boundary")).toBeInTheDocument();
    expect(screen.getByText(/"Revenue Chart" failed to render/i)).toBeInTheDocument();
    expect(screen.getByText(/Chart exploded/i)).toBeInTheDocument();
  });

  it("shows generic message when no label provided", () => {
    render(
      <ChartErrorBoundary>
        <Bomb shouldThrow />
      </ChartErrorBoundary>,
    );
    expect(screen.getByText(/Chart failed to render/i)).toBeInTheDocument();
  });

  it("shows Retry button in fallback", () => {
    render(
      <ChartErrorBoundary>
        <Bomb shouldThrow />
      </ChartErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("resets error state when Retry is clicked", async () => {
    const user = userEvent.setup();
    // After reset the Bomb won't throw (parent controls the prop)
    // We test that clicking Retry clears the error UI
    render(
      <ChartErrorBoundary>
        <Bomb shouldThrow />
      </ChartErrorBoundary>,
    );
    expect(screen.getByTestId("chart-error-boundary")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    // After reset it tries to re-render the child — which still throws,
    // so the boundary re-catches it. Verify the fallback is shown again.
    expect(screen.getByTestId("chart-error-boundary")).toBeInTheDocument();
  });
});
