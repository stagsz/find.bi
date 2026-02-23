import type { DashboardCardConfig } from "./DashboardGrid";

export interface DashboardCardProps {
  /** Card configuration */
  config: DashboardCardConfig;
  /** Whether the dashboard is in edit mode */
  editMode?: boolean;
  /** Called when user clicks the settings icon */
  onSettings?: (config: DashboardCardConfig) => void;
  /** Called when user clicks the remove button */
  onRemove?: (id: string) => void;
  /** Chart or content to render inside the card */
  children?: React.ReactNode;
}

function DashboardCard({
  config,
  editMode = false,
  onSettings,
  onRemove,
  children,
}: DashboardCardProps) {
  return (
    <div data-testid={`dashboard-card-${config.id}`} className="flex h-full flex-col">
      {/* Title bar */}
      <div
        data-testid={`card-title-bar-${config.id}`}
        className={`flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2${editMode ? " dashboard-card-drag-handle cursor-grab" : ""}`}
      >
        {editMode && (
          <svg
            data-testid={`card-drag-icon-${config.id}`}
            className="h-4 w-4 flex-shrink-0 text-gray-400"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        )}

        <span
          data-testid={`card-title-${config.id}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700"
        >
          {config.title}
        </span>

        {editMode && (
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              data-testid={`card-settings-${config.id}`}
              type="button"
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              onClick={() => onSettings?.(config)}
              aria-label={`Settings for ${config.title}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 0 1 1.262.125l.962.962a1 1 0 0 1 .125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.295a1 1 0 0 1 .804.98v1.361a1 1 0 0 1-.804.98l-1.473.295a6.95 6.95 0 0 1-.587 1.416l.834 1.25a1 1 0 0 1-.125 1.262l-.962.962a1 1 0 0 1-1.262.125l-1.25-.834a6.953 6.953 0 0 1-1.416.587l-.295 1.473a1 1 0 0 1-.98.804H9.32a1 1 0 0 1-.98-.804l-.295-1.473a6.957 6.957 0 0 1-1.416-.587l-1.25.834a1 1 0 0 1-1.262-.125l-.962-.962a1 1 0 0 1-.125-1.262l.834-1.25a6.957 6.957 0 0 1-.587-1.416l-1.473-.295A1 1 0 0 1 1 10.68V9.32a1 1 0 0 1 .804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 0 1 .125-1.262l.962-.962A1 1 0 0 1 5.38 3.23l1.25.834a6.957 6.957 0 0 1 1.416-.587l.295-1.473ZM13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              data-testid={`card-remove-${config.id}`}
              type="button"
              className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
              onClick={() => onRemove?.(config.id)}
              aria-label={`Remove ${config.title}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div
        data-testid={`card-content-${config.id}`}
        className="relative min-h-0 flex-1 overflow-auto"
      >
        {children ?? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No content
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardCard;
