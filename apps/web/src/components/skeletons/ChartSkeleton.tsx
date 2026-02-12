/**
 * Props for the ChartSkeleton component.
 */
export interface ChartSkeletonProps {
  /** Type of chart to simulate */
  type?: 'pie' | 'bar' | 'line';
  /** Height of the chart area */
  height?: number;
}

/**
 * A skeleton loading state for chart components.
 *
 * Provides placeholder visuals that match different chart types
 * during data loading states.
 */
export function ChartSkeleton({
  type = 'bar',
  height = 200,
}: ChartSkeletonProps) {
  if (type === 'pie') {
    return (
      <div
        className="flex items-center justify-center animate-pulse"
        style={{ height }}
      >
        <div className="w-32 h-32 bg-slate-200 rounded-full" />
      </div>
    );
  }

  if (type === 'line') {
    return (
      <div
        className="flex items-end gap-2 px-4 animate-pulse"
        style={{ height }}
      >
        {/* Simulated line chart with varying heights */}
        {Array.from({ length: 12 }).map((_, index) => {
          const heightPercent = 30 + Math.sin(index * 0.5) * 40;
          return (
            <div
              key={index}
              className="flex-1 bg-slate-200 rounded-t"
              style={{ height: `${heightPercent}%` }}
            />
          );
        })}
      </div>
    );
  }

  // Bar chart (default)
  return (
    <div
      className="flex items-end gap-2 px-4 animate-pulse"
      style={{ height }}
    >
      {Array.from({ length: 8 }).map((_, index) => {
        const heightPercent = 20 + Math.random() * 60;
        return (
          <div
            key={index}
            className="flex-1 bg-slate-200 rounded-t"
            style={{ height: `${heightPercent}%` }}
          />
        );
      })}
    </div>
  );
}

/**
 * Props for the MetricCardSkeleton component.
 */
export interface MetricCardSkeletonProps {
  /** Whether to show a trend indicator */
  showTrend?: boolean;
}

/**
 * A skeleton loading state for metric/KPI cards.
 *
 * Provides placeholder content for numeric metrics
 * typically shown on dashboards.
 */
export function MetricCardSkeleton({
  showTrend = true,
}: MetricCardSkeletonProps) {
  return (
    <div className="bg-white border border-slate-200 rounded p-4 animate-pulse">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
        <div className="h-3 w-20 bg-slate-200 rounded" />
      </div>
      <div className="flex items-baseline gap-2">
        <div className="h-8 w-16 bg-slate-300 rounded" />
        {showTrend && (
          <div className="h-4 w-12 bg-slate-100 rounded" />
        )}
      </div>
    </div>
  );
}

/**
 * Props for the RiskMatrixSkeleton component.
 */
export interface RiskMatrixSkeletonProps {
  /** Size of the matrix (5x5 default) */
  size?: number;
}

/**
 * A skeleton loading state for the 5x5 risk matrix.
 *
 * Provides a grid placeholder that matches the
 * risk matrix visualization structure.
 */
export function RiskMatrixSkeleton({
  size = 5,
}: RiskMatrixSkeletonProps) {
  return (
    <div className="animate-pulse">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }).map((_, index) => (
          <div
            key={index}
            className="aspect-square bg-slate-200 rounded"
          />
        ))}
      </div>
      {/* Axis labels */}
      <div className="flex justify-between mt-2">
        <div className="h-3 w-20 bg-slate-100 rounded" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
      </div>
    </div>
  );
}
