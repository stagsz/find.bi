/**
 * ChartErrorBoundary — catches render errors inside chart/card components
 * and shows a styled fallback instead of crashing the whole dashboard.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback (e.g. the card title). */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log for debugging — keeps the console informative without crashing UX
    console.error("[ChartErrorBoundary] Chart render error:", error, info);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, message: "" });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          data-testid="chart-error-boundary"
          className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center"
        >
          <svg
            className="h-6 w-6 text-[#E84393]/60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="font-mono text-[0.65rem] text-[#E84393]">
            {this.props.label ? `"${this.props.label}" failed to render` : "Chart failed to render"}
          </p>
          <p className="max-w-[200px] truncate font-mono text-[0.6rem] text-[#6B6860]" title={this.state.message}>
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-1 rounded border border-[#2A2A2A] bg-[#141414] px-2 py-0.5 font-mono text-[0.6rem] text-[#6B6860] transition-colors hover:border-[#F5A623]/30 hover:text-[#F5A623]"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;
