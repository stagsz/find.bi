import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";

import QualityScoreCard from "./QualityScoreCard";
import type { QualityIssue } from "./QualityScoreCard";

afterEach(() => {
  cleanup();
});

const SAMPLE_ISSUES: QualityIssue[] = [
  {
    type: "nulls",
    column: "email",
    count: 150,
    description: 'Column "email" has 150 null values (15% of rows)',
  },
  {
    type: "duplicates",
    column: null,
    count: 50,
    description: "50 duplicate rows found (5% of rows)",
  },
  {
    type: "type_mismatch",
    column: "id",
    count: 950,
    description:
      'Column "id" is VARCHAR but 95% of values are numeric — consider casting to a number type',
  },
  {
    type: "outliers",
    column: "price",
    count: 8,
    description:
      'Column "price" has 8 outliers (0.8% of rows) outside IQR bounds [2.5, 97.5]',
  },
];

const BASE_PROPS = {
  score: 72,
  issues: SAMPLE_ISSUES,
  rowCount: 1000,
  columnCount: 12,
};

describe("QualityScoreCard", () => {
  describe("rendering", () => {
    it("renders the card container", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      expect(screen.getByTestId("quality-score-card")).toBeInTheDocument();
    });

    it("renders the score gauge", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      expect(screen.getByTestId("score-gauge")).toBeInTheDocument();
    });

    it("displays the score number inside the gauge", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      const gauge = screen.getByTestId("score-gauge");
      expect(gauge).toHaveTextContent("72");
    });

    it("renders row count", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      expect(screen.getByTestId("row-count")).toHaveTextContent(/1.?000 rows/);
    });

    it("renders column count", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      expect(screen.getByTestId("column-count")).toHaveTextContent("12 cols");
    });

    it("applies className to container", () => {
      render(<QualityScoreCard {...BASE_PROPS} className="my-custom" />);
      expect(screen.getByTestId("quality-score-card")).toHaveClass("my-custom");
    });

    it("renders table name when provided", () => {
      render(<QualityScoreCard {...BASE_PROPS} tableName="sales" />);
      expect(screen.getByTestId("quality-score-card")).toHaveTextContent(
        "sales",
      );
    });
  });

  describe("score labels", () => {
    it("shows Excellent for score >= 90", () => {
      render(<QualityScoreCard {...BASE_PROPS} score={95} issues={[]} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("Excellent");
    });

    it("shows Good for score >= 80", () => {
      render(<QualityScoreCard {...BASE_PROPS} score={85} issues={[]} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("Good");
    });

    it("shows Fair for score >= 60", () => {
      render(<QualityScoreCard {...BASE_PROPS} score={65} issues={[]} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("Fair");
    });

    it("shows Poor for score >= 40", () => {
      render(<QualityScoreCard {...BASE_PROPS} score={45} issues={[]} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("Poor");
    });

    it("shows Critical for score < 40", () => {
      render(<QualityScoreCard {...BASE_PROPS} score={20} issues={[]} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("Critical");
    });
  });

  describe("score clamping", () => {
    it("clamps score above 100 to 100", () => {
      render(<QualityScoreCard {...BASE_PROPS} score={150} issues={[]} />);
      const gauge = screen.getByTestId("score-gauge");
      expect(gauge).toHaveTextContent("100");
    });

    it("clamps score below 0 to 0", () => {
      render(<QualityScoreCard {...BASE_PROPS} score={-10} issues={[]} />);
      const gauge = screen.getByTestId("score-gauge");
      expect(gauge).toHaveTextContent("0");
    });
  });

  describe("issue breakdown", () => {
    it("renders summary row for nulls", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      expect(screen.getByTestId("issue-summary-nulls")).toBeInTheDocument();
      expect(screen.getByTestId("issue-summary-nulls")).toHaveTextContent("1");
    });

    it("renders summary row for duplicates", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      expect(
        screen.getByTestId("issue-summary-duplicates"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("issue-summary-duplicates")).toHaveTextContent(
        "1",
      );
    });

    it("renders summary row for type_mismatch", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      expect(
        screen.getByTestId("issue-summary-type_mismatch"),
      ).toBeInTheDocument();
    });

    it("renders summary row for outliers", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      expect(screen.getByTestId("issue-summary-outliers")).toBeInTheDocument();
    });

    it("does not render summary for issue types with zero count", () => {
      const onlyNulls: QualityIssue[] = [SAMPLE_ISSUES[0]];
      render(<QualityScoreCard {...BASE_PROPS} issues={onlyNulls} />);
      expect(screen.getByTestId("issue-summary-nulls")).toBeInTheDocument();
      expect(
        screen.queryByTestId("issue-summary-duplicates"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("issue-summary-type_mismatch"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("issue-summary-outliers"),
      ).not.toBeInTheDocument();
    });

    it("shows no-issues message when there are no issues", () => {
      render(<QualityScoreCard {...BASE_PROPS} score={100} issues={[]} />);
      expect(screen.getByTestId("no-issues")).toHaveTextContent(
        "No issues detected",
      );
    });

    it("counts multiple issues of the same type", () => {
      const twoNulls: QualityIssue[] = [
        SAMPLE_ISSUES[0],
        {
          type: "nulls",
          column: "name",
          count: 80,
          description: 'Column "name" has 80 null values (8% of rows)',
        },
      ];
      render(<QualityScoreCard {...BASE_PROPS} issues={twoNulls} />);
      expect(screen.getByTestId("issue-summary-nulls")).toHaveTextContent("2");
    });
  });

  describe("suggestions", () => {
    it("renders suggestions section when issues exist", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      expect(screen.getByTestId("suggestions")).toBeInTheDocument();
    });

    it("renders all issue descriptions as suggestions", () => {
      render(<QualityScoreCard {...BASE_PROPS} />);
      const suggestions = screen.getByTestId("suggestions");
      for (const issue of SAMPLE_ISSUES) {
        expect(suggestions).toHaveTextContent(issue.description);
      }
    });

    it("does not render suggestions when no issues", () => {
      render(<QualityScoreCard {...BASE_PROPS} score={100} issues={[]} />);
      expect(screen.queryByTestId("suggestions")).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("renders loading skeleton when loading is true", () => {
      render(<QualityScoreCard {...BASE_PROPS} loading />);
      expect(screen.getByTestId("quality-loading")).toBeInTheDocument();
    });

    it("does not render gauge when loading", () => {
      render(<QualityScoreCard {...BASE_PROPS} loading />);
      expect(screen.queryByTestId("score-gauge")).not.toBeInTheDocument();
    });

    it("still renders the card container when loading", () => {
      render(<QualityScoreCard {...BASE_PROPS} loading />);
      expect(screen.getByTestId("quality-score-card")).toBeInTheDocument();
    });
  });
});
