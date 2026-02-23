import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import type { DashboardCardConfig } from "@/components/dashboard/DashboardGrid";
import DashboardCard from "@/components/dashboard/DashboardCard";
import CardRenderer from "@/components/dashboard/CardRenderer";
import ChartConfigDialog from "@/components/dashboard/ChartConfigDialog";
import FilterBar from "@/components/dashboard/FilterBar";
import { FiltersProvider, useFiltersOptional } from "@/hooks/useFilters";
import useDashboardCards from "@/hooks/useDashboardCards";
import useDashboardPersistence from "@/hooks/useDashboardPersistence";

function DashboardPageInner() {
  const { id } = useParams<{ id: string }>();

  const {
    cards,
    layout,
    addCard,
    updateCard,
    removeCard,
    onLayoutChange,
    setCards,
    setLayout,
  } = useDashboardCards();

  const { filters, values } = useFiltersOptional();

  const {
    dashboard,
    loading,
    error,
    dirty,
    saving,
    save,
  } = useDashboardPersistence(
    id,
    cards,
    layout,
    filters,
    values,
    setCards,
    setLayout,
  );

  const [editMode, setEditMode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<DashboardCardConfig | null>(
    null,
  );

  const handleAddCard = useCallback(() => {
    setEditingCard(null);
    setDialogOpen(true);
  }, []);

  const handleEditCard = useCallback((config: DashboardCardConfig) => {
    setEditingCard(config);
    setDialogOpen(true);
  }, []);

  const handleDialogSave = useCallback(
    (config: Omit<DashboardCardConfig, "id">) => {
      if (editingCard) {
        updateCard(editingCard.id, config);
      } else {
        addCard(config);
      }
      setDialogOpen(false);
      setEditingCard(null);
    },
    [editingCard, addCard, updateCard],
  );

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setEditingCard(null);
  }, []);

  const handleRemoveCard = useCallback(
    (cardId: string) => {
      removeCard(cardId);
    },
    [removeCard],
  );

  const renderCard = useCallback(
    (card: DashboardCardConfig) => (
      <DashboardCard
        config={card}
        editMode={editMode}
        onSettings={handleEditCard}
        onRemove={handleRemoveCard}
      >
        <CardRenderer config={card} />
      </DashboardCard>
    ),
    [editMode, handleEditCard, handleRemoveCard],
  );

  if (loading) {
    return (
      <div
        data-testid="dashboard-loading"
        className="flex h-full items-center justify-center"
      >
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div
        data-testid="dashboard-error"
        className="flex h-full items-center justify-center"
      >
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const dashboardName = dashboard?.name ?? "New Dashboard";

  return (
    <div data-testid="dashboard-page" className="flex h-full flex-col">
      {/* Header */}
      <div
        data-testid="dashboard-header"
        className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3"
      >
        <div className="min-w-0">
          <h1
            data-testid="dashboard-title"
            className="text-lg font-semibold text-gray-900"
          >
            {dashboardName}
          </h1>
          {id && (
            <p
              data-testid="dashboard-id"
              className="text-xs text-gray-500"
            >
              {id}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save status indicator */}
          {id && (
            <span
              data-testid="save-status"
              className="text-xs text-gray-400"
            >
              {saving
                ? "Saving..."
                : dirty
                  ? "Unsaved changes"
                  : "Saved"}
            </span>
          )}
          {/* Immediate save button */}
          {id && dirty && (
            <button
              data-testid="save-button"
              type="button"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={saving}
              onClick={() => void save()}
            >
              Save
            </button>
          )}
          {editMode && (
            <button
              data-testid="add-card-button"
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              onClick={handleAddCard}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              Add Card
            </button>
          )}
          <button
            data-testid="edit-mode-toggle"
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              editMode
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setEditMode((prev) => !prev)}
          >
            {editMode ? "Done Editing" : "Edit"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          data-testid="dashboard-save-error"
          className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Filter bar */}
      <FilterBar editMode={editMode} />

      {/* Grid area */}
      <div className="flex-1 overflow-auto p-6">
        {cards.length === 0 ? (
          <div
            data-testid="dashboard-empty"
            className="flex h-full flex-col items-center justify-center text-center"
          >
            <svg
              className="mb-4 h-12 w-12 text-gray-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-600">
              No cards yet
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Click Edit and then Add Card to get started
            </p>
          </div>
        ) : (
          <DashboardGrid
            layout={layout}
            cards={cards}
            editMode={editMode}
            onLayoutChange={onLayoutChange}
            renderCard={renderCard}
          />
        )}
      </div>

      {/* Chart config dialog */}
      <ChartConfigDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={handleDialogSave}
        initialConfig={editingCard ?? undefined}
      />
    </div>
  );
}

function DashboardPage() {
  return (
    <FiltersProvider>
      <DashboardPageInner />
    </FiltersProvider>
  );
}

export default DashboardPage;
