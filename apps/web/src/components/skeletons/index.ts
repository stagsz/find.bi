/**
 * Skeleton components for loading states.
 *
 * These components provide visual placeholders during data fetching,
 * maintaining the layout structure and improving perceived performance.
 *
 * All skeletons follow the regulatory document design aesthetic:
 * - Subtle slate gray backgrounds
 * - Clean borders and consistent spacing
 * - Smooth pulse animation
 */

export { TableRowSkeleton, TableSkeleton } from './TableRowSkeleton';
export type { TableRowSkeletonProps, TableSkeletonProps } from './TableRowSkeleton';

export {
  CardSkeleton,
  FormSkeleton,
  ListItemSkeleton,
  DashboardWidgetSkeleton,
} from './CardSkeleton';
export type {
  CardSkeletonProps,
  FormSkeletonProps,
  ListItemSkeletonProps,
  DashboardWidgetSkeletonProps,
} from './CardSkeleton';

export {
  ChartSkeleton,
  MetricCardSkeleton,
  RiskMatrixSkeleton,
} from './ChartSkeleton';
export type {
  ChartSkeletonProps,
  MetricCardSkeletonProps,
  RiskMatrixSkeletonProps,
} from './ChartSkeleton';
