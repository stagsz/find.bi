/**
 * useDashboardPersistence — loads a dashboard from the API on mount,
 * then auto-saves layout/cards/filters changes with a 2-second debounce.
 * Also exposes a `save` function for immediate saves.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { DashboardCardConfig, LayoutItem } from "@/components/dashboard/DashboardGrid";
import type { FilterConfig, FilterValue } from "@/hooks/useFilters";
import {
  getDashboard,
  updateDashboard,
} from "@/services/dashboards";
import type { DashboardDTO } from "@/services/dashboards";

const AUTO_SAVE_DELAY = 2000;

export interface DashboardPersistenceState {
  /** Dashboard metadata from the API */
  dashboard: DashboardDTO | null;
  /** Whether the initial load is in progress */
  loading: boolean;
  /** Error from load or save */
  error: string | null;
  /** Whether there are unsaved changes */
  dirty: boolean;
  /** Whether a save is currently in flight */
  saving: boolean;
  /** Trigger an immediate save */
  save: () => Promise<void>;
}

export default function useDashboardPersistence(
  dashboardId: string | undefined,
  cards: DashboardCardConfig[],
  layout: LayoutItem[],
  filters: FilterConfig[],
  filterValues: Record<string, FilterValue>,
  setCards: (cards: DashboardCardConfig[]) => void,
  setLayout: (layout: LayoutItem[]) => void,
): DashboardPersistenceState {
  const [dashboard, setDashboard] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Track whether the initial load has completed so we don't auto-save
  // the empty initial state.
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest values in refs so the save function always sees current data.
  const cardsRef = useRef(cards);
  const layoutRef = useRef(layout);
  const filtersRef = useRef(filters);
  const filterValuesRef = useRef(filterValues);
  cardsRef.current = cards;
  layoutRef.current = layout;
  filtersRef.current = filters;
  filterValuesRef.current = filterValues;

  // --- Load on mount ---

  useEffect(() => {
    if (!dashboardId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadedRef.current = false;

    getDashboard(dashboardId)
      .then((dto) => {
        if (cancelled) return;
        setDashboard(dto);

        // Hydrate card and layout state from the API response
        const savedCards = (dto.cards_json as { cards?: DashboardCardConfig[] })
          ?.cards ?? [];
        const savedLayout = (dto.layout_json as { items?: LayoutItem[] })
          ?.items ?? [];

        setCards(savedCards);
        setLayout(savedLayout);

        // Mark as loaded AFTER a tick so the state updates above
        // don't trigger an auto-save.
        setTimeout(() => {
          if (!cancelled) loadedRef.current = true;
        }, 0);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { detail?: string } } }).response?.data
            ?.detail ?? "Failed to load dashboard";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardId, setCards, setLayout]);

  // --- Persist function ---

  const persistNow = useCallback(async () => {
    if (!dashboardId || !loadedRef.current) return;
    setSaving(true);
    setError(null);
    try {
      const dto = await updateDashboard(dashboardId, {
        layout_json: { items: layoutRef.current },
        cards_json: { cards: cardsRef.current },
        filters_json: {
          filters: filtersRef.current,
          values: filterValuesRef.current,
        },
      });
      setDashboard(dto);
      setDirty(false);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? "Failed to save dashboard";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [dashboardId]);

  // --- Auto-save on changes (debounced) ---

  useEffect(() => {
    if (!loadedRef.current || !dashboardId) return;
    setDirty(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persistNow();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cards, layout, filters, filterValues, dashboardId, persistNow]);

  // --- Public save (immediate) ---

  const save = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await persistNow();
  }, [persistNow]);

  return { dashboard, loading, error, dirty, saving, save };
}

export { AUTO_SAVE_DELAY };
