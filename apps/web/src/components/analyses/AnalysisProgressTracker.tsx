/**
 * Analysis progress tracker component.
 *
 * Displays analysis progress showing:
 * - Nodes analyzed vs total nodes
 * - Progress bar visualization
 * - Risk distribution counts (high/medium/low)
 *
 * Designed for the analysis workspace header, providing at-a-glance
 * progress visibility for the current HazOps analysis session.
 */

interface AnalysisProgressTrackerProps {
  /** Total number of nodes in the P&ID document */
  totalNodes: number;

  /** Number of nodes with at least one analysis entry */
  analyzedNodes: number;

  /** Total number of analysis entries created */
  totalEntries: number;

  /** Number of entries classified as high risk */
  highRiskCount: number;

  /** Number of entries classified as medium risk */
  mediumRiskCount: number;

  /** Number of entries classified as low risk */
  lowRiskCount: number;

  /** Optional className for additional styling */
  className?: string;
}

/**
 * Compact progress tracker for the analysis workspace.
 * Shows node completion status and risk distribution.
 */
export function AnalysisProgressTracker({
  totalNodes,
  analyzedNodes,
  totalEntries,
  highRiskCount,
  mediumRiskCount,
  lowRiskCount,
  className = '',
}: AnalysisProgressTrackerProps) {
  // Calculate progress percentage
  const progressPercent = totalNodes > 0 ? Math.round((analyzedNodes / totalNodes) * 100) : 0;

  // Determine if there are any risk assessments
  const hasRiskData = highRiskCount > 0 || mediumRiskCount > 0 || lowRiskCount > 0;

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Node Progress Section */}
      <div className="flex items-center gap-2">
        {/* Progress indicator */}
        <div className="flex items-center gap-1.5">
          {/* Progress bar */}
          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {/* Node count */}
          <span className="text-xs font-medium text-slate-600">
            {analyzedNodes}/{totalNodes} nodes
          </span>
        </div>
      </div>

      {/* Divider */}
      {totalEntries > 0 && (
        <div className="w-px h-4 bg-slate-300" />
      )}

      {/* Entries count */}
      {totalEntries > 0 && (
        <span className="text-xs text-slate-500">
          {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}
        </span>
      )}

      {/* Risk Distribution Section - only shown when there's risk data */}
      {hasRiskData && (
        <>
          {/* Divider */}
          <div className="w-px h-4 bg-slate-300" />

          {/* Risk counts */}
          <div className="flex items-center gap-2">
            {highRiskCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-slate-600">{highRiskCount}</span>
              </span>
            )}
            {mediumRiskCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-600">{mediumRiskCount}</span>
              </span>
            )}
            {lowRiskCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-slate-600">{lowRiskCount}</span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
