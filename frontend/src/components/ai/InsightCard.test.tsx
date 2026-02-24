import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";

import InsightCard from "./InsightCard";
import type { Insight } from "./InsightCard";

afterEach(() => {
  cleanup();
});

const BASE_INSIGHT: Insight = {
  type: "trend",
  title: "Revenue is increasing",
  description: "Revenue shows an upward trend across all regions.",
  severity: "info",
};

describe("InsightCard", () => {
  describe("rendering", () => {
    it("renders the card container", () => {
      render(<InsightCard insight={BASE_INSIGHT} />);
      expect(screen.getByTestId("insight-card")).toBeInTheDocument();
    });

    it("renders the title", () => {
      render(<InsightCard insight={BASE_INSIGHT} />);
      expect(screen.getByTestId("insight-title")).toHaveTextContent(
        "Revenue is increasing",
      );
    });

    it("renders the description", () => {
      render(<InsightCard insight={BASE_INSIGHT} />);
      expect(screen.getByTestId("insight-description")).toHaveTextContent(
        "Revenue shows an upward trend across all regions.",
      );
    });

    it("renders the type badge", () => {
      render(<InsightCard insight={BASE_INSIGHT} />);
      expect(screen.getByTestId("insight-type")).toHaveTextContent("TREND");
    });

    it("renders the severity badge", () => {
      render(<InsightCard insight={BASE_INSIGHT} />);
      expect(screen.getByTestId("insight-severity")).toHaveTextContent("info");
    });

    it("applies className to container", () => {
      render(<InsightCard insight={BASE_INSIGHT} className="my-custom" />);
      expect(screen.getByTestId("insight-card")).toHaveClass("my-custom");
    });
  });

  describe("type badges", () => {
    it("renders ANOMALY for anomaly type", () => {
      render(
        <InsightCard
          insight={{ ...BASE_INSIGHT, type: "anomaly" }}
        />,
      );
      expect(screen.getByTestId("insight-type")).toHaveTextContent("ANOMALY");
    });

    it("renders CORRELATION for correlation type", () => {
      render(
        <InsightCard
          insight={{ ...BASE_INSIGHT, type: "correlation" }}
        />,
      );
      expect(screen.getByTestId("insight-type")).toHaveTextContent(
        "CORRELATION",
      );
    });

    it("renders OUTLIER for outlier type", () => {
      render(
        <InsightCard
          insight={{ ...BASE_INSIGHT, type: "outlier" }}
        />,
      );
      expect(screen.getByTestId("insight-type")).toHaveTextContent("OUTLIER");
    });
  });

  describe("severity badges", () => {
    it("renders warning severity", () => {
      render(
        <InsightCard
          insight={{ ...BASE_INSIGHT, severity: "warning" }}
        />,
      );
      expect(screen.getByTestId("insight-severity")).toHaveTextContent(
        "warning",
      );
    });

    it("renders important severity", () => {
      render(
        <InsightCard
          insight={{ ...BASE_INSIGHT, severity: "important" }}
        />,
      );
      expect(screen.getByTestId("insight-severity")).toHaveTextContent(
        "important",
      );
    });
  });

  describe("optional fields", () => {
    it("does not render columns when absent", () => {
      render(<InsightCard insight={BASE_INSIGHT} />);
      expect(screen.queryByTestId("insight-columns")).not.toBeInTheDocument();
    });

    it("renders column tags when present", () => {
      render(
        <InsightCard
          insight={{
            ...BASE_INSIGHT,
            columns: ["revenue", "region"],
          }}
        />,
      );
      const container = screen.getByTestId("insight-columns");
      expect(container).toBeInTheDocument();
      expect(container).toHaveTextContent("revenue");
      expect(container).toHaveTextContent("region");
    });

    it("does not render columns when array is empty", () => {
      render(
        <InsightCard
          insight={{ ...BASE_INSIGHT, columns: [] }}
        />,
      );
      expect(screen.queryByTestId("insight-columns")).not.toBeInTheDocument();
    });

    it("does not render metrics when absent", () => {
      render(<InsightCard insight={BASE_INSIGHT} />);
      expect(screen.queryByTestId("insight-metrics")).not.toBeInTheDocument();
    });

    it("renders metrics when present", () => {
      render(
        <InsightCard
          insight={{
            ...BASE_INSIGHT,
            metrics: { growth_rate: 0.15, count: 42 },
          }}
        />,
      );
      const container = screen.getByTestId("insight-metrics");
      expect(container).toBeInTheDocument();
      expect(container).toHaveTextContent("growth_rate");
      expect(container).toHaveTextContent("0.15");
      expect(container).toHaveTextContent("count");
      expect(container).toHaveTextContent("42");
    });

    it("does not render metrics when object is empty", () => {
      render(
        <InsightCard
          insight={{ ...BASE_INSIGHT, metrics: {} }}
        />,
      );
      expect(screen.queryByTestId("insight-metrics")).not.toBeInTheDocument();
    });

    it("formats decimal metrics to two decimal places", () => {
      render(
        <InsightCard
          insight={{
            ...BASE_INSIGHT,
            metrics: { correlation: 0.9567 },
          }}
        />,
      );
      expect(screen.getByTestId("insight-metrics")).toHaveTextContent("0.96");
    });

    it("renders integer metrics without decimals", () => {
      render(
        <InsightCard
          insight={{
            ...BASE_INSIGHT,
            metrics: { total: 100 },
          }}
        />,
      );
      expect(screen.getByTestId("insight-metrics")).toHaveTextContent("100");
    });
  });
});
