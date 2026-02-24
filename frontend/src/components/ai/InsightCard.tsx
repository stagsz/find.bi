/**
 * InsightCard — renders a single AI-generated insight with severity-coded
 * left-border accent, type badge, title, description, and optional metrics.
 *
 * Follows the find.bi retro-futuristic editorial aesthetic:
 * dark surface (#141414), amber accents (#F5A623), hot pink for anomalies (#E84393).
 */

/** Data shape returned by the insight generation service. */
interface Insight {
  type: "trend" | "anomaly" | "correlation" | "outlier";
  title: string;
  description: string;
  severity: "info" | "warning" | "important";
  table?: string;
  columns?: string[];
  metrics?: Record<string, number>;
}

interface InsightCardProps {
  insight: Insight;
  className?: string;
}

const SEVERITY_STYLES: Record<
  Insight["severity"],
  { border: string; badge: string; badgeText: string }
> = {
  info: {
    border: "border-l-[#6B6860]",
    badge: "bg-[#6B6860]/20 text-[#A09D93]",
    badgeText: "info",
  },
  warning: {
    border: "border-l-[#F5A623]",
    badge: "bg-[#F5A623]/15 text-[#F5A623]",
    badgeText: "warning",
  },
  important: {
    border: "border-l-[#E84393]",
    badge: "bg-[#E84393]/15 text-[#E84393]",
    badgeText: "important",
  },
};

const TYPE_LABELS: Record<Insight["type"], string> = {
  trend: "TREND",
  anomaly: "ANOMALY",
  correlation: "CORRELATION",
  outlier: "OUTLIER",
};

function InsightCard({ insight, className }: InsightCardProps) {
  const severity = SEVERITY_STYLES[insight.severity];

  return (
    <div
      data-testid="insight-card"
      className={`rounded-md border border-[#2A2A2A] border-l-2 bg-[#141414] p-4 transition-colors hover:border-[#3A3A3A] ${severity.border} ${className ?? ""}`}
    >
      {/* Header: type badge + severity badge */}
      <div className="mb-2 flex items-center gap-2">
        <span
          data-testid="insight-type"
          className="inline-block rounded bg-[#F5A623]/10 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-[#F5A623]"
        >
          {TYPE_LABELS[insight.type]}
        </span>
        <span
          data-testid="insight-severity"
          className={`inline-block rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-widest ${severity.badge}`}
        >
          {severity.badgeText}
        </span>
      </div>

      {/* Title */}
      <h3
        data-testid="insight-title"
        className="mb-1 text-sm font-semibold leading-snug text-[#F0EDE4]"
      >
        {insight.title}
      </h3>

      {/* Description */}
      <p
        data-testid="insight-description"
        className="text-[0.8rem] leading-relaxed text-[#6B6860]"
      >
        {insight.description}
      </p>

      {/* Columns tags */}
      {insight.columns && insight.columns.length > 0 && (
        <div data-testid="insight-columns" className="mt-3 flex flex-wrap gap-1.5">
          {insight.columns.map((col) => (
            <span
              key={col}
              className="inline-block rounded border border-[#2A2A2A] bg-[#1C1C1C] px-1.5 py-0.5 font-mono text-[0.65rem] text-[#A09D93]"
            >
              {col}
            </span>
          ))}
        </div>
      )}

      {/* Metrics */}
      {insight.metrics && Object.keys(insight.metrics).length > 0 && (
        <div data-testid="insight-metrics" className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(insight.metrics).map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-1.5">
              <span className="font-mono text-[0.65rem] uppercase tracking-wider text-[#6B6860]">
                {key}
              </span>
              <span className="font-mono text-xs font-semibold text-[#F5A623]">
                {typeof value === "number" && !Number.isInteger(value)
                  ? value.toFixed(2)
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { Insight, InsightCardProps };
export default InsightCard;
