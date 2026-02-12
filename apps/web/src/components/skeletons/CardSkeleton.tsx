/**
 * Props for the CardSkeleton component.
 */
export interface CardSkeletonProps {
  /** Whether to show a header section */
  showHeader?: boolean;
  /** Number of content lines to show */
  lines?: number;
  /** Whether to show a footer/action section */
  showFooter?: boolean;
}

/**
 * A skeleton loading state for card components.
 *
 * Provides a placeholder card with animated content
 * that matches typical card layouts in the application.
 *
 * Design follows regulatory document aesthetic:
 * - Clean borders and subtle shadows
 * - Slate gray backgrounds for skeleton elements
 * - Clear visual hierarchy
 */
export function CardSkeleton({
  showHeader = true,
  lines = 3,
  showFooter = false,
}: CardSkeletonProps) {
  return (
    <div className="bg-white border border-slate-200 rounded animate-pulse">
      {showHeader && (
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="h-5 w-1/3 bg-slate-200 rounded" />
        </div>
      )}
      <div className="p-4">
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, index) => (
            <div key={index}>
              <div
                className={`h-4 bg-slate-200 rounded ${
                  index === 0 ? 'w-3/4' : index === 1 ? 'w-1/2' : 'w-2/3'
                }`}
              />
            </div>
          ))}
        </div>
      </div>
      {showFooter && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
          <div className="h-4 w-1/4 bg-slate-200 rounded" />
        </div>
      )}
    </div>
  );
}

/**
 * Props for the FormSkeleton component.
 */
export interface FormSkeletonProps {
  /** Number of form fields to show */
  fields?: number;
  /** Whether to show action buttons at the bottom */
  showActions?: boolean;
}

/**
 * A skeleton loading state for form components.
 *
 * Provides placeholder form fields with labels
 * during data loading states.
 */
export function FormSkeleton({
  fields = 4,
  showActions = true,
}: FormSkeletonProps) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index}>
          <div className="h-3 w-20 bg-slate-200 rounded mb-2" />
          <div className="h-10 w-full bg-slate-100 rounded border border-slate-200" />
        </div>
      ))}
      {showActions && (
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-6">
          <div className="h-9 w-20 bg-slate-200 rounded" />
          <div className="h-9 w-24 bg-slate-300 rounded" />
        </div>
      )}
    </div>
  );
}

/**
 * Props for the ListItemSkeleton component.
 */
export interface ListItemSkeletonProps {
  /** Whether to show an icon/avatar placeholder */
  showIcon?: boolean;
  /** Whether to show an action button on the right */
  showAction?: boolean;
}

/**
 * A skeleton loading state for list items.
 *
 * Provides a placeholder list item with flexible layout
 * options for different list types.
 */
export function ListItemSkeleton({
  showIcon = false,
  showAction = false,
}: ListItemSkeletonProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      {showIcon && (
        <div className="w-8 h-8 bg-slate-200 rounded-full flex-shrink-0" />
      )}
      <div className="flex-1">
        <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
        <div className="h-3 w-1/2 bg-slate-100 rounded" />
      </div>
      {showAction && (
        <div className="h-5 w-16 bg-slate-200 rounded flex-shrink-0" />
      )}
    </div>
  );
}

/**
 * Props for the DashboardWidgetSkeleton component.
 */
export interface DashboardWidgetSkeletonProps {
  /** Title for the widget header */
  title: string;
  /** Number of items to show in the widget */
  items?: number;
  /** Whether to show icons for each item */
  showIcons?: boolean;
}

/**
 * A skeleton loading state for dashboard widgets.
 *
 * Provides a consistent loading experience for
 * dashboard widget components.
 */
export function DashboardWidgetSkeleton({
  title,
  items = 3,
  showIcons = false,
}: DashboardWidgetSkeletonProps) {
  return (
    <section className="bg-white border border-slate-200 rounded">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: items }).map((_, index) => (
          <ListItemSkeleton key={index} showIcon={showIcons} showAction />
        ))}
      </div>
    </section>
  );
}
