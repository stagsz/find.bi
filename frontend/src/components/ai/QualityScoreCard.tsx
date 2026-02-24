/**
 * QualityScoreCard — displays a data quality score with circular gauge,
 * issues breakdown by type, and actionable suggestions per column.
 *
 * Follows the find.bi retro-futuristic editorial aesthetic:
 * dark surface (#141414), amber accents (#F5A623), hot pink for critical (#E84393).
 */

/** Shape of a single quality issue returned by the quality service. */
interface QualityIssue {
  type: "nulls" | "duplicates" | "type_mismatch" | "outliers";
  column: string | null;
  count: number;
  description: string;
}

interface QualityScoreCardProps {
  score: number;
  issues: QualityIssue[];
  rowCount: number;
  columnCount: number;
  tableName?: string;
  className?: string;
  loading?: boolean;
}

/* ── Issue type presentation ─────────────────────────────────── */

const ISSUE_CONFIG: Record<
  QualityIssue["type"],
  { label: string; icon: string; color: string; bgColor: string }
> = {
  nulls: {
    label: "MISSING",
    icon: "\u25CB", // ○
    color: "text-[#F5A623]",
    bgColor: "bg-[#F5A623]/10",
  },
  duplicates: {
    label: "DUPLICATES",
    icon: "\u2261", // ≡
    color: "text-[#E84393]",
    bgColor: "bg-[#E84393]/10",
  },
  type_mismatch: {
    label: "TYPE MISMATCH",
    icon: "\u00D7", // ×
    color: "text-[#E0A458]",
    bgColor: "bg-[#E0A458]/10",
  },
  outliers: {
    label: "OUTLIERS",
    icon: "\u25C6", // ◆
    color: "text-[#A78BFA]",
    bgColor: "bg-[#A78BFA]/10",
  },
};

/* ── Score gauge color based on value ────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 80) return "#4ADE80";
  if (score >= 60) return "#F5A623";
  if (score >= 40) return "#E0A458";
  return "#E84393";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Poor";
  return "Critical";
}

/* ── Circular SVG gauge ──────────────────────────────────────── */

const GAUGE_SIZE = 120;
const GAUGE_STROKE = 8;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

function ScoreGauge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = GAUGE_CIRCUMFERENCE * (1 - clampedScore / 100);
  const color = scoreColor(clampedScore);
  const label = scoreLabel(clampedScore);

  return (
    <div data-testid="score-gauge" className="flex flex-col items-center gap-1">
      <svg
        width={GAUGE_SIZE}
        height={GAUGE_SIZE}
        viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
        className="drop-shadow-[0_0_12px_rgba(245,166,35,0.15)]"
      >
        {/* Background track */}
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS}
          fill="none"
          stroke="#2A2A2A"
          strokeWidth={GAUGE_STROKE}
        />
        {/* Score arc */}
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
          strokeDasharray={GAUGE_CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Score number */}
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-[#F0EDE4] font-mono text-[2rem] font-bold"
        >
          {clampedScore}
        </text>
        {/* "/ 100" subscript */}
        <text
          x="50%"
          y="68%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-[#6B6860] font-mono text-[0.6rem]"
        >
          / 100
        </text>
      </svg>
      <span
        data-testid="score-label"
        className="font-mono text-[0.65rem] font-semibold uppercase tracking-widest"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Issue type summary row ──────────────────────────────────── */

function IssueSummaryRow({
  type,
  count,
}: {
  type: QualityIssue["type"];
  count: number;
}) {
  const config = ISSUE_CONFIG[type];
  return (
    <div
      data-testid={`issue-summary-${type}`}
      className="flex items-center justify-between gap-2"
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded ${config.bgColor} font-mono text-xs ${config.color}`}
        >
          {config.icon}
        </span>
        <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[#A09D93]">
          {config.label}
        </span>
      </div>
      <span className={`font-mono text-xs font-semibold ${config.color}`}>
        {count}
      </span>
    </div>
  );
}

/* ── Loading skeleton ────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div data-testid="quality-loading" className="animate-pulse space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-[#2A2A2A]" />
        <div className="h-3 w-16 rounded bg-[#2A2A2A]" />
      </div>
      <div className="mx-auto h-[120px] w-[120px] rounded-full bg-[#2A2A2A]" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-[#2A2A2A]" />
        <div className="h-3 w-full rounded bg-[#2A2A2A]" />
        <div className="h-3 w-3/4 rounded bg-[#2A2A2A]" />
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */

function QualityScoreCard({
  score,
  issues,
  rowCount,
  columnCount,
  tableName,
  className,
  loading,
}: QualityScoreCardProps) {
  if (loading) {
    return (
      <div
        data-testid="quality-score-card"
        className={`rounded-md border border-[#2A2A2A] bg-[#141414] ${className ?? ""}`}
      >
        <LoadingSkeleton />
      </div>
    );
  }

  // Group issues by type and count
  const issueCounts: Record<QualityIssue["type"], number> = {
    nulls: 0,
    duplicates: 0,
    type_mismatch: 0,
    outliers: 0,
  };
  for (const issue of issues) {
    issueCounts[issue.type]++;
  }

  // Filter to only types with issues
  const activeTypes = (
    Object.keys(issueCounts) as QualityIssue["type"][]
  ).filter((t) => issueCounts[t] > 0);

  return (
    <div
      data-testid="quality-score-card"
      className={`rounded-md border border-[#2A2A2A] bg-[#141414] transition-colors hover:border-[#3A3A3A] ${className ?? ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-5 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#F0EDE4]">
            Data Quality
          </h3>
          {tableName && (
            <span className="font-mono text-[0.65rem] text-[#6B6860]">
              {tableName}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <span
            data-testid="row-count"
            className="font-mono text-[0.65rem] text-[#6B6860]"
          >
            {rowCount.toLocaleString()} rows
          </span>
          <span
            data-testid="column-count"
            className="font-mono text-[0.65rem] text-[#6B6860]"
          >
            {columnCount} cols
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Score gauge + issue summary side by side */}
        <div className="flex items-start gap-6">
          {/* Gauge */}
          <div className="shrink-0">
            <ScoreGauge score={score} />
          </div>

          {/* Issue counts breakdown */}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
            {activeTypes.length > 0 ? (
              activeTypes.map((type) => (
                <IssueSummaryRow
                  key={type}
                  type={type}
                  count={issueCounts[type]}
                />
              ))
            ) : (
              <p
                data-testid="no-issues"
                className="pt-4 text-center font-mono text-[0.7rem] text-[#4ADE80]"
              >
                No issues detected
              </p>
            )}
          </div>
        </div>

        {/* Suggestions — actionable descriptions from each issue */}
        {issues.length > 0 && (
          <div data-testid="suggestions" className="mt-5 space-y-2">
            <h4 className="font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-[#6B6860]">
              Suggestions
            </h4>
            <ul className="space-y-1.5">
              {issues.map((issue, i) => {
                const config = ISSUE_CONFIG[issue.type];
                return (
                  <li
                    key={`${issue.type}-${issue.column ?? "all"}-${i}`}
                    className="flex items-start gap-2 text-[0.8rem] leading-relaxed text-[#A09D93]"
                  >
                    <span
                      className={`mt-0.5 shrink-0 font-mono text-[0.6rem] ${config.color}`}
                    >
                      {config.icon}
                    </span>
                    <span>{issue.description}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export type { QualityIssue, QualityScoreCardProps };
export default QualityScoreCard;
